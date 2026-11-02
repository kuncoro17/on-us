CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  nama VARCHAR(150),
  role VARCHAR(30) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (LOWER(email));

CREATE OR REPLACE FUNCTION set_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_users_updated_at();
