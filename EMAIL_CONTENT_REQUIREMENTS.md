# 📋 Email Content Requirements - BG Bouquet Garden

## 🎯 Overview
This document outlines the specific content requirements, legal considerations, and branding guidelines for all email communications in the BG Bouquet Garden booking system.

## 📧 Email Types & Required Content

### 1. Booking Confirmation Email
**Purpose**: Confirm new bookings and provide visit information

**Required Information:**
- Customer name and contact details
- Visit date, time, and duration
- Number of visitors
- Total amount and payment method
- Booking ID for reference
- Cancellation/reschedule link with token
- Garden address and directions
- What to bring/expect information
- Contact information for questions

**Legal Requirements:**
- Clear cancellation policy
- Refund policy statement
- Privacy policy reference
- Unsubscribe option (if applicable)

**Tone**: Warm, welcoming, excited

### 2. Cancellation Confirmation Email
**Purpose**: Confirm booking cancellation and provide next steps

**Required Information:**
- Customer name
- Cancelled booking details (date, time, visitors)
- Booking ID
- Cancellation reason (if provided)
- Refund information and timeline
- Link to book new visit
- Contact information for questions

**Legal Requirements:**
- Refund policy and timeline
- Confirmation that booking is removed
- Data retention policy

**Tone**: Understanding, helpful, encouraging return visit

### 3. Reschedule Confirmation Email
**Purpose**: Confirm booking changes and provide updated information

**Required Information:**
- Customer name
- Original booking details (crossed out or grayed)
- New booking details (highlighted)
- Booking ID (remains same)
- Reason for reschedule (if provided)
- Updated cancellation/reschedule link
- Visit preparation information
- Contact information

**Legal Requirements:**
- Same cancellation policy applies
- Confirmation of payment status
- Updated terms if applicable

**Tone**: Accommodating, positive, helpful

### 4. Admin Cancellation Notification
**Purpose**: Notify admin of customer cancellations

**Required Information:**
- Customer contact details
- Booking details (date, time, visitors, amount)
- Cancellation reason
- Cancellation method (customer, admin, system)
- Timestamp of cancellation
- Booking ID
- Payment status and refund requirements

**Administrative Actions:**
- Quick links to customer record
- Refund processing reminder
- Calendar update confirmation

**Tone**: Professional, informative

### 5. Error Notification Email
**Purpose**: Alert admin to system errors

**Required Information:**
- Error type and description
- Affected booking details (if applicable)
- Customer information (if applicable)
- Timestamp of error
- System context and stack trace
- Recommended actions

**Administrative Actions:**
- Link to system logs
- Customer contact information
- Escalation procedures

**Tone**: Urgent, technical, actionable

## 🏛️ Legal Requirements

### Cancellation Policy
**Standard Policy Text:**
```
Cancellation Policy:
- Cancellations made 24+ hours in advance: Full refund
- Cancellations made less than 24 hours: 50% refund
- No-shows: No refund
- Weather-related cancellations: Full refund or reschedule
- Reschedules: Unlimited, subject to availability
```

### Refund Policy
**Standard Policy Text:**
```
Refund Policy:
- Online payments: Refunded to original payment method within 3-5 business days
- Pay-on-arrival bookings: No refund processing required
- Partial refunds: Calculated based on cancellation timing
- Processing fees: Non-refundable where applicable
```

### Privacy Policy
**Required Statement:**
```
Your personal information is collected solely for booking purposes and will not be shared with third parties. See our full privacy policy at bgbouquet.com/privacy
```

### Terms of Service
**Required Statement:**
```
By booking with BG Bouquet Garden, you agree to our terms of service available at bgbouquet.com/terms
```

## 🎨 Branding Guidelines

### Visual Identity
- **Primary Colors**: Pink (#F8E7E8), Blue (#EFF9FA)
- **Text Color**: Charcoal (#333333)
- **Accent Colors**: Soft pastels, vintage-inspired
- **Logo**: "BG Bouquet Garden" in Allura font
- **Tagline**: "Where Beauty Blooms"

### Typography
- **Headers**: Allura (cursive, elegant)
- **Subheaders**: Playfair Display (serif, classic)
- **Body Text**: Roboto (sans-serif, readable)
- **Emphasis**: Bold Roboto or italic Playfair Display

### Tone of Voice
- **Warm and welcoming**: Like a friend inviting you to their garden
- **Professional but personal**: Knowledgeable without being stuffy
- **Encouraging**: Positive language that builds excitement
- **Helpful**: Clear instructions and easy-to-find information
- **Respectful**: Understanding of customer needs and concerns

### Language Guidelines
- Use "visit" instead of "appointment" or "booking"
- Refer to "garden sanctuary" or "garden oasis"
- Include seasonal references when appropriate
- Use inclusive language for all visitors
- Avoid overly technical terms
- Include emojis sparingly (🌸, 🌿, 📍, 📞, ✉️)

## 📱 Technical Requirements

### Email Compatibility
- **Mobile-responsive**: 60%+ of emails opened on mobile
- **Dark mode support**: Proper contrast ratios
- **Email client testing**: Gmail, Outlook, Apple Mail, Yahoo
- **Accessibility**: Alt text, proper heading structure, color contrast

### Dynamic Content
- **Personalization**: Customer name, booking details
- **Conditional content**: Payment method, cancellation reason
- **Localization**: Date/time formatting
- **Fallbacks**: Default content for missing data

### Tracking & Analytics
- **Open rates**: Track email engagement
- **Click-through rates**: Monitor link clicks
- **Conversion tracking**: New bookings from emails
- **Error monitoring**: Failed email deliveries

## 🔧 Implementation Checklist

### Content Creation
- [ ] Write all email copy following tone guidelines
- [ ] Include all required legal text
- [ ] Add proper personalization tokens
- [ ] Create fallback content for missing data
- [ ] Review for accessibility compliance

### Design Implementation
- [ ] Apply Shabby Chic color scheme
- [ ] Use specified fonts with web-safe fallbacks
- [ ] Ensure mobile responsiveness
- [ ] Test dark mode compatibility
- [ ] Optimize images for email

### Legal Compliance
- [ ] Include cancellation policy
- [ ] Add refund policy details
- [ ] Link to privacy policy
- [ ] Add unsubscribe option
- [ ] Include business contact information

### Testing & Quality Assurance
- [ ] Test all dynamic content
- [ ] Verify links work correctly
- [ ] Check email rendering across clients
- [ ] Test with various booking scenarios
- [ ] Validate accessibility features

## 📞 Contact Information Template

**Standard Footer Content:**
```
BG Bouquet Garden
📍 [Garden Address, City, Province, Postal Code]
📞 [Phone Number]
✉️ info@bgbouquet.com
🌐 www.bgbouquet.com

Garden Hours: Thursday-Saturday, 10 AM - 9 PM
Closed Sundays-Wednesdays and holidays

Follow us: [Social Media Links]
```

## 🚀 Next Steps
1. Customize templates with actual business information
2. Set up Make.com scenarios with these templates
3. Test email delivery and rendering
4. Monitor email performance and engagement
5. Iterate based on customer feedback
