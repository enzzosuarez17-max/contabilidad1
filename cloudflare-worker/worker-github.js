const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Filename'
};

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Temporary, free storage: Cloudflare Cache API. No R2 and no GitHub token.
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, storage: 'cloudflare-cache' });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const key = new Request(url.origin + url.pathname, { method: 'GET' });
      const cached = await caches.default.match(key);
      if (!cached) return json({ error: 'Imagen no encontrada o ya fue retirada de la caché.' }, 404);
      const headers = new Headers(cached.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(cached.body, { status: 200, headers });
    }

    if (request.method !== 'POST' || url.pathname !== '/upload') {
      return json({ error: 'Ruta no encontrada', expected: 'POST /upload o GET /image/:id' }, 404);
    }

    const type = request.headers.get('content-type') || '';
    if (!type.toLowerCase().startsWith('image/png')) {
      return json({ error: 'Solo se aceptan imágenes PNG.', received: type }, 415);
    }

    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return json({ error: 'La imagen llegó vacía.' }, 400);
    if (bytes.byteLength > 25 * 1024 * 1024) return json({ error: 'Imagen demasiado grande (máximo 25 MB).' }, 413);

    const id = `${Date.now()}-${crypto.randomUUID()}`;
    const imagePath = `/image/${id}`;
    const key = new Request(url.origin + imagePath, { method: 'GET' });

    const response = new Response(bytes, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      }
    });

    await caches.default.put(key, response.clone());

    return json({
      ok: true,
      id,
      url: `${url.origin}${imagePath}`,
      storage: 'cloudflare-cache'
    });
  }
};
