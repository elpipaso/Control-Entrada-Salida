-- Tabla principal de personal
CREATE TABLE IF NOT EXISTS personal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_completo TEXT NOT NULL,
    rut TEXT UNIQUE NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de registros de entrada/salida
CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personal_id INTEGER NOT NULL,
    entrada TIMESTAMP NOT NULL,
    salida TIMESTAMP,
    FOREIGN KEY(personal_id) REFERENCES personal(id)
);

-- Tabla para control de migraciones
CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);