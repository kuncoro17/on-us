# Struktur proyek WFF

## Aplikasi

```text
WFF
├── server.js                 # HTTP server dan API Express
├── migrations/               # Perubahan skema PostgreSQL berurutan
├── scripts/migrate.js        # Pelaksana migration
├── admin-react/              # Dashboard Admin React
├── web-react/                # Entry point React situs publik
├── index.html                # Konten landing page publik
├── registration.js           # Form pendaftaran peserta
├── donation.js               # Form donasi pribadi
├── company-donation.js       # Form donasi perusahaan
├── gallery.js                # Galeri foto publik
├── slideshow.js              # Carousel contoh kegiatan
├── styles.css                # Gaya situs publik
├── slideshow-assets/         # Aset carousel publik
├── uploads/                  # File unggahan runtime, jangan di-commit
└── admin-dist/, web-dist/    # Hasil build, jangan diedit manual
```

## Aturan perubahan

1. Perubahan database selalu dibuat sebagai migration baru: `migrations/NNN_nama.sql`.
2. Jangan mengubah migration yang telah diterapkan pada database produksi.
3. Jalankan `npm run migrate` setelah menarik migration baru.
4. Kode dashboard diubah di `admin-react/src/`, lalu jalankan `npm run build`.
5. Konten situs publik diubah di `index.html`, JavaScript terkait, atau `styles.css`.
6. Jangan menyimpan password, OAuth secret, atau SMTP password di Git; gunakan `.env`.

## Alur data

```text
Situs publik → Express API → PostgreSQL
Admin → Google OAuth → tabel users → API Admin → PostgreSQL
Form donasi → uploads/ + PostgreSQL → email SMTP
```

## Perintah rutin

```bash
npm run migrate  # Terapkan perubahan database
npm run build    # Build situs publik dan Admin
npm run dev      # Build lalu jalankan server lokal
```
