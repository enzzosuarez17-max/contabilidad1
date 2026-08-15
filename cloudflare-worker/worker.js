export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (url.pathname !== '/upload' || request.method !== 'POST') return new Response('Not found', { status: 404, headers: cors() });
    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('image/png')) return new Response('PNG only', { status: 415, headers: cors() });
    const body = await request.arrayBuffer();
    if (body.byteLength > 10 * 1024 * 1024) return new Response('Too large', { status: 413, headers: cors() });
    const raw = request.headers.get('x-filename') || `ejercicio-${Date.now()}.png`;
    const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `ejercicios/${Date.now()}-${safe}`;
    await env.BUCKET.put(key, body, { httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' } });
    const publicBase = env.PUBLIC_BASE_URL.replace(/\/$/, '');
    return Response.json({ url: `${publicBase}/${key}` }, { headers: cors() });
  }
};
function cors() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Filename' }; }
