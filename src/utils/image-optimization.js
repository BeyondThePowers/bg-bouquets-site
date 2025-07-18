// Image optimization utilities
export class ImageOptimizer {
  constructor() {
    this.observedImages = new Set();
    this.setupLazyLoading();
    this.setupImageErrorHandling();
  }

  setupLazyLoading() {
    // Use Intersection Observer for lazy loading
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.imageObserver.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px 0px', // Start loading 50px before image enters viewport
        threshold: 0.01
      });

      // Observe all images with data-src attribute
      this.observeImages();
    } else {
      // Fallback for browsers without Intersection Observer
      this.loadAllImages();
    }
  }

  observeImages() {
    const lazyImages = document.querySelectorAll('img[data-src], img[loading="lazy"]');
    lazyImages.forEach(img => {
      if (!this.observedImages.has(img)) {
        this.imageObserver.observe(img);
        this.observedImages.add(img);
      }
    });
  }

  loadImage(img) {
    // Handle data-src lazy loading
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }

    // Handle srcset lazy loading
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
      img.removeAttribute('data-srcset');
    }

    // Add loaded class for CSS transitions
    img.addEventListener('load', () => {
      img.classList.add('loaded');
    });

    // Handle loading errors
    img.addEventListener('error', () => {
      this.handleImageError(img);
    });
  }

  loadAllImages() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => this.loadImage(img));
  }

  handleImageError(img) {
    // Add error class
    img.classList.add('image-error');
    
    // Try WebP fallback if original was not WebP
    if (!img.src.includes('.webp') && img.dataset.fallback) {
      img.src = img.dataset.fallback;
      return;
    }

    // Show placeholder or hide image
    if (img.dataset.placeholder) {
      img.src = img.dataset.placeholder;
    } else {
      img.style.display = 'none';
    }
  }

  setupImageErrorHandling() {
    // Global error handler for images
    document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG') {
        this.handleImageError(e.target);
      }
    }, true);
  }

  // Preload critical images
  preloadCriticalImages(imageUrls) {
    imageUrls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  // Generate responsive image markup
  generateResponsiveImage(src, alt, options = {}) {
    const {
      width = 800,
      height = 600,
      loading = 'lazy',
      fetchpriority = 'auto',
      className = '',
      sizes = '(max-width: 768px) 100vw, 50vw'
    } = options;

    const baseName = src.replace(/\.[^/.]+$/, "");
    const ext = src.split('.').pop()?.toLowerCase();

    // Generate different sizes
    const sizes_config = [
      { width: 480, suffix: '-small' },
      { width: 768, suffix: '-medium' },
      { width: 1200, suffix: '-large' }
    ];

    const webpSrcset = sizes_config
      .map(size => `${baseName}${size.suffix}.webp ${size.width}w`)
      .join(', ');

    const fallbackSrcset = sizes_config
      .map(size => `${baseName}${size.suffix}.${ext} ${size.width}w`)
      .join(', ');

    return `
      <picture class="${className}">
        <source 
          srcset="${webpSrcset}"
          type="image/webp"
          sizes="${sizes}"
        />
        <img
          src="${baseName}-medium.${ext}"
          srcset="${fallbackSrcset}"
          alt="${alt}"
          width="${width}"
          height="${height}"
          loading="${loading}"
          fetchpriority="${fetchpriority}"
          sizes="${sizes}"
          decoding="async"
        />
      </picture>
    `;
  }

  // Convert images to WebP format (client-side detection)
  supportsWebP() {
    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => {
        resolve(webP.height === 2);
      };
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
  }

  // Optimize image loading based on connection speed
  async optimizeForConnection() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      // Adjust image quality based on connection
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        // Load lower quality images
        this.adjustImageQuality('low');
      } else if (connection.effectiveType === '3g') {
        this.adjustImageQuality('medium');
      } else {
        this.adjustImageQuality('high');
      }

      // Listen for connection changes
      connection.addEventListener('change', () => {
        this.optimizeForConnection();
      });
    }
  }

  adjustImageQuality(quality) {
    const images = document.querySelectorAll('img[data-quality]');
    images.forEach(img => {
      const qualityUrls = JSON.parse(img.dataset.quality);
      if (qualityUrls[quality]) {
        img.src = qualityUrls[quality];
      }
    });
  }

  // Monitor image loading performance
  monitorImagePerformance() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            const loadTime = entry.responseEnd - entry.startTime;
            const size = entry.transferSize || 0;
            
            // Report slow loading images
            if (loadTime > 1000) {
              console.warn(`Slow image loading: ${entry.name} took ${loadTime}ms (${size} bytes)`);
            }

            // Track to performance monitoring
            if (window.performanceMonitor) {
              window.performanceMonitor.trackCustomEvent('ImageLoad', loadTime, 'Performance');
            }
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  // Initialize all optimizations
  init() {
    this.optimizeForConnection();
    this.monitorImagePerformance();
    
    // Re-observe images when new content is added
    const contentObserver = new MutationObserver(() => {
      this.observeImages();
    });

    contentObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Auto-initialize image optimization
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.imageOptimizer = new ImageOptimizer();
    window.imageOptimizer.init();
  });
}
