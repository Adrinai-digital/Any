const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.stripe = stripe;

const hasRecurring = prices.some(pr => pr.type === "recurring");
const hasOneTime = prices.some(pr => pr.type === "one_time");

if (hasRecurring && hasOneTime) {
 return res.status(400).json({ error: "No se pueden mezclar suscripciones y pago único en el mismo checkout." });
}

const mode = hasRecurring ? "subscription" : "payment";

router.post('/create-checkout-session', async (req, res) => {
 const { items, userEmail } = req.body;
 if (!items || !userEmail) return res.status(400).json({ error: 'Faltan productos o email del usuario' });

 const line_items = items.map(item => ({ price: item.priceId, quantity: item.quantity }));
 const prices = await Promise.all(items.map(p => stripe.prices.retrieve(p.priceId)));
 const basePayload = {
 line_items,
 customer_email: userEmail,
 success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
 cancel_url: `${process.env.BASE_URL}/cancel.html`,
 };

 try {
 const modeGuess = items.some(i => String(i.tipo).toLowerCase() === "suscripcion")
 ? "subscription"
 : "payment";

 console.log("checkout items:", items.map(i => ({ tipo: i.tipo, priceId: i.priceId })), "modeGuess:", modeGuess);

 const session = await stripe.checkout.sessions.create({ ...basePayload, mode: modeGuess });
 return res.json({ url: session.url });
 } catch (e) {
 console.error("❌ Error en /create-checkout-session:", e);
 return res.status(500).json({ error: "Error al crear la sesión de pago" });
 }
});

router.post('/crear-checkout', async (req, res) => {
    try {
        const { productos, userEmail, cita } = req.body;

        if (!productos || !userEmail) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }

        const lineItems = productos.map(item => ({
            price: item.priceId,
            quantity: item.cantidad,
        }));
 const prices = await Promise.all(productos.map(p => stripe.prices.retrieve(p.priceId)));
 const hasRecurring = prices.some(pr => pr.type === "recurring");
 const hasOneTime = prices.some(pr => pr.type === "one_time");

 if (hasRecurring && hasOneTime) {
 return res.status(400).json({ error: "No se pueden mezclar suscripciones y pago único en el mismo checkout." });
 }
    const mode = hasRecurring ? "subscription" : "payment";
        const sessionData = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode,
            customer_email: userEmail,
            success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/cancel.html`,
        };

        // Si es Método Learn, pasamos metadata con fecha, hora y teléfono
        if (cita) {
            sessionData.metadata = {
                curso_id: cita.curso_id,
                fecha: cita.fecha,
                hora: cita.hora,
                telefono: cita.telefono || ''
            };
        }

        const session = await stripe.checkout.sessions.create(sessionData);

        console.log("✅ Stripe session creada:", session);

        res.json({ url: session.url });
    } catch (error) {
        console.error("❌ Error en /crear-checkout:", error);
        res.status(500).json({ error: 'Error al crear la sesión de pago' });
    }
});


module.exports = router;