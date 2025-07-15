# 🔀 Make.com Router Setup Guide for Online Payment Confirmations

## Overview
This guide explains how to modify your existing Make.com booking confirmation scenario to handle both pay-on-arrival and online payment confirmations using a single scenario with a router.

## Current vs New Architecture

### Before (Separate Scenarios)
- **Scenario 1**: Pay-on-arrival confirmations → `MAKE_BOOKING_WEBHOOK_URL`
- **Scenario 2**: Online payment confirmations → `WEBHOOK_PAYMENT_SUCCESS_URL`

### After (Unified with Router)
- **Scenario 1**: All booking confirmations → `MAKE_BOOKING_WEBHOOK_URL`
  - Router splits based on `booking.payment.status`
  - Same email template with conditional content

## 🛠️ Step-by-Step Setup Instructions

### Step 1: Access Your Existing Scenario
1. Log into Make.com
2. Navigate to your existing booking confirmation scenario (the one using `MAKE_BOOKING_WEBHOOK_URL`)
3. Click **Edit** to modify the scenario

### Step 2: Add Router Module
1. **After the webhook trigger**, click the **+** button to add a new module
2. Search for and select **Router** from the Flow Control category
3. Position the router between your webhook trigger and the existing email module

### Step 3: Configure Router Paths

#### Path 1: Pay-on-Arrival Bookings
1. Click on the **first router path** (top path)
2. Set up the **filter**:
   - **Label**: "Pay on Arrival"
   - **Condition**: `booking.payment.status` **equals** `pending`
3. Connect this path to your existing email module

#### Path 2: Online Payment Bookings  
1. Click **Add another path** on the router
2. Set up the **filter** for the second path:
   - **Label**: "Online Payment Completed"
   - **Condition**: `booking.payment.status` **equals** `completed`
3. **Clone your existing email module** for this path:
   - Right-click your email module → **Clone**
   - Connect the cloned module to the second router path

### Step 4: Update Email Templates

Both email modules will use the same template, but Make.com will automatically handle the conditional content based on the webhook data.

#### Template Variables Available:
```
{{booking.customer.name}}
{{booking.customer.email}}
{{booking.visit.date}}
{{booking.visit.time}}
{{booking.visit.bouquets}}     // ← Primary field (recommended)
{{booking.visit.visitors}}     // ← Deprecated (for backward compatibility)
{{booking.visit.amount}}
{{booking.payment.status}}
{{booking.payment.method}}
{{booking.payment.squarePaymentId}}
{{booking.payment.completedAt}}
{{booking.metadata.cancellationToken}}
```

**Note**: Use `{{booking.visit.bouquets}}` for new scenarios. The `visitors` field is kept for backward compatibility.

#### Conditional Content in Email:
Use Make.com's conditional formatting:

**Payment Status Message:**
```
{{if(booking.payment.status = "completed"; "✅ Payment Confirmed! Your payment of $" + booking.visit.amount + " has been successfully processed."; "💳 Payment: You've selected to pay on arrival ($" + booking.visit.amount + ").")}}
```

**Payment Details Section:**
```
{{if(booking.payment.status = "completed"; "Payment Status: ✅ Paid Online" + if(booking.payment.squarePaymentId; newline + "Payment Reference: " + booking.payment.squarePaymentId; ""); "Payment Method: Pay on Arrival")}}
```

**Refund Policy (for paid bookings only):**
```
{{if(booking.payment.status = "completed"; "For paid bookings, refunds are processed manually. If you need to cancel, please contact us directly to initiate the refund process. View Full Refund Policy: https://bgbouquet.com/refund-policy"; "")}}
```

### Step 5: Test the Router

#### Test Pay-on-Arrival Path:
1. Use the test webhook endpoint: `POST /api/test-webhook`
2. Send payload with `booking.payment.status: "pending"`
3. Verify email goes through Path 1

#### Test Online Payment Path:
1. Use the test webhook endpoint: `POST /api/test-webhook`  
2. Send payload with `booking.payment.status: "completed"`
3. Verify email goes through Path 2

### Step 6: Update Environment Variables

Since we're now using the unified approach, you can remove the separate payment webhook URLs:

**Keep:**
```
MAKE_BOOKING_WEBHOOK_URL=https://hook.make.com/your-booking-webhook-id
```

**Optional (can remove):**
```
# WEBHOOK_PAYMENT_SUCCESS_URL=https://hook.make.com/your-payment-success-webhook-id
# WEBHOOK_PAYMENT_FAILED_URL=https://hook.make.com/your-payment-failed-webhook-id
```

## 📧 Email Template Differences

### Pay-on-Arrival Email Features:
- Shows "Payment: Pay on Arrival" 
- No payment reference numbers
- Standard cancellation/reschedule instructions

### Online Payment Email Features:
- Shows "✅ Payment Confirmed!" message
- Displays payment amount and bouquet count
- Includes Square payment reference ID
- Shows refund policy information
- Same cancellation/reschedule functionality

## 🔍 Troubleshooting

### Router Not Working?
- Check filter conditions are exactly: `booking.payment.status` equals `pending` or `completed`
- Verify webhook payload includes the `booking.payment.status` field
- Test with the `/api/test-webhook` endpoint

### Missing Payment Details?
- Ensure Square webhook is sending the updated payload format
- Check that `booking.payment.squarePaymentId` is included in webhook data
- Verify payment completion timestamp is being sent

### Email Template Issues?
- Use Make.com's formula editor for conditional content
- Test conditional expressions with sample data
- Ensure all variables are properly mapped from webhook payload

## 🚀 Benefits of This Approach

1. **Unified Management**: Single scenario handles both payment types
2. **Consistent Branding**: Same email template with conditional content
3. **Easier Maintenance**: One place to update email templates
4. **Cost Effective**: Uses only one Make.com scenario instead of multiple
5. **Scalable**: Easy to add more payment methods or conditions

## 📧 Complete Make.com Email Template

Here's the complete HTML email template to use in your Make.com email modules. This template works for both router paths and automatically shows the correct content based on payment status.

### Email Subject:
```
🌸 Your BG Bouquet Garden Visit is Confirmed - {{booking.visit.date}}
```

### Email HTML Body:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BG Bouquet Garden - Booking Confirmation</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Allura:wght@400&family=Playfair+Display:wght@400;700&family=Roboto:wght@300;400;500&display=swap');
        body { font-family: 'Roboto', sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #F8E7E8 0%, #EFF9FA 100%); padding: 40px 20px; text-align: center; }
        .logo { font-family: 'Allura', cursive; font-size: 36px; color: #333333; margin: 0; }
        .content { padding: 30px; }
        .booking-details { background: #F8E7E8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 5px 0; border-bottom: 1px solid rgba(51,51,51,0.1); }
        .label { font-weight: 500; color: #666; }
        .value { font-weight: 400; color: #333; }
        .button { background: #F8E7E8; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 500; }
        .footer { background: #333333; color: white; padding: 20px; text-align: center; font-size: 14px; }
        .payment-success { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .payment-pending { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .refund-policy { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="logo">BG Bouquet Garden</h1>
            <p style="margin: 0; font-style: italic; color: #666;">Where Beauty Blooms</p>
        </div>

        <div class="content">
            <h2 style="font-family: 'Playfair Display', serif; color: #333333;">Your Visit is Confirmed! 🌸</h2>

            <p>Dear {{booking.customer.name}},</p>

            <p>Thank you for booking your visit to BG Bouquet Garden! We're excited to welcome you to our beautiful garden sanctuary.</p>

            <!-- Payment Status Message (Make.com Conditional) -->
            {{if(booking.payment.status = "completed";
                "<div class='payment-success'><p style='margin: 0; color: #2e7d32; font-weight: 500;'>✅ <strong>Payment Confirmed!</strong> Your payment of $" + booking.visit.amount + " for " + booking.visit.bouquets + " bouquets has been successfully processed.</p></div>";
                "<div class='payment-pending'><p style='margin: 0; color: #856404; font-weight: 500;'>💳 <strong>Payment:</strong> You've selected to pay on arrival ($" + booking.visit.amount + " for " + booking.visit.bouquets + " bouquets).</p></div>"
            )}}

            <div class="booking-details">
                <h3 style="font-family: 'Playfair Display', serif; margin-top: 0;">Booking Details</h3>
                <div class="detail-row">
                    <span class="label">Date:</span>
                    <span class="value">{{booking.visit.date}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Time:</span>
                    <span class="value">{{booking.visit.time}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Number of Visitors:</span>
                    <span class="value">{{booking.visit.visitors}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Bouquets Included:</span>
                    <span class="value">{{booking.visit.bouquets}} (one per visitor)</span>
                </div>
                <div class="detail-row">
                    <span class="label">Total Amount:</span>
                    <span class="value">${{booking.visit.amount}}</span>
                </div>

                <!-- Payment Status Details (Make.com Conditional) -->
                {{if(booking.payment.status = "completed";
                    "<div class='detail-row'><span class='label'>Payment Status:</span><span class='value' style='color: #4caf50; font-weight: 500;'>✅ Paid Online</span></div>" +
                    if(booking.payment.squarePaymentId; "<div class='detail-row'><span class='label'>Payment Reference:</span><span class='value'>" + booking.payment.squarePaymentId + "</span></div>"; "") +
                    if(booking.payment.completedAt; "<div class='detail-row'><span class='label'>Payment Date:</span><span class='value'>" + formatDate(booking.payment.completedAt; "MM/DD/YYYY HH:mm") + "</span></div>"; "");
                    "<div class='detail-row'><span class='label'>Payment Method:</span><span class='value'>Pay on Arrival</span></div>"
                )}}

                <div class="detail-row">
                    <span class="label">Booking ID:</span>
                    <span class="value">{{booking.id}}</span>
                </div>
            </div>

            <h3 style="font-family: 'Playfair Display', serif;">What to Expect</h3>
            <ul>
                <li>Please arrive 10 minutes before your scheduled time</li>
                <li>Bring comfortable walking shoes for garden paths</li>
                <li>Feel free to bring a camera to capture beautiful moments</li>
                <li>Each visitor will create their own unique bouquet</li>
                <li>Our garden experts will guide you through the experience</li>
            </ul>

            <h3 style="font-family: 'Playfair Display', serif;">Need to Make Changes?</h3>
            <p>If you need to cancel or reschedule your visit, please use the link below:</p>

            <a href="https://bgbouquet.com/cancel?token={{booking.metadata.cancellationToken}}" class="button">
                Manage Your Booking
            </a>

            <!-- Refund Policy for Paid Bookings (Make.com Conditional) -->
            {{if(booking.payment.status = "completed";
                "<div class='refund-policy'><h4 style='margin-top: 0; color: #856404;'>Refund Policy</h4><p style='margin: 5px 0; color: #856404; font-size: 14px;'>For paid bookings, refunds are processed manually. If you need to cancel, please contact us directly to initiate the refund process.</p><p style='margin: 5px 0; color: #856404; font-size: 14px;'><a href='https://bgbouquet.com/refund-policy' style='color: #856404; text-decoration: underline;'>View Full Refund Policy</a></p></div>";
                ""
            )}}

            <p>We look forward to sharing the beauty of our garden with you!</p>

            <p>Warm regards,<br>
            The BG Bouquet Garden Team</p>
        </div>

        <div class="footer">
            <p><strong>BG Bouquet Garden</strong><br>
            📍 [Your Garden Address]<br>
            📞 [Your Phone Number]<br>
            ✉️ info@bgbouquet.com</p>

            <p style="font-size: 12px; margin-top: 20px;">
                This email was sent regarding your booking at BG Bouquet Garden.<br>
                If you have any questions, please contact us directly.
            </p>
        </div>
    </div>
</body>
</html>
```

### Key Features of This Template:

1. **Automatic Content Switching**: Uses Make.com's `{{if()}}` function to show different content based on `booking.payment.status`

2. **Payment Success Features** (when `booking.payment.status = "completed"`):
   - Green success message with payment amount and bouquet count
   - Payment reference ID from Square
   - Payment completion timestamp
   - Refund policy section

3. **Pay-on-Arrival Features** (when `booking.payment.status = "pending"`):
   - Yellow pending message
   - Standard payment on arrival instructions
   - No refund policy section

4. **Universal Features** (both payment types):
   - Same booking details layout
   - Same cancellation/reschedule functionality
   - Same garden visit preparation information

### Setup Instructions:

1. **Copy this entire HTML template** into both email modules in your Make.com router paths
2. **Use the same template for both paths** - the conditional logic handles the differences
3. **Update the contact information** in the footer with your actual details
4. **Test both router paths** to ensure conditional content displays correctly

## Next Steps

After implementing this router setup:
1. Test both payment flows thoroughly using the provided email template
2. Monitor webhook logs for any errors
3. Update your refund policy page if needed
4. Consider adding more conditional content based on booking details
