// Environment variable validation and fallbacks
export function validateEnvironment() {
  const requiredEnvVars = {
    PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: process.env.PUBLIC_SUPABASE_ANON_KEY
  };

  const optionalEnvVars = {
    MAKE_BOOKING_WEBHOOK_URL: process.env.MAKE_BOOKING_WEBHOOK_URL,
    MAKE_CANCELLATION_WEBHOOK_URL: process.env.MAKE_CANCELLATION_WEBHOOK_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL
  };

  const missing = [];
  const warnings = [];
  const optionalMissing = [];

  // Check for required environment variables
  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
      missing.push(key);
    } else if (value.includes('your_') || value.includes('_here')) {
      warnings.push(`${key} appears to be a placeholder value`);
    }
  });

  // Check for optional environment variables
  Object.entries(optionalEnvVars).forEach(([key, value]) => {
    if (!value) {
      optionalMissing.push(key);
    } else if (value.includes('your_') || value.includes('_here')) {
      warnings.push(`${key} appears to be a placeholder value`);
    }
  });

  // Log results
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    console.error('Please set these in your .env file or Netlify dashboard');

    // In development, provide helpful guidance
    if (import.meta.env.DEV) {
      console.error('\n📝 To fix this:');
      console.error('1. Copy .env.example to .env');
      console.error('2. Fill in your actual Supabase credentials');
      console.error('3. Restart your development server');
    }
  }

  if (optionalMissing.length > 0) {
    console.warn('⚠️ Optional environment variables not configured:', optionalMissing);
    console.warn('Email automation will not work without Make.com webhook URLs');
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Environment variable warnings:', warnings);
  }

  if (missing.length === 0 && warnings.length === 0 && optionalMissing.length === 0) {
    console.log('✅ All environment variables are properly configured');
  } else if (missing.length === 0) {
    console.log('✅ Required environment variables are configured');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    optionalMissing
  };
}

// Provide fallbacks for development
export function getEnvWithFallback(key, fallback = null) {
  const value = import.meta.env[key] || process.env[key];
  
  if (!value && fallback) {
    console.warn(`Using fallback for ${key}`);
    return fallback;
  }
  
  return value;
}

// Initialize validation on import
if (typeof window === 'undefined') {
  // Only run on server-side
  validateEnvironment();
}
