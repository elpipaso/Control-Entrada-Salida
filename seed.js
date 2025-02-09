const database = require('./database');

async function main() {
  await database.initialize();
  
  const pruebas = [
    {nombre: "Juan Pérez", rut: "167895325"},    // Formato sin guión
    {nombre: "Ana Sánchez", rut: "12.345.678-5"},// Formato tradicional
    {nombre: "Carlos Gómez", rut: "23456789K"}   // Formato con K mayúscula
  ];

  for (const prueba of pruebas) {
    try {
      await database.registrarPersona(prueba.nombre, prueba.rut);
      console.log(`✅ ${prueba.rut} registrado correctamente`);
    } catch (error) {
      console.log(`❌ Error con ${prueba.rut}:`, error.message);
    }
  }
}

main();