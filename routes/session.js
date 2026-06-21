const { stripe } = require('../stripe');

async function createSession({ lineItems, mode, userEmail, baseUrl }) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode,
    customer_email: userEmail,
    success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cancel.html`,
  });

  return session;
}

module.exports = { createSession };