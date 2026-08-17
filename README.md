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

## Integración con Mercado Libre

El proyecto incluye funciones de Vercel para autorizar la cuenta mediante OAuth con PKCE,
consultar categorías y crear publicaciones únicamente después de recibir una confirmación
explícita.

Configurar estas variables en Vercel para los entornos necesarios:

- `MELI_CLIENT_ID`: Client ID de la aplicación de Mercado Libre.
- `MELI_CLIENT_SECRET`: clave secreta de la aplicación. Nunca debe guardarse en GitHub.
- `MELI_REDIRECT_URI`: `https://catalogo-lovat-psi.vercel.app/api/mercadolibre/callback`.
- `MELI_SESSION_SECRET`: valor aleatorio largo utilizado para cifrar la sesión.

Rutas disponibles:

- `/api/mercadolibre/authorize`: inicia la autorización de la cuenta.
- `/api/mercadolibre/callback`: recibe y valida el código OAuth.
- `/api/mercadolibre/status`: comprueba la conexión sin exponer tokens.
- `/api/mercadolibre/categories`: busca categorías y sus atributos.
- `/api/mercadolibre/publish`: crea una publicación confirmada.
- `/api/mercadolibre/notifications`: recibe el callback configurado en la aplicación.

Los tokens se guardan cifrados en una cookie `HttpOnly`, limitada a las rutas de Mercado Libre.
Este diseño es adecuado para el flujo interactivo con aprobación por producto. Si se agregan
procesos autónomos sin navegador, será necesario incorporar un almacén de secretos persistente.
