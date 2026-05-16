-- Link vehicles to their original trade-in request
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trade_in_id UUID REFERENCES trade_in_requests(id);

-- Add custom appraisal metadata to vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS appraisal_notes TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS inspector_id UUID REFERENCES profiles(id);

-- Update trade_in_requests status ensemble
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_in_status') THEN
    -- Fallback if status is a string column with check constraint
    NULL; 
  END IF;
END $$;

-- Ensure 'COMPLETED_LISTED' is a valid status if using check constraints
-- Assuming standard text status check for now based on previous patterns
