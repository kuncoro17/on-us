ALTER TABLE event_donations
  ALTER COLUMN status SET DEFAULT 'DITERIMA';

ALTER TABLE company_donations
  ALTER COLUMN status SET DEFAULT 'DITERIMA';

CREATE OR REPLACE FUNCTION publish_sponsor_product_knowledge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DITERIMA' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'DITERIMA') THEN
    INSERT INTO sponsor_product_knowledge (company_donation_id, logo_path, foto_produk_path, deskripsi)
    VALUES (NEW.id, NEW.logo_path, NEW.foto_produk_path, NEW.deskripsi)
    ON CONFLICT (company_donation_id) DO UPDATE SET
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
AFTER INSERT OR UPDATE ON company_donations
FOR EACH ROW EXECUTE FUNCTION publish_sponsor_product_knowledge();
