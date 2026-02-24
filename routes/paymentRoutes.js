const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Crear una sesión de Stripe Checkout
router.post('/create-checkout-session', async (req, res) => {
 const { items, userEmail } = req.body;
 if (!items || !userEmail) return res.status(400).json({ error: 'Faltan productos o email del usuario' });

 const line_items = items.map(item => ({ price: item.priceId, quantity: item.quantity }));
 const modeGuess = items.some(i => String(i.tipo).toLowerCase() === 'suscripcion') ? 'subscription' : 'payment';

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
 if (e?.message?.includes('passed a recurring price')) {
 const session = await stripe.checkout.sessions.create({ ...basePayload, mode: 'subscription' });
 return res.json({ url: session.url });
 }
 console.error('❌ Error en /crear-checkout:', e);
 return res.status(500).json({ error: 'Error al crear la sesión de pago' });
 }
});
// paymentRoutes.js
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

        const sessionData = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
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