# WFF — Wilayah Family Fest

Situs WFF dengan formulir pendaftaran dan API PostgreSQL. Live: https://mellow-mermaid-279e25.netlify.app/

- `index.html` — landing page
- `classifier.html` — halaman tool
- `styles.css`, `tool.css`, `nav.js`, `script.js`
- `registration.js` — interaksi formulir pendaftaran
- `server.js` — API Express untuk PostgreSQL

## Menjalankan lokal

1. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` PostgreSQL.
2. Pastikan tabel `keuskupan` dan `paroki_stasi` sudah dibuat, lalu jalankan `donations.sql` untuk membuat tabel event baru.
3. Jalankan:

```bash
npm install
npm run dev
```

Keuskupan dan Paroki/Stasi wajib dipilih pada formulir.

Alamat menyimpan RT dan RW pada kolom terpisah: `rt` dan `rw`.
Data asal komunitas juga mencakup `nama_wilayah` dan `lingkungan`.

Buka `http://localhost:8001`. API yang tersedia:

- `GET /api/keuskupan`
- `GET /api/events`
- `GET /api/paroki-stasi?keuskupan_id=<uuid>`
- `POST /api/event-registrations`

Catatan: deployment Netlify statis belum dapat menjalankan `server.js`; API perlu dideploy pada layanan Node.js atau Netlify Functions dengan koneksi PostgreSQL yang aman.
