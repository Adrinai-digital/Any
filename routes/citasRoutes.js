// citasRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // tu conexión MySQL
const authMiddleware = require("../middlewares/authMiddleware");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/* -------------------- CONFIGURACIÓN EMAIL -------------------- */
const transporter = nodemailer.createTransport({
  host: "smtp.tuservidor.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function enviarAviso(cita) {
  await transporter.sendMail({
    from: `"Tu Web" <${process.env.EMAIL_USER}>`,
    to: "tucorreo@gmail.com", // tu email
    subject: "Nueva cita agendada",
    html: `
      <p>Se ha agendado una cita:</p>
      <p>Usuario: ${cita.nombre} (${cita.email})</p>
      <p>Curso: ${cita.curso_id}</p>
      <p>Fecha: ${cita.fecha}</p>
      <p>Hora: ${cita.hora}</p>
    `,
  });
}

/* -------------------- GOOGLE CALENDAR -------------------- */
async function agregarAGoogleCalendar(cita) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json", // tu archivo JSON del servicio
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `Cita Método Learn - ${cita.nombre}`,
      description: `Usuario: ${cita.nombre} (${cita.email})`,
      start: { dateTime: new Date(`${cita.fecha}T${cita.hora}`), timeZone: "Europe/Madrid" },
      end: { dateTime: new Date(new Date(`${cita.fecha}T${cita.hora}`).getTime() + 60 * 60 * 1000), timeZone: "Europe/Madrid" },
    },
  });
}

/* -------------------- CREAR PAGO + CITA MÉTODO LEARN -------------------- */
router.post("/crear-pago", authMiddleware, async (req, res) => {
  const { curso_id, priceId, fecha, hora } = req.body;
  const userId = req.user.id;

  if (!curso_id || !priceId || !fecha || !hora) {
    return res.status(400).json({ error: "Faltan datos obligatorios (curso, priceId, fecha u hora)" });
  }

  try {
    // 1️⃣ Crear cita pendiente en la base de datos
    const citaInsert = await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO citas (user_id, curso_id, estado, fecha, hora) VALUES (?, ?, 'pagado', ?, ?)`,
        [userId, curso_id, fecha, hora],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    // 2️⃣ Crear sesión de Stripe con el priceId del producto
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId, // ✅ usar el producto que creaste en Stripe
          quantity: 1
        }
      ],
      mode: "payment",
      customer_email: req.user.email,
      metadata: {
        user_id: userId,
        curso_id
      },
      success_url: `${process.env.BASE_URL}/perfil`,
      cancel_url: `${process.env.BASE_URL}/cancel`
    });

    // 3️⃣ Retornar URL del checkout a frontend
    res.json({ url: session.url });

  } catch (error) {
    console.error("Error al crear pago Método Learn:", error);
    res.status(500).json({ error: "Error al crear pago en Stripe" });
  }
});

/* -------------------- AGENDA CITA EXISTENTE -------------------- */
router.post("/agenda", authMiddleware, (req, res) => {
  const { fecha, hora, curso_id } = req.body;
  const userId = req.user.id;

  db.query(
    `UPDATE citas SET fecha=?, hora=? 
     WHERE user_id=? AND curso_id=? AND fecha IS NULL AND estado='pagado'`,
    [fecha, hora, userId, curso_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Error al agendar la cita" });
      if (result.affectedRows === 0) return res.status(400).json({ error: "No hay sesiones pagadas pendientes" });

      // Obtener cita actualizada
      db.query(
        `SELECT * FROM citas WHERE user_id=? AND curso_id=? AND fecha=? AND hora=? LIMIT 1`,
        [userId, curso_id, fecha, hora],
        async (err2, rows) => {
          if (!err2 && rows.length) {
            const cita = rows[0];
            try {
              await enviarAviso(cita);
              await agregarAGoogleCalendar(cita);
              console.log("✅ Email y Google Calendar enviados");
            } catch (error) {
              console.error("❌ Error enviando aviso o calendario:", error);
            }
          }
        }
      );

      res.json({ mensaje: "Cita agendada correctamente" });
    }
  );
});

/* -------------------- VER CITAS DEL USUARIO -------------------- */
router.get("/mis-citas", authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.query(
    `SELECT citas.*, cursos.titulo
     FROM citas
     JOIN cursos ON citas.curso_id = cursos.id
     WHERE citas.user_id = ?
     ORDER BY fecha ASC, hora ASC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error al obtener citas" });
      res.json(rows);
    }
  );
});

/* -------------------- ACCEDER A MÉTODO LEARN -------------------- */
router.get("/metodo-learn", authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.query(
    `SELECT * FROM citas
     WHERE user_id = ? AND curso_id = 10
     ORDER BY fecha ASC, hora ASC`,
    [userId],
    (err, citas) => {
      if (err) return res.status(500).send("Error");

      res.render("metodo_learn", {
        usuario: req.user,
        citas
      });
    }
  );
});


router.post("/confirmar", authMiddleware, (req, res) => {
  const { curso_id, fecha, hora } = req.body;
  const userId = req.user.id;

  if (!curso_id || !fecha || !hora) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  db.query(
    `INSERT INTO citas (user_id, curso_id, fecha, hora, estado)
     VALUES (?, ?, ?, ?, 'pagado')`,
    [userId, curso_id, fecha, hora],
    (err) => {
      if (err) {
        console.error("❌ Error guardando cita:", err);
        return res.status(500).json({ error: "Error guardando la cita" });
      }

      res.json({ ok: true });
    }
  );
});



module.exports = router;
