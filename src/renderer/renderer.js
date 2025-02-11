let chartInstance = null;
let debounceTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    const initApp = async () => {
        setupEventListeners();
        initRealTimeClock();
        await updateAllData();
        setupAutocomplete();
        setupChart();
    };
// En renderer.js agregar:
document.getElementById('btnNuevoRegistro').addEventListener('click', () => {
    ipcRenderer.send('abrir-ventana-registro');
  });

    const setupEventListeners = () => {
        document.getElementById('btnEntrada').addEventListener('click', handleRegistro('entrada'));
        document.getElementById('btnSalida').addEventListener('click', handleRegistro('salida'));
        document.getElementById('btnSync').addEventListener('click', handleSync);
        
        window.api.onError(showErrorNotification);
        window.api.sync.onUpdate(handleSyncUpdate);
    };

    const handleRegistro = (tipo) => async () => {
        const rut = document.getElementById('rutInput').value.trim();
        
        if (!window.api.personal.validateRUT(rut)) {
            showNotification('RUT inválido', 'error');
            return;
        }

        try {
            const result = await window.api.registros.logEntry(rut);
            showNotification(result.message, 'success');
            await updateAllData();
            document.getElementById('rutInput').value = '';
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleSync = async () => {
        try {
            document.getElementById('btnSync').classList.add('syncing');
            const lastSync = await window.api.sync.now();
            updateSyncTime(lastSync);
            showNotification('Sincronización completada', 'success');
        } catch (error) {
            showNotification(`Error de sincronización: ${error.message}`, 'error');
        } finally {
            document.getElementById('btnSync').classList.remove('syncing');
        }
    };

    const updateAllData = async () => {
        await Promise.all([
            updateLogEntries(),
            updateChart(),
            updateTotalTime()
        ]);
    };

    window.api.auth.getSession().then(updateSessionStatus);
    
    initApp();
});
// Registro de personal por interfaz
document.getElementById('btnRegistrar').addEventListener('click', async () => {
    const nombre = document.getElementById('nombreInput').value;
    const rut = document.getElementById('rutInput').value;
    
    try {
      await window.api.personal.register(nombre, rut);
      showNotification('Persona registrada exitosamente', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });

// Funciones auxiliares
function setupAutocomplete() {
    const input = document.getElementById('rutInput');
    const suggestions = document.getElementById('suggestions');

    input.addEventListener('input', async (e) => {
        clearTimeout(debounceTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            suggestions.innerHTML = '';
            return;
        }

        debounceTimeout = setTimeout(async () => {
            try {
                const results = await window.api.personal.search(query);
                showSuggestions(results);
            } catch (error) {
                console.error('Error en autocompletado:', error);
            }
        }, 300);
    });

    const showSuggestions = (ruts) => {
        suggestions.innerHTML = ruts.map(rut => `
            <div class="suggestion-item">${formatRut(rut)}</div>
        `).join('');
    };

    suggestions.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            input.value = e.target.textContent;
            suggestions.innerHTML = '';
        }
    });
}

async function updateChart() {
    const ctx = document.getElementById('statsChart').getContext('2d');
    const data = await window.api.stats.getChartData();

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Horas en cuartel',
                data: data.values,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Horas' } },
                x: { title: { display: true, text: 'Personal' } }
            }
        }
    });
}

async function updateLogEntries() {
    const entries = await window.api.registros.getLastEntries(10);
    const logContainer = document.getElementById('logEntries');
    
    logContainer.innerHTML = entries.map(entry => `
        <div class="log-entry">
            <div>
                <strong>${entry.nombre}</strong>
                <span class="rut">${formatRut(entry.rut)}</span>
            </div>
            <div class="timestamps">
                <span class="entrada">${formatTime(entry.entrada)}</span>
                ${entry.salida ? 
                    `<span class="salida">${formatTime(entry.salida)}</span>` :
                    '<span class="en-cuartel">EN CUARTEL</span>'}
            </div>
        </div>
    `).join('');
}

async function updateTotalTime() {
    const rut = document.getElementById('rutInput').value.trim();
    if (!rut) return;
    
    const total = await window.api.stats.getTotalTime(rut);
    document.getElementById('tiempoTotal').textContent = 
        `Horas acumuladas: ${total.toFixed(2)}`;
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification visible ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('visible');
    }, 3000);
}

// Funciones de formato
function formatRut(rut) {
    return rut.replace(/^(\d{1,3})(\d{3})(\d{3})-?(\w{1})$/, '$1.$2.$3-$4');
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('es-CL');
}

function initRealTimeClock() {
    function updateClock() {
        document.getElementById('currentTime').textContent = 
            new Date().toLocaleTimeString('es-CL');
    }
    setInterval(updateClock, 1000);
    updateClock();
}

function handleSyncUpdate(event, data) {
    updateSyncTime(data.lastSync);
    if (data.newEntries > 0) {
        showNotification(`${data.newEntries} nuevos registros sincronizados`, 'success');
    }
}

function updateSyncTime(timestamp) {
    document.getElementById('lastSync').textContent = 
        `Última sincronización: ${new Date(timestamp).toLocaleString()}`;
}
