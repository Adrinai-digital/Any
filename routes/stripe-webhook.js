const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db");

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
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

    try {
      // Aquí puedes añadir la lógica que necesites tras el pago del curso,
      // por ejemplo: matricular al usuario en la base de datos.
      
      console.log(`✅ Curso ${cursoId} pagado correctamente por el usuario ${userId}`);
    } catch (err) {
      console.error("❌ Error al procesar el pago del curso:", err);
      return res.status(500).send("Error interno del servidor");
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;