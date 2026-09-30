// GET /api/drive-list?link=<folder or file link>
// Returns {images:[{id,name}]}: every image in the folder (and its
// subfolders), or the single file if the link points to one image.
const {FOLDER_MIME, apiKey, extractId, getMeta, listChildren, sendError} = require("./_drive");

const MAX_IMAGES = 1000;
const MAX_DEPTH = 5;

module.exports = async (req, res) => {
  if (!apiKey()) return res.status(500).json({error: "missing_key"});
  const id = extractId(req.query.link || req.query.id);
  if (!id) return res.status(400).json({error: "bad_link"});

  try{
    const root = await getMeta(id);
    if (root.mimeType !== FOLDER_MIME){
      const isImage = (root.mimeType || "").startsWith("image/");
      return res.status(200).json({images: isImage ? [{id: root.id, name: root.name}] : []});
    }

    const images = [];
    const queue = [{id: root.id, depth: 0, path: ""}];
    while (queue.length && images.length < MAX_IMAGES){
      const folder = queue.shift();
      const children = await listChildren(folder.id);
      children.sort((a,b)=> a.name.localeCompare(b.name, "es", {numeric:true}));
      for (const f of children){
        if (f.mimeType === FOLDER_MIME){
          if (folder.depth < MAX_DEPTH) queue.push({id: f.id, depth: folder.depth + 1, path: folder.path + f.name + "/"});
        } else if ((f.mimeType || "").startsWith("image/")){
          images.push({id: f.id, name: folder.path + f.name});
          if (images.length >= MAX_IMAGES) break;
        }
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({folder: root.name, images, truncated: images.length >= MAX_IMAGES});
  }catch(e){
    sendError(res, e);
  }
};
