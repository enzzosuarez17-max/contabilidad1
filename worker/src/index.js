export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }
    if (url.pathname !== '/upload' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: cors() });
    }
    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('image/png')) {
      return new Response('Only PNG is accepted', { status: 415, headers: cors() });
    }
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > 10 * 1024 * 1024) {
      return new Response('Image too large', { status: 413, headers: cors() });
    }
    const name = `ejercicios-matematicas-ii/${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID()}.png`;
    const put = await env.DRAWINGS.put(name, bytes, { httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' } });
    return new Response(JSON.stringify({ ok: true, key: name, url: `${env.PUBLIC_BASE_URL}/${name}` }), {
      headers: { 'content-type': 'application/json', ...cors() }
    });
  }
};
function cors(){ return { 'access-control-allow-origin':'*', 'access-control-allow-methods':'POST, OPTIONS', 'access-control-allow-headers':'content-type' }; }
