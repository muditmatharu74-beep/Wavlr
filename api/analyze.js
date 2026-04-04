export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { songTitle, artist, genre, mood, lyrics } = req.body;

  if (!songTitle) {
    return res.status(400).json({ error: 'Song title is required' });
  }

  const prompt = `You are a music video AI director. Analyze this song and return ONLY valid JSON (no markdown, no extra text).

Song: "${songTitle}"
Artist: "${artist || 'Unknown'}"
Genre: ${genre}
Mood: ${mood}
Lyrics sample or description: "${lyrics || 'No lyrics provided - use genre/mood to infer'}"

Return this exact JSON:
{
  "bpm": 120,
  "key": "C Minor",
  "energy": "High",
  "primaryMood": "Aggressive",
  "themes": ["street life","hustle","victory"],
  "vibes": ["dark","cinematic","intense"],
  "clipRecommendation": "gaming",
  "captionStyle": "bold",
  "captions": [
    {"time":"0:04","text":"caption line here","type":"hook"},
    {"time":"0:12","text":"caption line here","type":"verse"},
    {"time":"0:20","text":"caption line here","type":"verse"},
    {"time":"0:28","text":"caption line here","type":"build"},
    {"time":"0:36","text":"caption line here","type":"chorus"},
    {"time":"0:44","text":"caption line here","type":"chorus"},
    {"time":"0:52","text":"caption line here","type":"drop"},
    {"time":"1:00","text":"caption line here","type":"bridge"}
  ],
  "templateSuggestion": "hype",
  "socialHook": "short punchy social media caption suggestion",
  "hashtags": ["#music","#rap","#viral"]
}

Make captions authentic to the song's style and themes. Keep them punchy, 2-6 words each. BPM should be realistic for the genre.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    const raw = data.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
}
