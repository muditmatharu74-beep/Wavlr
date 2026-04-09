import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role bypasses RLS for server-side ops
);

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  const { method } = req;

  // GET /api/usage?user_id=xxx  — read usage + plan
  if (method === 'GET') {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const month = currentMonth();

    const [profileRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('plan').eq('id', user_id).single(),
      supabase.from('usage').select('count').eq('user_id', user_id).eq('month', month).single(),
    ]);

    const plan = profileRes.data?.plan || 'free';
    const count = usageRes.data?.count || 0;
    const limit = plan === 'free' ? 2 : plan === 'pro' ? 20 : 999999;

    return res.status(200).json({ plan, count, limit, month });
  }

  // POST /api/usage  — increment usage by 1
  if (method === 'POST') {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const month = currentMonth();

    // Check current usage + plan first
    const [profileRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('plan').eq('id', user_id).single(),
      supabase.from('usage').select('count').eq('user_id', user_id).eq('month', month).single(),
    ]);

    const plan = profileRes.data?.plan || 'free';
    const currentCount = usageRes.data?.count || 0;
    const limit = plan === 'free' ? 2 : plan === 'pro' ? 20 : 999999;

    if (currentCount >= limit) {
      return res.status(403).json({ error: 'limit_reached', plan, count: currentCount, limit });
    }

    // Upsert usage row
    const { data, error } = await supabase
      .from('usage')
      .upsert(
        { user_id, month, count: currentCount + 1, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,month' }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ count: data.count, limit, plan });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
