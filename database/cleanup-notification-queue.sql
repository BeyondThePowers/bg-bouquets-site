-- Cleanup script for notification queue system removal
-- This script ensures the notification_queue table and related components are fully removed
-- Run this in Supabase SQL Editor if needed

-- Drop the notification_queue table if it exists
DROP TABLE IF EXISTS notification_queue CASCADE;

-- Drop any remaining indexes (in case they weren't dropped with CASCADE)
DROP INDEX IF EXISTS idx_notification_queue_status;
DROP INDEX IF EXISTS idx_notification_queue_scheduled;
DROP INDEX IF EXISTS idx_notification_queue_booking;

-- Verify cleanup
SELECT 
  'notification_queue table cleanup completed' as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'notification_queue'
    ) 
    THEN 'WARNING: notification_queue table still exists'
    ELSE 'SUCCESS: notification_queue table removed'
  END as table_status;

-- Show remaining tables to confirm cleanup
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
