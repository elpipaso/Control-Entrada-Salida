const database = require('./database');

async function test() {
  await database.initialize();
  
  const ruts = ["12345678-5", "23456789-K", "34567890-1"];
  
  for (const rut of ruts) {
    try {
      const resultadoRUT = await database.registrarRUT(rut);
      console.log(`RUT ${rut} registrado: ${resultadoRUT.mensaje}`);
      
      // Entrada
      await database.registrarMovimiento(rut);
      console.log(`Entrada registrada para ${rut}`);
      
      // Salida
      await database.registrarMovimiento(rut);
      console.log(`Salida registrada para ${rut}`);
      
    } catch (error) {
      console.error(`Error con ${rut}:`, error.message);
    }
  }
}

test();