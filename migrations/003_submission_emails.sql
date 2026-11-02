ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE event_donations ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE company_donations ADD COLUMN IF NOT EXISTS email VARCHAR(254);

CREATE INDEX IF NOT EXISTS event_registrations_email_idx ON event_registrations (email);
CREATE INDEX IF NOT EXISTS event_donations_email_idx ON event_donations (email);
CREATE INDEX IF NOT EXISTS company_donations_email_idx ON company_donations (email);
