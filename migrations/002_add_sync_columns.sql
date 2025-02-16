-- Agregar columnas de sincronización a la tabla personal
ALTER TABLE personal
ADD COLUMN sync_status INTEGER DEFAULT 0;

ALTER TABLE personal
ADD COLUMN last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE personal
ADD COLUMN deleted INTEGER DEFAULT 0;

-- Agregar columnas de sincronización a la tabla registros
ALTER TABLE registros
ADD COLUMN sync_status INTEGER DEFAULT 0;

ALTER TABLE registros
ADD COLUMN last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE registros
ADD COLUMN deleted INTEGER DEFAULT 0;