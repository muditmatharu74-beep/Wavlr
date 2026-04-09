import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLANS = {
  pro: {
    name: 'Pro',
    price_id: process.env.STRIPE_PRO_PRICE_ID,  // set in Vercel env
  },
  business: {
    name: 'Business',
    price_id: process.env.STRIPE_BUSINESS_PRICE_ID,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, email, plan } = req.body;

  if (!user_id || !email || !plan) {
    return res.status(400).json({ error: 'user_id, email, and plan required' });
  }

  const planConfig = PLANS[plan];
  if (!planConfig) return res.status(400).json({ error: 'Invalid plan' });

  try {
    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();

    let customerId = profile?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: user_id },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.price_id, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_URL || 'https://wavlr.vercel.app'}/?upgrade=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL || 'https://wavlr.vercel.app'}/?upgrade=cancelled`,
      metadata: { user_id, plan },
      subscription_data: {
        metadata: { user_id, plan },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
}
