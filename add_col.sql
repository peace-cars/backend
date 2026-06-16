ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS internal_documents TEXT[] DEFAULT '{}';
NOTIFY pgrst, 'reload schema';
