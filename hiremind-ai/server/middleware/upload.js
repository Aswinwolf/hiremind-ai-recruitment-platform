const multer = require("multer");
const path = require("path");
const fs = require("fs");

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join("uploads", String(req.user?.id || "anon"));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = (require("crypto").randomUUID && require("crypto").randomUUID()) || Date.now();
    cb(null, `${id}${ext}`);
  },
});

const ALLOWED_MIME = new Set(["application/pdf"]);
const ALLOWED_EXT = new Set([".pdf"]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext))
    return cb(new Error("Only PDF files are allowed"), false);
  if (file.originalname.length > 120) return cb(new Error("Filename too long"), false);
  cb(null, true);
};

const MAX = 5 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF-");
async function verifyPdfMagic(filePath) {
  const fd = await fs.promises.open(filePath, "r");
  const buf = Buffer.alloc(5);
  await fd.read(buf, 0, 5, 0);
  await fd.close();
  if (!buf.equals(PDF_MAGIC)) {
    await fs.promises.unlink(filePath);
    throw new Error("Invalid PDF signature");
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX } });
upload.verifyPdfMagic = verifyPdfMagic;
module.exports = upload;
