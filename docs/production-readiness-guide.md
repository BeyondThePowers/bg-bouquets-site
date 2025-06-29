# Bluebell Gardens - Production Readiness Guide

## Table of Contents

1. [Sandbox → Production Transition](#sandbox--production-transition)
2. [Production Readiness Checklist](#production-readiness-checklist)
3. [Environment Configuration](#environment-configuration)
4. [Testing Strategy](#testing-strategy)
5. [Data Safety & Separation](#data-safety--separation)
6. [Security Review](#security-review)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Sandbox → Production Transition

### Overview
Moving from development/sandbox to production requires careful coordination of multiple services and environment changes. This section outlines every change needed.

### 1. Square Payment System

**Sandbox Credentials (Current):**
```env
SQUARE_ACCESS_TOKEN=EAAAl2t2YejjJ1M1GAe9G60hBUMcS4xTAWRFnPRyT2Wv4_zbSOa-RfZry-O-IESt
SQUARE_LOCATION_ID=LB73JX2KPQ4VJ
SQUARE_APPLICATION_ID=sandbox-sq0idb-...
SQUARE_APPLICATION_SECRET=sandbox-sq0csb-...
SQUARE_WEBHOOK_SIGNATURE_KEY=sandbox-webhook-key
```

**Production Credentials (Required):**
```env
# Get these from Square Developer Dashboard → Production
SQUARE_ACCESS_TOKEN=EAAAEOVuza9... (starts with EAAAE for production)
SQUARE_LOCATION_ID=LXXXXXXXXXXXXXXX (your production location ID)
SQUARE_APPLICATION_ID=sq0idp-... (production app ID)
SQUARE_APPLICATION_SECRET=sq0csp-... (production secret)
SQUARE_WEBHOOK_SIGNATURE_KEY=production-webhook-key
```

**Steps to Get Production Credentials:**
1. Log into [Square Developer Dashboard](https://developer.squareup.com/)
2. Navigate to your application
3. Switch from "Sandbox" to "Production" mode
4. Generate production access token
5. Copy production location ID from your Square Dashboard
6. Update webhook endpoints to point to your production domain

### 2. Supabase Database

**Option A: Same Project, Different Schema**
```sql
-- Create production schema
CREATE SCHEMA production;

-- Move tables to production schema
ALTER TABLE bookings SET SCHEMA production;
ALTER TABLE booking_history SET SCHEMA production;
ALTER TABLE refunds SET SCHEMA production;
-- etc.
```

**Option B: Separate Production Project (Recommended)**
1. Create new Supabase project for production
2. Export schema from development project
3. Import schema to production project
4. Update environment variables

**Production Supabase Variables:**
```env
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Make.com Webhooks

**Current Development Webhooks:**
- Booking webhook: `https://hook.us1.make.com/dev-webhook-id`
- Cancellation webhook: `https://hook.us1.make.com/dev-cancel-webhook-id`

**Production Webhooks (Required):**
1. Create new Make.com scenarios for production
2. Update webhook URLs in environment variables:
```env
WEBHOOK_BOOKING_URL=https://hook.us1.make.com/prod-booking-webhook-id
WEBHOOK_CANCELLATION_URL=https://hook.us1.make.com/prod-cancel-webhook-id
WEBHOOK_RESCHEDULE_URL=https://hook.us1.make.com/prod-reschedule-webhook-id
WEBHOOK_PAYMENT_SUCCESS_URL=https://hook.us1.make.com/prod-payment-success-webhook-id
WEBHOOK_PAYMENT_FAILED_URL=https://hook.us1.make.com/prod-payment-failed-webhook-id
```

3. Configure Square webhooks in Square Developer Dashboard:
   - Add webhook endpoint: `https://yourdomain.com/api/webhooks/square`
   - Subscribe to events: `payment.created`, `payment.updated`, `order.updated`
   - Copy webhook signature key to environment variables

### 4. Domain and Hosting

**Development URLs:**
- Site: `http://localhost:4321`
- API: `http://localhost:4321/api`

**Production URLs (Update These):**
```env
PUBLIC_URL=https://bluebellgardens.ca
SITE_URL=https://bluebellgardens.ca
```

**Netlify Configuration:**
1. Connect GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Configure environment variables in Netlify dashboard
5. Set up custom domain

### 5. Email Configuration

**Development (Console Logging):**
Currently emails are logged to console for testing.

**Production (Required):**
Choose an email service and configure:

**Option A: SendGrid**
```env
SENDGRID_API_KEY=SG.your-api-key
FROM_EMAIL=noreply@bluebellgardens.ca
```

**Option B: Mailgun**
```env
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=mg.bluebellgardens.ca
FROM_EMAIL=noreply@bluebellgardens.ca
```

### 6. Environment Variables Checklist

Create a `.env.production` file with all production values:

```env
# Site Configuration
PUBLIC_URL=https://bluebellgardens.ca
SITE_URL=https://bluebellgardens.ca
NODE_ENV=production

# Supabase (Production Project)
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key

# Square (Production Credentials)
SQUARE_ACCESS_TOKEN=your-production-access-token
SQUARE_LOCATION_ID=your-production-location-id
SQUARE_APPLICATION_ID=your-production-app-id
SQUARE_APPLICATION_SECRET=your-production-app-secret
SQUARE_WEBHOOK_SIGNATURE_KEY=your-production-webhook-key

# Webhooks (Production Make.com Scenarios)
WEBHOOK_BOOKING_URL=https://hook.us1.make.com/prod-booking-webhook
WEBHOOK_CANCELLATION_URL=https://hook.us1.make.com/prod-cancel-webhook
WEBHOOK_RESCHEDULE_URL=https://hook.us1.make.com/prod-reschedule-webhook

# Email Service (Choose One)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@bluebellgardens.ca

# Security
SESSION_SECRET=your-secure-random-string-for-production
ADMIN_PASSWORD=your-secure-admin-password

# Optional: Analytics
GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
```

---

## Production Readiness Checklist

### ✅ Core Functionality

- [ ] **Booking Form**: All fields validate correctly
- [ ] **Payment Processing**: Both "Pay Now" and "Pay on Arrival" work
- [ ] **Availability Checking**: Prevents double-bookings
- [ ] **Confirmation Page**: `/booking-success` displays correctly
- [ ] **Admin Interface**: Can view and manage bookings
- [ ] **Cancellation System**: Email links work properly
- [ ] **Rescheduling**: Customers can change their bookings

### ✅ User Experience

- [ ] **Mobile Responsive**: Works on phones and tablets
- [ ] **Loading States**: Shows progress during form submission
- [ ] **Error Handling**: Clear error messages for users
- [ ] **Accessibility**: Screen reader compatible
- [ ] **Performance**: Page loads in under 3 seconds
- [ ] **SEO**: Meta tags and structured data present

### ✅ Data & Security

- [ ] **HTTPS Everywhere**: All pages use SSL
- [ ] **Input Validation**: Server-side validation on all forms
- [ ] **SQL Injection Protection**: Parameterized queries only
- [ ] **XSS Protection**: User input properly escaped
- [ ] **CSRF Protection**: Forms include CSRF tokens
- [ ] **Rate Limiting**: Prevent spam submissions

### ✅ Email & Notifications

- [ ] **Booking Confirmations**: Sent immediately after booking
- [ ] **Payment Confirmations**: Sent after successful payment
- [ ] **Cancellation Confirmations**: Sent when booking cancelled
- [ ] **Admin Notifications**: Owner notified of new bookings
- [ ] **Email Templates**: Professional and branded
- [ ] **Unsubscribe Links**: Required for marketing emails

### ✅ Error Handling

- [ ] **Payment Failures**: Graceful handling with retry options
- [ ] **Database Errors**: Don't expose sensitive information
- [ ] **API Timeouts**: Proper timeout handling
- [ ] **404 Pages**: Custom error pages
- [ ] **500 Errors**: Logged for debugging
- [ ] **Webhook Failures**: Retry mechanisms in place

### ✅ Testing

- [ ] **End-to-End Tests**: Complete booking flow tested
- [ ] **Payment Testing**: Test with real small amounts
- [ ] **Mobile Testing**: Tested on actual devices
- [ ] **Browser Testing**: Works in Chrome, Firefox, Safari, Edge
- [ ] **Load Testing**: Can handle expected traffic
- [ ] **Backup Testing**: Database backups work

---

## Environment Configuration

### Development Environment Setup

```bash
# Clone repository
git clone https://github.com/your-username/bluebell-gardens.git
cd bluebell-gardens

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local

# Start development server
npm run dev
```

### Production Deployment (Netlify)

```bash
# Build for production
npm run build

# Test production build locally
npm run preview

# Deploy to Netlify (automatic via GitHub integration)
git push origin main
```

### Environment Variable Management

**Development:**
- Use `.env.local` for local development
- Never commit `.env.local` to version control
- Use placeholder values in `.env.example`

**Production:**
- Set variables in Netlify dashboard
- Use Netlify's environment variable encryption
- Rotate secrets regularly

**Staging (Optional):**
- Create separate staging environment
- Use production-like data but sandbox payments
- Test deployments before production

---

## Testing Strategy

### Manual Testing Checklist

**Before Each Release:**

1. **Booking Flow Testing**
   ```
   [ ] Visit homepage
   [ ] Select available date/time
   [ ] Fill out booking form with valid data
   [ ] Test "Pay on Arrival" option
   [ ] Test "Pay Now" option with test card
   [ ] Verify confirmation page displays
   [ ] Check confirmation email received
   ```

2. **Admin Testing**
   ```
   [ ] Login to admin interface
   [ ] View booking list
   [ ] Search/filter bookings
   [ ] Cancel a booking
   [ ] Process a refund
   [ ] Check booking history
   ```

3. **Error Scenario Testing**
   ```
   [ ] Submit form with missing fields
   [ ] Try to book unavailable slot
   [ ] Test with invalid payment card
   [ ] Test network timeout scenarios
   [ ] Verify error messages are helpful
   ```

### Automated Testing Setup

**Install Testing Dependencies:**
```bash
npm install --save-dev @playwright/test vitest
```

**Basic Test Structure:**
```javascript
// tests/booking-flow.spec.js
import { test, expect } from '@playwright/test';

test('complete booking flow', async ({ page }) => {
  await page.goto('/');
  
  // Select date
  await page.click('[data-testid="date-picker"]');
  await page.click('[data-date="2025-07-01"]');
  
  // Select time
  await page.click('[data-time="10:00 AM"]');
  
  // Fill form
  await page.fill('[name="fullName"]', 'Test User');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="phone"]', '(555) 123-4567');
  
  // Submit
  await page.click('[type="submit"]');
  
  // Verify success
  await expect(page).toHaveURL('/booking-success');
});
```

### Performance Testing

**Core Web Vitals Targets:**
- **LCP (Largest Contentful Paint)**: < 2.5 seconds
- **FID (First Input Delay)**: < 100 milliseconds  
- **CLS (Cumulative Layout Shift)**: < 0.1

**Tools for Testing:**
- Google PageSpeed Insights
- Lighthouse CI
- WebPageTest.org

---

## Data Safety & Separation

### Development vs Production Data Separation

**The Problem:**
Mixing test data with real customer data can lead to:
- Accidentally contacting test customers
- Skewed analytics and reporting
- Compliance issues with data protection laws
- Confusion during debugging

**Solution: Clear Data Boundaries**

### 1. Database Separation Strategy

**Option A: Separate Supabase Projects (Recommended)**
```
Development Project: bluebell-gardens-dev
├── All test bookings
├── Fake customer data
├── Development webhooks
└── Sandbox payment records

Production Project: bluebell-gardens-prod
├── Real customer bookings only
├── Production webhooks
├── Live payment records
└── Strict access controls
```

**Option B: Schema Separation (Same Project)**
```sql
-- Development schema
CREATE SCHEMA development;
CREATE TABLE development.bookings (...);
CREATE TABLE development.customers (...);

-- Production schema
CREATE SCHEMA production;
CREATE TABLE production.bookings (...);
CREATE TABLE production.customers (...);
```

### 2. Data Identification System

**Add Environment Markers:**
```sql
-- Add to all tables
ALTER TABLE bookings ADD COLUMN environment VARCHAR(20) DEFAULT 'production';
ALTER TABLE bookings ADD CONSTRAINT check_environment
  CHECK (environment IN ('development', 'staging', 'production'));

-- Index for performance
CREATE INDEX idx_bookings_environment ON bookings(environment);
```

**Application-Level Filtering:**
```javascript
// Always filter by environment
const getBookings = async () => {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('environment', process.env.NODE_ENV || 'production');

  return data;
};
```

### 3. Test Data Management

**Automated Test Data Creation:**
```javascript
// scripts/create-test-data.js
const createTestBookings = async () => {
  const testBookings = [
    {
      full_name: 'TEST - John Doe',
      email: 'test+john@example.com',
      phone: '(555) 000-0001',
      environment: 'development',
      // ... other fields
    },
    // More test records...
  ];

  await supabase.from('bookings').insert(testBookings);
};
```

**Test Data Cleanup:**
```javascript
// scripts/cleanup-test-data.js
const cleanupTestData = async () => {
  // Delete all development/test records
  await supabase
    .from('bookings')
    .delete()
    .in('environment', ['development', 'test']);

  console.log('Test data cleaned up');
};
```

### 4. Email Safety Measures

**Prevent Accidental Emails to Real Customers:**
```javascript
const sendEmail = async (to, subject, content) => {
  // In development, only send to test emails
  if (process.env.NODE_ENV !== 'production') {
    const testEmailDomains = ['example.com', 'test.com', 'localhost'];
    const emailDomain = to.split('@')[1];

    if (!testEmailDomains.includes(emailDomain)) {
      console.log(`BLOCKED: Would have sent email to ${to}`);
      console.log(`Subject: ${subject}`);
      return;
    }
  }

  // Send actual email
  await emailService.send(to, subject, content);
};
```

**Test Email Prefixes:**
```javascript
const formatTestEmail = (baseEmail) => {
  if (process.env.NODE_ENV !== 'production') {
    return `test+${Date.now()}@example.com`;
  }
  return baseEmail;
};
```

---

## Security Review

### 1. Data Exposure Audit

**API Endpoint Security:**
```javascript
// ❌ BAD: Exposes all booking data
app.get('/api/bookings', async (req, res) => {
  const bookings = await getAllBookings();
  res.json(bookings);
});

// ✅ GOOD: Requires authentication and filters data
app.get('/api/bookings', requireAuth, async (req, res) => {
  const bookings = await getBookingsForUser(req.user.id);
  const sanitized = bookings.map(booking => ({
    id: booking.id,
    date: booking.date,
    time: booking.time,
    status: booking.status
    // Don't expose: email, phone, payment details
  }));
  res.json(sanitized);
});
```

**Database Row Level Security (RLS):**
```sql
-- Enable RLS on sensitive tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own bookings
CREATE POLICY "Users can view own bookings" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Only admins can see all bookings
CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

### 2. Input Validation & Sanitization

**Server-Side Validation:**
```javascript
import { z } from 'zod';

const bookingSchema = z.object({
  fullName: z.string().min(2).max(100).regex(/^[a-zA-Z\s'-]+$/),
  email: z.string().email(),
  phone: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.enum(['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '6:00 PM', '7:00 PM', '8:00 PM']),
  numberOfVisitors: z.number().int().min(1).max(10),
  paymentMethod: z.enum(['pay_now', 'pay_on_arrival'])
});

// Validate all incoming data
const validateBooking = (data) => {
  try {
    return bookingSchema.parse(data);
  } catch (error) {
    throw new Error(`Invalid booking data: ${error.message}`);
  }
};
```

### 3. Authentication & Authorization

**Admin Access Control:**
```javascript
// middleware/auth.js
export const requireAdmin = async (req, res, next) => {
  const session = await getSession(req);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = session.user;
  next();
};
```

**Rate Limiting:**
```javascript
import rateLimit from 'express-rate-limit';

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 booking attempts per windowMs
  message: 'Too many booking attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/bookings', bookingLimiter);
```

### 4. Environment Variable Security

**Secure Storage Checklist:**
- [ ] No secrets in version control
- [ ] Production secrets encrypted at rest
- [ ] Regular secret rotation schedule
- [ ] Principle of least privilege for API keys
- [ ] Separate secrets for each environment

**Secret Validation:**
```javascript
// config/validate-env.js
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SQUARE_ACCESS_TOKEN',
  'SQUARE_LOCATION_ID'
];

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate token formats
  if (process.env.NODE_ENV === 'production' &&
      process.env.SQUARE_ACCESS_TOKEN.startsWith('EAAAl')) {
    throw new Error('Production environment using sandbox Square token!');
  }
};
```

---

## Monitoring & Maintenance

### 1. Application Monitoring

**Error Tracking Setup:**
```javascript
// Install Sentry for error tracking
npm install @sentry/node @sentry/astro

// config/sentry.js
import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Capture booking errors
const createBooking = async (bookingData) => {
  try {
    return await processBooking(bookingData);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        section: 'booking',
        payment_method: bookingData.paymentMethod
      },
      user: {
        email: bookingData.email
      }
    });
    throw error;
  }
};
```

**Custom Logging:**
```javascript
// utils/logger.js
const log = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...data
    }));
  },

  error: (message, error, data = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...data
    }));
  },

  booking: (action, bookingId, data = {}) => {
    log.info(`Booking ${action}`, {
      category: 'booking',
      booking_id: bookingId,
      ...data
    });
  }
};

export default log;
```

### 2. Business Metrics Tracking

**Key Metrics to Monitor:**
```javascript
// utils/metrics.js
const trackMetric = async (metric, value, tags = {}) => {
  const data = {
    metric,
    value,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    ...tags
  };

  // Send to analytics service
  await fetch('https://your-analytics-endpoint.com/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

// Track booking events
const trackBookingCreated = (booking) => {
  trackMetric('booking.created', 1, {
    payment_method: booking.payment_method,
    visitor_count: booking.number_of_visitors,
    amount: booking.total_amount
  });
};

const trackPaymentSuccess = (booking) => {
  trackMetric('payment.success', booking.total_amount, {
    payment_method: booking.payment_method
  });
};
```

### 3. Health Checks

**System Health Endpoint:**
```javascript
// pages/api/health.js
export async function GET() {
  const checks = {
    database: false,
    square: false,
    webhooks: false,
    timestamp: new Date().toISOString()
  };

  try {
    // Test database connection
    const { data } = await supabase.from('schedule_settings').select('*').limit(1);
    checks.database = !!data;

    // Test Square API
    const squareResponse = await fetch(`${squareBaseUrl}/v2/locations`, {
      headers: { 'Authorization': `Bearer ${squareAccessToken}` }
    });
    checks.square = squareResponse.ok;

    // Test webhook endpoints
    const webhookResponse = await fetch(process.env.WEBHOOK_BOOKING_URL, {
      method: 'HEAD'
    });
    checks.webhooks = webhookResponse.ok;

  } catch (error) {
    console.error('Health check failed:', error);
  }

  const allHealthy = Object.values(checks).every(check =>
    typeof check === 'boolean' ? check : true
  );

  return new Response(JSON.stringify(checks), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 4. Backup & Recovery

**Database Backup Strategy:**
```bash
# Daily automated backups
#!/bin/bash
# scripts/backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql"

# Export Supabase data
supabase db dump --db-url "$DATABASE_URL" > "backups/$BACKUP_FILE"

# Upload to cloud storage
aws s3 cp "backups/$BACKUP_FILE" "s3://your-backup-bucket/database/"

# Keep only last 30 days of backups
find backups/ -name "backup_*.sql" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

**Recovery Testing:**
```bash
# Monthly recovery test
#!/bin/bash
# scripts/test-recovery.sh

# Create test database
createdb bluebell_recovery_test

# Restore from latest backup
LATEST_BACKUP=$(ls -t backups/backup_*.sql | head -1)
psql bluebell_recovery_test < "$LATEST_BACKUP"

# Verify data integrity
psql bluebell_recovery_test -c "SELECT COUNT(*) FROM bookings;"
psql bluebell_recovery_test -c "SELECT COUNT(*) FROM schedule_settings;"

# Cleanup
dropdb bluebell_recovery_test

echo "Recovery test completed successfully"
```

This completes the comprehensive production readiness guide. The documentation now covers all aspects of transitioning from development to production, maintaining data safety, ensuring security, and monitoring the system effectively.
