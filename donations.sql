CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO events (nama)
VALUES ('Walking Fun'), ('Run Fun')
ON CONFLICT (nama) DO NOTHING;

-- Tabel baru khusus pendaftaran event. Tabel pendaftaran_peserta lama tidak diubah.
CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  nama_strava VARCHAR(150) NOT NULL,
  umur SMALLINT NOT NULL CHECK (umur > 0 AND umur <= 120),
  nama_wilayah VARCHAR(150),
  lingkungan VARCHAR(150),
  paroki_stasi_id UUID NOT NULL REFERENCES paroki_stasi(id),
  keuskupan_id UUID NOT NULL REFERENCES keuskupan(id),
  periode VARCHAR(50) NOT NULL,
  jenis_pendaftaran VARCHAR(20) NOT NULL CHECK (jenis_pendaftaran IN ('INDIVIDU', 'KELOMPOK')),
  nama_kelompok VARCHAR(150),
  perumahan VARCHAR(150),
  rt VARCHAR(10),
  rw VARCHAR(10),
  nama_jalan VARCHAR(255),
  desa_kelurahan VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((jenis_pendaftaran = 'INDIVIDU' AND nama_kelompok IS NULL) OR (jenis_pendaftaran = 'KELOMPOK' AND nama_kelompok IS NOT NULL))
);

-- Tabel baru khusus donasi event.
CREATE TABLE IF NOT EXISTS event_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  participant_id UUID REFERENCES event_registrations(id) ON DELETE SET NULL,
  nama_peserta VARCHAR(150),
  aktivitas VARCHAR(20) NOT NULL CHECK (aktivitas IN ('LARI', 'JALAN', 'SEPEDA')),
  jarak VARCHAR(20) NOT NULL CHECK (jarak IN ('3 KM', '5 KM', '10 KM', '16 KM', '21 KM', '> 21 KM')),
  nominal NUMERIC(14, 2) NOT NULL CHECK (nominal > 0),
  metode_pembayaran VARCHAR(20) NOT NULL DEFAULT 'TRANSFER',
  bukti_transfer_path TEXT NOT NULL,
  deskripsi TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI'
    CHECK (status IN ('MENUNGGU_VERIFIKASI', 'DITERIMA', 'DITOLAK')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_donations
  ADD COLUMN IF NOT EXISTS nama_peserta VARCHAR(150);

-- Donasi perusahaan / sponsor. Product Knowledge hanya diterbitkan panitia setelah status DITERIMA.
CREATE TABLE IF NOT EXISTS company_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  paket VARCHAR(20) NOT NULL CHECK (paket IN ('BRONZE', 'SILVER', 'GOLD')),
  nama_perusahaan VARCHAR(150) NOT NULL,
  alamat_perusahaan VARCHAR(500) NOT NULL,
  nama_produk VARCHAR(150) NOT NULL,
  nama_pic VARCHAR(150) NOT NULL,
  no_hp_wa VARCHAR(30) NOT NULL,
  nama_rekening_pengirim VARCHAR(150) NOT NULL,
  nominal NUMERIC(14, 2) NOT NULL CHECK (nominal > 0),
  logo_path TEXT NOT NULL,
  foto_produk_path TEXT NOT NULL,
  bukti_transfer_path TEXT NOT NULL,
  deskripsi TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI'
    CHECK (status IN ('MENUNGGU_VERIFIKASI', 'DITERIMA', 'DITOLAK')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsor_product_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_donation_id UUID NOT NULL UNIQUE REFERENCES company_donations(id) ON DELETE CASCADE,
  logo_path TEXT NOT NULL,
  foto_produk_path TEXT NOT NULL,
  deskripsi TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product Knowledge dibuat otomatis ketika panitia menerima sponsor.
CREATE OR REPLACE FUNCTION publish_sponsor_product_knowledge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DITERIMA' AND OLD.status IS DISTINCT FROM 'DITERIMA' THEN
    INSERT INTO sponsor_product_knowledge (
      company_donation_id, logo_path, foto_produk_path, deskripsi
    ) VALUES (
      NEW.id, NEW.logo_path, NEW.foto_produk_path, NEW.deskripsi
    ) ON CONFLICT (company_donation_id) DO UPDATE SET
      logo_path = EXCLUDED.logo_path,
      foto_produk_path = EXCLUDED.foto_produk_path,
      deskripsi = EXCLUDED.deskripsi,
      published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_donation_product_knowledge ON company_donations;
CREATE TRIGGER company_donation_product_knowledge
AFTER UPDATE OF status ON company_donations
FOR EACH ROW EXECUTE FUNCTION publish_sponsor_product_knowledge();
