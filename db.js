const mysql = require('mysql');
const util = require('util');
require('dotenv').config();

// Crear pool de conexiones
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'vyksnxff_ecuela_online',
    password: process.env.DB_PASS || ';NcI6.21ck;}',
    database: process.env.DB_NAME || 'vyksnxff_escuela',
    charset: 'utf8mb4'
});

// Verificar conexión
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error al conectar con MySQL:', err.code, err.message);
    } else {
        console.log('✅ Conectado a MySQL correctamente');
        connection.release();
    }
});

// Convertir pool.query a promesas
pool.query = util.promisify(pool.query).bind(pool);

module.exports = pool;
