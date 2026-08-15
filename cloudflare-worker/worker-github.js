const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, storage: 'cloudflare-cache' });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const key = new Request(url.origin + url.pathname, { method: 'GET' });
      const cached = await caches.default.match(key);
      if (!cached) return json({ error: 'Imagen no encontrada o retirada de la caché.' }, 404);
      const headers = new Headers(cached.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(cached.body, { status: 200, headers });
    }

    if (request.method !== 'POST' || url.pathname !== '/upload') {
      return json({ error: 'Ruta no encontrada' }, 404);
    }

    const type = (request.headers.get('content-type') || '').toLowerCase();
    if (!(type.startsWith('text/plain') || type.startsWith('application/octet-stream') || type.startsWith('image/png'))) {
      return json({ error: 'Tipo de contenido no permitido', received: type }, 415);
    }

    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return json({ error: 'La imagen llegó vacía.' }, 400);
    if (bytes.byteLength > 25 * 1024 * 1024) return json({ error: 'Imagen demasiado grande.' }, 413);

    const id = `${Date.now()}-${crypto.randomUUID()}`;
    const imagePath = `/image/${id}`;
    const key = new Request(url.origin + imagePath, { method: 'GET' });
    const response = new Response(bytes, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ...CORS
      }
    });

    try {
      await caches.default.put(key, response.clone());
    } catch (e) {
      return json({ error: 'No se pudo guardar en Cloudflare Cache', detail: String(e) }, 500);
    }

    return json({ ok: true, id, url: `${url.origin}${imagePath}`, storage: 'cloudflare-cache' });
  }
};
