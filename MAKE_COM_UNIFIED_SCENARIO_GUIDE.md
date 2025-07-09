# Make.com Unified Webhook Scenario Configuration Guide

## Overview

This guide explains how to configure a single Make.com scenario to handle all booking-related webhook events from the BG Bouquet Garden website. All webhook events now route to `MAKE_BOOKING_WEBHOOK_URL` with standardized payload structures.

## Webhook Events Handled

All events use the same webhook URL but are differentiated by the `event` field:

- `booking_confirmed` - Customer booking confirmations
- `booking_error` - Error notifications  
- `booking_cancelled` - Customer cancellation confirmations
- `booking_cancelled_admin` - Admin cancellation notifications
- `booking_rescheduled` - Booking reschedule confirmations

## Standardized Payload Structure

All webhook payloads follow this consistent structure:

```json
{
  "event": "booking_confirmed|booking_error|booking_cancelled|booking_cancelled_admin|booking_rescheduled",
  "booking": {
    "id": "string",
    "customer": {
      "name": "string",
      "email": "string", 
      "phone": "string|null"
    },
    "visit": {
      "date": "string (YYYY-MM-DD)",
      "time": "string (H:MM AM/PM)",
      "visitors": "number|null",
      "amount": "number|null",
      "bouquets": "number|null (only for booking_confirmed)"
    },
    "payment": {
      "method": "string|null",
      "status": "pending|completed|cancelled|confirmed",
      "squareOrderId": "string|null",
      "squarePaymentId": "string|null", 
      "completedAt": "string|null",
      "details": "object|null"
    },
    "original": {
      "date": "string (only for reschedules)",
      "time": "string (only for reschedules)"
    },
    "new": {
      "date": "string (only for reschedules)",
      "time": "string (only for reschedules)",
      "visitors": "number (only for reschedules)",
      "amount": "number (only for reschedules)"
    },
    "cancellation": {
      "reason": "string (only for cancellations)",
      "cancelledAt": "string (only for cancellations)"
    },
    "reschedule": {
      "reason": "string (only for reschedules)",
      "rescheduledAt": "string (only for reschedules)"
    },
    "error": {
      "message": "string (only for errors)",
      "type": "string (only for errors)"
    },
    "metadata": {
      "createdAt": "string|null",
      "source": "website",
      "emailType": "string|null",
      "cancellationToken": "string|null",
      "adminEmail": "string|null (only for admin events)",
      "timestamp": "string|null (only for errors)"
    }
  }
}
```

## Make.com Scenario Configuration

### 1. Create Webhook Trigger

1. Create new scenario in Make.com
2. Add **Webhooks > Custom webhook** as first module
3. Configure webhook to accept JSON payloads
4. Copy the webhook URL to `MAKE_BOOKING_WEBHOOK_URL` environment variable

### 2. Add Router Module

Add a **Router** module after the webhook to handle different event types:

#### Route 1: Booking Confirmations
- **Filter**: `{{1.event}} = "booking_confirmed"`
- **Label**: "Booking Confirmations"

#### Route 2: Error Notifications  
- **Filter**: `{{1.event}} = "booking_error"`
- **Label**: "Error Notifications"

#### Route 3: Customer Cancellations
- **Filter**: `{{1.event}} = "booking_cancelled"`
- **Label**: "Customer Cancellations"

#### Route 4: Admin Cancellation Notifications
- **Filter**: `{{1.event}} = "booking_cancelled_admin"`
- **Label**: "Admin Notifications"

#### Route 5: Reschedule Confirmations
- **Filter**: `{{1.event}} = "booking_rescheduled"`
- **Label**: "Reschedule Confirmations"

### 3. Configure Email Modules

Add email modules (Gmail/Outlook/SMTP) for each route:

#### Booking Confirmation Email
- **To**: `{{1.booking.customer.email}}`
- **Subject**: `🌸 Your BG Bouquet Garden Visit is Confirmed - {{1.booking.visit.date}}`
- **Sender**: `BG Bouquet Garden <noreply@bgbouquet.com>`

**Key Fields to Map**:
- Customer name: `{{1.booking.customer.name}}`
- Visit date: `{{1.booking.visit.date}}`
- Visit time: `{{1.booking.visit.time}}`
- Number of visitors: `{{1.booking.visit.visitors}}`
- Total amount: `{{1.booking.visit.amount}}`
- Payment method: `{{1.booking.payment.method}}`
- Payment status: `{{1.booking.payment.status}}`
- Cancellation token: `{{1.booking.metadata.cancellationToken}}`

#### Error Notification Email
- **To**: `tim@ecosi.io` (or configured admin email)
- **Subject**: `🚨 BG Bouquet Booking Error - {{1.booking.id}}`

**Key Fields to Map**:
- Booking ID: `{{1.booking.id}}`
- Customer email: `{{1.booking.customer.email}}`
- Error message: `{{1.booking.error.message}}`
- Error type: `{{1.booking.error.type}}`
- Timestamp: `{{1.booking.metadata.timestamp}}`

#### Customer Cancellation Email
- **To**: `{{1.booking.customer.email}}`
- **Subject**: `Booking Cancellation Confirmed - BG Bouquet Garden`

**Key Fields to Map**:
- Customer name: `{{1.booking.customer.name}}`
- Original date: `{{1.booking.visit.date}}`
- Original time: `{{1.booking.visit.time}}`
- Cancellation reason: `{{1.booking.cancellation.reason}}`
- Cancelled at: `{{1.booking.cancellation.cancelledAt}}`

#### Admin Cancellation Notification
- **To**: `{{1.booking.metadata.adminEmail}}`
- **Subject**: `Customer Cancellation - {{1.booking.customer.name}} - {{1.booking.visit.date}}`

**Key Fields to Map**:
- Customer name: `{{1.booking.customer.name}}`
- Customer email: `{{1.booking.customer.email}}`
- Customer phone: `{{1.booking.customer.phone}}`
- Visit details: `{{1.booking.visit.date}}` at `{{1.booking.visit.time}}`
- Cancellation reason: `{{1.booking.cancellation.reason}}`

#### Reschedule Confirmation Email
- **To**: `{{1.booking.customer.email}}`
- **Subject**: `Booking Updated - BG Bouquet Garden - {{1.booking.new.date}}`

**Key Fields to Map**:
- Customer name: `{{1.booking.customer.name}}`
- Original date: `{{1.booking.original.date}}`
- Original time: `{{1.booking.original.time}}`
- New date: `{{1.booking.new.date}}`
- New time: `{{1.booking.new.time}}`
- Reschedule reason: `{{1.booking.reschedule.reason}}`
- Cancellation token: `{{1.booking.metadata.cancellationToken}}`

## Environment Variables

Update your environment variables:

```bash
# Required - Single webhook URL for all events
MAKE_BOOKING_WEBHOOK_URL=https://hook.us2.make.com/your-webhook-id

# Optional - Admin email for notifications
ADMIN_EMAIL=admin@bgbouquet.com

# Deprecated - No longer needed
# MAKE_CANCELLATION_WEBHOOK_URL (remove this)
```

## Testing

Use the test endpoint to verify webhook functionality:

```bash
# Test booking confirmation
POST /api/test-webhook
{
  "type": "confirmation",
  "paymentStatus": "pending"
}

# Test error notification  
POST /api/test-webhook
{
  "type": "error"
}

# Test cancellation
POST /api/test-webhook
{
  "type": "cancellation"
}

# Test admin notification
POST /api/test-webhook
{
  "type": "cancellation-admin"
}

# Test reschedule
POST /api/test-webhook
{
  "type": "reschedule"
}
```

## Migration Steps

1. **Create new unified scenario** in Make.com following this guide
2. **Copy the webhook URL** to `MAKE_BOOKING_WEBHOOK_URL`
3. **Test all event types** using the test endpoint
4. **Deploy updated code** with consolidated webhook routing
5. **Verify email delivery** for all event types
6. **Remove old scenarios** once confirmed working
7. **Remove deprecated environment variables**

## Troubleshooting

- **No emails received**: Check webhook URL configuration and Make.com scenario status
- **Wrong email content**: Verify field mappings in email modules match payload structure
- **Missing events**: Ensure router filters match exact event names
- **Payload errors**: Use Make.com execution history to debug payload structure issues
