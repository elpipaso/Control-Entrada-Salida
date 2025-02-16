-- Tabla para información de dispositivos
CREATE TABLE IF NOT EXISTS device_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    last_sync TIMESTAMP,
    sync_interval INTEGER DEFAULT 300,  -- en segundos
    server_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar relación con registros
ALTER TABLE registros
ADD COLUMN device_id INTEGER REFERENCES device_info(id);