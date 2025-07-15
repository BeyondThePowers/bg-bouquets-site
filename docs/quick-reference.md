# Bluebell Gardens - Quick Reference Guide

## Emergency Contacts & Resources

### Key Services
- **Hosting**: Netlify (https://app.netlify.com)
- **Database**: Supabase (https://app.supabase.com)
- **Payments**: Square (https://developer.squareup.com)
- **Automation**: Make.com (https://www.make.com)

### Important URLs
- **Production Site**: https://bluebellgardens.ca
- **Admin Interface**: https://bluebellgardens.ca/garden-mgmt
- **Health Check**: https://bluebellgardens.ca/api/health
- **Booking API**: https://bluebellgardens.ca/api/bookings

---

## Common Tasks

### Reset Booking Data (Development)
```bash
# SQL Method
psql -d your_database < scripts/reset-booking-data.sql

# JavaScript Method
node scripts/reset-booking-data.js
```

### Check System Health
```bash
curl https://bluebellgardens.ca/api/health
```

### View Recent Bookings
```sql
SELECT full_name, email, date, time, payment_status, created_at 
FROM bookings 
ORDER BY created_at DESC 
LIMIT 10;
```

### Test Payment Integration
```bash
# Test sandbox payment
curl -X POST https://bluebellgardens.ca/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "phone": "(555) 123-4567",
    "visitDate": "2025-07-01",
    "preferredTime": "10:00 AM",
    "numberOfVisitors": 1,
    "totalAmount": 35,
    "paymentMethod": "pay_now"
  }'
# Note: API field is still "numberOfVisitors" for compatibility, but represents number of bouquets
```

---

## Environment Variables Template

### Development (.env.local)
```env
# Site Configuration
PUBLIC_URL=http://localhost:4321
SITE_URL=http://localhost:4321
NODE_ENV=development

# Supabase (Development Project)
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key

# Square (Sandbox)
SQUARE_ACCESS_TOKEN=EAAAl2t2YejjJ1M1GAe9G60hBUMcS4xTAWRFnPRyT2Wv4_zbSOa-RfZry-O-IESt
SQUARE_LOCATION_ID=LB73JX2KPQ4VJ
SQUARE_APPLICATION_ID=sandbox-sq0idb-your-app-id
SQUARE_APPLICATION_SECRET=sandbox-sq0csb-your-app-secret
SQUARE_WEBHOOK_SIGNATURE_KEY=sandbox-webhook-key

# Webhooks (Development Make.com)
WEBHOOK_BOOKING_URL=https://hook.us1.make.com/dev-booking-webhook
WEBHOOK_CANCELLATION_URL=https://hook.us1.make.com/dev-cancel-webhook
WEBHOOK_RESCHEDULE_URL=https://hook.us1.make.com/dev-reschedule-webhook
WEBHOOK_PAYMENT_SUCCESS_URL=https://hook.us1.make.com/dev-payment-success-webhook
WEBHOOK_PAYMENT_FAILED_URL=https://hook.us1.make.com/dev-payment-failed-webhook

# Email (Development - Console Logging)
EMAIL_PROVIDER=console
FROM_EMAIL=dev@example.com

# Security
SESSION_SECRET=dev-session-secret-change-in-production
ADMIN_PASSWORD=dev-admin-password

# Optional
CONFIRM_DELETE=true
```

### Production (Netlify Environment Variables)
```env
# Site Configuration
PUBLIC_URL=https://bluebellgardens.ca
SITE_URL=https://bluebellgardens.ca
NODE_ENV=production

# Supabase (Production Project)
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key

# Square (Production)
SQUARE_ACCESS_TOKEN=EAAAEOVuza9... (production token)
SQUARE_LOCATION_ID=your-production-location-id
SQUARE_APPLICATION_ID=sq0idp-your-production-app-id
SQUARE_APPLICATION_SECRET=sq0csp-your-production-app-secret
SQUARE_WEBHOOK_SIGNATURE_KEY=your-production-webhook-key

# Webhooks (Production Make.com)
WEBHOOK_BOOKING_URL=https://hook.us1.make.com/prod-booking-webhook
WEBHOOK_CANCELLATION_URL=https://hook.us1.make.com/prod-cancel-webhook
WEBHOOK_RESCHEDULE_URL=https://hook.us1.make.com/prod-reschedule-webhook
WEBHOOK_PAYMENT_SUCCESS_URL=https://hook.us1.make.com/prod-payment-success-webhook
WEBHOOK_PAYMENT_FAILED_URL=https://hook.us1.make.com/prod-payment-failed-webhook

# Email (Production)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-production-api-key
FROM_EMAIL=noreply@bluebellgardens.ca

# Security
SESSION_SECRET=your-secure-random-production-secret
ADMIN_PASSWORD=your-secure-production-admin-password

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
```

---

## Troubleshooting Guide

### Payment Issues

**Problem**: "Payment link creation failed"
```bash
# Check Square credentials
curl -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  https://connect.squareupsandbox.com/v2/locations

# Verify environment detection
node -e "
const token = process.env.SQUARE_ACCESS_TOKEN;
console.log('Token starts with:', token.substring(0, 10));
console.log('Is sandbox:', token.startsWith('EAAAl'));
"
```

**Problem**: "Unauthorized" from Square
- Verify access token is correct
- Check if using sandbox token with production endpoint
- Ensure token has required permissions

### Database Issues

**Problem**: "Connection refused" to Supabase
```bash
# Test connection
curl -H "apikey: $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/bookings?select=id&limit=1"
```

**Problem**: "Row Level Security" errors
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'bookings';

-- Temporarily disable RLS for testing
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
```

### Webhook Issues

**Problem**: Make.com webhooks not receiving data
```bash
# Test webhook manually
curl -X POST $WEBHOOK_BOOKING_URL \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Problem**: Webhook authentication failures
- Check webhook signature validation
- Verify Make.com scenario is active
- Test with webhook testing tools

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables updated
- [ ] Database migrations applied
- [ ] Backup created
- [ ] Staging tested

### Deployment
- [ ] Code pushed to main branch
- [ ] Netlify build successful
- [ ] Environment variables set
- [ ] Custom domain configured
- [ ] SSL certificate active

### Post-Deployment
- [ ] Health check passing
- [ ] Test booking flow
- [ ] Verify email notifications
- [ ] Check admin interface
- [ ] Monitor error logs

---

## Maintenance Schedule

### Daily
- [ ] Check error logs
- [ ] Monitor booking volume
- [ ] Verify payment processing

### Weekly
- [ ] Review system health
- [ ] Check backup status
- [ ] Update dependencies (if needed)

### Monthly
- [ ] Test recovery procedures
- [ ] Review security logs
- [ ] Update documentation
- [ ] Rotate API keys (if required)

### Quarterly
- [ ] Security audit
- [ ] Performance review
- [ ] Backup strategy review
- [ ] Disaster recovery test

---

## Contact Information

### Technical Support
- **Developer**: [Your contact information]
- **Hosting**: Netlify Support
- **Database**: Supabase Support
- **Payments**: Square Developer Support

### Business Contacts
- **Domain Registrar**: [Your domain provider]
- **Email Service**: [Your email provider]
- **Analytics**: Google Analytics Support

---

## Useful Commands

### Development
```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview

# Reset database
npm run db:reset

# Generate types
npm run types:generate
```

### Database Management
```bash
# Connect to database
psql $DATABASE_URL

# Export schema
pg_dump --schema-only $DATABASE_URL > schema.sql

# Export data
pg_dump --data-only $DATABASE_URL > data.sql

# Import backup
psql $DATABASE_URL < backup.sql
```

### Monitoring
```bash
# Check logs
netlify logs

# Monitor health
watch -n 30 'curl -s https://bluebellgardens.ca/api/health | jq'

# Check SSL certificate
openssl s_client -connect bluebellgardens.ca:443 -servername bluebellgardens.ca
```
