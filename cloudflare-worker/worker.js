export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors();

    if (request.method === 'OPTIONS') return new Response(null, { headers });

    if (url.pathname.startsWith('/image/') && request.method === 'GET') {
      if (!env.BUCKET) return new Response('R2 todavía no está vinculado a este Worker.', { status: 503, headers });
      const key = decodeURIComponent(url.pathname.slice('/image/'.length));
      const object = await env.BUCKET.get(key);
      if (!object) return new Response('Imagen no encontrada', { status: 404, headers });
      const responseHeaders = new Headers(headers);
      responseHeaders.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
      responseHeaders.set('Cache-Control', object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable');
      return new Response(object.body, { headers: responseHeaders });
    }

    if (url.pathname !== '/upload' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers });
    }

    if (!env.BUCKET) {
      return new Response('R2 todavía no está vinculado a este Worker.', { status: 503, headers });
    }

    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('image/png')) return new Response('PNG only', { status: 415, headers });

    const body = await request.arrayBuffer();
    if (body.byteLength > 10 * 1024 * 1024) return new Response('Too large', { status: 413, headers });

    const raw = request.headers.get('x-filename') || `ejercicio-${Date.now()}.png`;
    const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `ejercicios/${Date.now()}-${safe}`;

    await env.BUCKET.put(key, body, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    return Response.json({
      key,
      url: `${url.origin}/image/${encodeURIComponent(key)}`
    }, { headers });
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Filename'
  };
}
