// stripe.js (raíz)
require('dotenv').config();
const Stripe = require('stripe');

const isTest = (process.env.STRIPE_MODE || 'live') === 'test';

const stripe = new Stripe(
  isTest ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE
);

const STRIPE_PUBLIC_KEY = isTest
  ? process.env.STRIPE_PUBLIC_KEY_TEST
  : process.env.STRIPE_PUBLIC_KEY_LIVE;

const STRIPE_WEBHOOK_SECRET = isTest
  ? process.env.STRIPE_WEBHOOK_SECRET_TEST
  : process.env.STRIPE_WEBHOOK_SECRET_LIVE;

module.exports = {
  stripe,
  STRIPE_PUBLIC_KEY,
  STRIPE_WEBHOOK_SECRET,
  isTest,
};