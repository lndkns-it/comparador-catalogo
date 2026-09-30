// POST /api/ai-details
// body: {photo:{data,name}, product:{data,name,specs}, page:{data,number}}
// Reads the product's data (model name, colors, measurements, description)
// from the rendered catalog page. The name is often printed as part of an
// image, which the PDF text parser can't see.
const {hasKey, imageBlock, askJson, sendAiError} = require("./_claude");

const SYSTEM = `You read furniture catalog pages and fill in a product record, in Spanish.
You get the full catalog page, a crop of one product on that page, and usually the store's photo of it.
Fill the record for the product in the crop, using only what the page shows:
- modelo: product type + model name exactly as printed, e.g. "SILLA Oslo", "MESA DE CENTRO Kai". The name may be printed inside an image. If the page shows no name, describe the product briefly (e.g. "Silla tejida con brazos").
- colores: the available colors or finishes listed for it, comma-separated. Empty string if none are listed.
- medidas: measurements as printed, keeping units. Empty string if none.
- descripcion: materials and notable features from the page (cubierta, base, tapiz, patas...), one short line.
- seccion: Comedor (dining tables, chairs, buffets), Sala (sofas, armchairs, coffee and side tables, stools, benches), Escritorio (desks, office chairs, bookcases) or Otra.
Never invent data that isn't on the page.`;

const SCHEMA = {
  type: "object",
  properties: {
    modelo: {type: "string"},
    colores: {type: "string"},
    medidas: {type: "string"},
    descripcion: {type: "string"},
    seccion: {type: "string", enum: ["Comedor", "Sala", "Escritorio", "Otra"]},
  },
  required: ["modelo", "colores", "medidas", "descripcion", "seccion"],
  additionalProperties: false,
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({error: "method"});
  if (!hasKey()) return res.status(500).json({error: "missing_key"});
  const {photo, product, page} = req.body || {};
  if (!product || !product.data || !page || !page.data) return res.status(400).json({error: "bad_request"});

  const specs = Object.entries(product.specs || {}).map(([k, v]) => `${k}: ${v}`).join("; ");
  const content = [
    {type: "text", text: `Página ${page.number || ""} del catálogo:`},
    imageBlock(page.data),
    {type: "text", text: `Recorte del producto en esa página. Texto detectado automáticamente (puede estar incompleto o mal asignado): ${product.name || "sin nombre"}${specs ? ` (${specs})` : ""}`},
    imageBlock(product.data),
  ];
  if (photo && photo.data){
    content.push({type: "text", text: `Foto de la tienda${photo.name ? ` (archivo: ${photo.name})` : ""}:`});
    content.push(imageBlock(photo.data));
  }
  content.push({type: "text", text: "Llena la ficha de este producto."});

  try{
    res.status(200).json(await askJson({system: SYSTEM, content, schema: SCHEMA, effort: "low"}));
  }catch(e){
    sendAiError(res, e);
  }
};
