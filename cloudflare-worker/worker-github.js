const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Filename'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST' || url.pathname !== '/upload') return new Response('Not found', { status: 404, headers: CORS });
    if (!env.GITHUB_TOKEN) return Response.json({ error: 'Falta configurar GITHUB_TOKEN en Cloudflare.' }, { status: 503, headers: CORS });

    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('image/png')) return new Response('PNG only', { status: 415, headers: CORS });

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > 8 * 1024 * 1024) return new Response('Imagen demasiado grande (máximo 8 MB).', { status: 413, headers: CORS });

    const raw = request.headers.get('x-filename') || `ejercicio-${Date.now()}.png`;
    const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `ejercicios/${Date.now()}-${safe}`;
    const repo = env.GITHUB_REPO || 'enzzosuarez17-max/contabilidad1';

    const gh = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'contabilidad1-pizarra'
      },
      body: JSON.stringify({ message: `Guardar ejercicio de Matemáticas II: ${safe}`, content: arrayBufferToBase64(bytes) })
    });

    if (!gh.ok) return Response.json({ error: 'GitHub rechazó la subida', detail: await gh.text() }, { status: 502, headers: CORS });
    const data = await gh.json();
    return Response.json({ path, url: `https://raw.githubusercontent.com/${repo}/main/${path}`, github: data.content?.html_url || `https://github.com/${repo}/blob/main/${path}` }, { headers: CORS });
  }
};

function arrayBufferToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return btoa(binary);
}
