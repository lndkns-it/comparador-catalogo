# Comparador de Catálogo

Herramienta web para identificar productos de un catálogo en PDF a partir de fotos. Pensada para catálogos de muebles (o cualquier catálogo con fotos de producto), resuelve un flujo típico de tiendas en línea: tienes un PDF con cientos de productos y un lote de fotos sueltas, y necesitas saber a qué modelo corresponde cada foto para poder cargarla a una tienda (WooCommerce, Shopify, etc.) con nombre, colores y medidas.

El PDF se lee en el navegador. La identificación de fotos con IA y la lectura de carpetas de Drive usan funciones serverless de Vercel (carpeta `api/`).

## Qué hace

1. **Lee el catálogo en PDF** directamente en el navegador (usando [PDF.js](https://mozilla.github.io/pdf.js/)): extrae cada imagen de producto y el texto cercano (nombre, categoría, medidas, colores, materiales) analizando la posición de cada elemento en la página.
2. **Identifica cada foto con IA** ([Claude](https://www.anthropic.com/claude)): compara la foto con las imágenes del catálogo, descarta productos de otro tipo (una silla nunca es una mesa) y sugiere el modelo con un porcentaje de seguridad. Después lee en la página del catálogo el nombre, los colores y las medidas de ese modelo y llena el formulario, aunque el nombre esté impreso dentro de una imagen.
   Si la IA no está configurada, usa un hash perceptual (dHash) como respaldo, que es mucho menos preciso.
3. **Deja confirmar o corregir** cada sugerencia a mano: "¿No es este?" muestra todos los productos del catálogo, con los más probables primero.
4. **Arma una tabla editable** con sección (comedor/sala/escritorio/otra), modelo, colores disponibles, medidas y descripción, exportable a CSV.

## Cómo correrlo

Es un sitio estático. Cualquier servidor HTTP simple sirve:

```bash
python3 -m http.server 8000
# abre http://localhost:8000/index.html
```

(No sirve abrir `index.html` directamente con `file://` — el worker de PDF.js necesita un origen `http(s)`.)

## Identificación con IA

Las funciones `api/ai-match.js` y `api/ai-details.js` usan la API de Claude (modelo `claude-opus-5-5`). Configuración:

1. Crea una clave en [console.anthropic.com](https://console.anthropic.com/) (Settings → API Keys).
2. En Vercel: Project → Settings → Environment Variables → agrega `ANTHROPIC_API_KEY` con esa clave y vuelve a desplegar.

Costo aproximado: unos pocos centavos de dólar por foto. Depende del tamaño del catálogo: con más de 80 imágenes, cada foto se compara por bloques.

## Fotos desde una carpeta de Google Drive

Puedes pegar el enlace de una carpeta de Drive (compartida como "Cualquier persona con el enlace") y se cargan todas sus fotos, incluidas las de subcarpetas. Esto usa las funciones de Vercel en `api/`, que necesitan una variable de entorno:

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto, habilita la **Google Drive API** y crea una **clave de API** (Credenciales → Crear credenciales → Clave de API). Conviene restringirla a la Google Drive API.
2. En Vercel: Project → Settings → Environment Variables → agrega `GOOGLE_API_KEY` con esa clave y vuelve a desplegar.

Para probarlo localmente usa `vercel dev` en lugar de `python -m http.server`.

## Stack

- HTML/CSS/JavaScript sin dependencias de build — un único archivo (`index.html`) más el bundle de [PDF.js](https://github.com/mozilla/pdf.js) (`pdf.min.js` / `pdf.worker.min.js`), ya incluido en el repo.
- Sin framework, sin paso de compilación. Las funciones de `api/` corren en Vercel; `package.json` solo declara su dependencia (`@anthropic-ai/sdk`). En un hosting estático sin funciones, la página sigue funcionando, pero sin IA ni carpetas de Drive.

## Notas sobre el emparejamiento automático

El layout de un catálogo de muebles rara vez es una tabla limpia: varias columnas de producto por página, bloques de especificaciones repetidos, páginas con "sets" (mesa + sillas). El parser agrupa el texto por posición (x, y) en cada página para separar columnas en vez de asumir un orden de lectura fijo, pero sigue siendo una heurística — por eso la interfaz siempre deja revisar y corregir antes de guardar cada producto.

## Licencia

Este proyecto se comparte con fines de portafolio.
