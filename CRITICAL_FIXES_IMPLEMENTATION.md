# 🚨 Critical Fixes Implementation Guide

## 1. Image Optimization (HIGHEST PRIORITY)

### Problem: Large images causing poor LCP scores

### Solution: Create optimized image component

```astro
---
// src/components/OptimizedImage.astro
export interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  loading?: 'lazy' | 'eager';
  fetchpriority?: 'high' | 'low' | 'auto';
  class?: string;
}

const { src, alt, width, height, loading = 'lazy', fetchpriority = 'auto', class: className } = Astro.props;

// Generate responsive image URLs (you'll need to create these)
const baseName = src.replace(/\.[^/.]+$/, "");
const ext = src.split('.').pop();
---

<img
  src={`${baseName}-medium.webp`}
  srcset={`
    ${baseName}-small.webp 480w,
    ${baseName}-medium.webp 768w,
    ${baseName}-large.webp 1200w
  `}
  sizes="(max-width: 768px) 100vw, 50vw"
  width={width}
  height={height}
  alt={alt}
  loading={loading}
  fetchpriority={fetchpriority}
  class={className}
/>
```

## 2. JavaScript Code Splitting (HIGH PRIORITY)

### Problem: 1700+ lines of JavaScript in one file

### Solution: Split into modules

```javascript
// src/scripts/booking.js
export class BookingManager {
  constructor() {
    this.initializeBooking();
  }
  
  async initializeBooking() {
    // Move booking logic here
  }
}

// src/scripts/flowers.js
export class FlowerManager {
  constructor() {
    this.initializeFlowers();
  }
  
  initializeFlowers() {
    // Move flower section logic here
  }
}

// In index.astro
<script>
  import { BookingManager } from '../scripts/booking.js';
  import { FlowerManager } from '../scripts/flowers.js';
  
  document.addEventListener('DOMContentLoaded', () => {
    new BookingManager();
    new FlowerManager();
  });
</script>
```

## 3. Critical CSS Inlining (HIGH PRIORITY)

### Problem: FOUC (Flash of Unstyled Content)

### Solution: Inline critical styles

```astro
---
// In Layout.astro head section
---
<style is:inline>
  /* Critical styles for above-the-fold content */
  .hero-section {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
  
  .nav-backdrop {
    background: rgba(248, 231, 232, 0.95);
    backdrop-filter: blur(10px);
  }
  
  /* Font display optimization */
  @font-face {
    font-family: 'Allura';
    src: url('/fonts/Allura-Regular.woff2') format('woff2');
    font-display: swap;
  }
</style>
```

## 4. Security Headers (MEDIUM PRIORITY)

### Problem: Missing security headers

### Solution: Add middleware

```javascript
// src/middleware.js
export function onRequest(context, next) {
  const response = next();
  
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' https://*.supabase.co;"
  );
  
  return response;
}
```

## 5. Accessibility Improvements (MEDIUM PRIORITY)

### Problem: Missing focus management and color contrast

### Solution: Enhanced focus styles and contrast

```css
/* Add to global.css */
:focus-visible {
  outline: 2px solid #E8B4B8;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Ensure sufficient color contrast */
.text-charcoal {
  color: #1a1a1a; /* Darker for better contrast */
}

/* Skip link styling */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: #E8B4B8;
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}
```

## 6. Performance Monitoring Setup

### Add performance tracking

```javascript
// src/scripts/performance.js
export function trackWebVitals() {
  // Track Core Web Vitals
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  });
}

// In Layout.astro
<script>
  import { trackWebVitals } from '../scripts/performance.js';
  trackWebVitals();
</script>
```

## Implementation Priority

1. **Week 1**: Image optimization and responsive images
2. **Week 2**: JavaScript code splitting and lazy loading
3. **Week 3**: Critical CSS inlining and font optimization
4. **Week 4**: Security headers and accessibility improvements

## Testing Checklist

- [ ] Lighthouse score > 90 for all metrics
- [ ] WAVE accessibility scan passes
- [ ] Manual keyboard navigation test
- [ ] Mobile device testing
- [ ] Cross-browser compatibility
- [ ] Performance testing on slow networks

## Expected Results

After implementing these fixes:
- **Performance**: 40-60% improvement in load times
- **SEO**: Better search engine rankings
- **Accessibility**: WCAG AA compliance
- **User Experience**: Smoother interactions and faster perceived performance
