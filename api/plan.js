const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const requestBuckets = globalThis.__atlasPlanBuckets || new Map();
globalThis.__atlasPlanBuckets = requestBuckets;

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST to create a trip plan.' }), { status: 405, headers });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return new Response(JSON.stringify({ error: 'The AI planner is not configured on this deployment yet. You can still use the demo and trip tools.' }), { status: 503, headers });
    let input;
    try { input = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Send a valid JSON request.' }), { status: 400, headers }); }
    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    if (!prompt || prompt.length > 12000) return new Response(JSON.stringify({ error: 'The planning request is empty or too long.' }), { status: 400, headers });
    // Best-effort burst guard per warm function instance. Provider quotas remain the hard limit.
    const now = Date.now();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const recent = (requestBuckets.get(ip) || []).filter(time => now - time < 10 * 60 * 1000);
    if (recent.length >= 20) return new Response(JSON.stringify({ error: 'Atlas is receiving many requests from this network. Try again in a few minutes.' }), { status: 429, headers });
    recent.push(now); requestBuckets.set(ip, recent);
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.65, responseMimeType: 'application/json' } })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status === 429 ? 429 : 502;
        const message = response.status === 429 ? 'The AI service is at its current rate limit. Wait a moment and try again.' : 'The AI service could not create a plan. Check the server key and model setting.';
        return new Response(JSON.stringify({ error: message }), { status, headers });
      }
      const text = result?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
      if (!text) return new Response(JSON.stringify({ error: 'The AI returned an empty plan. Please try again.' }), { status: 502, headers });
      return new Response(JSON.stringify({ text }), { status: 200, headers });
    } catch {
      return new Response(JSON.stringify({ error: 'Could not reach the AI service. Check your connection and retry.' }), { status: 502, headers });
    }
  }
};
