const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middlewares/authMiddleware');  // ajusta según tu estructura
const cookieParser = require('cookie-parser');

// Middleware para verificar el token desde la cookie
function authMiddleware(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado, token requerido' });
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = verificado;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

// Ruta de registro
router.post('/register', async (req, res) => {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const sql = 'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)';
        db.query(sql, [nombre, email, hashedPassword], (err, result) => {
            if (err) {
                console.error('Error en el registro:', err);
                return res.status(500).json({ error: 'Error al registrar el usuario' });
            }
            res.status(201).json({ message: 'Usuario registrado con éxito' });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta de login (AJUSTADA para responder JSON, no redirigir)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    try {
        db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
            if (err || results.length === 0) {
                return res.status(400).json({ error: 'Credenciales incorrectas' });
            }

            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.status(400).json({ error: 'Credenciales incorrectas' });
            }

            const token = jwt.sign({ id: user.id, nombre: user.nombre, email: user.email }, process.env.JWT_SECRET, {
                expiresIn: '1h'
            });

            // Guardar token en cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: 3600000 // 1 hora
            });

            // ✅ Cambiado: en vez de redirigir, devolvemos un JSON
            res.json({ message: 'Login exitoso', token });
        });
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para agregar un curso al carrito
router.post('/agregar-al-carrito', (req, res) => {
    const { cursoId } = req.body;
    const token = req.headers['authorization']?.split(' ')[1]; // Extraer el token de los headers
    
    if (!token) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    // Verificar el token y obtener los datos del usuario
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        const userId = decoded.id;  // Asumimos que el token contiene el ID del usuario

        // Verificar si el curso es gratuito o de pago
        db.query('SELECT * FROM cursos WHERE id = ?', [cursoId], (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Error en la base de datos' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'Curso no encontrado' });
            }

            const curso = results[0];

            // Si el curso es gratuito, agregarlo al perfil del usuario
            if (curso.tipo === 'gratis') {
                db.query('INSERT INTO cursos_comprados (user_id, curso_id) VALUES (?, ?)', [userId, cursoId], (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error al agregar el curso gratuito al perfil' });
                    }

                    return res.json({
                        message: 'Curso gratuito agregado al perfil',
                        redirectUrl: '/perfil'  // Redirigir a la página de perfil después de agregar el curso
                    });
                });
            } else {
                // Si el curso es de pago, simplemente devuelve el curso, lo procesarás con Stripe en el frontend
                return res.status(400).json({ error: 'Curso no gratuito. Para comprarlo, ve al proceso de pago.' });
            }
        });
    });
});

// Ruta protegida: perfil
router.get('/perfil', authMiddleware, (req, res) => {
    const { id, nombre, email } = req.usuario;

    const sql = `
        SELECT c.*
        FROM cursos_comprados cc
        JOIN cursos c ON cc.curso_id = c.id
        WHERE cc.user_id = ?
    `;

    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener cursos comprados:', err);
            return res.status(500).send('Error al cargar el perfil');
        }

        res.render('perfil', {
            usuario: { id, nombre, email },
            cursos: results
        });
    });
});


// Ruta para cerrar sesión
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/formulario.html');
});

// Ruta para marcar un video como completado
router.post('/marcar-completado', authMiddleware, (req, res) => {
    const { video_id, curso_id } = req.body;
    const usuario_id = req.user.id;

    if (!video_id || !curso_id || !usuario_id) {
        return res.status(400).json({ error: 'Faltan datos necesarios' });
    }

    const query = `
        INSERT INTO lecciones_completadas (usuario_id, curso_id, video_id, completado, fecha_completado)
        VALUES (?, ?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE completado = 1, fecha_completado = NOW();
    `;

    db.query(query, [usuario_id, curso_id, video_id], (err, result) => {
        if (err) {
            console.error("❌ Error al marcar video como completado:", err);
            return res.status(500).json({ error: 'Error al actualizar el estado' });
        }

        res.json({ message: '✅ Video marcado como completado' });
    });
});

module.exports = router;
