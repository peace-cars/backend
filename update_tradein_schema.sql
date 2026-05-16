-- Ensure profiles table allows repairs without phone number
ALTER TABLE profiles ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_number_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_phone_number_key UNIQUE (phone_number);

-- Add commission setting to system_settings
INSERT INTO system_settings (key, value)
VALUES ('evaluation_commission_percent', '0.01')
ON CONFLICT (key) DO NOTHING;

-- Add financing flag to trade-in requests
ALTER TABLE trade_in_requests ADD COLUMN IF NOT EXISTS financing_requested BOOLEAN DEFAULT FALSE;

-- Ensure notifications table has deep-linking fields
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT; 
