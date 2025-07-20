# Schedule Locking Feature - Complete Removal Guide

**⚠️ IMPORTANT: This guide provides instructions for completely removing the schedule locking feature from both the database and codebase. Only use this if you've decided the feature is unwanted.**

## Overview

This document provides step-by-step instructions for safely removing the schedule locking mechanism that was implemented to prevent race conditions between admin schedule updates and customer bookings.

### What Will Be Removed:
- Database columns, tables, functions, and indexes
- Customer-facing lock state UI components
- API integration code
- Admin interface locking controls
- All related JavaScript functionality

### What Will Be Preserved:
- All existing booking functionality
- All existing schedule management
- All existing customer data
- All existing admin functionality (except locking)

---

## Phase 1: Pre-Removal Verification

### For AI Assistant:
Run these verification queries to document current state before removal:

```sql
-- Document current lock state before removal
SELECT 
    setting_key,
    schedule_update_in_progress,
    schedule_update_scheduled_at,
    schedule_update_scheduled_by
FROM schedule_settings 
WHERE schedule_update_in_progress = TRUE 
   OR schedule_update_scheduled_at IS NOT NULL;

-- Count audit logs that will be lost
SELECT COUNT(*) as total_logs FROM schedule_update_logs;

-- Verify no active locks that could affect removal
SELECT is_booking_allowed() as booking_currently_allowed;
```

### For Human User:
1. **Check Admin Interface**: Ensure no schedule updates are currently in progress
2. **Verify Customer Experience**: Confirm booking form is working normally
3. **Backup Database**: Create a full database backup before proceeding
4. **Document Current State**: Note any active scheduled updates or locks

---

## Phase 2: Code Removal (Frontend & API)

### For AI Assistant:

#### 2.1 Remove Customer-Facing Lock State UI
**File: `src/pages/index.astro`**

Remove these HTML components (lines ~185-230):
```html
<!-- Schedule Lock State Messages -->
<div id="schedule-lock-message" class="hidden mb-6...">
<!-- booking-unavailable-message -->
<div id="booking-unavailable-message" class="hidden mb-6...">
```

Remove these JavaScript functions (lines ~3622-3734):
```javascript
// Schedule lock state management functions
function showScheduleLockedMessage(message: string) { ... }
function showBookingUnavailableMessage(message: string) { ... }
function hideScheduleMessages() { ... }
function disableBookingForm() { ... }
function enableBookingForm() { ... }
// Retry button event listeners
```

#### 2.2 Revert loadAvailability() Function
**File: `src/pages/index.astro`**

Replace the enhanced version (lines ~2863-2900) with original:
```javascript
async function loadAvailability() {
    try {
        console.log('Loading availability...');
        const response = await fetch('/api/availability');
        availabilityData = await response.json();
        console.log('Availability data loaded:', availabilityData);

        // Get available dates
        const validDates = Object.keys(availabilityData);
        console.log('Valid dates:', validDates);

        // Initialize always-visible calendar
        initializeCustomCalendar();

        // Show "select a date" prompt (no auto-selection)
        showSelectDatePrompt();

    } catch (error) {
        console.error('Error loading availability:', error);
    }
}
```

#### 2.3 Revert Booking Submission Error Handling
**File: `src/pages/index.astro`**

Replace enhanced error handling (lines ~3494-3515) with original:
```javascript
if (!res.ok) {
    // Show specific error message from server
    alert(result.error || 'There was an error with your booking. Please try again.');
    return;
}
```

#### 2.4 Remove API Lock State Checks
**File: `src/pages/api/bookings.ts`**

Remove lock state checking code (lines ~55-85):
```typescript
// Remove this entire section:
// Check if booking is currently allowed (no schedule update in progress)
const { data: lockStatus, error: lockError } = await supabase...
```

**File: `src/pages/api/availability.ts`**

Remove lock state checking code (lines ~25-50) if it exists.

### For Human User:

#### 2.1 Remove Admin Interface Locking Controls
**File: `src/pages/garden-mgmt/admin.astro`**

1. Remove the "Lock/Unlock Bookings" section from the admin interface
2. Remove any lock status indicators
3. Remove lock-related JavaScript functions
4. Remove any CSS classes related to locking states

**File: `public/styles/schedule-lock.css`**
- Delete this entire file if it exists

#### 2.2 Remove Lock-Related API Endpoints
Check for and remove any dedicated lock management API endpoints:
- `/api/schedule-lock` or similar
- Any admin-specific locking endpoints

---

## Phase 3: Database Removal

### For AI Assistant:

Create and run this rollback SQL script:

```sql
-- Schedule Locking Feature Removal Script
-- WARNING: This will permanently remove all locking functionality

BEGIN;

-- 1. Drop functions (in reverse dependency order)
DROP FUNCTION IF EXISTS auto_timeout_schedule_updates();
DROP FUNCTION IF EXISTS process_scheduled_updates();
DROP FUNCTION IF EXISTS is_booking_allowed();

-- 2. Drop indexes
DROP INDEX IF EXISTS idx_schedule_update_scheduled_at;

-- 3. Drop audit table (WARNING: This removes all lock history)
DROP TABLE IF EXISTS schedule_update_logs;

-- 4. Remove columns from schedule_settings
ALTER TABLE schedule_settings 
DROP COLUMN IF EXISTS schedule_update_in_progress,
DROP COLUMN IF EXISTS schedule_update_scheduled_at,
DROP COLUMN IF EXISTS schedule_update_scheduled_by,
DROP COLUMN IF EXISTS schedule_update_json;

-- 5. Verify removal
SELECT 
    'REMOVAL VERIFICATION' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'schedule_settings' 
            AND column_name = 'schedule_update_in_progress'
        ) THEN 'COLUMNS STILL EXIST ✗'
        ELSE 'COLUMNS REMOVED ✓'
    END as columns_status,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'schedule_update_logs'
        ) THEN 'AUDIT TABLE STILL EXISTS ✗'
        ELSE 'AUDIT TABLE REMOVED ✓'
    END as audit_table_status,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'is_booking_allowed'
        ) THEN 'FUNCTIONS STILL EXIST ✗'
        ELSE 'FUNCTIONS REMOVED ✓'
    END as functions_status;

COMMIT;
```

### For Human User:

1. **Backup First**: Ensure you have a complete database backup
2. **Run During Maintenance**: Execute during low-traffic period
3. **Monitor**: Watch for any errors during execution
4. **Verify**: Confirm all components are removed successfully

---

## Phase 4: Post-Removal Verification

### For AI Assistant:

Run comprehensive verification:

```sql
-- Verify complete removal
SELECT 
    table_name,
    column_name
FROM information_schema.columns 
WHERE column_name LIKE '%schedule_update%'
   OR column_name LIKE '%lock%';

-- Should return empty result

-- Test booking system still works
SELECT 
    setting_key,
    setting_value,
    created_at IS NOT NULL as has_created_at,
    updated_at IS NOT NULL as has_updated_at
FROM schedule_settings 
ORDER BY setting_key;

-- Verify no broken references
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_definition LIKE '%is_booking_allowed%'
   OR routine_definition LIKE '%schedule_update%';
```

### For Human User:

1. **Test Booking Flow**: Complete a test booking from start to finish
2. **Test Admin Interface**: Verify all admin functions work normally
3. **Check Error Logs**: Monitor application logs for any errors
4. **User Acceptance**: Confirm customer experience is normal

---

## Phase 5: Cleanup and Documentation

### For AI Assistant:

1. **Remove Migration Files**: Delete or archive the migration files:
   - `database/migrations/add_schedule_update_locking.sql`
   - `database/verification/` directory

2. **Update Code Comments**: Remove any references to locking in comments

3. **Clean Dependencies**: Check if any imported libraries were only used for locking

### For Human User:

1. **Update Documentation**: Remove references to locking from user guides
2. **Update Deployment Scripts**: Remove any deployment steps related to locking
3. **Notify Team**: Inform team members that locking feature has been removed
4. **Archive This Guide**: Keep this removal guide for future reference

---

## Emergency Rollback

If issues arise during removal:

### Immediate Steps:
1. **Stop the removal process**
2. **Restore from backup** if database changes were applied
3. **Revert code changes** using version control
4. **Test system functionality**
5. **Investigate the issue** before attempting removal again

### Recovery Commands:
```bash
# Restore database from backup
pg_restore -d your_database backup_file.sql

# Revert code changes
git checkout HEAD~1 -- src/pages/index.astro
git checkout HEAD~1 -- src/pages/api/bookings.ts
```

---

## Success Criteria

The removal is successful when:

- ✅ All lock-related database components are removed
- ✅ All lock-related code is removed
- ✅ Booking system functions normally
- ✅ Admin interface works without locking features
- ✅ No errors in application logs
- ✅ Customer experience is unaffected
- ✅ All tests pass (if applicable)

---

**⚠️ FINAL WARNING: This removal is irreversible without a database backup. Ensure you have a complete backup before proceeding.**

---

## Quick Reference Checklist

### Files to Modify/Remove:
- [ ] `src/pages/index.astro` - Remove lock UI and revert functions
- [ ] `src/pages/api/bookings.ts` - Remove lock state checks
- [ ] `src/pages/api/availability.ts` - Remove lock state checks (if present)
- [ ] `src/pages/garden-mgmt/admin.astro` - Remove admin locking controls
- [ ] `public/styles/schedule-lock.css` - Delete file
- [ ] Database - Run removal SQL script

### Database Components to Remove:
- [ ] `schedule_update_logs` table
- [ ] `is_booking_allowed()` function
- [ ] `process_scheduled_updates()` function
- [ ] `auto_timeout_schedule_updates()` function
- [ ] `idx_schedule_update_scheduled_at` index
- [ ] 4 columns from `schedule_settings` table

### Verification Steps:
- [ ] Pre-removal backup created
- [ ] Code changes applied and tested
- [ ] Database removal script executed
- [ ] Post-removal verification passed
- [ ] Booking system tested end-to-end
- [ ] No errors in application logs
