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
const adminBuildDirectory = path.join(__dirname, "admin-dist");
const webBuildDirectory = path.join(__dirname, "web-dist");
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype)),
});
const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => callback(null, `gallery-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

app.use(express.json());
app.use("/uploads", (_request, response) => response.status(403).json({ message: "Berkas tidak dapat diakses langsung." }));
// Route eksplisit agar dashboard tetap tersedia pada deployment yang tidak
// melakukan static-file fallback secara otomatis.
app.get("/", (_request, response) => response.sendFile(path.join(webBuildDirectory, "index.html")));
app.get("/legacy-home.html", (_request, response) => response.sendFile(path.join(__dirname, "index.html")));
app.get("/admin", (_request, response) => response.sendFile(path.join(adminBuildDirectory, "index.html")));
app.get("/admin.html", (_request, response) => response.sendFile(path.join(adminBuildDirectory, "index.html")));
app.use("/admin-assets", express.static(adminBuildDirectory));
app.use("/assets", express.static(webBuildDirectory));
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

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

// Admin lokal sederhana: endpoint dibiarkan terbuka selama pengembangan.
app.get("/api/admin/masters", async (_request, response, next) => {
  try {
    const [events, dioceses, parishes] = await Promise.all([
      pool.query("SELECT id, nama FROM events ORDER BY nama ASC"),
      pool.query("SELECT id, nama FROM keuskupan ORDER BY nama ASC"),
      pool.query(`SELECT ps.id, ps.nama, ps.tipe, ps.keuskupan_id, k.nama AS keuskupan_nama
        FROM paroki_stasi ps JOIN keuskupan k ON k.id = ps.keuskupan_id
        ORDER BY k.nama ASC, ps.tipe ASC, ps.nama ASC`),
    ]);
    response.json({ events: events.rows, keuskupan: dioceses.rows, paroki_stasi: parishes.rows });
  } catch (error) { next(error); }
});

app.get("/api/admin/dashboard", async (_request, response, next) => {
  try {
    const [summary, events, donationSeries] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*) FROM event_registrations)::int AS total_participants,
        (SELECT COALESCE(SUM(nominal), 0) FROM event_donations)::numeric AS total_donations,
        (SELECT COALESCE(SUM(nominal), 0) FROM event_donations WHERE status = 'DITERIMA')::numeric AS accepted_donations`),
      pool.query(`SELECT e.id, e.nama,
        COALESCE(r.total_participants, 0)::int AS total_participants,
        COALESCE(d.total_donations, 0)::numeric AS total_donations,
        COALESCE(d.accepted_donations, 0)::numeric AS accepted_donations
        FROM events e
        LEFT JOIN (
          SELECT event_id, COUNT(*) AS total_participants
          FROM event_registrations GROUP BY event_id
        ) r ON r.event_id = e.id
        LEFT JOIN (
          SELECT event_id, SUM(nominal) AS total_donations,
            SUM(nominal) FILTER (WHERE status = 'DITERIMA') AS accepted_donations
          FROM event_donations GROUP BY event_id
        ) d ON d.event_id = e.id
        ORDER BY e.nama ASC`),
      pool.query(`WITH daily_donations AS (
          SELECT d.created_at::date AS tanggal, e.id AS event_id, e.nama AS event_nama,
            COALESCE(SUM(d.nominal), 0)::numeric AS nominal_harian
          FROM event_donations d
          JOIN events e ON e.id = d.event_id
          GROUP BY d.created_at::date, e.id, e.nama
        )
        SELECT TO_CHAR(tanggal, 'YYYY-MM-DD') AS tanggal, event_id, event_nama,
          SUM(nominal_harian) OVER (PARTITION BY event_id ORDER BY tanggal)::numeric AS nominal
        FROM daily_donations
        ORDER BY tanggal ASC, event_nama ASC`),
    ]);
    response.json({ summary: summary.rows[0], events: events.rows, donation_series: donationSeries.rows });
  } catch (error) { next(error); }
});

app.get("/api/admin/events", async (_request, response, next) => {
  try {
    const result = await pool.query("SELECT id, nama FROM events ORDER BY nama ASC");
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.get("/api/admin/keuskupan", async (_request, response, next) => {
  try {
    const result = await pool.query("SELECT id, nama FROM keuskupan ORDER BY nama ASC");
    response.json(result.rows);
  } catch (error) { next(error); }
});

app.get("/api/admin/paroki-stasi", async (_request, response, next) => {
  try {
    const result = await pool.query(`SELECT ps.id, ps.nama, ps.tipe, ps.keuskupan_id, k.nama AS keuskupan_nama
      FROM paroki_stasi ps JOIN keuskupan k ON k.id = ps.keuskupan_id
      ORDER BY k.nama ASC, ps.tipe ASC, ps.nama ASC`);
    response.json(result.rows);
  } catch (error) { next(error); }
});

// Data operasional untuk dashboard panitia. Endpoint ini sengaja dipisahkan dari
// endpoint publik agar informasi peserta dan bukti pembayaran tidak terekspos.
const adminDataQueries = {
  registrations: `SELECT r.*, e.nama AS event_nama, k.nama AS keuskupan_nama, ps.nama AS paroki_stasi_nama
    FROM event_registrations r JOIN events e ON e.id=r.event_id JOIN keuskupan k ON k.id=r.keuskupan_id
    JOIN paroki_stasi ps ON ps.id=r.paroki_stasi_id ORDER BY r.created_at DESC`,
  donations: `SELECT d.*, e.nama AS event_nama FROM event_donations d JOIN events e ON e.id=d.event_id ORDER BY d.created_at DESC`,
  sponsors: `SELECT d.*, e.nama AS event_nama FROM company_donations d JOIN events e ON e.id=d.event_id ORDER BY d.created_at DESC`,
  products: `SELECT pk.*, cd.nama_perusahaan, cd.nama_produk, cd.event_id, e.nama AS event_nama
    FROM sponsor_product_knowledge pk JOIN company_donations cd ON cd.id=pk.company_donation_id
    JOIN events e ON e.id=cd.event_id ORDER BY pk.published_at DESC`,
  gallery: "SELECT id, judul, deskripsi, image_path, created_at FROM gallery_images ORDER BY created_at DESC",
};

app.get("/api/admin/data/:type", async (request, response, next) => {
  const query = adminDataQueries[request.params.type];
  if (!query) return response.status(404).json({ message: "Jenis data admin tidak dikenal." });
  try { response.json((await pool.query(query)).rows); } catch (error) { next(error); }
});

function cleanNullable(value, limit = 1000) {
  const clean = cleanName(value);
  return clean ? clean.slice(0, limit) : null;
}
function validStatus(value) { return ["MENUNGGU_VERIFIKASI", "DITERIMA", "DITOLAK"].includes(value); }
function validPackage(value) { return ["BRONZE", "SILVER", "GOLD"].includes(value); }
function validActivity(value) { return ["LARI", "JALAN", "SEPEDA"].includes(value); }
function validDistance(value) { return ["3 KM", "5 KM", "10 KM", "16 KM", "21 KM", "> 21 KM"].includes(value); }
function validRegistration(data) {
  return validUuid(data.event_id) && validUuid(data.keuskupan_id) && validUuid(data.paroki_stasi_id)
    && cleanNullable(data.nama_strava, 150) && Number.isInteger(Number(data.umur)) && Number(data.umur) > 0 && Number(data.umur) <= 120
    && cleanNullable(data.periode, 50) && ["INDIVIDU", "KELOMPOK"].includes(data.jenis_pendaftaran)
    && (data.jenis_pendaftaran !== "KELOMPOK" || cleanNullable(data.nama_kelompok, 150));
}

app.post("/api/admin/data/registrations", async (request, response, next) => {
  const d = request.body;
  if (!validRegistration(d)) return response.status(400).json({ message: "Data peserta tidak valid." });
  try {
    const result = await pool.query(`INSERT INTO event_registrations (event_id,nama_strava,umur,nama_wilayah,lingkungan,paroki_stasi_id,keuskupan_id,periode,jenis_pendaftaran,nama_kelompok,perumahan,rt,rw,nama_jalan,desa_kelurahan)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`, [d.event_id,cleanNullable(d.nama_strava,150),Number(d.umur),cleanNullable(d.nama_wilayah,150),cleanNullable(d.lingkungan,150),d.paroki_stasi_id,d.keuskupan_id,cleanNullable(d.periode,50),d.jenis_pendaftaran,d.jenis_pendaftaran === "KELOMPOK" ? cleanNullable(d.nama_kelompok,150) : null,cleanNullable(d.perumahan,150),cleanNullable(d.rt,10),cleanNullable(d.rw,10),cleanNullable(d.nama_jalan,255),cleanNullable(d.desa_kelurahan,150)]);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});
app.put("/api/admin/data/registrations/:id", async (request, response, next) => {
  const d = request.body; if (!validUuid(request.params.id) || !validRegistration(d)) return response.status(400).json({ message: "Data peserta tidak valid." });
  try { const result = await pool.query(`UPDATE event_registrations SET event_id=$1,nama_strava=$2,umur=$3,nama_wilayah=$4,lingkungan=$5,paroki_stasi_id=$6,keuskupan_id=$7,periode=$8,jenis_pendaftaran=$9,nama_kelompok=$10,perumahan=$11,rt=$12,rw=$13,nama_jalan=$14,desa_kelurahan=$15 WHERE id=$16 RETURNING id`, [d.event_id,cleanNullable(d.nama_strava,150),Number(d.umur),cleanNullable(d.nama_wilayah,150),cleanNullable(d.lingkungan,150),d.paroki_stasi_id,d.keuskupan_id,cleanNullable(d.periode,50),d.jenis_pendaftaran,d.jenis_pendaftaran === "KELOMPOK" ? cleanNullable(d.nama_kelompok,150) : null,cleanNullable(d.perumahan,150),cleanNullable(d.rt,10),cleanNullable(d.rw,10),cleanNullable(d.nama_jalan,255),cleanNullable(d.desa_kelurahan,150),request.params.id]); if (!result.rowCount) return response.sendStatus(404); response.json(result.rows[0]); } catch (error) { next(error); }
});

async function saveDonation(request, response, next, updating) {
  const d = request.body; if (!validUuid(d.event_id) || !validActivity(d.aktivitas) || !validDistance(d.jarak) || !Number.isFinite(Number(d.nominal)) || Number(d.nominal) <= 0 || !validStatus(d.status)) return response.status(400).json({ message: "Data donasi tidak valid." });
  try { const args=[d.event_id,cleanNullable(d.nama_peserta,150),validUuid(d.participant_id) ? d.participant_id : null,d.aktivitas,d.jarak,Number(d.nominal),cleanNullable(d.deskripsi,1000),d.status]; const sql=updating ? `UPDATE event_donations SET event_id=$1,nama_peserta=$2,participant_id=$3,aktivitas=$4,jarak=$5,nominal=$6,deskripsi=$7,status=$8 WHERE id=$9 RETURNING id` : `INSERT INTO event_donations (event_id,nama_peserta,participant_id,aktivitas,jarak,nominal,bukti_transfer_path,deskripsi,status) VALUES ($1,$2,$3,$4,$5,$6,'ADMIN_ENTRY',$7,$8) RETURNING id`; if (updating) args.push(request.params.id); const result=await pool.query(sql,args); if (!result.rowCount) return response.sendStatus(404); response.status(updating ? 200 : 201).json(result.rows[0]); } catch (error) { next(error); }
}
app.post("/api/admin/data/donations", (a,b,c) => saveDonation(a,b,c,false));
app.put("/api/admin/data/donations/:id", (a,b,c) => validUuid(a.params.id) ? saveDonation(a,b,c,true) : b.status(400).json({ message: "ID tidak valid." }));

async function saveSponsor(request, response, next, updating) {
  const d=request.body; const valid=validUuid(d.event_id)&&validPackage(d.paket)&&cleanNullable(d.nama_perusahaan,150)&&cleanNullable(d.alamat_perusahaan,500)&&cleanNullable(d.nama_produk,150)&&cleanNullable(d.nama_pic,150)&&/^[0-9]{8,15}$/.test(d.no_hp_wa||"")&&cleanNullable(d.nama_rekening_pengirim,150)&&Number(d.nominal)>0&&validStatus(d.status); if (!valid) return response.status(400).json({message:"Data sponsor tidak valid."});
  try { const args=[d.event_id,d.paket,cleanNullable(d.nama_perusahaan,150),cleanNullable(d.alamat_perusahaan,500),cleanNullable(d.nama_produk,150),cleanNullable(d.nama_pic,150),d.no_hp_wa,cleanNullable(d.nama_rekening_pengirim,150),Number(d.nominal),cleanNullable(d.deskripsi,1000),d.status]; const sql=updating ? `UPDATE company_donations SET event_id=$1,paket=$2,nama_perusahaan=$3,alamat_perusahaan=$4,nama_produk=$5,nama_pic=$6,no_hp_wa=$7,nama_rekening_pengirim=$8,nominal=$9,deskripsi=$10,status=$11 WHERE id=$12 RETURNING id` : `INSERT INTO company_donations (event_id,paket,nama_perusahaan,alamat_perusahaan,nama_produk,nama_pic,no_hp_wa,nama_rekening_pengirim,nominal,logo_path,foto_produk_path,bukti_transfer_path,deskripsi,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ADMIN_ENTRY','ADMIN_ENTRY','ADMIN_ENTRY',$10,$11) RETURNING id`; if (updating) args.push(request.params.id); const result=await pool.query(sql,args); if (!result.rowCount) return response.sendStatus(404); response.status(updating?200:201).json(result.rows[0]); } catch(error){next(error);}
}
app.post("/api/admin/data/sponsors", (a,b,c) => saveSponsor(a,b,c,false));
app.put("/api/admin/data/sponsors/:id", (a,b,c) => validUuid(a.params.id) ? saveSponsor(a,b,c,true) : b.status(400).json({message:"ID tidak valid."}));

app.post("/api/admin/data/products", async (request,response,next) => { const d=request.body; if (!validUuid(d.company_donation_id)) return response.status(400).json({message:"Sponsor tidak valid."}); try { const r=await pool.query(`INSERT INTO sponsor_product_knowledge (company_donation_id,logo_path,foto_produk_path,deskripsi) SELECT id,logo_path,foto_produk_path,$2 FROM company_donations WHERE id=$1 RETURNING id`,[d.company_donation_id,cleanNullable(d.deskripsi,1000)]); if(!r.rowCount)return response.status(404).json({message:"Sponsor tidak ditemukan."}); response.status(201).json(r.rows[0]); }catch(e){next(e);} });
app.put("/api/admin/data/products/:id", async (request,response,next) => { if(!validUuid(request.params.id))return response.status(400).json({message:"ID tidak valid."}); try{const r=await pool.query("UPDATE sponsor_product_knowledge SET deskripsi=$1, published_at=NOW() WHERE id=$2 RETURNING id",[cleanNullable(request.body.deskripsi,1000),request.params.id]);if(!r.rowCount)return response.sendStatus(404);response.json(r.rows[0]);}catch(e){next(e);}});

app.post("/api/admin/gallery", galleryUpload.single("image"), async (request, response, next) => {
  const judul = cleanNullable(request.body.judul, 150);
  if (!judul || !request.file) return response.status(400).json({ message: "Judul dan foto galeri wajib diisi." });
  try {
    const result = await pool.query("INSERT INTO gallery_images (judul, deskripsi, image_path) VALUES ($1, $2, $3) RETURNING id", [judul, cleanNullable(request.body.deskripsi, 1000), request.file.filename]);
    response.status(201).json(result.rows[0]);
  } catch (error) { fs.unlink(request.file.path, () => {}); next(error); }
});

app.put("/api/admin/gallery/:id", galleryUpload.single("image"), async (request, response, next) => {
  if (!validUuid(request.params.id)) return response.status(400).json({ message: "Data galeri tidak valid." });
  const judul = cleanNullable(request.body.judul, 150);
  if (!judul) return response.status(400).json({ message: "Judul galeri wajib diisi." });
  try {
    const old = await pool.query("SELECT image_path FROM gallery_images WHERE id = $1", [request.params.id]);
    if (!old.rowCount) { if (request.file) fs.unlink(request.file.path, () => {}); return response.sendStatus(404); }
    const imagePath = request.file ? request.file.filename : old.rows[0].image_path;
    await pool.query("UPDATE gallery_images SET judul=$1, deskripsi=$2, image_path=$3 WHERE id=$4", [judul, cleanNullable(request.body.deskripsi, 1000), imagePath, request.params.id]);
    if (request.file && old.rows[0].image_path !== imagePath) fs.unlink(path.join(uploadDirectory, old.rows[0].image_path), () => {});
    response.json({ id: request.params.id });
  } catch (error) { if (request.file) fs.unlink(request.file.path, () => {}); next(error); }
});

app.delete("/api/admin/gallery/:id", async (request, response, next) => {
  if (!validUuid(request.params.id)) return response.status(400).json({ message: "Data galeri tidak valid." });
  try {
    const result = await pool.query("DELETE FROM gallery_images WHERE id=$1 RETURNING image_path", [request.params.id]);
    if (!result.rowCount) return response.sendStatus(404);
    fs.unlink(path.join(uploadDirectory, result.rows[0].image_path), () => {});
    response.status(204).end();
  } catch (error) { next(error); }
});

app.delete("/api/admin/data/:type/:id", async (request,response,next) => {
  const table = { registrations:"event_registrations", donations:"event_donations", sponsors:"company_donations", products:"sponsor_product_knowledge" }[request.params.type];
  if (!table || !validUuid(request.params.id)) return response.status(400).json({ message:"Data tidak valid." });
  try { const result=await pool.query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`,[request.params.id]); if(!result.rowCount)return response.sendStatus(404); response.status(204).end(); } catch(error){next(error);}
});

app.post("/api/admin/events", async (request, response, next) => {
  const nama = cleanName(request.body.nama);
  if (!nama || nama.length > 150) return response.status(400).json({ message: "Nama event wajib diisi (maks. 150 karakter)." });
  try {
    const result = await pool.query("INSERT INTO events (nama) VALUES ($1) RETURNING id, nama", [nama]);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.put("/api/admin/events/:id", async (request, response, next) => {
  const nama = cleanName(request.body.nama);
  if (!validUuid(request.params.id) || !nama || nama.length > 150) return response.status(400).json({ message: "Data event tidak valid." });
  try {
    const result = await pool.query("UPDATE events SET nama = $1 WHERE id = $2 RETURNING id, nama", [nama, request.params.id]);
    if (!result.rowCount) return response.status(404).json({ message: "Event tidak ditemukan." });
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.delete("/api/admin/events/:id", async (request, response, next) => {
  if (!validUuid(request.params.id)) return response.status(400).json({ message: "ID event tidak valid." });
  try {
    const result = await pool.query("DELETE FROM events WHERE id = $1 RETURNING id", [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ message: "Event tidak ditemukan." });
    response.status(204).end();
  } catch (error) { next(error); }
});

app.post("/api/admin/keuskupan", async (request, response, next) => {
  const nama = cleanName(request.body.nama);
  if (!nama || nama.length > 150) return response.status(400).json({ message: "Nama keuskupan wajib diisi (maks. 150 karakter)." });
  try {
    const result = await pool.query("INSERT INTO keuskupan (nama) VALUES ($1) RETURNING id, nama", [nama]);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.put("/api/admin/keuskupan/:id", async (request, response, next) => {
  const nama = cleanName(request.body.nama);
  if (!validUuid(request.params.id) || !nama || nama.length > 150) return response.status(400).json({ message: "Data keuskupan tidak valid." });
  try {
    const result = await pool.query("UPDATE keuskupan SET nama = $1 WHERE id = $2 RETURNING id, nama", [nama, request.params.id]);
    if (!result.rowCount) return response.status(404).json({ message: "Keuskupan tidak ditemukan." });
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.delete("/api/admin/keuskupan/:id", async (request, response, next) => {
  if (!validUuid(request.params.id)) return response.status(400).json({ message: "ID keuskupan tidak valid." });
  try {
    const result = await pool.query("DELETE FROM keuskupan WHERE id = $1 RETURNING id", [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ message: "Keuskupan tidak ditemukan." });
    response.status(204).end();
  } catch (error) { next(error); }
});

app.post("/api/admin/paroki-stasi", async (request, response, next) => {
  const nama = cleanName(request.body.nama);
  const tipe = String(request.body.tipe || "").toUpperCase();
  const keuskupanId = request.body.keuskupan_id;
  if (!nama || nama.length > 150 || !validUuid(keuskupanId) || !["PAROKI", "STASI"].includes(tipe)) return response.status(400).json({ message: "Data paroki/stasi tidak valid." });
  try {
    const result = await pool.query("INSERT INTO paroki_stasi (keuskupan_id, nama, tipe) VALUES ($1, $2, $3) RETURNING id, keuskupan_id, nama, tipe", [keuskupanId, nama, tipe]);
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.put("/api/admin/paroki-stasi/:id", async (request, response, next) => {
  const nama = cleanName(request.body.nama);
  const tipe = String(request.body.tipe || "").toUpperCase();
  const keuskupanId = request.body.keuskupan_id;
  if (!validUuid(request.params.id) || !nama || nama.length > 150 || !validUuid(keuskupanId) || !["PAROKI", "STASI"].includes(tipe)) return response.status(400).json({ message: "Data paroki/stasi tidak valid." });
  try {
    const result = await pool.query("UPDATE paroki_stasi SET keuskupan_id = $1, nama = $2, tipe = $3 WHERE id = $4 RETURNING id, keuskupan_id, nama, tipe", [keuskupanId, nama, tipe, request.params.id]);
    if (!result.rowCount) return response.status(404).json({ message: "Paroki/Stasi tidak ditemukan." });
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.delete("/api/admin/paroki-stasi/:id", async (request, response, next) => {
  if (!validUuid(request.params.id)) return response.status(400).json({ message: "ID paroki/stasi tidak valid." });
  try {
    const result = await pool.query("DELETE FROM paroki_stasi WHERE id = $1 RETURNING id", [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ message: "Paroki/Stasi tidak ditemukan." });
    response.status(204).end();
  } catch (error) { next(error); }
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

app.get("/api/gallery", async (_request, response, next) => {
  try {
    const result = await pool.query("SELECT id, judul, deskripsi, image_path, created_at FROM gallery_images ORDER BY created_at DESC");
    response.json(result.rows.map((row) => ({ ...row, image_url: `/api/gallery-images/${encodeURIComponent(row.image_path)}` })));
  } catch (error) { next(error); }
});

app.get("/api/gallery-images/:filename", async (request, response, next) => {
  const filename = path.basename(request.params.filename);
  try {
    const result = await pool.query("SELECT 1 FROM gallery_images WHERE image_path = $1", [filename]);
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

app.use("/api", (request, response) => response.status(404).json({
  message: `Endpoint API tidak ditemukan: ${request.method} ${request.originalUrl}`,
}));

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return response.status(400).json({ message: "Ukuran bukti transfer maksimal 5 MB." });
  if (error.code === "23505") return response.status(409).json({ message: "Data dengan nama tersebut sudah ada." });
  if (error.code === "23503") return response.status(409).json({ message: "Data tidak dapat dihapus karena masih digunakan oleh data lain." });
  response.status(500).json({ message: "Terjadi kesalahan pada server." });
});

app.listen(port, () => {
  console.log(`WFF berjalan di http://localhost:${port}`);
});
