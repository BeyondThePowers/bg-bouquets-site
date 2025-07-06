# 🧪 Online Payment Confirmation Testing Guide

## Overview
This guide provides comprehensive testing instructions for the new online payment confirmation email system that uses the unified Make.com router approach.

## 🔧 Prerequisites

### Environment Setup
Ensure these environment variables are configured:
```
MAKE_BOOKING_WEBHOOK_URL=https://hook.make.com/your-booking-webhook-id
SQUARE_APPLICATION_ID=sandbox-sq0idb-your_application_id
SQUARE_ACCESS_TOKEN=EAAAl_your_sandbox_access_token
SQUARE_LOCATION_ID=your_location_id
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_signature_key
```

### Make.com Router Setup
- Router configured with two paths (pay-on-arrival vs online payment)
- Email templates updated with conditional content
- Both paths tested and activated

## 🧪 Testing Scenarios

### Test 1: Pay-on-Arrival Booking (Existing Flow)

**Purpose**: Verify existing pay-on-arrival confirmations still work

**Steps**:
1. Create a booking with `paymentMethod: "pay_on_arrival"`
2. Submit booking form
3. Check webhook logs for confirmation email trigger

**Expected Results**:
- Immediate confirmation email sent
- Email shows "Payment: Pay on Arrival"
- No payment reference numbers
- Standard cancellation/reschedule links

**Test Payload**:
```json
{
  "event": "booking_confirmed",
  "booking": {
    "payment": {
      "method": "pay_on_arrival",
      "status": "pending"
    }
  }
}
```

### Test 2: Online Payment Booking (New Flow)

**Purpose**: Verify online payment confirmations work after payment completion

**Steps**:
1. Create a booking with `paymentMethod: "pay_now"`
2. Complete Square payment process
3. Verify Square webhook triggers confirmation email

**Expected Results**:
- Confirmation email sent after payment completion
- Email shows "✅ Payment Confirmed!"
- Includes payment amount and bouquet count
- Shows Square payment reference ID
- Includes refund policy information

**Test Payload**:
```json
{
  "event": "booking_confirmed",
  "booking": {
    "payment": {
      "method": "pay_now",
      "status": "completed",
      "squarePaymentId": "test-payment-123",
      "completedAt": "2025-07-01T10:30:00Z"
    }
  }
}
```

### Test 3: Square Webhook Integration

**Purpose**: Verify Square webhook properly triggers confirmation emails

**Steps**:
1. Create test booking with online payment
2. Use Square's webhook testing tools
3. Send test payment completion webhook
4. Verify confirmation email is triggered

**Square Test Webhook Payload**:
```json
{
  "type": "payment.updated",
  "data": {
    "object": {
      "payment": {
        "id": "test-payment-123",
        "order_id": "test-order-456",
        "status": "COMPLETED",
        "amount_money": {
          "amount": 7000,
          "currency": "CAD"
        }
      }
    }
  }
}
```

## 🔍 Manual Testing Steps

### Step 1: Test Webhook Endpoint
```bash
curl -X POST http://localhost:4321/api/test-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "confirmation",
    "paymentStatus": "completed"
  }'
```

### Step 2: Test Pay-on-Arrival Flow
1. Navigate to booking form
2. Fill out booking details
3. Select "Pay on Arrival"
4. Submit form
5. Check email inbox for confirmation

### Step 3: Test Online Payment Flow
1. Navigate to booking form
2. Fill out booking details  
3. Select "Pay Online"
4. Complete Square payment process
5. Check email inbox for confirmation after payment

### Step 4: Verify Email Content

**Pay-on-Arrival Email Should Include**:
- ✅ Customer name and booking details
- ✅ "Payment: Pay on Arrival" message
- ✅ Total amount to pay on arrival
- ✅ Cancellation/reschedule links
- ❌ No payment reference numbers
- ❌ No refund policy section

**Online Payment Email Should Include**:
- ✅ Customer name and booking details
- ✅ "✅ Payment Confirmed!" message
- ✅ Payment amount and bouquet count
- ✅ Square payment reference ID
- ✅ Payment completion timestamp
- ✅ Refund policy information
- ✅ Cancellation/reschedule links

## 🐛 Troubleshooting

### Issue: No Confirmation Email for Online Payments

**Possible Causes**:
- Square webhook not configured correctly
- Webhook signature verification failing
- Make.com router filter not matching

**Debug Steps**:
1. Check Square webhook logs in dashboard
2. Verify webhook signature key is correct
3. Test router filters in Make.com
4. Check application logs for webhook errors

### Issue: Wrong Email Template Sent

**Possible Causes**:
- Router filter conditions incorrect
- Webhook payload missing payment status
- Make.com conditional logic errors

**Debug Steps**:
1. Verify `booking.payment.status` in webhook payload
2. Test router paths individually
3. Check Make.com execution logs
4. Validate conditional expressions in email template

### Issue: Missing Payment Details in Email

**Possible Causes**:
- Square payment details not included in webhook
- Webhook service not formatting payment data correctly
- Make.com variables not mapped properly

**Debug Steps**:
1. Check webhook payload includes Square payment details
2. Verify webhook service includes payment information
3. Test Make.com variable mapping
4. Validate email template variable references

## 📊 Testing Checklist

### Pre-Deployment Testing
- [ ] Pay-on-arrival bookings still send confirmations
- [ ] Online payment bookings send confirmations after payment
- [ ] Email templates display correct conditional content
- [ ] Router paths work correctly in Make.com
- [ ] Webhook payloads include all required data
- [ ] Square webhook integration functions properly

### Post-Deployment Monitoring
- [ ] Monitor webhook success rates
- [ ] Check email delivery rates
- [ ] Verify customer feedback on email content
- [ ] Monitor Make.com scenario execution logs
- [ ] Track any webhook failures or errors

### Performance Testing
- [ ] Test with multiple concurrent bookings
- [ ] Verify webhook retry logic works
- [ ] Check email delivery timing
- [ ] Monitor Make.com scenario execution time

## 🚀 Go-Live Checklist

Before enabling online payment confirmations in production:

1. **Environment Variables**: Update production environment with correct webhook URLs
2. **Square Configuration**: Switch to production Square credentials
3. **Make.com Setup**: Deploy router configuration to production scenario
4. **Email Templates**: Verify all conditional content works correctly
5. **Testing**: Complete full end-to-end testing in production environment
6. **Monitoring**: Set up alerts for webhook failures
7. **Documentation**: Update customer-facing documentation about email confirmations

## 📞 Support Information

If issues arise during testing:
- Check application logs for webhook errors
- Review Make.com scenario execution logs
- Verify Square webhook delivery in Square dashboard
- Test individual components using provided test endpoints
- Contact development team with specific error messages and logs
