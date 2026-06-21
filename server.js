const path = require('path');
const fs = require('fs');

require('dotenv').config();

console.log("✅ Existe metodo_learn.ejs:", fs.existsSync(path.join(__dirname, 'views/metodo_learn.ejs')));

const cors = require('cors');
const db = require('./db');
const authMiddleware = require('./middlewares/authMiddleware');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');
const { STRIPE_PUBLIC_KEY } = require('./stripe');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
//const citasRoutes = require('./routes/citasRoutes');

const PORT = process.env.PORT || 3000;
const express = require('express');
const app = express();
const paymentRoutes = require('./routes/paymentRoutes');
// ---------------- MIDDLEWARES ----------------
app.use((req, res, next) => {
  console.log("📍 REQUEST:", req.method, req.originalUrl);
  next();
});

// middlewares de parseo y cookies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: 'https://autoconocimientoygratitud.com',
    credentials: true
}));

// motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// static
app.use(express.static(path.join(__dirname, 'public')));

// middleware de auth
const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies.token;

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

// ----------------- WEBHOOK STRIPE -----------------
const stripeWebhook = require('./routes/stripe-webhook');
app.use('/webhook', stripeWebhook);
app.use('/', paymentRoutes);

//app.post("/webhook/stripe",
  //bodyParser.raw({ type: "application/json" }),
  //(req, res) => {
    //const sig = req.headers["stripe-signature"];
    //let event;

    //try {
      //event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    //} catch (err) {
     // return res.status(400).send(`Webhook Error: ${err.message}`);
    //}

    //if (event.type === "checkout.session.completed") {
      //const s = event.data.object;
      //const userId = s.metadata.user_id;
      //const cursoId = s.metadata.curso_id;
      //const fecha = s.metadata?.fecha;
      //const hora = s.metadata?.hora;

      //if (userId && cursoId && fecha && hora) {
       // db.query(
         // `INSERT INTO citas (user_id, curso_id, stripe_payment_id, estado, fecha, hora)
          // VALUES (?, ?, ?, 'pagado', ?, ?)`,
          //[userId, cursoId, s.payment_intent, fecha, hora],
          //(err) => {
            //if (err) console.error("Error creando cita de coaching:", err);
            //else console.log(`✅ Cita de coaching creada para ${userId} en ${fecha} ${hora}`);
          //}
        //);
      //} else if (userId && cursoId) {
        //db.query(
         // `INSERT INTO citas (user_id, curso_id, stripe_payment_id, estado)
           //VALUES (?, ?, ?, 'pagado')`,
          //[userId, cursoId, s.payment_intent],
          //(err) => {
            //if (err) console.error("Error creando cita de otro curso:", err);
            //else console.log(`✅ Cita creada para otro curso para usuario ${userId}`);
          //}
        //);
      //}
    //}

   // res.json({ received: true });
 // }
//);

// ----------------- RUTAS -----------------
//app.use('/api/citas', citasRoutes);
//app.use('/curso'); // para /curso/metodo-learn
app.post('/register', async (req, res) => {
    const { nombre, email, password, telefono } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const sql = 'INSERT INTO usuarios (nombre, email, password, telefono) VALUES (?, ?, ?, ?)';
        db.query(sql, [nombre, email, hashedPassword, telefono || null], (err) => {
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

// Login
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
                expiresIn: '7d'
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

// Perfil
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

// Perfil-data
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

// Logout
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// Crear checkout
app.post("/create-checkout-session", (req, res) => {
 const { userId, cursoId, fecha, hora } = req.body;

 if (!userId || !cursoId || !fecha || !hora) {
 return res.status(400).send("Faltan datos: userId, cursoId, fecha u hora");
 }

 db.query(
 "SELECT tipo, stripe_price_id FROM cursos WHERE id = ? LIMIT 1",
 [cursoId],
 async (err, rows) => {
 if (err) {
 console.error("Error leyendo curso:", err);
 return res.status(500).send("Error leyendo el curso");
 }
 if (!rows || rows.length === 0) return res.status(404).send("Curso no encontrado");

 const curso = rows[0];
 if (!curso.stripe_price_id) return res.status(400).send("Curso sin stripe_price_id");

 const mode = (curso.tipo === "membresia") ? "subscription" : "payment";

 try {
 const session = await stripe.checkout.sessions.create({
 mode: 'subscription', // antes: 'payment'
 line_items: [{ price: curso.stripe_price_id, quantity: 1 }],
 mode,
 success_url: "https://autoconocimientoygratitud.com/success.html?session_id={CHECKOUT_SESSION_ID}",
 cancel_url: "https://autoconocimientoygratitud.com/cancel.html",
 client_reference_id: String(userId),
 metadata: { user_id: String(userId), curso_id: String(cursoId), fecha, hora }
 });

 return res.json({ url: session.url });
 } catch (e) {
 console.error("Error creando sesión de Checkout:", e);
 return res.status(500).send("Error creando sesión de pago");
 }
 }
 );
});

// ----------------- RUTA CITAS OCUPADAS -----------------
//app.get("/citas-ocupadas", (req, res) => {
  //const query = `
    //SELECT fecha, hora
   // FROM citas
    //WHERE estado = 'pagado'
  //    AND fecha IS NOT NULL
 // `;

  //db.query(query, (err, rows) => {
    //if (err) return res.status(500).json({ error: err.message });

    //const busy = {};
    //rows.forEach(row => {
     // if (!busy[row.fecha]) busy[row.fecha] = [];
     // if (!busy[row.fecha].includes(row.hora)) {
        //busy[row.fecha].push(row.hora);
      //}
    //});

    //res.json(busy); // ✅ Devuelve JSON correcto
 // });
//});
app.post('/marcar-completado', verificarToken, (req, res) => {
 const usuario_id = req.user.id;
 const { video_id, cursoId } = req.body;
 const curso_id = cursoId;

 if (!usuario_id || !curso_id || !video_id) {
 return res.status(400).json({ error: 'Faltan datos' });
 }

 db.query(
 `INSERT INTO lecciones_completadas (usuario_id, curso_id, video_id, completado)
 VALUES (?, ?, ?, 1)
 ON DUPLICATE KEY UPDATE completado=1, fecha_completado=CURRENT_TIMESTAMP`,
 [usuario_id, curso_id, video_id],
 (err) => {
 if (err) return res.status(500).json({ error: 'Error guardando progreso' });
 return res.json({ ok: true });
 }
 );
});

// ----------------- LISTEN -----------------
app.listen(PORT, () => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    console.log(`Servidor corriendo en ${baseUrl}`);
});
