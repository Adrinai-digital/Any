const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db");
const { enviarAviso } = require("../services/emailService");
const { addCalendarEvent } = require("../services/googleCalendar");

router.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
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
    const fecha = metadata.fecha; // Solo viene en sesiones/coaching
    const hora = metadata.hora;   // Solo viene en sesiones/coaching

    if (!userId) {
      console.error("❌ Error: Evento recibido sin user_id en metadata.");
      return res.status(400).send("Falta el ID de usuario");
    }

    try {
      // 🔀 CASO 1: Es una Cita / Sesión de Coaching (tiene fecha y hora)
      if (fecha && hora) {
        await new Promise((resolve, reject) => {
          db.query(
            `INSERT INTO citas (user_id, curso_id, fecha, hora, stripe_payment_id, estado)
             VALUES (?, ?, ?, ?, ?, 'pagado')
             ON DUPLICATE KEY UPDATE estado='pagado'`,
            [userId, cursoId || null, fecha, hora, session.payment_intent],
            (err, result) => (err ? reject(err) : resolve(result))
          );
        });

        // Notificaciones automáticas en segundo plano (Calendar y Email)
        const cita = {
          user_id: userId,
          curso_id: cursoId,
          fecha,
          hora,
          nombre: session.customer_details?.name || "Usuario",
          email: session.customer_email || session.customer_details?.email,
          telefono: session.customer_details?.phone || ""
        };

        setImmediate(async () => {
          try {
            await enviarAviso(cita);
            await addCalendarEvent(cita);
            console.log("✅ Cita de coaching: Email y Google Calendar gestionados");
          } catch (err) {
            console.error("❌ Error notificando cita:", err);
          }
        });

      } 
     // 🔀 CASO 2: Es un Curso Normal de Pago Único o Recurrente (Suscripción)
      else if (cursoId) {
        // Buscamos el ID numérico real en la base de datos de manera dinámica
        const idCursoNumerico = await new Promise((resolve, reject) => {
          db.query(
            `SELECT id FROM cursos WHERE id = ? OR stripe_price_id = ? LIMIT 1`,
            [cursoId, cursoId],
            (err, rows) => {
              if (err) return reject(err);
              resolve(rows && rows.length > 0 ? rows[0].id : null);
            }
          );
        });

        // Verificamos si no se ha encontrado en la base de datos
        if (!idCursoNumerico) {
          console.error(`❌ No se encontró ningún curso en tu BD que coincida con: ${cursoId}`);
          return res.status(400).send("Curso no encontrado en la base de datos interna");
        }

        // Hacemos el INSERT automático con el ID recuperado de la consulta
        await new Promise((resolve, reject) => {
          db.query(
            `INSERT INTO pagos (usuario_id, curso_id, stripe_session_id, estado, estado_pago, fecha, fecha_pago)
             VALUES (?, ?, ?, 'completado', 'completado', NOW(), NOW())
             ON DUPLICATE KEY UPDATE estado='completado', estado_pago='completado', fecha_pago=NOW()`,
            [userId, idCursoNumerico, session.id],
            (err, result) => (err ? reject(err) : resolve(result))
          );
        });
        console.log(`✅ Curso ${idCursoNumerico} activado con éxito para el usuario ${userId}`);
      }
    } catch (err) {
      console.error("❌ Error procesando la compra en la base de datos:", err);
      return res.status(500).send("Error interno al procesar la compra");
    }
  }

  res.status(200).json({ received: true });
});
module.exports = router;