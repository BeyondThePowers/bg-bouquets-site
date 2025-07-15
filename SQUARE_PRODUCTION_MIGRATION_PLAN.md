# 🚀 Square Production Migration - Implementation Plan

## **Project Overview**
Migrate BG Bouquet Garden booking system from Square Sandbox to Production while maintaining sandbox rollback capability for debugging and problem-solving.

## **Implementation Decisions**
- ✅ **Dual-Mode Support**: Maintain sandbox capability with `SQUARE_FORCE_SANDBOX` emergency rollback
- ✅ **Legacy Data**: No special handling needed for existing sandbox orders
- ✅ **Credential Management**: Manual input by owner
- ✅ **Testing Timeline**: Production testing in coming days (not immediate)

---

## **Phase B - Implementation Tasks**

### **Task 1: Add Emergency Rollback Feature**

**File**: `src/utils/squareService.ts`
**Changes**: Add `SQUARE_FORCE_SANDBOX` environment variable support

```typescript
// Current code (line 38):
const isSandbox = config.SQUARE_ACCESS_TOKEN.startsWith('EAAAl');

// New code:
const isSandbox = config.SQUARE_ACCESS_TOKEN.startsWith('EAAAl') || 
                  (process.env.SQUARE_FORCE_SANDBOX || import.meta.env.SQUARE_FORCE_SANDBOX) === 'true';
```

**Benefits**: 
- Emergency rollback without changing all credentials
- Debugging capability in production environment
- Quick troubleshooting option

### **Task 2: Environment Variable Documentation**

**File**: Create/Update `.env.example`
**Purpose**: Document all required production environment variables

```env
# Square Payment Integration
# For Production: Use credentials from Square Developer Dashboard → Production
# For Sandbox: Use sandbox credentials (current setup)
SQUARE_APPLICATION_ID=sq0idp-your-production-app-id
SQUARE_APPLICATION_SECRET=sq0csp-your-production-secret  
SQUARE_ACCESS_TOKEN=EAAAE-your-production-access-token
SQUARE_LOCATION_ID=L-your-production-location-id
SQUARE_WEBHOOK_SIGNATURE_KEY=your-production-webhook-signature-key

# Emergency Rollback (Optional)
# Set to 'true' to force sandbox mode even with production credentials
SQUARE_FORCE_SANDBOX=false
```

### **Task 3: Remove Test Endpoints (Production Security)**

**Files to Remove**:
- `src/pages/api/test-square.ts`
- `src/pages/api/test-square-signature.ts` 
- `src/pages/api/test-square-webhook.ts`
- `src/pages/api/debug-square-config.ts`

**Rationale**: Security best practice - remove debug endpoints from production

### **Task 4: Update Documentation**

**Files to Update**:
- `README.md` - Add production setup section
- `docs/production-readiness-guide.md` - Update with new rollback feature
- `docs/square-webhook-setup.md` - Add production webhook configuration

---

## **Owner Manual Tasks (Square Dashboard)**

### **Step 1: Square Developer Dashboard Setup**

1. **Navigate to Square Developer Dashboard**
   - URL: https://developer.squareup.com/
   - Login with your Square account

2. **Switch to Production Environment**
   - Look for environment toggle (usually top-right)
   - Select "Production" instead of "Sandbox"

3. **Create/Activate Production Application**
   - If first time: Create new application
   - If existing: Activate production mode for existing app

### **Step 2: Generate Production Credentials**

**Collect these 5 credentials:**

1. **Production Access Token**
   - Location: Applications → [Your App] → Production → OAuth
   - Format: Starts with `EAAAE`
   - Copy full token

2. **Production Location ID**
   - Location: Applications → [Your App] → Production → Locations
   - Format: Starts with `L` (not `LB` like sandbox)
   - Use your primary business location

3. **Production Application ID**
   - Location: Applications → [Your App] → Production → Credentials
   - Format: Starts with `sq0idp-`

4. **Production Application Secret**
   - Location: Applications → [Your App] → Production → Credentials  
   - Format: Starts with `sq0csp-`
   - ⚠️ **Security**: Only shown once, copy immediately

5. **Production Webhook Signature Key**
   - Location: Applications → [Your App] → Production → Webhooks
   - Create endpoint: `https://bgbouquet.com/api/square-webhook`
   - Events: `payment.created`, `payment.updated`, `order.updated`
   - Copy signature key after creation

### **Step 3: Compliance Requirements**

1. **PCI Questionnaire**
   - Complete required PCI compliance forms
   - Usually found in Account → Compliance section

2. **Bank Account Verification**
   - Verify bank account for payment settlements
   - Location: Account → Banking

3. **Production Terms**
   - Review and accept production terms of service
   - Required before processing live payments

---

## **Deployment Checklist**

### **Pre-Deployment**
- [ ] All 5 production credentials collected from Square Dashboard
- [ ] PCI compliance completed
- [ ] Bank account verified
- [ ] Code changes implemented and tested locally

### **Deployment Steps**

1. **Update Netlify Environment Variables**
   - Navigate to Netlify Dashboard → Site Settings → Environment Variables
   - Update these 5 variables with production values:
     - `SQUARE_APPLICATION_ID`
     - `SQUARE_APPLICATION_SECRET`
     - `SQUARE_ACCESS_TOKEN`
     - `SQUARE_LOCATION_ID`
     - `SQUARE_WEBHOOK_SIGNATURE_KEY`
   - Add new variable: `SQUARE_FORCE_SANDBOX=false`

2. **Deploy Code Changes**
   - Push code changes to main branch
   - Netlify will auto-deploy
   - Monitor build logs for success

3. **Verify Deployment**
   - Check `/api/test-square` endpoint removed (should return 404)
   - Verify environment detection working
   - Confirm webhook endpoint responding

### **Post-Deployment Testing**

**Test Case 1: Small Value Payment**
- Amount: $1.00 CAD
- Card: Real credit card (not test card)
- Expected: Payment processes, webhook fires, database updates

**Test Case 2: Webhook Verification**
- Monitor: Netlify function logs
- Expected: 200 OK responses from Square webhooks
- Check: `square_payment_id` populated in database

**Test Case 3: Refund Processing**
- Method: Square Dashboard refund
- Expected: Refund processes successfully
- Verify: Customer receives refund

---

## **Emergency Rollback Procedures**

### **Method 1: Environment Variable Rollback**
1. Set `SQUARE_FORCE_SANDBOX=true` in Netlify
2. Redeploy (automatic)
3. System reverts to sandbox mode immediately

### **Method 2: Full Credential Rollback**
1. Revert all 5 Square environment variables to sandbox values
2. Set `SQUARE_FORCE_SANDBOX=false`
3. Redeploy

### **Method 3: Code Rollback**
1. Revert to previous Git commit
2. Push to trigger Netlify redeploy
3. System returns to previous state

---

## **Monitoring & Maintenance**

### **Key Metrics to Track**
- Payment success rate (target: >95%)
- Webhook delivery success (target: >99%)
- Database completion rate (target: 100%)
- Customer support tickets (target: <5% increase)

### **Regular Maintenance Tasks**
- Monthly: Review Square Dashboard transaction reports
- Weekly: Check Netlify function error rates
- Daily: Monitor Make.com scenario success rates
- As needed: Review Supabase payment data integrity

---

## **Success Criteria**

### **Technical Success**
- [ ] All payments process through Square Production
- [ ] Webhooks deliver successfully (200 OK responses)
- [ ] Database records complete payment information
- [ ] No increase in system errors or downtime

### **Business Success**
- [ ] Real payments settle to bank account
- [ ] Customer experience unchanged
- [ ] Admin booking management functions normally
- [ ] Email confirmations send correctly

---

## **Next Steps**

1. **Review this plan** and confirm all requirements understood
2. **Schedule production credential collection** from Square Dashboard
3. **Plan deployment window** for low-traffic time
4. **Prepare rollback communication** for team/customers if needed
5. **Execute implementation** following this plan

---

## **Contact & Support**

- **Square Support**: https://developer.squareup.com/support
- **Netlify Support**: https://docs.netlify.com/
- **Supabase Support**: https://supabase.com/docs

---

## **Implementation Prompt for AI Assistant**

When ready to implement, use this prompt:

```
I'm ready to implement the Square Production migration plan from SQUARE_PRODUCTION_MIGRATION_PLAN.md.

Current status:
- [ ] Square Dashboard credentials collected (I will provide these)
- [ ] PCI compliance completed: [YES/NO]
- [ ] Bank account verified: [YES/NO]
- [ ] Ready to deploy: [YES/NO]

Please implement the code changes from Task 1-4 in the plan:
1. Add SQUARE_FORCE_SANDBOX emergency rollback feature
2. Update environment variable documentation
3. Remove test endpoints for production security
4. Update relevant documentation

After code changes, provide the exact Netlify environment variable values I need to set and the deployment verification steps.
```

---

**Document Status**: Ready for Implementation
**Last Updated**: 2025-07-15
**Implementation Timeline**: Owner discretion (coming days)
**Next Action**: Use implementation prompt above when ready to proceed
