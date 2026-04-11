import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMPLATE_ID = '16eae61f-7203-4ade-a82f-aca587ef5852';

const CLIP_VIDEOS = {
  gaming: 'https://creatomate.com/files/assets/b68f979c-48c4-41f1-9bf2-98d620b420e7',
  cinematic: 'https://creatomate.com/files/assets/b68f979c-48c4-41f1-9bf2-98d620b420e7',
  stock: 'https://creatomate.com/files/assets/b68f979c-48c4-41f1-9bf2-98d620b420e7',
  anime: 'https://creatomate.com/files/assets/b68f979c-48c4-41f1-9bf2-98d620b420e7',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { video_id, user_id, captions, clip_style, song_title, artist } = req.body;

  if (!user_id || !captions?.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const subtitleText = captions.map(c => c.text).join('\n');

  try {
    const renderRes = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: TEMPLATE_ID,
        modifications: {
          'Video-DHM.source': CLIP_VIDEOS[clip_style] || CLIP_VIDEOS.stock,
          'Subtitles-NZ5.transcript': subtitleText,
        },
      }),
    });

    const text = await renderRes.text();
    let renderData;
    try { renderData = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Creatomate response: ' + text.slice(0, 200) }); }

    if (!renderRes.ok) {
      return res.status(500).json({ error: renderData.message || JSON.stringify(renderData) });
    }

    const renderId = Array.isArray(renderData) ? renderData[0]?.id : renderData?.id;
    if (!renderId) return res.status(500).json({ error: 'No render ID returned' });

    if (video_id) {
      await supabase.from('videos').update({ status: 'rendering', render_id: renderId }).eq('id', video_id);
    }

    return res.status(200).json({ render_id: renderId, status: 'rendering' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
