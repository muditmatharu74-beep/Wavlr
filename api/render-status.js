import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { render_id, video_id } = req.query;

  if (!render_id) return res.status(400).json({ error: 'render_id required' });

  try {
    const pollRes = await fetch(`https://api.creatomate.com/v1/renders/${render_id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`,
      },
    });

    const data = await pollRes.json();

    if (!pollRes.ok) {
      return res.status(500).json({ error: data.message || 'Poll failed' });
    }

    const status = data.status; // planned, rendering, succeeded, failed
    const url = data.url || null;

    // If done, update Supabase video record
    if (video_id && (status === 'succeeded' || status === 'failed')) {
      await supabase
        .from('videos')
        .update({
          status: status === 'succeeded' ? 'rendered' : 'failed',
          render_url: url,
        })
        .eq('id', video_id);
    }

    return res.status(200).json({ status, url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
