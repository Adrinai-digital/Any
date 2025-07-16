const path = require('path');
require('dotenv').config();
const cors = require('cors');
const db = require('./db');
const authMiddleware = require('./middlewares/authMiddleware');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const PORT = process.env.PORT || 3000;

const express = require('express');
const app = express();

const stripeWebhook = require('./routes/stripe-webhook');
app.use('/webhook', stripeWebhook);
// Middleware para verificar token desde cookies
const verificarToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado, token requerido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

// Middlewares globales
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: 'https://autoconocimientoygratitud.com',
    credentials: true
}));

//app.use(express.json());
//app.use(bodyParser.json());
 // importante para leer body en POST

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ruta de registro
app.post('/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const sql = 'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)';
        db.query(sql, [nombre, email, hashedPassword], (err) => {
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

// Ruta de login
app.post('/login', async (req, res) => {
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

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: 3600000
            });

            return res.json({ message: 'Login exitoso', token });
        });
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/perfil', verificarToken, (req, res) => {
    const userId = req.user.id;

    db.query('SELECT * FROM cursos WHERE id IN (SELECT curso_id FROM pagos WHERE usuario_id = ?)', [userId], (err, cursos) => {
        if (err) {
            console.error('Error al obtener los cursos:', err);
            return res.status(500).json({ error: 'Error al obtener los cursos' });
        }

        const usuario = {
            id: req.user.id,
            nombre: req.user.nombre,
            email: req.user.email
        };

        res.render('perfil', {
            usuario: usuario,
            cursos: cursos
        });
    });
});

app.get('/perfil-data', verificarToken, (req, res) => {
    const userId = req.user.id;

    db.query(
        'SELECT * FROM cursos WHERE id IN (SELECT curso_id FROM pagos WHERE usuario_id = ?)',
        [userId],
        (err, cursos) => {
            if (err) {
                console.error('Error al obtener los cursos:', err);
                return res.status(500).json({ error: 'Error al obtener los cursos' });
            }

            const usuario = {
                id: req.user.id,
                nombre: req.user.nombre,
                email: req.user.email
            };

            res.json({ usuario, cursos });
        }
    );
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

app.post("/crear-checkout", async (req, res) => {
    const { productos, total, userEmail } = req.body;

    if (!productos || !Array.isArray(productos) || productos.length === 0 || !total || !userEmail) {
        return res.status(400).json({ error: '❌ Faltan datos importantes para procesar el pago' });
    }

    try {
        const line_items = productos.map(producto => ({
            price: producto.priceId,
            quantity: producto.cantidad || 1
        }));

        let hasRecurring = false;

        for (const producto of productos) {
            const precio = await stripe.prices.retrieve(producto.priceId);
            if (precio.recurring) {
                hasRecurring = true;
                break;
            }
        }

        const sessionMode = hasRecurring ? 'subscription' : 'payment';
        console.log('Productos antes de crear sesión:', productos);
        console.log('Metadata enviada:', JSON.stringify(productos.map(p => p.priceId)));


        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items,
            mode: sessionMode,
            success_url: `https://autoconocimientoygratitud.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://autoconocimientoygratitud.com/cancel.html`,

            customer_email: userEmail,
            metadata: {
                price_ids: JSON.stringify(productos.map(p => p.priceId))
              }
              
        });

        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error("❌ Error en Stripe:", error);
        return res.status(500).json({
            error: "Hubo un problema procesando el pago",
            detalles: error.message
        });
    }
});

app.post('/agregar-al-carrito', verificarToken, async (req, res) => {
    const { cursoId } = req.body;
    const usuarioId = req.user.id;

    if (!usuarioId || !cursoId) {
        return res.status(400).json({ error: "Faltan datos en la solicitud." });
    }

    try {
        const [existing] = await db.query(
            'SELECT * FROM cursos_comprados WHERE usuario_id = ? AND curso_id = ?',
            [usuarioId, cursoId]
        );

        if (existing.length > 0) {
            return res.status(200).json({
                message: "El curso ya fue agregado previamente.",
                redirectUrl: `/curso${cursoId}.html`
            });
        }

        await db.query(
            'INSERT INTO cursos_comprados (usuario_id, curso_id) VALUES (?, ?)',
            [usuarioId, cursoId]
        );

        const [curso] = await db.query(
            'SELECT url_contenido FROM cursos WHERE id = ?',
            [cursoId]
        );

        const url = curso[0]?.url_contenido || '/perfil';

        return res.status(200).json({
            message: "Curso agregado correctamente",
            redirectUrl: url
        });

    } catch (error) {
        console.error("❌ Error al agregar curso gratuito:", error);
        return res.status(500).json({
            error: "Error interno del servidor."
        });
    }
});

app.get('/success', async (req, res) => {
    const sessionId = req.query.session_id;

    if (!sessionId) {
        return res.status(400).json({ error: "No session ID provided." });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const userEmail = session.customer_email;

        db.query('SELECT id FROM usuarios WHERE email = ?', [userEmail], async (err, results) => {
            if (err || results.length === 0) {
                return res.status(500).json({ error: "Usuario no encontrado." });
            }

            const usuarioId = results[0].id;
            const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);

            const insertarCurso = (cursoId, stripeSessionId, estado) => {
                return new Promise((resolve, reject) => {
                    db.query(
                        'INSERT INTO pagos (usuario_id, curso_id, stripe_session_id, estado, fecha, fecha_pago, estado_pago) VALUES (?, ?, ?, ?, NOW(), NOW(), ?)',
                        [usuarioId, cursoId, stripeSessionId, estado, 'completado'],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            };

            for (const item of lineItems.data) {
                const precioId = item.price.id;
                db.query('SELECT id FROM cursos WHERE stripe_price_id = ?', [precioId], async (err, result) => {
                    if (result && result.length > 0) {
                        const cursoId = result[0].id;
                        const stripeSessionId = session.id;
                        const estado = 'completado';
                        await insertarCurso(cursoId, stripeSessionId, estado);
                    }
                });
            }

            res.json({ email: userEmail });
        });

    } catch (error) {
        console.error('Error al verificar el pago:', error);
        res.status(500).json({ error: "Error al verificar el pago." });
    }
});

app.get('/cancel', (req, res) => {
    res.send("El pago fue cancelado. <a href='/'>Volver al inicio</a>");
});


app.post('/marcar-completado', authMiddleware, (req, res) => {
    console.log('📥 Datos recibidos en /marcar-completado:', req.body);

    const { video_id, cursoId } = req.body;

    if (!video_id || !cursoId) {
        return res.status(400).json({ error: 'Faltan datos en la solicitud' });
    }

    // Primero verificamos si ya existe el registro
    const selectQuery = `
        SELECT 1 FROM lecciones_completadas 
        WHERE usuario_id = ? AND curso_id = ? AND video_id = ?
    `;

    db.query(selectQuery, [req.user.id, cursoId, video_id], (err, results) => {
        if (err) {
            console.error('❌ Error al verificar duplicado:', err.message);
            return res.status(500).json({ error: 'Error al verificar el progreso' });
        }
        console.log('Resultados SELECT:', results); // <--- Añade esto para debug

        if (results.length > 0) {
            console.log('ℹ️ El video ya estaba marcado como completado');
            return res.status(200).json({ message: 'Ya estaba completado' });
        }

        // Si no está marcado, lo insertamos
        const insertQuery = `
            INSERT INTO lecciones_completadas (usuario_id, curso_id, video_id)
            VALUES (?, ?, ?)
        `;

        db.query(insertQuery, [req.user.id, cursoId, video_id], (err, result) => {
            if (err) {
                console.error('❌ Error al insertar:', err.message);
                return res.status(500).json({ error: 'Error al marcar como completado' });
            }

            console.log('✅ Video marcado como completado');
            res.status(200).json({ message: 'Video marcado como completado' });
        });
    });
});
app.get('/progreso', authMiddleware, (req, res) => {
    console.log('Usuario en /progreso:', req.user);
    console.log('Curso ID recibido:', req.query.cursoId);

    const usuarioId = req.user.id;
    const cursoId = req.query.cursoId;

    if (!cursoId) {
        return res.status(400).json({ error: 'Falta el ID del curso' });
    }

    const query = `
        SELECT video_id FROM lecciones_completadas
        WHERE usuario_id = ? AND curso_id = ?
    `;

    db.query(query, [usuarioId, cursoId], (err, results) => {
        if (err) {
            console.error('❌ Error al consultar progreso:', err.message);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        const completados = results.map(row => row.video_id);
        console.log('Progreso retornado:', completados);
        res.json({ completados });
    });
});


app.listen(PORT, () => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    console.log(`Servidor corriendo en ${baseUrl}`);
});

