CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul VARCHAR(150) NOT NULL,
  deskripsi VARCHAR(1000),
  image_path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gallery_images_created_at_idx
  ON gallery_images (created_at DESC);
