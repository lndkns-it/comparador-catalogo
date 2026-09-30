# CLAUDE.md

Project context for Claude Code.

## What this is

**Comparador de Catálogo** matches a batch of product photos against a PDF catalog. For each photo it suggests which catalog product it is, lets a person confirm or correct the match, and collects the confirmed products (section, model, colors, measurements, description, catalog page, photo) in a table that downloads as CSV.

Typical use: a furniture store has a PDF catalog with hundreds of products and a folder of loose photos, and needs to know which model each photo shows so it can upload them to an online store (WooCommerce, Shopify…).

People who don't know the code use the page, and it gets shared with them by link. The UI must be understandable without any explanation.

## Language

- **All user-facing text is Spanish** (labels, toasts, placeholders, empty states, CSV headers). Keep it that way. Use a natural, informal "tú" tone.
- Code identifiers and comments are in English.

## Files

- `index.html`: the whole app (HTML + CSS + JS in one file, no framework, no build step).
- `pdf.min.js` / `pdf.worker.min.js`: vendored PDF.js bundle. Don't edit these files.
- `api/`: Vercel serverless functions (CommonJS) for Google Drive.
  - `drive-list.js`: `?link=` takes a folder or file link and returns `{folder, images:[{id,name}], truncated}`. It walks subfolders (depth ≤ 5, at most 1000 images).
  - `drive-image.js`: `?id=` proxies one image, preferring Drive's `=s1000` thumbnail so the response stays under Vercel's 4.5MB body limit.
  - `_drive.js`: shared helpers. The underscore keeps it from becoming a route.
  - They need the **`GOOGLE_API_KEY`** env var in Vercel: a Google Cloud API key with the Drive API enabled. Folders must be shared as "Cualquier persona con el enlace".
- `README.md`: public, Spanish-language project description.

## Running it

It's a static site. Serve it over HTTP, because the PDF.js worker doesn't load from `file://`:

```bash
python -m http.server 8000   # then open http://localhost:8000/index.html
```

There are no tests and no linter. To check the script for syntax errors, pull the `<script>` block out of the page and run `node --check` on it. To check the layout, take a headless Chrome screenshot (`chrome --headless=new --screenshot=… --window-size=W,H`) at desktop and ~500px widths.

## How it works (the three "stations" in `index.html`)

1. **Catálogo (PDF)**: `parseCatalogPdf()` reads the PDF entirely in the browser.
   - `extractPageTextItems()` gets text with (x, y) positions.
   - `extractPageImages()` follows the transform matrix through the operator list to find where each image sits, renders the page once, and crops those regions. Images smaller than 60px are skipped.
   - `buildPageProducts()` finds product anchors using `CATEGORY_TOKENS` (e.g. `MESA`, `SILLA`, `BUFFET`) and assigns the spec label/value pairs below each one (`SPEC_LABELS`: `MEDIDAS`, `CUBIERTA`, `BASE`…) to the nearest column. Each product is paired with the nearest image on the page.
   - `guessSeccion()` maps a category to Comedor / Sala / Escritorio / Otra through `SECCION_MAP`.
   - Every catalog entry gets a 64-bit **dHash** (`computeDHashFromCanvasSource`).
   - This is a heuristic tuned to one furniture catalog's layout. To support a new catalog, the usual changes are to `CATEGORY_TOKENS`, `SPEC_LABELS` and `SECCION_MAP`.
2. **Fotos**: photos come from file upload or from Google Drive links. A link can point to a folder or to a single file.
   - `driveListImages()` calls `/api/drive-list`. Each image then loads through `/api/drive-image`, so it's same-origin and the page can read its pixels. Four images load at a time (`runPool`).
   - When `/api` isn't available (local `python -m http.server`, or no key configured), single-file links fall back to `driveDirectUrl()`. Drive blocks pixel reads (CORS) on that path, so there's no auto-match. Folder links need `/api`.
   - Each photo is hashed and ranked against the catalog by Hamming distance (`bestMatches`, top 6). The similarity % is `1 - dist/64`. A review card shows the top match, the alternatives, a search by name, and editable fields. If Drive blocks pixel reads (CORS), the hash is `null` and the user picks the match by hand.
3. **Tabla**: confirmed products are saved and shown in an editable table, then exported with `toCsv()`.

## Storage modes

- **Inside a claude.ai Artifact** (`window.claude` is available): uses the `db` capability (`products` collection), `assets` (photo uploads) and `downloads` (CSV). The table is shared with everyone who has the link.
- **Standalone** (Vercel, a local server…): `STANDALONE` is true and `LocalStore` stores the rows in `localStorage` (`catalogo_productos_v1`). The CSV downloads through a blob link.
  - Photos are saved there as ~200px thumbnails (`shrinkDataUrl`) because `localStorage` only holds about 5MB.
  - The table is per browser; it isn't shared between visitors.

Any change to how products are saved has to work in both modes.

## UI conventions

- Colors are CSS custom properties on `:root`, with dark-mode overrides (`prefers-color-scheme` plus `data-theme`). Use the tokens and don't hard-code colors.
- A global `[hidden]{display:none !important}` rule exists because several elements use `display:flex`. Without it, the `hidden` attribute doesn't hide them (this used to make the progress rows show all the time).
- Step states: `setCatalogReady()` turns step 1 into a check mark and unlocks step 2 (`.station.done` / `.station.locked`). `updateReviewCount()` keeps the "pendientes" counter in sync, so call it whenever `State.pendingReviews` changes.
- Any text taken from the PDF or the database must go through `escapeHtml()` before it's inserted with `innerHTML`.
- The page has to work at phone width (16px side gutters, no horizontal page scroll; only the table scrolls sideways).
