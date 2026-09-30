// Shared helpers for the Drive endpoints. Files starting with "_" are not
// exposed as routes by Vercel.
const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function apiKey(){
  return process.env.GOOGLE_API_KEY || "";
}

// Accepts a bare id or any Drive URL: /folders/ID, /file/d/ID, ?id=ID
function extractId(input){
  const s = String(input || "").trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/)
         || s.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
         || s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{10,}$/.test(s) ? s : null;
}

async function driveGet(path, params){
  const qs = new URLSearchParams({
    ...params, key: apiKey(), supportsAllDrives: "true",
  });
  const r = await fetch(`${API}${path}?${qs}`);
  if (!r.ok){
    const err = new Error(`drive ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

function getMeta(id){
  return driveGet(`/${encodeURIComponent(id)}`, {fields: "id,name,mimeType,size,thumbnailLink"});
}

async function listChildren(folderId){
  const out = [];
  let pageToken = "";
  do {
    const data = await driveGet("", {
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? {pageToken} : {}),
    });
    out.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return out;
}

function sendError(res, e){
  if (e && (e.status === 404 || e.status === 403)){
    res.status(404).json({error: "not_found"});
  } else {
    console.error(e);
    res.status(502).json({error: "drive_error"});
  }
}

module.exports = {FOLDER_MIME, apiKey, extractId, getMeta, listChildren, sendError};
