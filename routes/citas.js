const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db"); // tu conexión MySQL
const authMiddleware = require("../middlewares/authMiddleware");

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
          unit_amount: precio // 5000 = 50€
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

router.post("/agenda", authMiddleware, (req, res) => {
  const { fecha, hora, curso_id } = req.body;
  const userId = req.user.id;

  db.query(
    `UPDATE citas
     SET fecha=?, hora=?
     WHERE user_id=? AND curso_id=? AND fecha IS NULL AND estado='pagado'
     ORDER BY created_at ASC
     LIMIT 1`,
    [fecha, hora, userId, curso_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Error al agendar la cita" });
      if (result.affectedRows === 0) return res.status(400).json({ error: "No hay sesiones pagadas pendientes" });
      res.json({ mensaje: "Cita agendada correctamente" });
    }
  );
});


module.exports = router;
