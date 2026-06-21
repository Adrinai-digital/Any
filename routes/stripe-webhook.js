const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db");
const express = require('express');
const router = express.Router();
const { stripe, STRIPE_WEBHOOK_SECRET } = require('../stripe');

router.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

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
    const metadata = session.metadata || {};

    const userId = Number(metadata.user_id);
    const cursoId = Number(metadata.curso_id);

    try {
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO pagos
            (usuario_id, curso_id, stripe_session_id, stripe_payment_intent_id, estado, estado_pago, fecha_pago)
           VALUES (?, ?, ?, ?, 'completado', 'completado', NOW())`,
          [userId, cursoId, session.id, session.payment_intent || null],
          (err, result) => (err ? reject(err) : resolve(result))
        );
      });

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Error guardando pago:", err);
      return res.status(500).send("Error guardando pago");
    }
  }

  return res.status(200).json({ received: true });
});

res.json({ received: true });
});

module.exports = router;