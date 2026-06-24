const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.stripe = stripe;

// 1. RUTA PRINCIPAL DE CHECKOUT (Cursos normales y membresías)
router.post('/create-checkout-session', async (req, res) => {
    const { items, userEmail, userId } = req.body;
    
    if (!items || !userEmail || !userId || userId === "null" || userId === "undefined") { 
        return res.status(400).json({ error: 'Debes registrarte o iniciar sesión antes de realizar el pago.' }); 
    }

    const line_items = items.map(item => ({ price: item.priceId, quantity: item.quantity }));
    const prices = await Promise.all(items.map(p => stripe.prices.retrieve(p.priceId)));
    const hasRecurring = prices.some(pr => pr.type === "recurring");
    const hasOneTime = prices.some(pr => pr.type === "one_time");
    
    if (hasRecurring && hasOneTime) {
        return res.status(400).json({ error: "No se pueden mezclar suscripciones y pago único en el mismo checkout." });
    }

    // 🔔 EXTRAEMOS EL CURSO ID: Sacamos el ID del primer artículo que compra
    const cursoId = items[0]?.cursoId || items[0]?.curso_id || items[0]?.id;
    
    const basePayload = {
        line_items,
        customer_email: userEmail,
        success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL}/cancel.html`,
        // 🔥 Ahora guardamos el user_id Y el curso_id para el Webhook
        metadata: {
            user_id: String(userId),
            curso_id: cursoId ? String(cursoId) : ''
        }
    };

    try {
        const modeGuess = items.some(i => String(i.tipo).toLowerCase() === "suscripcion" || String(i.tipo).toLowerCase() === "membresia")
            ? "subscription"
            : "payment";

        console.log("checkout items:", items.map(i => ({ tipo: i.tipo, priceId: i.priceId, cursoId })), "modeGuess:", modeGuess);

        const session = await stripe.checkout.sessions.create({ ...basePayload, mode: modeGuess });
        return res.json({ url: session.url });
    } catch (e) {
        console.error("❌ Error en /create-checkout-session:", e);
        return res.status(500).json({ error: "Error al crear la sesión de pago" });
    }
});

// 2. SEGUNDA RUTA DE CHECKOUT (MÉTODO LEARN / CITAS Y CARRITO DEFINITIVO)
router.post('/crear-checkout', async (req, res) => {
    try {
        const { productos, userEmail, userId, cita } = req.body;

        if (!productos || !userEmail || !userId || userId === "null" || userId === "undefined") {
            return res.status(400).json({ error: 'Debes registrarte o iniciar sesión antes de realizar el pago.' });
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
        
        // 🔔 PRIORIDAD AL ID NUMÉRICO DEL CURSO:
        // Buscamos primero 'cursoId', que es donde inyectamos el item.id numérico en el procesarPago
        const cursoIdNormal = productos[0]?.cursoId || productos[0]?.curso_id || productos[0]?.id;

        const sessionData = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode,
            customer_email: userEmail,
            success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/cancel.html`,
            metadata: {
                user_id: String(userId),
                curso_id: String(cursoIdNormal) // 👈 Aquí viajará el "1" impecable hacia Stripe
            }
        };

        // Si es el Método Learn (cita), añadimos sus datos extras
        if (cita) {
            sessionData.metadata = {
                ...sessionData.metadata,
                curso_id: String(cita.curso_id),
                fecha: cita.fecha,
                hora: cita.hora,
                telefono: cita.telefono || ''
            };
        }

        const session = await stripe.checkout.sessions.create(sessionData);
        console.log("✅ Stripe session creada con metadata:", session.metadata);
        res.json({ url: session.url });
    } catch (error) {
        console.error("❌ Error en /crear-checkout:", error);
        res.status(500).json({ error: 'Error al crear la sesión de pago' });
    }
});

module.exports = router;