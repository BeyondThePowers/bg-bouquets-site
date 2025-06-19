// Security and performance middleware
export function onRequest(context, next) {
  return next().then(response => {
    // Clone response to modify headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });

    // Security Headers
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('X-DNS-Prefetch-Control', 'on');

    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for Astro
      "style-src 'self' 'unsafe-inline'", // Allow inline styles
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ');
    
    newResponse.headers.set('Content-Security-Policy', csp);

    // Performance Headers
    const url = new URL(context.request.url);
    
    // Cache static assets
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot|ico)$/)) {
      newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (url.pathname === '/' || url.pathname.endsWith('.html')) {
      // Cache HTML pages for a shorter time
      newResponse.headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    }

    // Compression hint
    newResponse.headers.set('Vary', 'Accept-Encoding');

    // HSTS for HTTPS (only set in production)
    if (context.request.url.startsWith('https://')) {
      newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Permissions Policy (formerly Feature Policy)
    const permissionsPolicy = [
      'camera=()',
      'microphone=()',
      'geolocation=(self)',
      'payment=(self)',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'fullscreen=(self)'
    ].join(', ');
    
    newResponse.headers.set('Permissions-Policy', permissionsPolicy);

    // Cross-Origin Policies
    newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newResponse.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

    return newResponse;
  });
}
