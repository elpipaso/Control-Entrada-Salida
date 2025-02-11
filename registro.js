const { ipcRenderer } = require('electron');

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nombre = document.getElementById('nombre').value;
  const rut = document.getElementById('rut').value;
  const cargo = document.getElementById('cargo').value;

  try {
    const respuesta = await ipcRenderer.invoke('registrar-usuario', {
      nombre,
      rut,
      cargo
    });
    
    mostrarMensaje(`Regro exitoso - ID: ${respuesta.id}`, 'exito');
    document.getElementById('formRegistro').reset();
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
});

function mostrarMensaje(texto, tipo) {
  const mensajeDiv = document.getElementById('mensaje');
  mensajeDiv.textContent = texto;
  mensajeDiv.className = `mensaje ${tipo}`;
  setTimeout(() => mensajeDiv.textContent = '', 3000);
}