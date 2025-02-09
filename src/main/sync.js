const axios = require('axios');
const { app } = require('electron');
const { machineIdSync } = require('node-machine-id');
const database = require('../../database');
const { v4: uuidv4 } = require('uuid');

class SyncManager {
  constructor() {
    this.config = {
      serverUrl: 'https://tuserver.com/api',
      syncInterval: 5 * 60 * 1000, // 5 minutos
      deviceId: machineIdSync(),
      authToken: null
    };
    
    this.pendingOperations = [];
    this.isSyncing = false;
  }

  async initialize() {
    await this.loadConfig();
    setInterval(() => this.sync(), this.config.syncInterval);
  }

  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const changes = await database.getPendingSync();
      if (changes.length === 0) return;

      const response = await axios.post(
        `${this.config.serverUrl}/sync`,
        {
          deviceId: this.config.deviceId,
          operations: this.prepareOperations(changes)
        },
        { headers: this.getAuthHeaders() }
      );

      await database.applyServerChanges(response.data.changes);
      await this.markAsSynced(changes);
      
      this.emitSyncEvent({
        status: 'success',
        newEntries: response.data.changes.length
      });

    } catch (error) {
      this.handleSyncError(error);
    } finally {
      this.isSyncing = false;
    }
  }

  prepareOperations(changes) {
    return changes.map(change => ({
      uuid: change.uuid || uuidv4(),
      table: change.table_name,
      operation: change.deleted ? 'delete' : 'upsert',
      data: this.sanitizeData(change),
      timestamp: new Date().toISOString()
    }));
  }

  sanitizeData(change) {
    const baseData = {
      uuid: change.uuid,
      last_modified: change.last_modified,
      deleted: change.deleted || 0
    };

    if (change.table_name === 'personal') {
      return {
        ...baseData,
        nombre_completo: change.nombre,
        rut: change.rut
      };
    }

    return {
      ...baseData,
      personal_id: change.personal,
      entrada: change.entrada,
      salida: change.salida,
      duracion: change.duracion
    };
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.config.authToken}`,
      'X-Device-ID': this.config.deviceId
    };
  }

  async markAsSynced(changes) {
    const uuids = changes.map(c => c.uuid);
    await database.executeQuery(
      `UPDATE registros SET sync_status = 1 WHERE uuid IN (${uuids.map(() => '?').join(',')})`,
      uuids
    );
  }

  handleSyncError(error) {
    console.error('Sync error:', error);
    this.emitSyncEvent({
      status: 'error',
      message: error.message
    });
  }

  emitSyncEvent(data) {
    app.emit('sync-update', {
      ...data,
      lastSync: new Date().toISOString()
    });
  }

  async loadConfig() {
    // Implementar carga de configuración persistente
  }
}

module.exports = new SyncManager();