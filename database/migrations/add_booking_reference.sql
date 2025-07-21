-- Add Booking Reference System Migration
-- This migration adds human-readable booking reference codes to the booking system
-- Format: BG-YYYYMMDD-XXXX (e.g., BG-20250721-8391)
-- Run this migration in your Supabase SQL Editor

-- 1. Add booking_reference column to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(16) NULL;

-- 2. Create unique index on booking_reference to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_booking_reference 
ON bookings(booking_reference) 
WHERE booking_reference IS NOT NULL;

-- 3. Create function to generate booking references
CREATE OR REPLACE FUNCTION generate_booking_reference(booking_date DATE)
RETURNS VARCHAR(16)
LANGUAGE plpgsql
AS $$
DECLARE
    date_str VARCHAR(8);
    random_suffix VARCHAR(4);
    reference_code VARCHAR(16);
    attempt_count INTEGER := 0;
    max_attempts INTEGER := 10;
BEGIN
    -- Format date as YYYYMMDD
    date_str := TO_CHAR(booking_date, 'YYYYMMDD');
    
    -- Try to generate a unique reference with collision handling
    LOOP
        -- Generate random 4-digit suffix
        random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
        
        -- Construct reference code
        reference_code := 'BG-' || date_str || '-' || random_suffix;
        
        -- Check if this reference already exists
        IF NOT EXISTS (SELECT 1 FROM bookings WHERE booking_reference = reference_code) THEN
            RETURN reference_code;
        END IF;
        
        -- Increment attempt counter and check max attempts
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique booking reference after % attempts', max_attempts;
        END IF;
    END LOOP;
END;
$$;

-- 4. Create function to backfill booking references for existing bookings
CREATE OR REPLACE FUNCTION backfill_booking_references()
RETURNS TABLE(booking_id UUID, old_reference VARCHAR(16), new_reference VARCHAR(16))
LANGUAGE plpgsql
AS $$
DECLARE
    booking_record RECORD;
    generated_reference VARCHAR(15);
BEGIN
    -- Process each booking that doesn't have a reference
    FOR booking_record IN 
        SELECT id, date, created_at 
        FROM bookings 
        WHERE booking_reference IS NULL 
        ORDER BY created_at ASC
    LOOP
        -- Generate reference based on booking date
        generated_reference := generate_booking_reference(booking_record.date);
        
        -- Update the booking with the new reference
        UPDATE bookings 
        SET booking_reference = generated_reference 
        WHERE id = booking_record.id;
        
        -- Return the result for logging
        RETURN QUERY SELECT
            booking_record.id,
            NULL::VARCHAR(16) as old_reference,
            generated_reference as new_reference;
    END LOOP;
END;
$$;

-- 5. Execute backfill for existing bookings
SELECT * FROM backfill_booking_references();

-- 6. Add NOT NULL constraint after backfill (for future bookings)
-- Note: We'll add this constraint in the application layer to ensure
-- all new bookings have references, but keep the column nullable
-- for safety during the migration period

-- 7. Update admin_booking_view to include booking_reference
CREATE OR REPLACE VIEW admin_booking_view AS
SELECT
    b.*,
    -- Include booking reference for admin display
    b.booking_reference,
    -- Status should only be 'active' or 'cancelled', refunds are separate
    CASE
        WHEN b.status = 'cancelled' THEN 'cancelled'
        ELSE 'active'
    END as booking_status,
    -- Payment information for admin display
    CASE
        WHEN b.payment_method = 'pay_on_arrival' AND b.payment_status = 'pending' THEN 'Pay on Arrival'
        WHEN b.payment_method = 'pay_online' AND b.payment_status = 'completed' THEN 'Paid Online'
        WHEN b.payment_method = 'pay_online' AND b.payment_status = 'pending' THEN 'Payment Pending'
        ELSE b.payment_status
    END as payment_display,
    -- Refund information (separate from status)
    CASE
        WHEN b.admin_refund_amount IS NOT NULL THEN true
        ELSE false
    END as has_refund,
    -- Visitor information for display
    CASE
        WHEN b.number_of_visitor_passes > 0 THEN 
            b.number_of_bouquets || ' bouquet' || 
            CASE WHEN b.number_of_bouquets > 1 THEN 's' ELSE '' END ||
            ', ' || b.number_of_visitor_passes || ' visitor pass' ||
            CASE WHEN b.number_of_visitor_passes > 1 THEN 'es' ELSE '' END
        ELSE 
            b.number_of_bouquets || ' bouquet' || 
            CASE WHEN b.number_of_bouquets > 1 THEN 's' ELSE '' END
    END as visit_summary
FROM bookings b;

-- 8. Update admin_booking_history view to include booking_reference
CREATE OR REPLACE VIEW admin_booking_history AS
SELECT 
  b.id,
  b.booking_reference,  -- Add booking reference to history view
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
  -- Audit trail summary (if audit logging exists)
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_audit_log') THEN
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
      )
    ELSE NULL
  END as audit_trail
FROM bookings b
ORDER BY b.created_at DESC;

-- 9. Create index for efficient booking reference lookups
CREATE INDEX IF NOT EXISTS idx_bookings_reference_lookup 
ON bookings(booking_reference) 
WHERE booking_reference IS NOT NULL;

-- 10. Add comment to document the booking reference format
COMMENT ON COLUMN bookings.booking_reference IS 'Human-readable booking reference in format BG-YYYYMMDD-XXXX (16 characters) for customer communication and admin reference';

-- Migration completed successfully
-- Next steps:
-- 1. Update application code to generate references for new bookings
-- 2. Update admin interface to display booking references
-- 3. Update confirmation pages to show booking references
-- 4. Update webhook payloads to include booking references
