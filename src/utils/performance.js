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
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.reportMetric('CLS', {
          name: 'CLS',
          value: clsValue,
          rating: this.getRating('CLS', clsValue)
        });
      });
    }

    // Track navigation timing
    this.trackNavigationTiming();
  }

  observeMetric(type, callback) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
    } catch (error) {
      console.warn(`Could not observe ${type}:`, error);
    }
  }

  trackNavigationTiming() {
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            // Track TTFB
            const ttfb = navigation.responseStart - navigation.fetchStart;
            this.reportMetric('TTFB', {
              name: 'TTFB',
              value: ttfb,
              rating: this.getRating('TTFB', ttfb)
            });

            // Track FCP (approximation)
            const fcp = navigation.responseEnd - navigation.fetchStart;
            this.reportMetric('FCP', {
              name: 'FCP',
              value: fcp,
              rating: this.getRating('FCP', fcp)
            });
          }
        }, 0);
      });
    }
  }

  trackCustomMetrics() {
    // Track page load time
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      this.trackCustomEvent('PageLoad', loadTime, 'Performance');
    });

    // Track user interactions
    this.trackUserInteractions();

    // Track resource loading
    this.trackResourceLoading();
  }

  trackUserInteractions() {
    // Track button clicks
    document.addEventListener('click', (event) => {
      if (event.target.tagName === 'BUTTON' || event.target.closest('button')) {
        const button = event.target.tagName === 'BUTTON' ? event.target : event.target.closest('button');
        this.trackCustomEvent('ButtonClick', 1, 'Interaction', {
          buttonText: button.textContent?.trim() || 'Unknown',
          buttonId: button.id || 'no-id'
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target;
      this.trackCustomEvent('FormSubmit', 1, 'Interaction', {
        formId: form.id || 'no-id',
        formAction: form.action || 'no-action'
      });
    });
  }

  trackResourceLoading() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          // Track slow resources
          if (entry.duration > 1000) {
            this.trackCustomEvent('SlowResource', entry.duration, 'Performance', {
              resourceName: entry.name,
              resourceType: entry.initiatorType
            });
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  getRating(metric, value) {
    const thresholds = {
      'LCP': { good: 2500, poor: 4000 },
      'FID': { good: 100, poor: 300 },
      'CLS': { good: 0.1, poor: 0.25 },
      'TTFB': { good: 800, poor: 1800 },
      'FCP': { good: 1800, poor: 3000 }
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  reportMetric(name, metric) {
    this.metrics[name] = metric;
    
    console.log(`📊 ${name}:`, metric.value, `(${metric.rating})`);

    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.value),
        custom_parameter_1: metric.rating
      });
    }

    // Store for later reporting
    this.storeMetric(name, metric);
  }

  trackCustomEvent(eventName, value, category, additionalData = {}) {
    const eventData = {
      name: eventName,
      value: value,
      category: category,
      timestamp: Date.now(),
      ...additionalData
    };

    console.log(`📈 Custom Event - ${eventName}:`, eventData);

    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, {
        event_category: category,
        value: value,
        ...additionalData
      });
    }

    // Store for later reporting
    this.storeCustomEvent(eventData);
  }

  storeMetric(name, metric) {
    // Store in localStorage for debugging
    try {
      const stored = JSON.parse(localStorage.getItem('performance_metrics') || '{}');
      stored[name] = {
        ...metric,
        timestamp: Date.now(),
        url: window.location.pathname
      };
      localStorage.setItem('performance_metrics', JSON.stringify(stored));
    } catch (error) {
      console.warn('Could not store performance metric:', error);
    }
  }

  storeCustomEvent(eventData) {
    // Store in localStorage for debugging
    try {
      const stored = JSON.parse(localStorage.getItem('custom_events') || '[]');
      stored.push({
        ...eventData,
        url: window.location.pathname
      });
      
      // Keep only last 100 events
      if (stored.length > 100) {
        stored.splice(0, stored.length - 100);
      }
      
      localStorage.setItem('custom_events', JSON.stringify(stored));
    } catch (error) {
      console.warn('Could not store custom event:', error);
    }
  }

  // Get current metrics
  getMetrics() {
    return { ...this.metrics };
  }

  // Get stored metrics
  getStoredMetrics() {
    try {
      return JSON.parse(localStorage.getItem('performance_metrics') || '{}');
    } catch (error) {
      return {};
    }
  }

  // Get stored events
  getStoredEvents() {
    try {
      return JSON.parse(localStorage.getItem('custom_events') || '[]');
    } catch (error) {
      return [];
    }
  }

  // Clear stored data
  clearStoredData() {
    try {
      localStorage.removeItem('performance_metrics');
      localStorage.removeItem('custom_events');
    } catch (error) {
      console.warn('Could not clear stored performance data:', error);
    }
  }
}

// Auto-initialize performance monitoring
if (typeof window !== 'undefined') {
  window.performanceMonitor = new PerformanceMonitor();
}
