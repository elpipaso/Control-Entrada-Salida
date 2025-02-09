const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const database = require('./database');
const syncManager = require('./src/main/sync');

app.whenReady().then(async () => {
    await database.initialize();
    await syncManager.initialize();
    // ... resto de la inicialización
    });

// Configuración de la aplicación
const isDev = process.env.NODE_ENV === 'development';

// Manejar la creación/eliminación de ventanas
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: true
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false
    });

    // Cargar la aplicación
    mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

    // Mostrar ventana cuando esté lista
    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
        if (isDev) mainWindow.webContents.openDevTools();
    });

    // Manejar cierre
    mainWindow.on('closed', () => (mainWindow = null));
}

// Configurar IPC Main
function setupIPC() {
    // Sincronización
    ipcMain.handle('sync-now', async () => {
        await syncManager.sync();
        return database.getLastSync();
    });
    
    // Autenticación
    ipcMain.handle('login', async (_, credentials) => {
        // Implementar lógica de autenticación
        return { success: true, token: 'dummy-token' };
    });
    
    // Obtener datos para gráficos
    ipcMain.handle('get-chart-data', async () => {
        return database.getChartData();
    });
    
    // Obtener últimos registros
    ipcMain.handle('get-last-entries', async (_, limit = 10) => {
        return database.getLastEntries(limit);
    });
}

// Configurar la aplicación
app.whenReady().then(async () => {
    await database.initialize();
    syncManager.initialize();
    setupIPC();
    createWindow();
});

// Manejar múltiples instancias (macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Salir cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
    if (mainWindow) {
        mainWindow.webContents.send('global-error', error.message);
    }
});