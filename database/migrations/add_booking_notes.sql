-- Add Booking Notes System Migration
-- This migration adds admin notes functionality to the booking system
-- Notes are admin-only with creation/update timestamps and basic formatting support
-- Run this migration in your Supabase SQL Editor

-- 1. Add notes columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS notes TEXT NULL,
ADD COLUMN IF NOT EXISTS notes_created_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMPTZ NULL;

-- 2. Add check constraint for notes length (2000 characters max)
-- First check if constraint already exists, then add if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_notes_length'
        AND table_name = 'bookings'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT chk_notes_length
        CHECK (notes IS NULL OR char_length(notes) <= 2000);
    END IF;
END $$;

-- 3. Add index for notes queries (for admin interface performance)
CREATE INDEX IF NOT EXISTS idx_bookings_notes_not_null 
ON bookings(id) 
WHERE notes IS NOT NULL;

-- 4. Add comments for documentation
COMMENT ON COLUMN bookings.notes IS 'Admin-only notes for booking management. Max 2000 characters with basic formatting support.';
COMMENT ON COLUMN bookings.notes_created_at IS 'Timestamp when notes were first created';
COMMENT ON COLUMN bookings.notes_updated_at IS 'Timestamp when notes were last updated';

-- 5. Update admin_booking_view to include notes fields
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
    -- Refund display text
    CASE
        WHEN b.admin_refund_amount IS NOT NULL THEN
            CONCAT('$', b.admin_refund_amount::text, ' via ', b.admin_refund_method)
        ELSE NULL
    END as refund_display,
    -- Notes indicator for UI (APPENDED AT END)
    CASE
        WHEN b.notes IS NOT NULL AND trim(b.notes) != '' THEN true
        ELSE false
    END as has_notes
FROM bookings b;

-- 6. Update admin_booking_history view to include notes fields
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
  END as audit_trail,
  -- Include notes fields at the end (APPENDED)
  b.notes,
  b.notes_created_at,
  b.notes_updated_at
FROM bookings b;

-- 7. Create function to update booking notes with proper timestamp handling
CREATE OR REPLACE FUNCTION update_booking_notes(
    p_booking_id UUID,
    p_notes TEXT,
    p_admin_user TEXT
) RETURNS TABLE(success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_notes TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Validate input
    IF p_booking_id IS NULL THEN
        RETURN QUERY SELECT false, 'Booking ID is required';
        RETURN;
    END IF;
    
    IF p_admin_user IS NULL OR trim(p_admin_user) = '' THEN
        RETURN QUERY SELECT false, 'Admin user is required';
        RETURN;
    END IF;
    
    -- Validate notes length
    IF p_notes IS NOT NULL AND char_length(p_notes) > 2000 THEN
        RETURN QUERY SELECT false, 'Notes cannot exceed 2000 characters';
        RETURN;
    END IF;
    
    -- Check if booking exists
    SELECT notes INTO v_existing_notes
    FROM bookings 
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Booking not found';
        RETURN;
    END IF;
    
    -- Update notes with appropriate timestamps
    IF v_existing_notes IS NULL THEN
        -- First time adding notes
        UPDATE bookings 
        SET notes = p_notes,
            notes_created_at = v_now,
            notes_updated_at = v_now,
            last_modified_by = p_admin_user,
            updated_at = v_now
        WHERE id = p_booking_id;
    ELSE
        -- Updating existing notes
        UPDATE bookings 
        SET notes = p_notes,
            notes_updated_at = v_now,
            last_modified_by = p_admin_user,
            updated_at = v_now
        WHERE id = p_booking_id;
    END IF;
    
    -- Log the action if audit logging exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_audit_log') THEN
        INSERT INTO booking_audit_log (
            booking_id, action_type, old_values, new_values, 
            performed_by, performed_by_id, reason
        ) VALUES (
            p_booking_id, 'admin_action', 
            json_build_object('notes', v_existing_notes),
            json_build_object('notes', p_notes),
            'admin', p_admin_user, 'Notes updated'
        );
    END IF;
    
    RETURN QUERY SELECT true, 'Notes updated successfully';
END;
$$;

-- 8. Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_booking_notes TO authenticated;

-- 9. Verification queries
SELECT 'Booking notes system added successfully!' as status;

-- Check if columns were added
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings' 
AND column_name IN ('notes', 'notes_created_at', 'notes_updated_at')
ORDER BY column_name;

-- Check if views were updated
SELECT schemaname, viewname 
FROM pg_views 
WHERE viewname IN ('admin_booking_view', 'admin_booking_history')
ORDER BY viewname;
