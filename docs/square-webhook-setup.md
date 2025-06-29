# Square Webhook Setup Guide

## Overview

This guide walks you through setting up Square webhooks to automatically send email confirmations when customers complete online payments. The system works as follows:

1. Customer selects "Pay Now" and completes payment on Square
2. Square sends webhook notification to your site
3. Your site updates the booking status and sends data to Make.com
4. Make.com sends the confirmation email to the customer

## Prerequisites

- Square Developer account with sandbox/production app
- Make.com account with webhook scenarios
- Supabase database with Square tracking columns
- Deployed website with webhook endpoint

## Step 1: Add Database Columns

Run this SQL in your Supabase SQL Editor:

```sql
-- Add Square tracking columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS square_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_square_order_id ON bookings(square_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_square_payment_id ON bookings(square_payment_id);
```

## Step 2: Create Make.com Scenarios

### Payment Success Scenario

1. **Create New Scenario** in Make.com
2. **Add Webhook Trigger**:
   - Copy the webhook URL (e.g., `https://hook.us1.make.com/abc123`)
   - Set this as `WEBHOOK_PAYMENT_SUCCESS_URL` in your environment variables

3. **Add Email Module** (Gmail, Outlook, SendGrid, etc.):
   - **To**: `{{booking.email}}`
   - **Subject**: `Payment Confirmed - Your Bluebell Gardens Visit`
   - **Body**: Create a template like:
   ```
   Hi {{booking.full_name}},

   Great news! Your payment has been successfully processed.

   Visit Details:
   - Date: {{booking.date}}
   - Time: {{booking.time}}
   - Visitors: {{booking.number_of_visitors}}
   - Amount Paid: ${{booking.total_amount}}

   We look forward to seeing you at Bluebell Gardens!

   Best regards,
   The Bluebell Gardens Team
   ```

### Payment Failed Scenario (Optional)

1. **Create New Scenario** in Make.com
2. **Add Webhook Trigger**:
   - Copy the webhook URL
   - Set this as `WEBHOOK_PAYMENT_FAILED_URL` in your environment variables

3. **Add Email Module**:
   - **Subject**: `Payment Issue - Bluebell Gardens Booking`
   - **Body**: Inform customer of payment failure and provide next steps

## Step 3: Configure Square Webhooks

### For Sandbox (Development)

1. **Go to Square Developer Dashboard**: https://developer.squareup.com/
2. **Select Your Application**
3. **Go to Webhooks** (in left sidebar)
4. **Click "Add Endpoint"**:
   - **Endpoint URL**: `https://your-dev-site.netlify.app/api/webhooks/square`
   - **API Version**: `2023-10-18` (or latest)
   - **Event Types**: Select these events:
     - `payment.created`
     - `payment.updated`
     - `order.updated`

5. **Save and Copy Signature Key**:
   - Copy the "Signature Key" 
   - Set this as `SQUARE_WEBHOOK_SIGNATURE_KEY` in your environment variables

### For Production

Repeat the same process but use your production domain:
- **Endpoint URL**: `https://bluebellgardens.ca/api/webhooks/square`

## Step 4: Environment Variables

Add these to your `.env.local` (development) and Netlify environment variables (production):

```env
# Square Webhook
SQUARE_WEBHOOK_SIGNATURE_KEY=your-webhook-signature-key

# Make.com Payment Webhooks
WEBHOOK_PAYMENT_SUCCESS_URL=https://hook.us1.make.com/your-success-webhook-id
WEBHOOK_PAYMENT_FAILED_URL=https://hook.us1.make.com/your-failed-webhook-id
```

## Step 5: Testing the Integration

### Test Payment Success Flow

1. **Create a Test Booking**:
   - Go to your booking form
   - Select "Pay Now"
   - Use Square's test card: `4111 1111 1111 1111`
   - Complete the payment

2. **Verify the Flow**:
   - Check your server logs for webhook receipt
   - Verify booking status updated to "paid" in Supabase
   - Confirm customer received email confirmation
   - Check Make.com scenario execution logs

### Test Payment Failure Flow

1. **Use a Declined Test Card**: `4000 0000 0000 0002`
2. **Verify**:
   - Booking status remains "pending" or updates to "failed"
   - Customer receives appropriate notification (if configured)

## Step 6: Webhook Verification

### Test Webhook Endpoint

You can test your webhook endpoint directly:

```bash
# Test webhook endpoint is accessible
curl https://your-site.com/api/webhooks/square

# Should return: "Square webhook endpoint"
```

### Verify Webhook in Square Dashboard

1. Go to your Square webhook configuration
2. Click "Send Test Event"
3. Check your server logs to confirm receipt
4. Verify signature validation is working

## Troubleshooting

### Common Issues

**Webhook Not Receiving Events**
- Verify endpoint URL is correct and accessible
- Check that your site is deployed and running
- Ensure webhook events are properly subscribed

**Signature Verification Failing**
- Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` is correct
- Check that the key matches your Square app environment (sandbox vs production)

**Booking Not Found**
- Ensure `square_order_id` column exists in database
- Verify order ID is being stored during booking creation
- Check that webhook is looking for the correct order ID format

**Make.com Not Receiving Data**
- Verify webhook URLs are correct
- Check Make.com scenario is active
- Test webhook URLs manually with curl

### Debug Webhook Payloads

Add temporary logging to see what Square is sending:

```javascript
// In src/pages/api/webhooks/square.ts
console.log('Raw webhook payload:', rawBody);
console.log('Parsed payload:', JSON.stringify(payload, null, 2));
```

### Test Webhook Manually

```bash
# Send test webhook to Make.com
curl -X POST https://hook.us1.make.com/your-webhook-id \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "payment_success",
    "booking": {
      "id": "test-123",
      "full_name": "Test User",
      "email": "test@example.com",
      "date": "2025-07-01",
      "time": "10:00 AM",
      "number_of_visitors": 2,
      "total_amount": 70
    }
  }'
```

## Security Considerations

1. **Always Verify Signatures**: Never process webhooks without signature verification
2. **Use HTTPS**: Webhook endpoints must use SSL
3. **Rate Limiting**: Consider adding rate limiting to webhook endpoints
4. **Idempotency**: Handle duplicate webhook deliveries gracefully

## Monitoring

Set up monitoring for:
- Webhook delivery failures
- Payment processing errors
- Email delivery failures
- Database update failures

## Next Steps

Once webhooks are working:
1. Test thoroughly with small real payments
2. Monitor webhook delivery and email sending
3. Set up alerting for failed payments or webhooks
4. Document the process for your team
5. Create runbooks for common issues

This completes the Square webhook integration for automated payment confirmations!
