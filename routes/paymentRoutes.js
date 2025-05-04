const express = require('express');
const router = express.Router();
const stripe = require('../stripe'); // Asegúrate de que la ruta sea correcta

// Crear un PaymentIntent (si se usa el método tradicional con clientSecret)
router.post('/checkout', async (req, res) => {
    try {
        const { amount, currency, paymentMethodId } = req.body;

        if (!amount || !currency || !paymentMethodId) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            payment_method: paymentMethodId,
            confirm: true,
            confirmation_method: 'manual',
            return_url: `${process.env.BASE_URL}/payment-success`,  // Cambiado a producción
        });

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('❌ Error al crear PaymentIntent:', error);
        res.status(400).json({ error: error.message });
    }
});

// Crear una sesión de Stripe Checkout (el flujo más sencillo para cursos)
router.post('/create-checkout-session', async (req, res) => {
    const { items, userEmail } = req.body;

    if (!items || !userEmail) {
        return res.status(400).json({ error: 'Faltan productos o email del usuario' });
    }

    try {
        const lineItems = items.map(item => ({
            price: item.priceId,
            quantity: item.quantity,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            customer_email: userEmail,
            success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/cancel.html`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('❌ Error al crear la sesión de pago:', error);
        res.status(500).json({ error: 'Error al crear la sesión de pago' });
    }
});

module.exports = router;
