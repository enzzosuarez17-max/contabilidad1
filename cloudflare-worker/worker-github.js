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
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, github_token: !!env.GITHUB_TOKEN, repo: env.GITHUB_REPO || 'enzzosuarez17-max/contabilidad1' });
    }

    if (request.method !== 'POST' || url.pathname !== '/upload') return json({ error: 'Ruta no encontrada' }, 404);
    if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN no está disponible en el Worker.' }, 503);

    const type = (request.headers.get('content-type') || '').toLowerCase();
    if (!type.startsWith('multipart/form-data')) return json({ error: 'Se esperaba multipart/form-data', received: type }, 415);

    const form = await request.formData();
    const file = form.get('image');
    const filename = String(form.get('filename') || `ejercicio-${Date.now()}.png`);
    if (!(file instanceof File)) return json({ error: 'No llegó el campo image.' }, 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) return json({ error: 'La imagen llegó vacía.' }, 400);
    if (bytes.length > 8 * 1024 * 1024) return json({ error: 'Imagen demasiado grande. Máximo 8 MB.' }, 413);

    const repo = env.GITHUB_REPO || 'enzzosuarez17-max/contabilidad1';
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `ejercicios/${Date.now()}-${safe}`;

    let gh;
    try {
      gh = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'contabilidad1-pizarra'
        },
        body: JSON.stringify({ message: `Guardar ejercicio: ${safe}`, content: arrayBufferToBase64(bytes) })
      });
    } catch (error) {
      return json({ error: 'No se pudo conectar con GitHub.', detail: String(error) }, 502);
    }

    const text = await gh.text();
    if (!gh.ok) {
      let detail = text;
      try { detail = JSON.parse(text); } catch {}
      return json({ error: 'GitHub rechazó la subida.', status: gh.status, detail }, 502);
    }

    const data = JSON.parse(text);
    return json({ ok: true, path, url: `https://raw.githubusercontent.com/${repo}/main/${path}`, github: data.content?.html_url || `https://github.com/${repo}/blob/main/${path}` });
  }
};

function arrayBufferToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  return btoa(binary);
}
