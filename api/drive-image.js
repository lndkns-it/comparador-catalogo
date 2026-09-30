// GET /api/drive-image?id=<fileId>
// Proxies a Drive image through our own origin so the page can read its
// pixels (Drive doesn't send CORS headers). Serves a ~1000px thumbnail when
// Drive has one, which also keeps responses under Vercel's body size limit.
const {apiKey, getMeta, sendError} = require("./_drive");

const MAX_ORIGINAL_BYTES = 4 * 1024 * 1024;

module.exports = async (req, res) => {
  if (!apiKey()) return res.status(500).json({error: "missing_key"});
  const id = String(req.query.id || "");
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) return res.status(400).json({error: "bad_id"});

  try{
    const meta = await getMeta(id);
    let upstream = null;
    if (meta.thumbnailLink){
      const thumbUrl = meta.thumbnailLink.replace(/=s\d+$/, "=s1000");
      const r = await fetch(thumbUrl);
      if (r.ok) upstream = r;
    }
    if (!upstream && Number(meta.size || 0) <= MAX_ORIGINAL_BYTES){
      const qs = new URLSearchParams({alt: "media", key: apiKey(), supportsAllDrives: "true"});
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?${qs}`);
      if (r.ok) upstream = r;
    }
    if (!upstream) return res.status(404).json({error: "not_found"});

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || meta.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).end(buf);
  }catch(e){
    sendError(res, e);
  }
};
