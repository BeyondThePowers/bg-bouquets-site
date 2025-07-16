#!/usr/bin/env node

/**
 * Admin Security Test Script
 * Tests that admin pages are properly protected from public access
 */

const https = require('https');
const http = require('http');

// Configuration
const SITE_URL = process.env.SITE_URL || 'https://bgbouquet.com';
const TEST_PATHS = [
  '/garden-mgmt',
  '/garden-mgmt/',
  '/garden-mgmt/bookings',
  '/api/garden-mgmt/bookings',
  '/api/admin/verify-password'
];

/**
 * Make HTTP request and return response details
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Test security headers for admin routes
 */
async function testSecurityHeaders(path) {
  console.log(`\n🔍 Testing: ${path}`);
  
  try {
    const response = await makeRequest(`${SITE_URL}${path}`);
    const headers = response.headers;
    
    // Check for security headers
    const securityChecks = {
      'X-Robots-Tag': headers['x-robots-tag'],
      'Cache-Control': headers['cache-control'],
      'X-Frame-Options': headers['x-frame-options'],
      'Referrer-Policy': headers['referrer-policy']
    };
    
    console.log(`   Status: ${response.statusCode}`);
    
    // Check each security header
    Object.entries(securityChecks).forEach(([header, value]) => {
      if (value) {
        console.log(`   ✅ ${header}: ${value}`);
      } else {
        console.log(`   ❌ ${header}: Missing`);
      }
    });
    
    // Check for noindex in HTML meta tags (for HTML responses)
    if (response.body.includes('<meta') && response.body.includes('noindex')) {
      console.log(`   ✅ HTML Meta: noindex found`);
    } else if (response.body.includes('<html')) {
      console.log(`   ❌ HTML Meta: noindex missing`);
    }
    
    // Check if authentication is required
    if (response.statusCode === 401 || response.body.includes('password') || response.body.includes('login')) {
      console.log(`   ✅ Authentication: Required`);
    } else {
      console.log(`   ⚠️  Authentication: Check manually`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * Test robots.txt configuration
 */
async function testRobotsTxt() {
  console.log(`\n🤖 Testing robots.txt`);
  
  try {
    const response = await makeRequest(`${SITE_URL}/robots.txt`);
    const robotsTxt = response.body;
    
    const adminPaths = ['/garden-mgmt', '/api/garden-mgmt', '/api/admin'];
    
    adminPaths.forEach(path => {
      if (robotsTxt.includes(`Disallow: ${path}`)) {
        console.log(`   ✅ Blocked: ${path}`);
      } else {
        console.log(`   ❌ Missing: ${path}`);
      }
    });
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * Test sitemap.xml to ensure admin pages are not listed
 */
async function testSitemap() {
  console.log(`\n🗺️  Testing sitemap.xml`);
  
  try {
    const response = await makeRequest(`${SITE_URL}/sitemap.xml`);
    const sitemap = response.body;
    
    const adminPaths = ['/garden-mgmt', 'garden-mgmt'];
    let foundAdminPaths = [];
    
    adminPaths.forEach(path => {
      if (sitemap.includes(path)) {
        foundAdminPaths.push(path);
      }
    });
    
    if (foundAdminPaths.length === 0) {
      console.log(`   ✅ No admin paths found in sitemap`);
    } else {
      console.log(`   ❌ Admin paths found: ${foundAdminPaths.join(', ')}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runSecurityTests() {
  console.log('🔒 Admin Security Test Suite');
  console.log('============================');
  console.log(`Testing site: ${SITE_URL}`);
  
  // Test robots.txt
  await testRobotsTxt();
  
  // Test sitemap.xml
  await testSitemap();
  
  // Test each admin path
  for (const path of TEST_PATHS) {
    await testSecurityHeaders(path);
  }
  
  console.log('\n📋 Security Test Summary');
  console.log('========================');
  console.log('✅ = Pass, ❌ = Fail, ⚠️ = Manual Check Required');
  console.log('\nRecommendations:');
  console.log('1. Ensure all admin paths show authentication required');
  console.log('2. Verify X-Robots-Tag headers are present');
  console.log('3. Check that Cache-Control prevents caching');
  console.log('4. Confirm no admin paths in sitemap.xml');
  console.log('5. Test with actual search engines after deployment');
}

// Run tests if called directly
if (require.main === module) {
  runSecurityTests().catch(console.error);
}

module.exports = { runSecurityTests, testSecurityHeaders, testRobotsTxt, testSitemap };
