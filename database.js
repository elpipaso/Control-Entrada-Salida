const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const fs = require('fs');

// Configuración condicional para Electron
let DB_PATH;
try {
  const { app } = require('electron');
  DB_PATH = path.join(app.getPath('userData'), 'control-cuartel.db');
} catch (error) {
  DB_PATH = path.join(__dirname, 'local-data.db');
}

let db = null;

const crearTablaUsuarios = () => {
  return executeQuery(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_completo TEXT NOT NULL,
      rut TEXT UNIQUE NOT NULL,
      cargo TEXT CHECK(cargo IN ('Bombero', 'Aspirante')) NOT NULL,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const validarRUT = (rut) => {
  try {
    // Paso 1: Normalización del RUT
    const rutLimpio = rut
      .replace(/[^0-9kK-]/g, '') // Eliminar caracteres inválidos
      .toUpperCase()
      .replace(/-/g, ''); // Eliminar todos los guiones

    // Verificar longitud mínima
    if (rutLimpio.length < 8) {
      console.log('RUT demasiado corto');
      return false;
    }

    // Paso 2: Separar cuerpo y DV
    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);

    console.log('Procesando RUT:', {
      original: rut,
      limpio: rutLimpio,
      cuerpo: cuerpo,
      dv: dv
    });

    // Paso 3: Validar formato numérico
    if (!/^\d+$/.test(cuerpo)) {
      console.log('Cuerpo no numérico');
      return false;
    }

    // Paso 4: Cálculo del dígito verificador
    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
      multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }

    const dvCalculado = 11 - (suma % 11);
    const dvEsperado = dvCalculado === 11 ? '0' 
                     : dvCalculado === 10 ? 'K' 
                     : dvCalculado.toString();

    console.log('Resultado validación:', dv === dvEsperado);
    return dv === dvEsperado;

  } catch (error) {
    console.error('Error en validación RUT:', error);
    return false;
  }
};

const registrarPersona = async (nombre, rut) => {
  if (!validarRUT(rut)) throw new Error('RUT inválido');
  
  const uuid = uuidv4();
  return executeQuery(
    `INSERT INTO personal (uuid, nombre_completo, rut) 
     VALUES (?, ?, ?) 
     ON CONFLICT(rut) DO UPDATE SET 
       nombre_completo = excluded.nombre_completo,
       sync_status = 1,
       last_modified = CURRENT_TIMESTAMP`,
    [uuid, nombre, rut]
  );
};



const MIGRATIONS = [
    require('./migrations/001_initial_schema.sql'),
    require('./migrations/002_add_sync_columns.sql'),
    require('./migrations/003_add_device_info.sql')
];

const applyMigrations = async () => {
    const currentVersion = await getCurrentMigrationVersion();
    
    for (let version = currentVersion + 1; version <= MIGRATIONS.length; version++) {
        const migration = MIGRATIONS[version - 1];
        await executeMigration(version, migration);
    }
};

const getCurrentMigrationVersion = async () => {
    try {
        const result = await executeSelect('SELECT MAX(version) as version FROM migrations');
        return result[0].version || 0;
    } catch (error) {
        await executeQuery('CREATE TABLE migrations (version INTEGER PRIMARY KEY)');
        return 0;
    }
};

const executeMigration = async (version, sql) => {
    await executeQuery('BEGIN TRANSACTION');
    try {
        // Ejecutar cada sentencia del archivo SQL
        const statements = sql.split(';').filter(s => s.trim());
        for (const statement of statements) {
            await executeQuery(statement);
        }
        
        await executeQuery('INSERT INTO migrations (version) VALUES (?)', [version]);
        await executeQuery('COMMIT');
    } catch (error) {
        await executeQuery('ROLLBACK');
        throw error;
    }
};

const initializeDB = () => {
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return console.error('Error opening database:', err.message);
    
    db.serialize(() => {
      // Crear todas las tablas
      db.run(`
        CREATE TABLE IF NOT EXISTS personal (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE,
          nombre_completo TEXT NOT NULL,
          rut TEXT NOT NULL UNIQUE,
          sync_status INTEGER DEFAULT 0,
          last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted INTEGER DEFAULT 0
        )`);
        
      db.run(`
        CREATE TABLE IF NOT EXISTS registros (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE,
          personal_id INTEGER,
          entrada TIMESTAMP,
          salida TIMESTAMP,
          duracion REAL,
          sync_status INTEGER DEFAULT 0,
          last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted INTEGER DEFAULT 0,
          FOREIGN KEY(personal_id) REFERENCES personal(id)
        )`);

      crearTablaUsuarios();
    });
  });
};

const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const executeSelect = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const registrarMovimiento = async (rut) => {
  const personal = await executeSelect(
    'SELECT id FROM personal WHERE rut = ?', 
    [rut.replace(/[.-]/g, '')]
  );
  
  if (!personal.length) throw new Error('RUT no registrado');
  
  const registroAbierto = await executeSelect(
    `SELECT uuid FROM registros 
     WHERE personal_id = ? AND salida IS NULL`,
    [personal[0].id]
  );

  const ahora = moment().format('YYYY-MM-DD HH:mm:ss');
  const uuid = uuidv4();

  if (registroAbierto.length) {
    const duracion = await executeSelect(
      `SELECT (julianday(?) - julianday(entrada)) * 24 AS horas 
       FROM registros WHERE uuid = ?`,
      [ahora, registroAbierto[0].uuid]
    );

    return executeQuery(
      `UPDATE registros SET 
       salida = ?, 
       duracion = ?,
       sync_status = 1,
       last_modified = CURRENT_TIMESTAMP
       WHERE uuid = ?`,
      [ahora, duracion[0].horas, registroAbierto[0].uuid]
    );
  }

  return executeQuery(
    `INSERT INTO registros (uuid, personal_id, entrada) 
     VALUES (?, ?, ?)`,
    [uuid, personal[0].id, ahora]
  );
};

const getPendingSync = () => {
  return executeSelect(`
    SELECT 
      'personal' as table_name,
      uuid,
      nombre_completo as nombre,
      rut,
      deleted,
      last_modified,
      NULL as entrada,  -- Columnas adicionales para igualar
      NULL as salida,
      NULL as duracion
    FROM personal 
    WHERE sync_status = 0
    
    UNION ALL
    
    SELECT 
      'registros' as table_name,
      uuid,
      NULL as nombre,   -- Ajustar para igualar
      NULL as rut,
      deleted,
      last_modified,
      entrada,
      salida,
      duracion
    FROM registros 
    WHERE sync_status = 0
  `);
};
const registrarUsuario = async (nombre, rut, cargo) => {
  if (!validarRUT(rut)) throw new Error('RUT inválido');
  
  try {
    // Verificar si el RUT ya existe
    const existe = await executeSelect(
      'SELECT id FROM usuarios WHERE rut = ? LIMIT 1',
      [rut.replace(/[.-]/g, '')]
    );
    
    if (existe.length > 0) throw new Error('RUT ya registrado');

    // Insertar nuevo usuario
    const result = await executeQuery(
      `INSERT INTO usuarios (nombre_completo, rut, cargo)
       VALUES (?, ?, ?)`,
      [nombre, rut.replace(/[.-]/g, ''), cargo]
    );

    return { 
      success: true,
      id: result.id,
      message: 'Registro exitoso' 
    };
  } catch (error) {
    throw error;
  }
};

const applyServerChanges = async (changes) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      changes.forEach(change => {
        const { table, operation, data } = change;
        const query = operation === 'delete' ? 
          `UPDATE ${table} SET deleted = 1 WHERE uuid = ?` :
          `INSERT OR REPLACE INTO ${table} 
           (${Object.keys(data).join(', ')}) 
           VALUES (${Object.keys(data).map(() => '?').join(', ')})`;

        db.run(query, Object.values(data), (err) => {
          if (err) reject(err);
        });
      });

      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};


module.exports = {
  initialize: initializeDB,
  validarRUT,
  registrarPersona,
  registrarMovimiento,
  registrarUsuario,
  getPendingSync,
  applyServerChanges,
  executeQuery,
  executeSelect
};