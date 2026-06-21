const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Stripe = require('stripe');

const isTest = (process.env.STRIPE_MODE || 'live') === 'test';

const secretKey = isTest
  ? (process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY)
  : (process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY);

if (!secretKey) {
  throw new Error('Falta la clave secreta de Stripe en .env');
}

const stripe = new Stripe(secretKey);

const STRIPE_PUBLIC_KEY = isTest
  ? (process.env.STRIPE_PUBLIC_KEY_TEST || process.env.STRIPE_PUBLIC_KEY)
  : (process.env.STRIPE_PUBLIC_KEY_LIVE || process.env.STRIPE_PUBLIC_KEY);

const STRIPE_WEBHOOK_SECRET = isTest
  ? (process.env.STRIPE_WEBHOOK_SECRET_TEST || process.env.STRIPE_WEBHOOK_SECRET)
  : (process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET);

module.exports = {
  stripe,
  STRIPE_PUBLIC_KEY,
  STRIPE_WEBHOOK_SECRET,
};
