# 📧 Email Templates for BG Bouquet Garden

## Design Guidelines

### Shabby Chic Aesthetic
- **Colors**: Pink (#F8E7E8), Blue (#EFF9FA), Charcoal (#333333)
- **Fonts**: Allura (headers), Playfair Display (subheaders), Roboto (body)
- **Style**: Elegant, vintage-inspired, warm and welcoming

### Email Structure
- Header with logo and garden imagery
- Clear subject lines
- Personal greeting
- Essential information prominently displayed
- Call-to-action buttons
- Footer with contact information

## 📧 Template 1: Unified Booking Confirmation (Pay-on-Arrival & Online Payment)

### Subject Line
`🌸 Your BG Bouquet Garden Visit is Confirmed - {{booking.visit.date}}`

### Key Features
- **Conditional Payment Status**: Shows different content based on payment method and status
- **Bouquet Count Display**: Shows number of bouquets (= number of visitors)
- **Payment Details**: For online payments, shows amount paid and payment confirmation
- **Refund Policy**: Included for paid bookings with link to full policy
- **Cancellation/Reschedule**: Same functionality for both payment types

### Email Content
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Booking Confirmation - BG Bouquet Garden</title>
    <style>
        body { font-family: 'Roboto', Arial, sans-serif; color: #333333; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #F8E7E8, #EFF9FA); padding: 20px; text-align: center; }
        .logo { font-family: 'Allura', cursive; font-size: 36px; color: #333333; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .content { padding: 30px; }
        .booking-details { background: #F8E7E8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: bold; color: #333333; }
        .value { color: #666666; }
        .button { background: #F8E7E8; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        .footer { background: #333333; color: white; padding: 20px; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="logo">BG Bouquet Garden</h1>
            <p style="margin: 0; font-style: italic;">Where Beauty Blooms</p>
        </div>
        
        <div class="content">
            <h2 style="font-family: 'Playfair Display', serif; color: #333333;">Your Visit is Confirmed! 🌸</h2>
            
            <p>Dear {{booking.customer.name}},</p>

            <p>Thank you for booking your visit to BG Bouquet Garden! We're excited to welcome you to our beautiful garden sanctuary.</p>

            <!-- Payment Status Message (Conditional) -->
            {{#if (eq booking.payment.status "completed")}}
            <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #2e7d32; font-weight: 500;">
                    ✅ <strong>Payment Confirmed!</strong> Your payment of ${{booking.visit.amount}} has been successfully processed.
                </p>
            </div>
            {{else}}
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-weight: 500;">
                    💳 <strong>Payment:</strong> You've selected to pay on arrival (${{booking.visit.amount}}).
                </p>
            </div>
            {{/if}}
            
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

                <!-- Payment Information (Conditional) -->
                {{#if (eq booking.payment.status "completed")}}
                <div class="detail-row">
                    <span class="label">Payment Status:</span>
                    <span class="value" style="color: #4caf50; font-weight: 500;">✅ Paid Online</span>
                </div>
                {{#if booking.payment.squarePaymentId}}
                <div class="detail-row">
                    <span class="label">Payment Reference:</span>
                    <span class="value">{{booking.payment.squarePaymentId}}</span>
                </div>
                {{/if}}
                {{#if booking.payment.completedAt}}
                <div class="detail-row">
                    <span class="label">Payment Date:</span>
                    <span class="value">{{booking.payment.completedAt}}</span>
                </div>
                {{/if}}
                {{else}}
                <div class="detail-row">
                    <span class="label">Payment Method:</span>
                    <span class="value">Pay on Arrival</span>
                </div>
                {{/if}}
                <div class="detail-row">
                    <span class="label">Booking ID:</span>
                    <span class="value">{{booking.id}}</span>
                </div>
            </div>
            
            <h3 style="font-family: 'Playfair Display', serif;">What to Expect</h3>
            <ul>
                <li>Please arrive 10 minutes before your scheduled time</li>
                <li>Comfortable walking shoes recommended</li>
                <li>Photography is welcome and encouraged</li>
                <li>Light refreshments available on-site</li>
            </ul>
            
            <h3 style="font-family: 'Playfair Display', serif;">Need to Make Changes?</h3>
            <p>If you need to cancel or reschedule your visit, please use the link below:</p>

            <a href="https://bgbouquet.com/cancel?token={{booking.metadata.cancellationToken}}" class="button">
                Manage Your Booking
            </a>

            <!-- Refund Policy for Paid Bookings -->
            {{#if (eq booking.payment.status "completed")}}
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h4 style="margin-top: 0; color: #856404;">Refund Policy</h4>
                <p style="margin: 5px 0; color: #856404; font-size: 14px;">
                    For paid bookings, refunds are processed manually. If you need to cancel, please contact us directly to initiate the refund process.
                </p>
                <p style="margin: 5px 0; color: #856404; font-size: 14px;">
                    <a href="https://bgbouquet.com/refund-policy" style="color: #856404; text-decoration: underline;">View Full Refund Policy</a>
                </p>
            </div>
            {{/if}}
            
            <p>We look forward to sharing the beauty of our garden with you!</p>
            
            <p>Warm regards,<br>
            The BG Bouquet Garden Team</p>
        </div>
        
        <div class="footer">
            <p><strong>BG Bouquet Garden</strong><br>
            📍 [Garden Address]<br>
            📞 [Phone Number]<br>
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

## 📧 Template 2: Cancellation Confirmation

### Subject Line
`Booking Cancelled - BG Bouquet Garden Visit for {{booking.visit.date}}`

### Email Content
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Booking Cancelled - BG Bouquet Garden</title>
    <style>
        /* Same styles as confirmation email */
        body { font-family: 'Roboto', Arial, sans-serif; color: #333333; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #F8E7E8, #EFF9FA); padding: 20px; text-align: center; }
        .logo { font-family: 'Allura', cursive; font-size: 36px; color: #333333; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .content { padding: 30px; }
        .booking-details { background: #F8E7E8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: bold; color: #333333; }
        .value { color: #666666; }
        .button { background: #F8E7E8; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        .footer { background: #333333; color: white; padding: 20px; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="logo">BG Bouquet Garden</h1>
            <p style="margin: 0; font-style: italic;">Where Beauty Blooms</p>
        </div>
        
        <div class="content">
            <h2 style="font-family: 'Playfair Display', serif; color: #333333;">Booking Cancelled</h2>
            
            <p>Dear {{booking.customer.name}},</p>
            
            <p>We've successfully cancelled your booking as requested. We're sorry we won't be seeing you this time, but we hope to welcome you to BG Bouquet Garden in the future.</p>
            
            <div class="booking-details">
                <h3 style="font-family: 'Playfair Display', serif; margin-top: 0;">Cancelled Booking Details</h3>
                <div class="detail-row">
                    <span class="label">Original Date:</span>
                    <span class="value">{{booking.visit.date}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Original Time:</span>
                    <span class="value">{{booking.visit.time}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Number of Visitors:</span>
                    <span class="value">{{booking.visit.visitors}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Booking ID:</span>
                    <span class="value">{{booking.id}}</span>
                </div>
                {{#if booking.cancellation.reason}}
                <div class="detail-row">
                    <span class="label">Reason:</span>
                    <span class="value">{{booking.cancellation.reason}}</span>
                </div>
                {{/if}}
            </div>
            
            <h3 style="font-family: 'Playfair Display', serif;">What's Next?</h3>
            <ul>
                <li>Your booking has been removed from our system</li>
                <li>If you paid online, refunds will be processed within 3-5 business days</li>
                <li>You're welcome to book a new visit anytime</li>
            </ul>
            
            <a href="https://bgbouquet.com" class="button">
                Book a New Visit
            </a>
            
            <p>Thank you for your interest in BG Bouquet Garden. We hope to see you soon!</p>
            
            <p>Warm regards,<br>
            The BG Bouquet Garden Team</p>
        </div>
        
        <div class="footer">
            <p><strong>BG Bouquet Garden</strong><br>
            📍 [Garden Address]<br>
            📞 [Phone Number]<br>
            ✉️ info@bgbouquet.com</p>
        </div>
    </div>
</body>
</html>
```

## 📧 Template 3: Reschedule Confirmation

### Subject Line
`🌸 Booking Updated - Your New BG Bouquet Garden Visit: {{booking.new.date}}`

### Key Elements
- Show both original and new booking details
- Emphasize the change clearly
- Include same visit preparation information
- Provide cancellation link for new booking

## 📧 Template 4: Admin Cancellation Notification

### Subject Line
`[ADMIN] Booking Cancelled - {{booking.customer.name}} - {{booking.visit.date}}`

### Key Elements
- Admin-focused layout
- Customer contact information
- Booking details
- Cancellation reason
- Quick action links

## 📧 Template 5: Error Notification

### Subject Line
`[ALERT] Booking System Error - {{error.type}}`

### Key Elements
- Technical error details
- Affected booking information
- Timestamp
- Recommended actions

## 📧 Template 3: Reschedule Confirmation (Full Template)

### Email Content
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Booking Rescheduled - BG Bouquet Garden</title>
    <style>
        body { font-family: 'Roboto', Arial, sans-serif; color: #333333; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #F8E7E8, #EFF9FA); padding: 20px; text-align: center; }
        .logo { font-family: 'Allura', cursive; font-size: 36px; color: #333333; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .content { padding: 30px; }
        .booking-details { background: #F8E7E8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .old-booking { background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .new-booking { background: #EFF9FA; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: bold; color: #333333; }
        .value { color: #666666; }
        .button { background: #F8E7E8; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        .footer { background: #333333; color: white; padding: 20px; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="logo">BG Bouquet Garden</h1>
            <p style="margin: 0; font-style: italic;">Where Beauty Blooms</p>
        </div>

        <div class="content">
            <h2 style="font-family: 'Playfair Display', serif; color: #333333;">Your Visit Has Been Rescheduled! 🌸</h2>

            <p>Dear {{booking.customer.name}},</p>

            <p>We've successfully updated your booking as requested. Here are your new visit details:</p>

            <div class="booking-details">
                <h3 style="font-family: 'Playfair Display', serif; margin-top: 0;">Previous Booking</h3>
                <div class="old-booking">
                    <div class="detail-row">
                        <span class="label">Date:</span>
                        <span class="value">{{booking.original.date}}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Time:</span>
                        <span class="value">{{booking.original.time}}</span>
                    </div>
                </div>

                <h3 style="font-family: 'Playfair Display', serif;">New Booking Details</h3>
                <div class="new-booking">
                    <div class="detail-row">
                        <span class="label">Date:</span>
                        <span class="value">{{booking.new.date}}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Time:</span>
                        <span class="value">{{booking.new.time}}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Number of Visitors:</span>
                        <span class="value">{{booking.new.visitors}}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Total Amount:</span>
                        <span class="value">${{booking.new.amount}}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Payment:</span>
                        <span class="value">{{booking.payment.method}}</span>
                    </div>
                </div>

                <div class="detail-row">
                    <span class="label">Booking ID:</span>
                    <span class="value">{{booking.id}}</span>
                </div>
                {{#if booking.reschedule.reason}}
                <div class="detail-row">
                    <span class="label">Reason for Change:</span>
                    <span class="value">{{booking.reschedule.reason}}</span>
                </div>
                {{/if}}
            </div>

            <h3 style="font-family: 'Playfair Display', serif;">What to Expect</h3>
            <ul>
                <li>Please arrive 10 minutes before your scheduled time</li>
                <li>Comfortable walking shoes recommended</li>
                <li>Photography is welcome and encouraged</li>
                <li>Light refreshments available on-site</li>
            </ul>

            <h3 style="font-family: 'Playfair Display', serif;">Need to Make More Changes?</h3>
            <p>If you need to cancel or reschedule again, please use the link below:</p>

            <a href="https://bgbouquet.com/cancel?token={{booking.metadata.cancellationToken}}" class="button">
                Manage Your Booking
            </a>

            <p>We look forward to welcoming you on your new visit date!</p>

            <p>Warm regards,<br>
            The BG Bouquet Garden Team</p>
        </div>

        <div class="footer">
            <p><strong>BG Bouquet Garden</strong><br>
            📍 [Garden Address]<br>
            📞 [Phone Number]<br>
            ✉️ info@bgbouquet.com</p>
        </div>
    </div>
</body>
</html>
```

## 🎨 Implementation Notes

### Make.com Setup
1. Use HTML email modules in Make.com
2. Map webhook payload data to template variables
3. Set appropriate sender information
4. Configure reply-to addresses

### Testing
1. Use test webhook endpoint to verify templates
2. Check email rendering across devices
3. Verify all dynamic content displays correctly
4. Test with various booking scenarios

### Customization
- Replace placeholder contact information
- Add actual garden address and phone
- Include garden photos in header
- Adjust colors to match brand guidelines
