# Catálogo · 3D Backdraft

Catálogo público conectado a la misma planilla utilizada por el panel de productos.

Reconoce todas las filas cuyo código de la columna A comienza con `3DB`.
Incluye búsqueda, filtros por categoría y subcategoría, galería de fotos,
detalle del producto, carrito y consulta por WhatsApp.

## Activación

1. Completar en `config.js` la URL `/exec` de Apps Script.
2. Completar `whatsappNumber` con código de país y área, sin símbolos.
3. Publicar la carpeta en GitHub Pages o en el alojamiento elegido.

Sin configurar la API se muestran productos de demostración. El carrito se conserva en el
dispositivo y genera una consulta de WhatsApp; no confirma compras ni procesa pagos.

Las fotos visibles en el catálogo deben poder consultarse públicamente. Si una imagen no aparece,
revisar el uso compartido del archivo o de la carpeta correspondiente en Google Drive.
