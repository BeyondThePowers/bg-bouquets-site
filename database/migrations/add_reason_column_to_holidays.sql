-- Add reason column to holidays table
-- This migration adds the missing 'reason' column that the API expects

-- Add the reason column to the holidays table
ALTER TABLE holidays 
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN holidays.reason IS 'Optional reason for the holiday (e.g., Maintenance, Personal, etc.)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'holidays' 
ORDER BY ordinal_position;
