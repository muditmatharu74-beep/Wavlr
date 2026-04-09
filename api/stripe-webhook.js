import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel: disable body parsing so we get raw body for Stripe signature verification
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const { type, data } = event;

  // Helper to update plan in Supabase
  async function updatePlan(userId, plan, subscriptionId) {
    await supabase
      .from('profiles')
      .update({ plan, stripe_subscription_id: subscriptionId, updated_at: new Date().toISOString() })
      .eq('id', userId);
  }

  switch (type) {
    // New subscription started — upgrade user
    case 'checkout.session.completed': {
      const session = data.object;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      const subscriptionId = session.subscription;
      if (userId && plan) {
        await updatePlan(userId, plan, subscriptionId);
        console.log(`Upgraded user ${userId} to ${plan}`);
      }
      break;
    }

    // Subscription renewed — keep plan active
    case 'invoice.payment_succeeded': {
      const invoice = data.object;
      if (invoice.billing_reason === 'subscription_cycle') {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = sub.metadata?.user_id;
        const plan = sub.metadata?.plan;
        if (userId && plan) await updatePlan(userId, plan, invoice.subscription);
      }
      break;
    }

    // Payment failed or subscription cancelled — downgrade to free
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const obj = data.object;
      const subId = obj.subscription || obj.id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId).catch(() => null);
        const userId = sub?.metadata?.user_id;
        if (userId) {
          await supabase
            .from('profiles')
            .update({ plan: 'free', stripe_subscription_id: null, updated_at: new Date().toISOString() })
            .eq('id', userId);
          console.log(`Downgraded user ${userId} to free`);
        }
      }
      break;
    }

    default:
      break;
  }

  return res.status(200).json({ received: true });
}
