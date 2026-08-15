# Subida de ejercicios de la pizarra

La pizarra usa un endpoint `POST` para enviar PNG. GitHub Pages no puede recibir archivos directamente.

## Cloudflare

1. Crear un Worker.
2. Crear un bucket R2, por ejemplo `contabilidad1-ejercicios`.
3. Vincular el bucket al Worker con el binding `BUCKET`.
4. Copiar `worker.js` al Worker.
5. Cambiar `https://REEMPLAZAR-CON-TU-WORKER/upload` en `pizarra-matematicas-ii.html` por la URL del Worker.

El Worker devuelve `{ "url": "..." }` y permite que la pizarra muestre el enlace de la imagen guardada.
