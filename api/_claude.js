// Shared Claude helpers for the AI endpoints. Needs ANTHROPIC_API_KEY in
// Vercel. Files starting with "_" are not exposed as routes.
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-opus-5-5";
let client = null;

function hasKey(){ return !!process.env.ANTHROPIC_API_KEY; }
function getClient(){
  if (!client) client = new Anthropic();
  return client;
}

// "data:image/jpeg;base64,AAA" or bare base64 -> image content block
function imageBlock(data){
  const s = String(data || "");
  const m = s.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/);
  return {
    type: "image",
    source: {type: "base64", media_type: m ? m[1] : "image/jpeg", data: m ? m[2] : s},
  };
}

class RefusalError extends Error{}

// One structured-output call: returns the parsed JSON object.
async function askJson({system, content, schema, effort}){
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {effort, format: {type: "json_schema", schema}},
    system,
    messages: [{role: "user", content}],
  });
  if (response.stop_reason === "refusal") throw new RefusalError("refusal");
  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(text);
}

function sendAiError(res, e){
  if (e instanceof RefusalError) return res.status(422).json({error: "refusal"});
  if (e instanceof Anthropic.RateLimitError) return res.status(429).json({error: "rate_limited"});
  if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({error: "bad_key"});
  if (e instanceof Anthropic.APIError){
    console.error("claude api error", e.status, e.message);
    return res.status(502).json({error: "ai_error"});
  }
  console.error(e);
  res.status(500).json({error: "ai_error"});
}

module.exports = {hasKey, imageBlock, askJson, sendAiError};
