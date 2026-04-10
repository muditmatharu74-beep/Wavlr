export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ 
    stripeKey: process.env.STRIPE_SECRET_KEY ? 'present' : 'MISSING',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || 'MISSING',
    supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING',
    body: req.body
  });
}
