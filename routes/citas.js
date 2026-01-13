const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db");
const authMiddleware = require("../middlewares/authMiddleware");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

/* -------------------- CONFIGURACIÓN EMAIL -------------------- */
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
    to: "tucorreo@gmail.com", // tu email
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
    keyFile: "credentials.json", // tu archivo JSON del servicio
    scopes: ["https://www.googleapis.com/auth/calendar"]
  });

  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `Cita Método Learn - ${cita.nombre}`,
      description: `Usuario: ${cita.nombre} (${cita.email})`,
      start: { dateTime: new Date(`${cita.fecha}T${cita.hora}`), timeZone: "Europe/Madrid" },
      end: { dateTime: new Date(new Date(`${cita.fecha}T${cita.hora}`).getTime() + 60*60*1000), timeZone: "Europe/Madrid" }
    }
  });
}

/* -------------------- CREAR PAGO -------------------- */
router.post("/crear-pago", authMiddleware, async (req, res) => {
  const { curso_id, precio } = req.body; // precio por hora en céntimos

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: "Sesión de Coaching (1h)" },
          unit_amount: precio
        },
        quantity: 1
      }],
      metadata: {
        user_id: req.user.id,
        curso_id
      },
      success_url: "https://tusitio.com/perfil",
      cancel_url: "https://tusitio.com/cancelado"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando sesión de pago" });
  }
});

/* -------------------- AGENDA CITA -------------------- */
router.post("/agenda", authMiddleware, (req, res) => {
  const { fecha, hora, curso_id } = req.body;
  const userId = req.user.id;

  // Actualizar cita pendiente
  db.query(
    `UPDATE citas SET fecha=?, hora=? 
     WHERE user_id=? AND curso_id=? AND fecha IS NULL LIMIT 1`,
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
    "SELECT * FROM citas WHERE user_id = ? ORDER BY fecha ASC, hora ASC",
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Error al obtener citas" });
      res.json(results);
    }
  );
});

module.exports = router;
