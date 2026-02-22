const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middlewares/authMiddleware");
const { enviarAviso } = require("../services/emailService");
const { addCalendarEvent } = require("../services/googleCalendar");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

console.log("🔥 citasRoutes cargado");

/* -------------------- CREAR PAGO + CITA MÉTODO LEARN -------------------- */
router.post("/crear-pago", authMiddleware, async (req, res) => {
  const { curso_id, priceId, fecha, hora, telefono } = req.body;
  const userId = req.user.id;

  if (!curso_id || !priceId || !fecha || !hora || !telefono) {
    return res.status(400).json({ error: "Faltan datos obligatorios (curso, priceId, fecha, hora o teléfono)" });
  }

  try {
    // Guardar cita pendiente con teléfono
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO citas (user_id, curso_id, estado, fecha, hora, telefono) VALUES (?, ?, 'pendiente', ?, ?, ?)`,
        [userId, curso_id, fecha, hora, telefono],
        (err, result) => (err ? reject(err) : resolve(result))
      );
    });

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      customer_email: req.user.email,
      metadata: { user_id: userId, curso_id, fecha, hora, telefono },
      success_url: `${process.env.BASE_URL}/perfil`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Error al crear pago Método Learn:", error);
    res.status(500).json({ error: "Error al crear pago en Stripe" });
  }
});

/* -------------------- AGENDA CITA EXISTENTE -------------------- */
router.post("/agenda", authMiddleware, (req, res) => {
  const { fecha, hora, curso_id, telefono } = req.body;
  const userId = req.user.id;

  db.query(
    `UPDATE citas SET fecha=?, hora=?, telefono=? 
     WHERE user_id=? AND curso_id=? AND fecha IS NULL AND estado='pagado'`,
    [fecha, hora, telefono, userId, curso_id],
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
              await addCalendarEvent(cita);
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

/* -------------------- CITAS OCUPADAS -------------------- */
router.get("/ocupadas", authMiddleware, (req, res) => {
  db.query(
    `SELECT fecha, hora FROM citas WHERE estado='pagado' AND fecha IS NOT NULL`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const busy = {};
      rows.forEach(row => {
        if (!busy[row.fecha]) busy[row.fecha] = [];
        busy[row.fecha].push(row.hora.slice(0,5));
      });
      res.json(busy);
    }
  );
});

module.exports = router;