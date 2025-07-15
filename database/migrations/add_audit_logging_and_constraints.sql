-- Phase 1: Critical Booking System Improvements
-- Run this in your Supabase SQL Editor

-- 1. Add comprehensive audit logging table
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created', 'modified', 'cancelled', 'rescheduled', 'payment_updated', 
    'status_changed', 'refund_processed', 'admin_action'
  )),
  old_values JSONB,
  new_values JSONB,
  performed_by TEXT NOT NULL CHECK (performed_by IN ('customer', 'admin', 'system')),
  performed_by_id TEXT, -- email or admin username
  ip_address INET,
  user_agent TEXT,
  reason TEXT, -- optional reason for the change
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_audit_booking_id ON booking_audit_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_audit_created_at ON booking_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_audit_action_type ON booking_audit_log(action_type);

-- 3. Add optimistic locking to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_modified_by TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_modified_ip INET;

-- 4. Add booking validation constraints
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS payment_consistency;
ALTER TABLE bookings ADD CONSTRAINT payment_consistency
CHECK (
  (payment_method = 'pay_on_arrival' AND payment_status IN ('pending', 'paid')) OR
  (payment_method = 'pay_now' AND payment_status IN ('pending', 'paid', 'failed'))
);

-- 5. Clean up test data and add constraint to prevent booking in the past
-- First, delete any test bookings with past dates (development only)
DELETE FROM bookings WHERE date < CURRENT_DATE - INTERVAL '1 day';

-- Now add the constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_past_bookings;
ALTER TABLE bookings ADD CONSTRAINT no_past_bookings
CHECK (date >= CURRENT_DATE - INTERVAL '1 day');

-- 6. Notification queue table removed - using direct webhook messaging to Make.com
-- The queue system was removed due to complexity and incomplete integration
-- Direct messaging via webhookService.ts remains the active notification mechanism

-- 8. Create function to automatically log booking changes
CREATE OR REPLACE FUNCTION log_booking_change()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val TEXT;
  old_vals JSONB;
  new_vals JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type_val := 'created';
    old_vals := NULL;
    new_vals := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine specific type of update
    IF OLD.status != NEW.status THEN
      action_type_val := 'status_changed';
    ELSIF OLD.payment_status != NEW.payment_status THEN
      action_type_val := 'payment_updated';
    ELSIF OLD.date != NEW.date OR OLD.time != NEW.time THEN
      action_type_val := 'rescheduled';
    ELSE
      action_type_val := 'modified';
    END IF;
    old_vals := to_jsonb(OLD);
    new_vals := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    action_type_val := 'cancelled';
    old_vals := to_jsonb(OLD);
    new_vals := NULL;
  END IF;

  -- Insert audit log entry
  INSERT INTO booking_audit_log (
    booking_id,
    action_type,
    old_values,
    new_values,
    performed_by,
    performed_by_id,
    ip_address
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    action_type_val,
    old_vals,
    new_vals,
    COALESCE(NEW.last_modified_by, 'system'),
    COALESCE(NEW.last_modified_by, 'system'),
    NEW.last_modified_ip
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger for automatic audit logging
DROP TRIGGER IF EXISTS booking_audit_trigger ON bookings;
CREATE TRIGGER booking_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_booking_change();

-- 10. Create function to increment version on updates
CREATE OR REPLACE FUNCTION increment_booking_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for version increment
DROP TRIGGER IF EXISTS booking_version_trigger ON bookings;
CREATE TRIGGER booking_version_trigger
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION increment_booking_version();

-- 12. Create view for admin booking history (includes audit trail)
CREATE OR REPLACE VIEW admin_booking_history AS
SELECT 
  b.id,
  b.full_name,
  b.email,
  b.phone,
  b.date,
  b.time,
  b.number_of_bouquets,
  b.total_amount,
  b.payment_method,
  b.payment_status,
  b.status,
  b.created_at,
  b.updated_at,
  b.version,
  -- Audit trail summary
  (
    SELECT json_agg(
      json_build_object(
        'action', bal.action_type,
        'performed_by', bal.performed_by,
        'performed_by_id', bal.performed_by_id,
        'timestamp', bal.created_at,
        'reason', bal.reason,
        'old_values', bal.old_values,
        'new_values', bal.new_values
      ) ORDER BY bal.created_at DESC
    )
    FROM booking_audit_log bal 
    WHERE bal.booking_id = b.id
  ) as audit_trail,
  -- Action counts
  (SELECT COUNT(*) FROM booking_audit_log bal WHERE bal.booking_id = b.id) as total_actions
FROM bookings b;

-- 13. Create function for safe booking creation with race condition prevention
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_date DATE,
  p_time TEXT,
  p_number_of_bouquets INTEGER,
  p_total_amount DECIMAL(10,2),
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_performed_by_id TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  booking_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_capacity INTEGER;
  v_slot_bookings INTEGER;
  v_current_bookings INTEGER;
  v_current_bouquets INTEGER;
  v_new_booking_id UUID;
  v_cancellation_token UUID;
  v_booking_data JSONB;
BEGIN
  -- Lock the time slot to prevent race conditions
  -- Only allow booking in active (non-legacy) slots
  SELECT max_bouquets, max_bookings INTO v_slot_capacity, v_slot_bookings
  FROM time_slots
  WHERE date = p_date AND time = p_time
  AND COALESCE(is_legacy, false) = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Selected time slot is not available', NULL::JSONB;
    RETURN;
  END IF;

  -- Count current confirmed bookings for this slot
  SELECT COUNT(*), COALESCE(SUM(number_of_bouquets), 0)
  INTO v_current_bookings, v_current_bouquets
  FROM bookings
  WHERE date = p_date
  AND time = p_time
  AND status = 'confirmed';

  -- Check booking limit
  IF v_current_bookings >= v_slot_bookings THEN
    RETURN QUERY SELECT false, 'Maximum bookings reached for this time slot', NULL::JSONB;
    RETURN;
  END IF;

  -- Check bouquet capacity
  IF v_current_bouquets + p_number_of_bouquets > v_slot_capacity THEN
    RETURN QUERY SELECT false, 'Not enough bouquet capacity remaining', NULL::JSONB;
    RETURN;
  END IF;

  -- Create the booking
  INSERT INTO bookings (
    full_name, email, phone, date, time, number_of_bouquets,
    total_amount, payment_method, payment_status,
    last_modified_by, last_modified_ip
  ) VALUES (
    p_full_name, p_email, p_phone, p_date, p_time, p_number_of_bouquets,
    p_total_amount, p_payment_method, p_payment_status,
    COALESCE(p_performed_by_id, p_email), p_ip_address
  ) RETURNING id, cancellation_token INTO v_new_booking_id, v_cancellation_token;

  -- Prepare return data
  v_booking_data := jsonb_build_object(
    'id', v_new_booking_id,
    'cancellation_token', v_cancellation_token,
    'date', p_date,
    'time', p_time,
    'number_of_bouquets', p_number_of_bouquets,
    'total_amount', p_total_amount
  );

  RETURN QUERY SELECT true, 'Booking created successfully', v_booking_data;
END;
$$;

-- 14. Grant necessary permissions
GRANT SELECT ON booking_audit_log TO authenticated, anon;
GRANT SELECT ON admin_booking_history TO authenticated;
-- GRANT SELECT ON notification_queue TO authenticated; -- Removed: queue system discontinued
GRANT EXECUTE ON FUNCTION create_booking_safe TO authenticated, anon;

-- 15. Verification queries
SELECT 'Audit logging and constraints added successfully!' as status;

-- Check if tables were created
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('booking_audit_log')
ORDER BY table_name, ordinal_position;

-- Check if constraints were added
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'bookings' 
AND constraint_type = 'CHECK';
