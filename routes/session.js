const { stripe } = require('./paymentRoutes');

const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode,
    customer_email: userEmail,
    success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/cancel.html`,

    return: res.json({ url: session.url })
});
