export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const body = req.body;
    return res.status(200).json({ 
      received: true, 
      body,
      stripeKey: process.env.STRIPE_SECRET_KEY ? 'present' : 'MISSING',
      supabaseUrl: process.env.SUPABASE_URL ? 'present' : 'MISSING',
      supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
