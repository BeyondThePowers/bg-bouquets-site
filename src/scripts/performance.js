// Performance monitoring and Core Web Vitals tracking
export class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.initializeTracking();
  }

  async initializeTracking() {
    // Track Core Web Vitals
    if ('web-vitals' in window || typeof window !== 'undefined') {
      try {
        // Dynamic import for web-vitals (if available)
        const webVitals = await import('web-vitals').catch(() => null);
        
        if (webVitals) {
          this.trackWithWebVitals(webVitals);
        } else {
          this.trackWithNativeAPIs();
        }
      } catch (error) {
        console.log('Web Vitals library not available, using native APIs');
        this.trackWithNativeAPIs();
      }
    } else {
      this.trackWithNativeAPIs();
    }

    // Track custom metrics
    this.trackCustomMetrics();
  }

  trackWithWebVitals(webVitals) {
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = webVitals;

    getCLS((metric) => this.reportMetric('CLS', metric));
    getFID((metric) => this.reportMetric('FID', metric));
    getFCP((metric) => this.reportMetric('FCP', metric));
    getLCP((metric) => this.reportMetric('LCP', metric));
    getTTFB((metric) => this.reportMetric('TTFB', metric));
  }

  trackWithNativeAPIs() {
    // Fallback to native Performance APIs
    if ('PerformanceObserver' in window) {
      // Track LCP
      this.observeMetric('largest-contentful-paint', (entries) => {
        const lastEntry = entries[entries.length - 1];
        this.reportMetric('LCP', {
          name: 'LCP',
          value: lastEntry.startTime,
          rating: this.getRating('LCP', lastEntry.startTime)
        });
      });

      // Track FID
      this.observeMetric('first-input', (entries) => {
        const firstEntry = entries[0];
        this.reportMetric('FID', {
          name: 'FID',
          value: firstEntry.processingStart - firstEntry.startTime,
          rating: this.getRating('FID', firstEntry.processingStart - firstEntry.startTime)
        });
      });

      // Track CLS
      this.observeMetric('layout-shift', (entries) => {
        let clsValue = 0;
        for (const entry of entries) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.reportMetric('CLS', {
          name: 'CLS',
          value: clsValue,
          rating: this.getRating('CLS', clsValue)
        });
      });
    }

    // Track Navigation Timing
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            this.reportMetric('TTFB', {
              name: 'TTFB',
              value: navigation.responseStart - navigation.requestStart,
              rating: this.getRating('TTFB', navigation.responseStart - navigation.requestStart)
            });
          }
        }, 0);
      });
    }
  }

  observeMetric(type, callback) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
    } catch (error) {
      console.log(`Could not observe ${type}:`, error);
    }
  }

  trackCustomMetrics() {
    // Track time to interactive (custom implementation)
    this.trackTimeToInteractive();
    
    // Track resource loading
    this.trackResourceMetrics();
    
    // Track user interactions
    this.trackUserInteractions();
  }

  trackTimeToInteractive() {
    let interactiveTime = 0;
    
    const checkInteractive = () => {
      if (document.readyState === 'complete' && !interactiveTime) {
        interactiveTime = performance.now();
        this.reportMetric('TTI', {
          name: 'TTI',
          value: interactiveTime,
          rating: this.getRating('TTI', interactiveTime)
        });
      }
    };

    if (document.readyState === 'complete') {
      checkInteractive();
    } else {
      window.addEventListener('load', checkInteractive);
    }
  }

  trackResourceMetrics() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const resources = performance.getEntriesByType('resource');
        
        let totalSize = 0;
        let imageCount = 0;
        let scriptCount = 0;
        let styleCount = 0;

        resources.forEach(resource => {
          if (resource.transferSize) {
            totalSize += resource.transferSize;
          }

          if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            imageCount++;
          } else if (resource.name.match(/\.js$/i)) {
            scriptCount++;
          } else if (resource.name.match(/\.css$/i)) {
            styleCount++;
          }
        });

        this.reportMetric('ResourceMetrics', {
          name: 'ResourceMetrics',
          totalSize,
          imageCount,
          scriptCount,
          styleCount,
          totalRequests: resources.length
        });
      }, 1000);
    });
  }

  trackUserInteractions() {
    let interactionCount = 0;
    
    const trackInteraction = () => {
      interactionCount++;
    };

    ['click', 'keydown', 'touchstart'].forEach(event => {
      document.addEventListener(event, trackInteraction, { passive: true });
    });

    // Report interaction count after 30 seconds
    setTimeout(() => {
      this.reportMetric('UserInteractions', {
        name: 'UserInteractions',
        value: interactionCount
      });
    }, 30000);
  }

  getRating(metric, value) {
    const thresholds = {
      'LCP': { good: 2500, poor: 4000 },
      'FID': { good: 100, poor: 300 },
      'CLS': { good: 0.1, poor: 0.25 },
      'TTFB': { good: 800, poor: 1800 },
      'TTI': { good: 3800, poor: 7300 }
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  reportMetric(name, metric) {
    this.metrics[name] = metric;
    
    // Log to console in development
    if (window.location.hostname === 'localhost') {
      console.log(`${name}:`, metric);
    }

    // Send to analytics (implement based on your analytics provider)
    this.sendToAnalytics(name, metric);
  }

  sendToAnalytics(name, metric) {
    // Example: Send to Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: name,
        value: Math.round(metric.value),
        custom_map: {
          metric_rating: metric.rating
        }
      });
    }

    // Example: Send to custom analytics endpoint
    if (window.location.hostname !== 'localhost') {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: name,
          value: metric.value,
          rating: metric.rating,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {
        // Silently fail - analytics shouldn't break the site
      });
    }
  }

  getMetrics() {
    return this.metrics;
  }

  // Public method to manually track custom events
  trackCustomEvent(name, value, category = 'Custom') {
    this.reportMetric(name, {
      name,
      value,
      category,
      timestamp: Date.now()
    });
  }
}

// Auto-initialize performance monitoring
if (typeof window !== 'undefined') {
  window.performanceMonitor = new PerformanceMonitor();
}
