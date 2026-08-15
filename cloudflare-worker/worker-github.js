const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Filename'
};

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/health') return json({ ok: true, github_token: !!env.GITHUB_TOKEN, repo: env.GITHUB_REPO || 'enzzosuarez17-max/contabilidad1' });
    if (request.method !== 'POST' || url.pathname !== '/upload') return json({ error: 'Ruta no encontrada', expected: 'POST /upload' }, 404);
    if (!env.GITHUB_TOKEN) return json({ error: 'Falta configurar GITHUB_TOKEN en Cloudflare.' }, 503);

    const type = request.headers.get('content-type') || '';
    if (!type.toLowerCase().startsWith('image/png')) return json({ error: 'Solo se aceptan imágenes PNG.', received: type }, 415);

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.byteLength) return json({ error: 'La imagen llegó vacía.' }, 400);
    if (bytes.byteLength > 8 * 1024 * 1024) return json({ error: 'Imagen demasiado grande (máximo 8 MB).' }, 413);

    const raw = request.headers.get('x-filename') || `ejercicio-${Date.now()}.png`;
    const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `ejercicios/${Date.now()}-${safe}`;
    const repo = env.GITHUB_REPO || 'enzzosuarez17-max/contabilidad1';

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
        body: JSON.stringify({
          message: `Guardar ejercicio de Matemáticas II: ${safe}`,
          content: arrayBufferToBase64(bytes)
        })
      });
    } catch (e) {
      return json({ error: 'No se pudo contactar a GitHub.', detail: String(e) }, 502);
    }

    const responseText = await gh.text();
    if (!gh.ok) {
      let detail = responseText;
      try { detail = JSON.parse(responseText); } catch {}
      return json({ error: 'GitHub rechazó la subida.', status: gh.status, detail }, 502);
    }

    let data;
    try { data = JSON.parse(responseText); } catch { return json({ error: 'GitHub respondió algo inesperado.', detail: responseText }, 502); }
    const imageUrl = `https://raw.githubusercontent.com/${repo}/main/${path}`;
    return json({ ok: true, path, url: imageUrl, github: data.content?.html_url || `https://github.com/${repo}/blob/main/${path}` });
  }
};

function arrayBufferToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return btoa(binary);
}
