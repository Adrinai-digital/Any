const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middlewares/authMiddleware');  // ajusta según tu estructura
const cookieParser = require('cookie-parser');
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

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
                expiresIn: '7d'
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

// Ruta protegida: perfil HTML
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

// 🌟 NUEVA RUTA: Datos del Perfil (JSON) requerida por tu script.js para procesarPago()
router.get('/perfil-data', authMiddleware, (req, res) => {
    const { id, nombre, email } = req.usuario;
    res.json({
        usuario: { id, nombre, email }
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
    const usuario_id = req.usuario.id;

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

// 🌟 NUEVA RUTA: Obtener listado de lecciones completadas para persistencia al recargar
router.get('/lecciones-completadas', authMiddleware, (req, res) => {
    const usuario_id = req.usuario.id;

    const query = `
        SELECT video_id FROM lecciones_completadas 
        WHERE usuario_id = ? AND completado = 1
    `;

    db.query(query, [usuario_id], (err, results) => {
        if (err) {
            console.error("❌ Error al obtener lecciones completadas:", err);
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        
        const completados = results.map(row => row.video_id);
        res.json({ completados });
    });
});

router.get('/api/auth/check', (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        return res.json({ loggedIn: false });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({ loggedIn: true, user: { id: decoded.id, nombre: decoded.nombre } });
    } catch (error) {
        res.json({ loggedIn: false });
    }
});

const transporter = nodemailer.createTransport({
  host: "smtp.tuservidor.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function enviarAviso(cita) {
  await transporter.sendMail({
    from: `"Tu Web" <${process.env.EMAIL_USER}>`,
    to: "info@autoconocimientoygratitud.com",
    subject: "Nueva cita agendada",
    html: `
      <p>Se ha agendado una cita:</p>
      <p>Usuario: ${cita.nombre} (${cita.email})</p>
      <p>Curso: ${cita.curso_id}</p>
      <p>Fecha: ${cita.fecha}</p>
      <p>Hora: ${cita.hora}</p>
    `
  });
}

/* -------------------- GOOGLE CALENDAR -------------------- */
async function agregarAGoogleCalendar(cita) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/calendar"]
  });

  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `Cita Método Learn - ${cita.nombre}`,
      description: `Usuario: ${cita.nombre} (${cita.email})`,
      start: { dateTime: `${cita.fecha}T${cita.hora}`, timeZone: "Europe/Madrid" },
      end: { dateTime: new Date(new Date(`${cita.fecha}T${cita.hora}`).getTime() + 60*60*1000).toISOString(), timeZone: "Europe/Madrid" }
    }
  });
}

/* -------------------- CREAR PAGO DE CITA -------------------- */
router.post("/crear-pago-cita", authMiddleware, async (req, res) => {
  const { curso_id, price_id, fecha, hora } = req.body;
  const userId = req.user.id;

  if (!fecha || !hora) return res.status(400).json({ error: "Debes seleccionar fecha y hora" });

  try {
    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: req.user.email,
      line_items: [
        {
          price: price_id,
          quantity: 1
        }
      ],
      metadata: {
        user_id: userId,
        curso_id,
        fecha,
        hora
      },
      success_url: "https://autoconocimientoygratitud.com/perfil",
      cancel_url: "https://autoconocimientoygratitud.com/cancelado"
    });

    // Guardar cita pendiente en DB
    db.query(
      `INSERT INTO citas (user_id, curso_id, estado, fecha, hora, stripe_payment_id, nombre, email)
       VALUES (?, ?, 'pendiente', ?, ?, ?, ?, ?)`,
      [userId, curso_id, fecha, hora, session.payment_intent, req.user.nombre, req.user.email],
      (err) => {
        if (err) console.error("Error guardando cita pendiente:", err);
      }
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creando sesión de Stripe:", err);
    res.status(500).json({ error: "No se pudo crear la sesión de pago" });
  }
});

module.exports = router;