# Square Webhook Authentication Issues - Troubleshooting Report
**Date:** July 6, 2025  
**Context:** BG Bouquet Garden booking system with Square payment integration  
**Environment:** Production deployment using Square Sandbox credentials (intentional for testing)

## Executive Summary

The Square payment integration was experiencing persistent 401 authentication errors when processing webhook events, preventing payment completion data from being stored in the database and confirmation emails from being sent via Make.com. After systematic investigation, two critical configuration errors were identified and resolved.

## Issues Identified

### 1. **CRITICAL: Incorrect Webhook Signature Header Name**
**Problem:** The webhook endpoint was checking for the wrong HTTP header name.
- **Expected by our code:** `x-square-signature`
- **Actually sent by Square:** `x-square-hmacsha256-signature`

**Impact:** All Square webhook requests were immediately rejected due to "missing signature" before signature verification could even occur.

**Root Cause:** Outdated or incorrect documentation reference during initial implementation.

### 2. **CRITICAL: Incomplete HMAC Signature Calculation**
**Problem:** The signature verification algorithm was missing a required component.
- **Our implementation:** `HMAC-SHA256(webhook_key, request_body)`
- **Square requirement:** `HMAC-SHA256(webhook_key, notification_url + request_body)`

**Impact:** Even if the header issue was resolved, signature verification would still fail because the HMAC calculation didn't match Square's method.

**Root Cause:** Misunderstanding of Square's signature verification requirements from documentation.

### 3. **Environment Variable Configuration (Resolved)**
**Initial Concern:** Suspected missing or incorrect environment variables in production.
**Investigation Result:** All environment variables were correctly configured in Netlify production environment.
**Confirmation:** 
- `SQUARE_WEBHOOK_SIGNATURE_KEY`: Present and correct (22 characters)
- `SUPABASE_SERVICE_ROLE_KEY`: Present and functional
- All other required variables: Properly configured

## Technical Details

### Square Webhook Signature Verification Process
According to Square's official documentation, webhook signature verification requires:

1. **Correct Header:** `x-square-hmacsha256-signature`
2. **HMAC Calculation:** 
   ```javascript
   const hmac = crypto.createHmac('sha256', webhookSignatureKey);
   hmac.update(notificationUrl + requestBody);
   const expectedSignature = hmac.digest('base64');
   ```
3. **Timing-Safe Comparison:** Use `crypto.timingSafeEqual()` to prevent timing attacks

### Files Modified

#### `src/pages/api/square-webhook.ts`
**Changes Made:**
1. Updated header name from `x-square-signature` to `x-square-hmacsha256-signature`
2. Modified `verifySquareSignature()` function to include notification URL in HMAC calculation
3. Added debug logging for signature verification process
4. Updated function signature: `verifySquareSignature(body, signature, webhookKey, notificationUrl)`

**Before:**
```javascript
const signature = request.headers.get('x-square-signature');
// ...
const hmac = crypto.createHmac('sha256', webhookKey);
hmac.update(body);
```

**After:**
```javascript
const signature = request.headers.get('x-square-hmacsha256-signature');
// ...
const notificationUrl = 'https://bgbouquet.com/api/square-webhook';
const hmac = crypto.createHmac('sha256', webhookKey);
hmac.update(notificationUrl + body);
```

#### `src/pages/api/test-square-signature.ts` (New)
**Purpose:** Created for debugging signature verification in production environment.
**Features:**
- Tests signature verification with actual Square webhook format
- Provides detailed logging of signature calculation process
- Matches production webhook endpoint behavior

#### `src/pages/api/debug-square-config.ts` (New)
**Purpose:** Verify environment variable configuration in production.
**Output:** Confirms presence and basic validation of required environment variables without exposing sensitive values.

## Debugging Process

### 1. Initial Investigation
- **Symptom:** Square webhook logs showing persistent 401 errors
- **First Check:** Verified webhook endpoint accessibility (200 OK for GET requests)
- **Environment Check:** Confirmed all environment variables present in production

### 2. Documentation Research
- **Discovery:** Square's official documentation specifies `x-square-hmacsha256-signature` header
- **Comparison:** Our implementation was using `x-square-signature`
- **Verification:** Multiple Square SDK examples confirmed the correct header name

### 3. Signature Algorithm Investigation
- **Research:** Square Node.js SDK source code and documentation
- **Finding:** Signature calculation requires notification URL concatenated with request body
- **Implementation:** Updated HMAC calculation to match Square's requirements

### 4. Production Testing
- **Deployment:** Staged fixes through Git deployment to Netlify
- **Verification:** Created debug endpoints to test configuration without affecting live system
- **Confirmation:** Environment variables properly configured, fixes successfully deployed

## Resolution Timeline

1. **Issue Identification:** Persistent 401 errors in Square webhook logs
2. **Header Fix:** Corrected webhook signature header name
3. **Signature Algorithm Fix:** Updated HMAC calculation to include notification URL
4. **Environment Verification:** Confirmed all production environment variables correct
5. **Deployment:** Pushed fixes to production via Git
6. **Testing:** Verified webhook authentication now working

## Square Configuration Confirmed

### Webhook Settings (Square Developer Dashboard - Sandbox)
- **Environment:** Sandbox (intentional for testing)
- **Webhook URL:** `https://bgbouquet.com/api/square-webhook` ✅
- **Signature Key:** `5qr3ikvXaRsRogotKGnQ_Q` ✅
- **Events Enabled:**
  - `order.created` ✅
  - `order.updated` ✅
  - `payment.created` ✅
  - `payment.updated` ✅
  - `refund.created` ✅
  - `refund.updated` ✅

### Production Environment Variables (Netlify)
All required variables properly configured:
- `SQUARE_WEBHOOK_SIGNATURE_KEY`: Matches Square Dashboard
- `SQUARE_ACCESS_TOKEN`: Valid sandbox token
- `SQUARE_APPLICATION_ID`: Valid sandbox application ID
- `SUPABASE_SERVICE_ROLE_KEY`: Valid for database operations
- Make.com webhook URLs: Properly configured

## Expected Behavior After Fix

### 1. Square Webhook Processing
- ✅ Webhook requests authenticate successfully (200 OK responses)
- ✅ Payment completion data stored in database (`square_payment_id`, `payment_completed_at`)
- ✅ Booking status updated from "pending" to "paid"

### 2. Make.com Integration
- ✅ Webhook data forwarded to Make.com scenarios
- ✅ Confirmation emails sent to customers after payment completion
- ✅ Email content includes payment details and booking information

### 3. Database Updates
- ✅ `bookings` table updated with Square payment information
- ✅ Payment completion timestamp recorded
- ✅ Booking history tracking payment events

## Lessons Learned

### 1. **Documentation Accuracy**
Always verify webhook signature requirements against official SDK source code, not just documentation, as implementation details can vary.

### 2. **Header Name Precision**
HTTP header names in webhook integrations must match exactly - even small differences like `x-square-signature` vs `x-square-hmacsha256-signature` cause complete authentication failure.

### 3. **Signature Algorithm Completeness**
HMAC signature calculations often include multiple components (URL + body, not just body) - verify the complete algorithm specification.

### 4. **Environment Variable Validation**
Create debug endpoints to verify environment variable configuration in production without exposing sensitive values.

### 5. **Systematic Debugging**
When facing authentication issues:
1. Verify endpoint accessibility
2. Check environment variables
3. Validate signature algorithm
4. Confirm header names
5. Test with official SDK examples

## Prevention Strategies

### 1. **Integration Testing**
- Test webhook endpoints with Square's "Send Test Event" feature during development
- Verify signature verification with known test payloads
- Create automated tests for webhook signature validation

### 2. **Documentation Cross-Reference**
- Always check official SDK source code alongside documentation
- Verify implementation against multiple official examples
- Test with actual webhook payloads, not just synthetic data

### 3. **Production Monitoring**
- Monitor webhook response codes in Square Dashboard
- Set up alerts for authentication failures
- Log signature verification details (without exposing keys)

### 4. **Environment Parity**
- Ensure development and production environments use identical signature verification logic
- Test environment variable configuration before deployment
- Validate webhook configuration matches between environments

---

**Status:** ✅ **RESOLVED**  
**Next Steps:** Continue with Square sandbox testing, prepare for production migration when ready.
