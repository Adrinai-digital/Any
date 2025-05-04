const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Registro de usuario
const register = (req, res) => {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si ya existe un usuario con ese email
    db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Error al buscar usuario:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        try {
            // Cifrar contraseña
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insertar nuevo usuario
            db.query(
                'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
                [nombre, email, hashedPassword],
                (err, result) => {
                    if (err) {
                        console.error('Error al registrar usuario:', err);
                        return res.status(500).json({ error: 'Error en el registro' });
                    }

                    res.json({ message: 'Usuario registrado con éxito' });
                }
            );
        } catch (hashErr) {
            console.error('Error al cifrar contraseña:', hashErr);
            res.status(500).json({ error: 'Error al procesar la contraseña' });
        }
    });
};

// Login de usuario
const login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Error al buscar usuario:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        const user = results[0];

        try {
            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword) {
                return res.status(400).json({ error: 'Contraseña incorrecta' });
            }

            // Crear token
            const token = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '2h' }
            );

            // Enviar token + datos del usuario
            res.json({
                message: 'Login exitoso',
                token,
                usuario: {
                    id: user.id,
                    nombre: user.nombre,
                    email: user.email
                }
            });
        } catch (compareErr) {
            console.error('Error al comparar contraseñas:', compareErr);
            res.status(500).json({ error: 'Error al verificar contraseña' });
        }
    });
};

module.exports = { register, login };
