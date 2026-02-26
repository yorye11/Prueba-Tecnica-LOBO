const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err.stack);
  } else {
    console.log('conexion exitosa');
    release(); // Liberamos el cliente
  }
});

module.exports = pool;
