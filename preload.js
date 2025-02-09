const { contextBridge, ipcRenderer } = require('electron');
const { validarRUT } = require('../main/database');

// Expone una API segura y limitada al renderer
contextBridge.exposeInMainWorld('api', {
    // Sistema de sincronización
    sync: {
        now: () => ipcRenderer.invoke('sync-now'),
        status: () => ipcRenderer.invoke('get-sync-status'),
        onUpdate: (callback) => ipcRenderer.on('sync-update', callback)
    },
    
    // Autenticación y seguridad
    auth: {
        login: (credentials) => ipcRenderer.invoke('login', credentials),
        logout: () => ipcRenderer.invoke('logout'),
        getSession: () => ipcRenderer.invoke('get-session')
    },
    
    // Operaciones con personal
    personal: {
        search: (query) => ipcRenderer.invoke('search-personal', query),
        register: (data) => ipcRenderer.invoke('register-personal', data),
        validateRUT: (rut) => validarRUT(rut)
    },
    
    // Registros y movimientos
    registros: {
        logEntry: (rut) => ipcRenderer.invoke('log-entry', rut),
        getHistory: (options) => ipcRenderer.invoke('get-history', options),
        getLastEntries: (limit) => ipcRenderer.invoke('get-last-entries', limit)
    },
    
    // Estadísticas y reportes
    stats: {
        getChartData: () => ipcRenderer.invoke('get-chart-data'),
        generateReport: (params) => ipcRenderer.invoke('generate-report', params)
    },
    
    // Sistema de notificaciones
    notifications: {
        send: (title, message) => ipcRenderer.invoke('show-notification', title, message)
    },
    
    // Manejo de errores globales
    onError: (callback) => ipcRenderer.on('global-error', callback)
});

// Protección contra sobreescritura accidental
Object.defineProperty(window, 'api', {
    configurable: false,
    writable: false
});