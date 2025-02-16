const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const pdf = require('pdfkit');

// Configuración de la base de datos
const DB_PATH = path.join(__dirname, 'control-cuartel.db');
let db = null;

// Inicialización de la base de datos
const initializeDB = () => {
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return console.error('Error opening database:', err.message);
    
    db.serialize(() => {
      // Tabla de personal (solo RUT)
      db.run(`
        CREATE TABLE IF NOT EXISTS personal (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rut TEXT UNIQUE NOT NULL
        )`, (err) => {
          if (err) console.error("Error tabla personal:", err);
          else console.log("Tabla personal creada");
      });

      // Tabla de registros
      db.run(`
        CREATE TABLE IF NOT EXISTS registros (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          personal_id INTEGER,
          entrada TIMESTAMP,
          salida TIMESTAMP,
          duracion REAL,
          FOREIGN KEY(personal_id) REFERENCES personal(id)
        )`, (err) => {
          if (err) console.error("Error tabla registros:", err);
          else console.log("Tabla registros creada");
      });
    });
  });
};

const registrarRUT = async (rut) => {
  try {
    const result = await executeQuery(
      'INSERT INTO personal (rut) VALUES (?)',
      [rut]
    );
    return { id: result.id, mensaje: 'RUT registrado' };
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      const personal = await executeQuery(
        'SELECT id FROM personal WHERE rut = ?',
        [rut]
      );
      return { id: personal.id, mensaje: 'RUT ya registrado' };
    }
    throw error;
  }
};

// Registrar entrada/salida
const registrarMovimiento = async (rut) => {
  const personal = await executeQuery(
    'SELECT id FROM personal WHERE rut = ?',
    [rut]
  );

  if (!personal) throw new Error('Personal not found');

  const registroAbierto = await executeQuery(
    `SELECT id, entrada FROM registros 
     WHERE personal_id = ? AND salida IS NULL`,
    [personal.id]
  );

  const ahora = new Date().toISOString();

  if (registroAbierto) {
    // Registrar salida
    const duracion = (new Date() - new Date(registroAbierto.entrada)) / 3600000; // Horas
    return executeQuery(
      `UPDATE registros SET 
       salida = ?, 
       duracion = ?
       WHERE id = ?`,
      [ahora, duracion.toFixed(2), registroAbierto.id]
    );
  } else {
    // Registrar entrada
    return executeQuery(
      `INSERT INTO registros (personal_id, entrada) 
       VALUES (?, ?)`,
      [personal.id, ahora]
    );
  }
};

const obtenerHistorial = async (rut) => {
  const personal = await executeQuery(
    'SELECT id FROM personal WHERE rut = ?', 
    [rut]
  );
  
  return executeQuery(
    `SELECT entrada, salida, duracion 
     FROM registros 
     WHERE personal_id = ? 
     ORDER BY entrada DESC`,
    [personal.id]
  );
};

const generarReportePDF = async (reportes) => {
  const doc = new pdf();
  doc.pipe(fs.createWriteStream(reportes));

  // Obtener datos
  const personal = await executeQuery('SELECT * FROM personal');
  const registros = await executeQuery('SELECT * FROM registros');

  // Cabecera
  doc.fontSize(18).text('Reporte de Movimientos', { align: 'center' });
  doc.moveDown();

  // Listado de personal
  doc.fontSize(14).text('Personal Registrado:');
  personal.forEach((p, i) => {
    doc.fontSize(12).text(`${i + 1}. ${p.rut}`);
  });
  doc.moveDown();

  // Movimientos
  doc.fontSize(14).text('Últimos Movimientos:');
  registros.forEach((r, i) => {
    doc.fontSize(12)
      .text(`${i + 1}. RUT: ${r.personal_id} | Entrada: ${r.entrada} | Salida: ${r.salida || 'En cuartel'}`);
  });

  doc.end();
  return reportes;
};

const obtenerEstadisticas = async () => {
  const resultados = await executeQuery(`
    SELECT 
      p.rut,
      COUNT(r.id) AS total_movimientos,
      SUM(r.duracion) AS total_horas,
      AVG(r.duracion) AS promedio_horas
    FROM registros r
    JOIN personal p ON r.personal_id = p.id
    GROUP BY p.rut
  `);

  return resultados.map(r => ({
    rut: r.rut,
    totalMovimientos: r.total_movimientos,
    totalHoras: r.total_horas.toFixed(2),
    promedioHoras: r.promedio_horas.toFixed(2)
  }));
};

const generarGrafico = async () => {
  const datos = await obtenerEstadisticas();
  
  return {
    labels: datos.map(d => d.rut),
    datasets: [{
      label: 'Horas en Cuartel',
      data: datos.map(d => d.totalHoras),
      backgroundColor: 'rgba(54, 162, 235, 0.5)'
    }]
  };
};

// Funciones auxiliares
const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = {
  initialize: initializeDB,
  registrarRUT,
  registrarMovimiento,
  obtenerHistorial,
  generarReportePDF,
  generarGrafico
};