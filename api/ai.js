// KM.OS — AI-proxy voor Vercel. Plaats dit als api/ai.js
// Je API-sleutel blijft hier op de server; de browser ziet hem nooit.

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.AI_ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.AI_API_KEY;
  if (!key) return res.status(500).json({ error: 'AI_API_KEY ontbreekt' });

  const { kind = 'text', prompt = '', system = '', width, height, seconds } = req.body || {};
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  try {
    if (kind === 'text') {
      const base = process.env.AI_BASE || 'https://api.openai.com/v1';
      const r = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model: process.env.AI_TEXT_MODEL || 'gpt-4o-mini',
          messages: [ system && { role: 'system', content: system }, { role: 'user', content: prompt } ].filter(Boolean),
          temperature: 0.7
        })
      });
      const j = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: j.error?.message || 'upstream error' });
      return res.json({ text: j.choices?.[0]?.message?.content || '' });
    }

    const model = kind === 'video' ? process.env.AI_VIDEO_MODEL : process.env.AI_IMAGE_MODEL;
    if (!model) return res.status(400).json({ error: 'Geen model ingesteld voor ' + kind });

    if (provider === 'replicate') {
      const create = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, Prefer: 'wait' },
        body: JSON.stringify({ version: model, input: { prompt, width, height, num_frames: seconds ? seconds * 24 : undefined } })
      });
      const j = await create.json();
      if (!create.ok) return res.status(create.status).json({ error: j.detail || 'replicate error' });
      const out = Array.isArray(j.output) ? j.output[j.output.length - 1] : j.output;
      return res.json({ url: out, raw: j.status });
    }

    if (provider === 'fal') {
      const r = await fetch('https://fal.run/' + model, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + key },
        body: JSON.stringify({ prompt, image_size: width && height ? { width, height } : undefined })
      });
      const j = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: j.detail || 'fal error' });
      return res.json({ url: j.video?.url || j.images?.[0]?.url || j.image?.url || '' });
    }

    if (provider === 'huggingface') {
      const r = await fetch('https://api-inference.huggingface.co/models/' + model, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ inputs: prompt })
      });
      if (!r.ok) return res.status(r.status).json({ error: await r.text() });
      const buf = Buffer.from(await r.arrayBuffer());
      return res.json({ url: 'data:image/png;base64,' + buf.toString('base64') });
    }

    // OpenAI-compatibel beeld
    const base = process.env.AI_BASE || 'https://api.openai.com/v1';
    const r = await fetch(base + '/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, prompt, size: (width && height) ? width + 'x' + height : '1024x1024' })
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: j.error?.message || 'image error' });
    const d = j.data?.[0];
    return res.json({ url: d?.url || (d?.b64_json ? 'data:image/png;base64,' + d.b64_json : '') });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
