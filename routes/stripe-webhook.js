const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db");
const { enviarAviso } = require("../services/emailService");
const { addCalendarEvent } = require("../services/googleCalendar");

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("⚠️ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata;

    const userId = metadata.user_id;
    const cursoId = metadata.curso_id;
    const fecha = metadata.fecha;
    const hora = metadata.hora;

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO citas (user_id, curso_id, fecha, hora, estado)
           VALUES (?, ?, ?, ?, 'pagado')
           ON DUPLICATE KEY UPDATE estado='pagado'`,
          [userId, cursoId, fecha, hora],
          (err, result) => (err ? reject(err) : resolve(result))
        );
      });

      const cita = {
        user_id: userId,
        curso_id: cursoId,
        fecha,
        hora,
        nombre: session.customer_details?.name || "Usuario",
        email: session.customer_email,
        telefono: session.customer_details?.phone || ""
      };

      setImmediate(async () => {
        try {
          await enviarAviso(cita);
          await addCalendarEvent(cita);
          console.log("✅ Email y Google Calendar enviados");
        } catch (err) {
          console.error("❌ Error notificando cita:", err);
        }
      });

    } catch (err) {
      console.error("❌ Error guardando cita pagada:", err);
      return res.status(500).send("Error al actualizar cita");
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;