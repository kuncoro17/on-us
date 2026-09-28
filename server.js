const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 8001);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur. Salin .env.example menjadi .env lalu isi koneksi PostgreSQL.");
}

const pool = new Pool({ connectionString: databaseUrl });
const uploadDirectory = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype)),
});

app.use(express.json());
app.use("/uploads", (_request, response) => response.status(403).json({ message: "Berkas tidak dapat diakses langsung." }));
app.use(express.static(__dirname));

app.get("/api/payment-info", (_request, response) => {
  response.json({
    bank_name: process.env.CHURCH_BANK_NAME || "Rekening Gereja",
    account_number: process.env.CHURCH_BANK_ACCOUNT || "Belum diatur",
    account_holder: process.env.CHURCH_ACCOUNT_HOLDER || "Panitia WFF",
    instructions: process.env.PAYMENT_INSTRUCTIONS || "Transfer sesuai nominal donasi, lalu unggah bukti transfer.",
    qris_image_url: process.env.QRIS_IMAGE_URL || "",
  });
});

app.get("/api/events", async (_request, response, next) => {
  try {
    const result = await pool.query("SELECT id, nama FROM events ORDER BY nama ASC");
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/keuskupan", async (_request, response, next) => {
  try {
    const result = await pool.query("SELECT id, nama FROM keuskupan ORDER BY nama ASC");
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/paroki-stasi", async (request, response, next) => {
  try {
    const params = [];
    let query = "SELECT id, keuskupan_id, nama, tipe FROM paroki_stasi";

    if (request.query.keuskupan_id) {
      params.push(request.query.keuskupan_id);
      query += " WHERE keuskupan_id = $1";
    }

    query += " ORDER BY tipe ASC, nama ASC";
    const result = await pool.query(query, params);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/participants", async (request, response, next) => {
  try {
    const query = String(request.query.query || "").trim();
    if (query.length < 2) return response.json([]);
    const params = [`%${query}%`];
    let sql = `SELECT p.id, p.nama_strava, e.nama AS event_nama
      FROM event_registrations p JOIN events e ON e.id = p.event_id
      WHERE p.nama_strava ILIKE $1`;
    if (request.query.event_id) { params.push(request.query.event_id); sql += " AND p.event_id = $2"; }
    sql += " ORDER BY p.nama_strava ASC LIMIT 8";
    const result = await pool.query(sql, params);
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.get("/api/product-knowledge", async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT pk.id, cd.nama_perusahaan, cd.nama_produk, cd.deskripsi, cd.logo_path, cd.foto_produk_path, e.nama AS event_nama
       FROM sponsor_product_knowledge pk
       JOIN company_donations cd ON cd.id = pk.company_donation_id AND cd.status = 'DITERIMA'
       JOIN events e ON e.id = cd.event_id
       ORDER BY pk.published_at DESC`,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.get("/api/product-images/:filename", async (request, response, next) => {
  const filename = path.basename(request.params.filename);
  try {
    const result = await pool.query(
      `SELECT 1 FROM sponsor_product_knowledge pk
       JOIN company_donations cd ON cd.id = pk.company_donation_id AND cd.status = 'DITERIMA'
       WHERE cd.foto_produk_path = $1`, [filename],
    );
    if (!result.rowCount) return response.sendStatus(404);
    response.sendFile(path.join(uploadDirectory, filename));
  } catch (error) { next(error); }
});

app.post("/api/event-registrations", async (request, response, next) => {
  const data = request.body;
  const required = [
    "nama_strava",
    "umur",
    "event_id",
    "periode",
    "jenis_pendaftaran",
    "keuskupan_id",
    "paroki_stasi_id",
  ];
  const missing = required.filter((key) => !data[key]);

  if (missing.length || !["INDIVIDU", "KELOMPOK"].includes(data.jenis_pendaftaran)) {
    return response.status(400).json({ message: "Data pendaftaran tidak valid." });
  }
  if (data.jenis_pendaftaran === "KELOMPOK" && !data.nama_kelompok) {
    return response.status(400).json({ message: "Nama kelompok wajib diisi." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO event_registrations (
        event_id, nama_strava, umur, nama_wilayah, lingkungan, paroki_stasi_id, keuskupan_id,
        periode, jenis_pendaftaran, nama_kelompok, perumahan, rt, rw,
        nama_jalan, desa_kelurahan
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING id, created_at`,
      [
        data.event_id,
        data.nama_strava,
        data.umur,
        data.nama_wilayah || null,
        data.lingkungan || null,
        data.paroki_stasi_id || null,
        data.keuskupan_id || null,
        data.periode,
        data.jenis_pendaftaran,
        data.nama_kelompok || null,
        data.perumahan || null,
        data.rt || null,
        data.rw || null,
        data.nama_jalan || null,
        data.desa_kelurahan || null,
      ],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/api/donations", upload.single("bukti_transfer"), async (request, response, next) => {
  const data = request.body;
  if (!request.file || !data.event_id || !data.aktivitas || !data.jarak || !Number.isFinite(Number(data.nominal)) || Number(data.nominal) <= 0) {
    return response.status(400).json({ message: "Data donasi belum lengkap." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO event_donations (event_id, nama_peserta, aktivitas, jarak, nominal, metode_pembayaran, bukti_transfer_path, deskripsi)
       VALUES ($1, $2, $3, $4, $5, 'TRANSFER', $6, $7) RETURNING id, status`,
      [data.event_id, data.nama_peserta || null, data.aktivitas, data.jarak, data.nominal, request.file.filename, data.deskripsi || null],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    fs.unlink(request.file.path, () => {});
    next(error);
  }
});

app.post("/api/company-donations", upload.fields([
  { name: "logo_perusahaan", maxCount: 1 },
  { name: "foto_produk", maxCount: 1 },
  { name: "bukti_transfer", maxCount: 1 },
]), async (request, response, next) => {
  const data = request.body;
  const files = request.files || {};
  const required = ["event_id", "paket", "nama_perusahaan", "alamat_perusahaan", "nama_produk", "nama_pic", "no_hp_wa", "nama_rekening_pengirim", "nominal"];
  if (required.some((key) => !data[key]) || !/^[0-9]{8,15}$/.test(data.no_hp_wa) || !Number.isFinite(Number(data.nominal)) || Number(data.nominal) <= 0 || !files.logo_perusahaan?.[0] || !files.foto_produk?.[0] || !files.bukti_transfer?.[0]) {
    return response.status(400).json({ message: "Data sponsor belum lengkap." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO company_donations (
        event_id, paket, nama_perusahaan, alamat_perusahaan, nama_produk, nama_pic, no_hp_wa,
        nama_rekening_pengirim, nominal, logo_path, foto_produk_path, bukti_transfer_path, deskripsi
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, status`,
      [data.event_id, data.paket, data.nama_perusahaan, data.alamat_perusahaan, data.nama_produk, data.nama_pic, data.no_hp_wa, data.nama_rekening_pengirim, data.nominal, files.logo_perusahaan[0].filename, files.foto_produk[0].filename, files.bukti_transfer[0].filename, data.deskripsi || null],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    Object.values(files).flat().forEach((file) => fs.unlink(file.path, () => {}));
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return response.status(400).json({ message: "Ukuran bukti transfer maksimal 5 MB." });
  response.status(500).json({ message: "Terjadi kesalahan pada server." });
});

app.listen(port, () => {
  console.log(`WFF berjalan di http://localhost:${port}`);
});
