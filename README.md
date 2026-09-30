# Comparador de Catálogo

Herramienta web para identificar productos de un catálogo en PDF a partir de fotos. Pensada para catálogos de muebles (o cualquier catálogo con fotos de producto), resuelve un flujo típico de tiendas en línea: tienes un PDF con cientos de productos y un lote de fotos sueltas, y necesitas saber a qué modelo corresponde cada foto para poder cargarla a una tienda (WooCommerce, Shopify, etc.) con nombre, colores y medidas.

Todo corre en el navegador — no hay backend ni servidor propio.

## Qué hace

1. **Lee el catálogo en PDF** directamente en el navegador (usando [PDF.js](https://mozilla.github.io/pdf.js/)): extrae cada imagen de producto y el texto cercano (nombre, categoría, medidas, colores, materiales) analizando la posición de cada elemento en la página.
2. **Compara fotos contra el catálogo** con un hash perceptual (dHash) calculado en un `<canvas>`, sin subir ninguna imagen a un servidor. Sugiere el producto más parecido y muestra el porcentaje de similitud.
3. **Deja confirmar o corregir** cada sugerencia a mano — el emparejamiento automático es un punto de partida, no una verdad absoluta.
4. **Arma una tabla editable** con sección (comedor/sala/escritorio/otra), modelo, colores disponibles, medidas y descripción, exportable a CSV.

## Cómo correrlo

Es un sitio estático. Cualquier servidor HTTP simple sirve:

```bash
python3 -m http.server 8000
# abre http://localhost:8000/index.html
```

(No sirve abrir `index.html` directamente con `file://` — el worker de PDF.js necesita un origen `http(s)`.)

## Stack

- HTML/CSS/JavaScript sin dependencias de build — un único archivo (`index.html`) más el bundle de [PDF.js](https://github.com/mozilla/pdf.js) (`pdf.min.js` / `pdf.worker.min.js`), ya incluido en el repo.
- Sin framework, sin paso de compilación: se despliega tal cual en cualquier hosting estático (GitHub Pages, Vercel, Netlify...).

## Notas sobre el emparejamiento automático

El layout de un catálogo de muebles rara vez es una tabla limpia: varias columnas de producto por página, bloques de especificaciones repetidos, páginas con "sets" (mesa + sillas). El parser agrupa el texto por posición (x, y) en cada página para separar columnas en vez de asumir un orden de lectura fijo, pero sigue siendo una heurística — por eso la interfaz siempre deja revisar y corregir antes de guardar cada producto.

## Licencia

Este proyecto se comparte con fines de portafolio.
