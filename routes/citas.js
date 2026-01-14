const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db");
const authMiddleware = require("../middlewares/authMiddleware");
const nodemailer = require("nodemailer");
// const { google } = require("googleapis"); // ⛔ activar más adelante

/* =========================================================
   CONFIGURACIÓN EMAIL
========================================================= */
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
    to: "tucorreo@gmail.com", // TU email
    subject: "📅 Nueva cita agendada",
    html: `
      <h3>Nueva cita agendada</h3>
      <p><strong>Usuario:</strong> ${cita.nombre} (${cita.email})</p>
      <p><strong>Curso:</strong> ${cita.titulo}</p>
      <p><strong>Fecha:</strong> ${cita.fecha}</p>
      <p><strong>Hora:</strong> ${cita.hora}</p>
    `
  });
}

/* =========================================================
   CREAR PAGO STRIPE (1 sesión = 1 pago)
========================================================= */
router.post("/crear-pago", authMiddleware, async (req, res) => {
  const { curso_id, precio } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: "Sesión de Coaching (1h)" },
          unit_amount: precio // en céntimos
        },
        quantity: 1
      }],
      metadata: {
        user_id: req.user.id,
        curso_id
      },
      success_url: "https://autoconocimientoygratitud.com/perfil",
      cancel_url: "https://autoconocimientoygratitud.com/cancelado"
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando sesión de pago" });
  }
});

/* =========================================================
   AGENDAR CITA (usa SOLO una sesión pagada)
========================================================= */
router.post("/agenda", authMiddleware, (req, res) => {
  const { fecha, hora, curso_id } = req.body;
  const userId = req.user.id;

  db.query(
    `UPDATE citas 
     SET fecha=?, hora=? 
     WHERE user_id=? 
       AND curso_id=? 
       AND fecha IS NULL 
       AND estado='pagado'
     ORDER BY created_at ASC
     LIMIT 1`,
    [fecha, hora, userId, curso_id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al agendar la cita" });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({ error: "No hay sesiones pagadas pendientes" });
      }

      // Obtener la cita ya agendada (con nombre del curso)
      db.query(
        `SELECT citas.*, cursos.titulo
         FROM citas
         JOIN cursos ON citas.curso_id = cursos.id
         WHERE citas.user_id=? 
           AND citas.curso_id=? 
           AND citas.fecha=? 
           AND citas.hora=?
         LIMIT 1`,
        [userId, curso_id, fecha, hora],
        async (err2, rows) => {
          if (!err2 && rows.length) {
            try {
              await enviarAviso(rows[0]);
              console.log("✅ Email de aviso enviado");
            } catch (e) {
              console.error("❌ Error enviando email:", e);
            }
          }
        }
      );

      res.json({ mensaje: "Cita agendada correctamente" });
    }
  );
});

/* =========================================================
   VER CITAS DEL USUARIO (perfil)
========================================================= */
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
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener citas" });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
