// POST /api/ai-match
// body: {photo:{data,name}, candidates:[{i,name,data}]}   (at most 80 candidates)
// Claude looks at the store's photo and the catalog images and picks the
// same product. The page splits big catalogs into chunks and runs a final
// round over each chunk's winners.
const {hasKey, imageBlock, askJson, sendAiError} = require("./_claude");

const MAX_CANDIDATES = 80;

const SYSTEM = `You match product photos to a furniture catalog.
You get numbered catalog images, then one photo taken by a store. Find the catalog image that shows the SAME product model as the photo.

How to judge:
- First decide what kind of product the photo shows (chair, stool, armchair, dining table, coffee table, side table, desk, buffet, sofa...). A candidate of a different kind is never a match, however similar its colors or background are: a chair never matches a table.
- Among candidates of the right kind, compare the design details: silhouette, legs and base, backrest and armrests, weave or upholstery pattern, tabletop shape, materials. Color and upholstery may differ because the same model is sold in several finishes, so weigh shape over color.
- Catalog images may show several products or a set (a table with chairs, for example). A candidate that clearly contains the product counts as a match.
- If no candidate is the same model, return best = -1. A wrong confident match is worse than none.

confidence (0-100) is how sure you are that "best" is the same model. alternatives lists up to 4 other plausible candidate numbers, most likely first.`;

const SCHEMA = {
  type: "object",
  properties: {
    photo_product_type: {type: "string", description: "What the photo shows, in Spanish, e.g. silla con brazos tejida"},
    best: {type: "integer", description: "Candidate number of the same model, or -1"},
    confidence: {type: "integer"},
    alternatives: {type: "array", items: {type: "integer"}},
    reason: {type: "string", description: "One short sentence in Spanish"},
  },
  required: ["photo_product_type", "best", "confidence", "alternatives", "reason"],
  additionalProperties: false,
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({error: "method"});
  if (!hasKey()) return res.status(500).json({error: "missing_key"});
  const {photo, candidates} = req.body || {};
  if (!photo || !photo.data || !Array.isArray(candidates) || !candidates.length || candidates.length > MAX_CANDIDATES){
    return res.status(400).json({error: "bad_request"});
  }

  // Candidates first (identical across photos, so that prefix gets cached), photo last.
  const content = [{type: "text", text: `Catálogo (${candidates.length} imágenes candidatas):`}];
  for (const c of candidates){
    content.push({type: "text", text: `Candidato ${c.i}: ${c.name || "sin nombre"}`});
    content.push(imageBlock(c.data));
  }
  content[content.length - 1].cache_control = {type: "ephemeral"};
  content.push({type: "text", text: `Foto a identificar${photo.name ? ` (nombre de archivo: ${photo.name})` : ""}:`});
  content.push(imageBlock(photo.data));
  content.push({type: "text", text: "¿Qué candidato es el mismo modelo que esta foto?"});

  try{
    const out = await askJson({system: SYSTEM, content, schema: SCHEMA, effort: "medium"});
    const valid = new Set(candidates.map(c => c.i));
    if (!valid.has(out.best)) out.best = -1;
    out.alternatives = (out.alternatives || []).filter(i => valid.has(i) && i !== out.best);
    out.confidence = Math.max(0, Math.min(100, out.confidence | 0));
    res.status(200).json(out);
  }catch(e){
    sendAiError(res, e);
  }
};
