# 📧 Make.com Integration Guide for BG Bouquet Garden

## Overview
This guide explains how to set up Make.com scenarios to handle email automation for the booking system. The website sends webhook payloads to Make.com, which then processes them and sends appropriate emails.

## 🔗 Webhook Architecture

### Consolidated Webhooks for Make.com Free Plan (2 Scenario Limit)
Events are consolidated into 2 webhook URLs to work within Make.com's free plan limitations:

**Scenario 1 - Booking & Error Management:**
- **MAKE_BOOKING_WEBHOOK_URL** - Handles `booking_confirmed` and `booking_error` events

**Scenario 2 - Cancellation & Reschedule Management:**
- **MAKE_CANCELLATION_WEBHOOK_URL** - Handles `booking_cancelled`, `booking_rescheduled`, and `booking_cancelled_admin` events

Each scenario uses the `event` field to filter and route to appropriate email templates.

## 📋 Required Make.com Scenarios

### 1. Booking Confirmation Scenario
**Trigger:** Webhook receives `event: "booking_confirmed"`

**Payload Structure:**
```json
{
  "event": "booking_confirmed",
  "booking": {
    "id": "booking_123",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "(555) 123-4567"
    },
    "visit": {
      "date": "2025-07-15",
      "time": "10:00 AM",
      "visitors": 2,
      "amount": 70
    },
    "payment": {
      "method": "pay_on_arrival",
      "status": "pending",
      "squareOrderId": null,
      "squarePaymentId": null,
      "completedAt": null,
      "details": null
    },
    "metadata": {
      "createdAt": "2025-06-22T10:30:00Z",
      "source": "website",
      "cancellationToken": "uuid-token-here"
    }
  }
}
```

**Actions:**
1. Parse webhook payload
2. Send confirmation email to customer
3. Log successful email delivery

### 2. Cancellation Confirmation Scenario
**Trigger:** Webhook receives `event: "booking_cancelled"`

**Payload Structure:**
```json
{
  "event": "booking_cancelled",
  "booking": {
    "id": "booking_123",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "(555) 123-4567"
    },
    "visit": {
      "date": "2025-07-15",
      "time": "10:00 AM",
      "visitors": 2,
      "amount": 70
    },
    "payment": {
      "method": "pay_on_arrival",
      "status": "cancelled"
    },
    "cancellation": {
      "reason": "Schedule conflict",
      "cancelledAt": "2025-06-22T15:30:00Z"
    },
    "metadata": {
      "source": "website",
      "emailType": "customer_cancellation_confirmation",
      "cancellationToken": "uuid-token-here"
    }
  }
}
```

**Actions:**
1. Parse webhook payload
2. Send cancellation confirmation to customer
3. Log successful email delivery

### 3. Reschedule Confirmation Scenario
**Trigger:** Webhook receives `event: "booking_rescheduled"`

**Payload Structure:**
```json
{
  "event": "booking_rescheduled",
  "booking": {
    "id": "booking_123",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "(555) 123-4567"
    },
    "original": {
      "date": "2025-07-15",
      "time": "10:00 AM"
    },
    "new": {
      "date": "2025-07-20",
      "time": "2:00 PM",
      "visitors": 2,
      "amount": 70
    },
    "payment": {
      "method": "pay_on_arrival",
      "status": "confirmed"
    },
    "reschedule": {
      "reason": "Weather concerns",
      "rescheduledAt": "2025-06-22T16:00:00Z"
    },
    "metadata": {
      "source": "website",
      "emailType": "booking_updated",
      "cancellationToken": "uuid-token-here"
    }
  }
}
```

**Actions:**
1. Parse webhook payload
2. Send reschedule confirmation to customer
3. Log successful email delivery

### 4. Admin Notification Scenario
**Trigger:** Webhook receives `event: "booking_cancelled_admin"`

**Payload Structure:**
```json
{
  "event": "booking_cancelled_admin",
  "booking": {
    "id": "booking_123",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "(555) 123-4567"
    },
    "visit": {
      "date": "2025-07-15",
      "time": "10:00 AM",
      "visitors": 2,
      "amount": 70
    },
    "payment": {
      "method": "pay_on_arrival",
      "status": "cancelled"
    },
    "cancellation": {
      "reason": "Customer request via phone",
      "cancelledAt": "2025-06-22T15:30:00Z"
    },
    "metadata": {
      "source": "website",
      "emailType": "admin_cancellation_notification",
      "adminEmail": "admin@bgbouquet.com",
      "cancellationToken": "uuid-token-here"
    }
  }
}
```

**Actions:**
1. Parse webhook payload
2. Send notification to admin email
3. Log successful email delivery

### 5. Error Notification Scenario
**Trigger:** Webhook receives `event: "booking_error"`

**Payload Structure:**
```json
{
  "event": "booking_error",
  "booking": {
    "id": "booking_123",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "visit": {
      "date": "2025-07-15",
      "time": "10:00 AM"
    }
  },
  "error": {
    "message": "Payment processing failed",
    "type": "payment_error"
  },
  "timestamp": "2025-06-22T17:00:00Z"
}
```

**Actions:**
1. Parse webhook payload
2. Send error alert to admin email
3. Log error for monitoring

## 🚀 Setup Instructions

### Step 1: Create Make.com Account
1. Sign up at [make.com](https://make.com)
2. Create a new organization for BG Bouquet Garden

### Step 2: Create Webhook Scenarios
1. Create 5 new scenarios (one for each event type)
2. Add webhook trigger to each scenario
3. Copy webhook URLs for environment variables

### Step 3: Configure Email Templates
1. Add email modules to each scenario
2. Design templates using the payload data
3. Test email delivery

### Step 4: Set Environment Variables
1. Add webhook URLs to `.env` file
2. Deploy to Netlify with environment variables
3. Test webhook connectivity

### Step 5: Test Integration
1. Use `/api/test-webhook` endpoint
2. Verify emails are received
3. Check Make.com execution logs

## 🧪 Testing

### Test Webhook Endpoint
The website includes a test endpoint at `/api/test-webhook`:

```bash
# Test booking confirmation
curl -X POST https://your-site.netlify.app/api/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "confirmation"}'

# Test cancellation
curl -X POST https://your-site.netlify.app/api/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "cancellation"}'

# Test reschedule
curl -X POST https://your-site.netlify.app/api/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "reschedule"}'

# Test admin notification
curl -X POST https://your-site.netlify.app/api/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "cancellation-admin"}'

# Test error notification
curl -X POST https://your-site.netlify.app/api/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "error"}'
```

## 📧 Next Steps
1. Create email templates (see EMAIL_TEMPLATES.md)
2. Set up Make.com scenarios
3. Test webhook integration
4. Deploy to production
