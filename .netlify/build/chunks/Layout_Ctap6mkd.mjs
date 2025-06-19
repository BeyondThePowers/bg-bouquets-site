import { f as createComponent, m as maybeRenderHead, n as renderScript, r as renderTemplate, g as createAstro, p as renderSlot, l as renderComponent, q as renderHead, i as addAttribute } from './astro/server_DIFcwkh2.mjs';
import 'kleur/colors';
/* empty css                         */
import 'clsx';

const $$Navigation = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<nav class="fixed top-0 left-0 right-0 z-50 nav-backdrop border-b-2 border-shabby-pink transition-transform duration-300 ease-in-out" id="main-nav"> <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> <div class="flex justify-between items-center h-16"> <!-- Logo Section --> <div class="flex-shrink-0"> <a href="#home" class="flex items-center space-x-3 nav-link group"> <div class=""> <span class="text-charcoal font-playfair font-bold text-[2rem] leading-[2.25rem]">BG</span> </div> <span class="font-allura font-bold text-charcoal text-[2.25rem] leading-[2.25rem]">Bouquet</span> </a> </div> <!-- Desktop Navigation --> <div class="hidden md:block"> <div class="ml-10 flex items-baseline space-x-6"> <a href="#home" class="nav-link text-charcoal hover:text-dusty-rose px-3 py-2 font-playfair font-medium transition-all duration-300 relative group"> <span>Book Visit</span> <div class="absolute bottom-0 left-0 w-0 h-0.5 bg-dusty-rose group-hover:w-full transition-all duration-300"></div> </a> <a href="#what-to-expect" class="nav-link text-charcoal hover:text-dusty-rose px-3 py-2 font-playfair font-medium transition-all duration-300 relative group"> <span>What to Expect</span> <div class="absolute bottom-0 left-0 w-0 h-0.5 bg-dusty-rose group-hover:w-full transition-all duration-300"></div> </a> <a href="#flowers" class="nav-link text-charcoal hover:text-dusty-rose px-3 py-2 font-playfair font-medium transition-all duration-300 relative group"> <span>Flowers</span> <div class="absolute bottom-0 left-0 w-0 h-0.5 bg-dusty-rose group-hover:w-full transition-all duration-300"></div> </a> <a href="#about" class="nav-link text-charcoal hover:text-dusty-rose px-3 py-2 font-playfair font-medium transition-all duration-300 relative group"> <span>About</span> <div class="absolute bottom-0 left-0 w-0 h-0.5 bg-dusty-rose group-hover:w-full transition-all duration-300"></div> </a> <a href="#location" class="nav-link text-charcoal hover:text-dusty-rose px-3 py-2 font-playfair font-medium transition-all duration-300 relative group"> <span>Location</span> <div class="absolute bottom-0 left-0 w-0 h-0.5 bg-dusty-rose group-hover:w-full transition-all duration-300"></div> </a> <a href="#contact" class="nav-link text-charcoal hover:text-dusty-rose px-3 py-2 font-playfair font-medium transition-all duration-300 relative group"> <span>Contact</span> <div class="absolute bottom-0 left-0 w-0 h-0.5 bg-dusty-rose group-hover:w-full transition-all duration-300"></div> </a> </div> </div> <!-- Mobile menu button --> <div class="md:hidden"> <button type="button" class="hamburger inline-flex items-center justify-center p-2 rounded-lg text-charcoal hover:text-dusty-rose hover:bg-shabby-pink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-dusty-rose vintage-border" aria-controls="mobile-menu" aria-expanded="false" id="mobile-menu-button"> <span class="sr-only">Open main menu</span> <div class="w-6 h-6 flex flex-col justify-center items-center"> <span class="hamburger-line block w-5 h-0.5 bg-current mb-1"></span> <span class="hamburger-line block w-5 h-0.5 bg-current mb-1"></span> <span class="hamburger-line block w-5 h-0.5 bg-current"></span> </div> </button> </div> </div> </div> <!-- Mobile menu backdrop --> <div class="md:hidden fixed inset-0 bg-black bg-opacity-50 hidden z-40" id="mobile-backdrop"></div> <!-- Mobile menu --> <div class="md:hidden mobile-menu fixed top-0 left-0 w-full bg-cream z-50 lace-pattern" id="mobile-menu" style="height: 100vh; height: 100dvh;"> <div class="flex flex-col bg-cream" style="height: 100vh; height: 100dvh;"> <!-- Mobile menu header --> <div class="flex items-center justify-between p-6 border-b-2 border-shabby-pink bg-cream min-h-[80px]"> <div class="flex items-center space-x-3"> <div class="w-12 h-12 bg-dusty-rose rounded-lg flex items-center justify-center vintage-border relative"> <span class="text-white font-playfair font-bold text-lg">BG</span> <svg class="absolute -top-1 -right-1 w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"> <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path> </svg> </div> <span class="font-playfair font-bold text-charcoal text-xl">Bouquet Garden</span> </div> <button type="button" class="p-3 rounded-lg text-charcoal hover:text-dusty-rose hover:bg-shabby-pink min-w-[48px] min-h-[48px] flex items-center justify-center vintage-border" id="mobile-menu-close"> <span class="sr-only">Close menu</span> <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path> </svg> </button> </div> <!-- Mobile menu items --> <div class="flex-1 px-6 py-8 bg-cream overflow-y-auto"> <nav class="space-y-3"> <a href="#home" class="mobile-nav-link flex items-center px-4 py-4 text-lg font-playfair font-medium text-charcoal hover:text-dusty-rose hover:bg-shabby-pink rounded-lg transition-all duration-300 min-h-[56px] vintage-border"> <svg class="mr-4 w-5 h-5 text-dusty-rose" fill="currentColor" viewBox="0 0 20 20"> <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path> </svg>
Book Visit
</a> <a href="#about" class="mobile-nav-link flex items-center px-4 py-4 text-lg font-playfair font-medium text-charcoal hover:text-dusty-rose hover:bg-shabby-pink rounded-lg transition-all duration-300 min-h-[56px] vintage-border"> <svg class="mr-4 w-5 h-5 text-dusty-rose" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path> </svg>
About
</a> <a href="#flowers" class="mobile-nav-link flex items-center px-4 py-4 text-lg font-playfair font-medium text-charcoal hover:text-dusty-rose hover:bg-shabby-pink rounded-lg transition-all duration-300 min-h-[56px] vintage-border"> <svg class="mr-4 w-5 h-5 text-dusty-rose" fill="currentColor" viewBox="0 0 20 20"> <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path> </svg>
Flowers
</a> <a href="#location" class="mobile-nav-link flex items-center px-4 py-4 text-lg font-playfair font-medium text-charcoal hover:text-dusty-rose hover:bg-shabby-pink rounded-lg transition-all duration-300 min-h-[56px] vintage-border"> <svg class="mr-4 w-5 h-5 text-dusty-rose" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path> </svg>
Location
</a> <a href="#what-to-expect" class="mobile-nav-link flex items-center px-4 py-4 text-lg font-playfair font-medium text-charcoal hover:text-dusty-rose hover:bg-shabby-pink rounded-lg transition-all duration-300 min-h-[56px] vintage-border"> <svg class="mr-4 w-5 h-5 text-dusty-rose" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path> </svg>
What to Expect
</a> <a href="#contact" class="mobile-nav-link flex items-center px-4 py-4 text-lg font-playfair font-medium text-charcoal hover:text-dusty-rose hover:bg-shabby-pink rounded-lg transition-all duration-300 min-h-[56px] vintage-border"> <svg class="mr-4 w-5 h-5 text-dusty-rose" fill="currentColor" viewBox="0 0 20 20"> <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path> </svg>
Contact
</a> </nav> <!-- Optional footer section in mobile menu --> <div class="mt-12 pt-8 border-t-2 border-shabby-pink"> <div class="text-center font-roboto"> <p class="text-charcoal font-medium">Visit us daily 9AM - 6PM</p> <p class="mt-1 text-dusty-rose font-playfair">(555) 123-4567</p> <div class="mt-3 flex justify-center space-x-2"> <div class="w-2 h-2 bg-dusty-rose rounded-full"></div> <div class="w-2 h-2 bg-sage-green rounded-full"></div> <div class="w-2 h-2 bg-dusty-rose rounded-full"></div> </div> </div> </div> </div> </div> </div> </nav> ${renderScript($$result, "/home/tallred/bgbouquet/bg/src/components/Navigation.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/tallred/bgbouquet/bg/src/components/Navigation.astro", void 0);

const $$CriticalCSS = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<style>
  /* Critical styles for immediate rendering */
  
  /* Font loading optimization */
  @font-face {
    font-family: 'Allura';
    src: url('/fonts/Allura-Regular.woff2') format('woff2');
    font-display: swap;
    font-weight: normal;
    font-style: normal;
  }
  
  @font-face {
    font-family: 'Playfair Display';
    src: url('/fonts/playfairdisplay-variablefont.woff2') format('woff2');
    font-display: swap;
    font-weight: 400 900;
    font-style: normal;
  }
  
  @font-face {
    font-family: 'Roboto';
    src: url('/fonts/roboto-variable.woff2') format('woff2');
    font-display: swap;
    font-weight: 100 900;
    font-style: normal;
  }

  /* Reset and base styles */
  * {
    box-sizing: border-box;
  }
  
  html {
    scroll-behavior: smooth;
  }
  
  body {
    margin: 0;
    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    color: #333333;
    background-color: #ffffff;
  }

  /* Skip link for accessibility */
  .skip-link {
    position: absolute;
    top: -40px;
    left: 6px;
    background: #E8B4B8;
    color: white;
    padding: 8px 16px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 1000;
    font-weight: 600;
  }
  
  .skip-link:focus {
    top: 6px;
  }

  /* Navigation critical styles */
  .nav-backdrop {
    background: rgba(248, 231, 232, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  
  nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    transition: transform 0.3s ease-in-out;
  }
  
  /* Hero section critical styles */
  .hero-section {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    padding: 5rem 0;
    position: relative;
  }
  
  .hero-header-text {
    font-family: 'Allura', cursive;
    color: #333333;
    line-height: 0.9;
  }
  
  /* Critical layout utilities */
  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1rem;
  }
  
  .grid {
    display: grid;
  }
  
  .flex {
    display: flex;
  }
  
  .items-center {
    align-items: center;
  }
  
  .justify-between {
    justify-content: space-between;
  }
  
  .space-x-3 > * + * {
    margin-left: 0.75rem;
  }
  
  .space-y-8 > * + * {
    margin-top: 2rem;
  }
  
  /* Critical responsive utilities */
  .hidden {
    display: none;
  }
  
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  
  .sr-only:focus {
    position: static;
    width: auto;
    height: auto;
    padding: inherit;
    margin: inherit;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }

  /* Focus styles for accessibility */
  :focus-visible {
    outline: 2px solid #E8B4B8;
    outline-offset: 2px;
    border-radius: 4px;
  }
  
  /* Button focus styles */
  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid #E8B4B8;
    outline-offset: 2px;
  }

  /* Critical typography */
  .font-allura {
    font-family: 'Allura', cursive;
  }
  
  .font-playfair {
    font-family: 'Playfair Display', serif;
  }
  
  .font-roboto {
    font-family: 'Roboto', sans-serif;
  }
  
  .text-charcoal {
    color: #1a1a1a;
  }
  
  .text-dusty-rose {
    color: #E8B4B8;
  }

  /* Critical spacing */
  .pt-16 {
    padding-top: 4rem;
  }
  
  .px-4 {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  
  .py-20 {
    padding-top: 5rem;
    padding-bottom: 5rem;
  }

  /* Critical responsive breakpoints */
  @media (min-width: 768px) {
    .md\\\\:block {
      display: block;
    }
    
    .md\\\\:hidden {
      display: none;
    }
    
    .md\\\\:grid-cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    
    .md\\\\:text-5xl {
      font-size: 3rem;
      line-height: 1;
    }
    
    .center-mobile-text {
      text-align: left;
    }
  }
  
  @media (min-width: 1024px) {
    .lg\\\\:grid-cols-5 {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
    
    .lg\\\\:col-span-3 {
      grid-column: span 3 / span 3;
    }
    
    .lg\\\\:text-7xl {
      font-size: 4.5rem;
      line-height: 1;
    }
  }
  
  @media (max-width: 767px) {
    .center-mobile-text {
      text-align: center;
    }
  }

  /* Critical animation for smooth loading */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .fade-in {
    animation: fadeIn 0.6s ease-out;
  }

  /* Prevent layout shift */
  img {
    max-width: 100%;
    height: auto;
  }
  
  /* Loading state styles */
  .loading {
    opacity: 0.7;
    pointer-events: none;
  }
  
  /* Critical form styles */
  input, select, textarea {
    font-family: inherit;
    font-size: 100%;
    line-height: 1.15;
    margin: 0;
  }
  
  button {
    font-family: inherit;
    font-size: 100%;
    line-height: 1.15;
    margin: 0;
    cursor: pointer;
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>`;
}, "/home/tallred/bgbouquet/bg/src/components/CriticalCSS.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro();
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const {
    title = "Bouquet Garden",
    description = "Visit BG Bouquet Garden in Southern Alberta - a cut-your-own bouquet farm near Waterton National Park. Create beautiful bouquets from our seasonal flower fields.",
    image = "/og-image.jpg",
    canonical = Astro2.url.href,
    type = "website"
  } = Astro2.props;
  const siteName = "BG Bouquet Garden";
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  return renderTemplate(_a || (_a = __template(['<html lang="en" data-astro-cid-sckkx6r4> <head><meta charset="UTF-8"><meta name="description"', '><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="canonical"', '><meta name="generator"', "><!-- Critical CSS for immediate rendering -->", "<!-- Primary Meta Tags --><title>", '</title><meta name="title"', '><meta name="description"', '><meta name="keywords" content="bouquet garden, cut your own flowers, Southern Alberta, Waterton, flower farm, seasonal blooms, wedding flowers"><meta name="author" content="BG Bouquet Garden"><meta name="robots" content="index, follow"><!-- Open Graph / Facebook --><meta property="og:type"', '><meta property="og:url"', '><meta property="og:title"', '><meta property="og:description"', '><meta property="og:image"', '><meta property="og:site_name"', '><meta property="og:locale" content="en_CA"><!-- Twitter --><meta property="twitter:card" content="summary_large_image"><meta property="twitter:url"', '><meta property="twitter:title"', '><meta property="twitter:description"', '><meta property="twitter:image"', `><!-- Preload critical fonts --><link rel="preload" href="/fonts/Allura-Regular.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/playfairdisplay-variablefont.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/roboto-variable.woff2" as="font" type="font/woff2" crossorigin><!-- Performance hints --><link rel="dns-prefetch" href="//fonts.googleapis.com"><!-- Theme color --><meta name="theme-color" content="#F8E7E8"><!-- PWA Manifest --><link rel="manifest" href="/manifest.json"><!-- Performance monitoring --><script type="module">
			import('../scripts/performance.js').catch(() => {
				console.log('Performance monitoring not available');
			});
		<\/script><!-- Structured Data --><script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "LocalBusiness",
			"name": "BG Bouquet Garden",
			"description": "Cut-your-own bouquet farm in Southern Alberta near Waterton National Park",
			"url": "https://bgbouquet.com",
			"telephone": "+1-555-123-4567",
			"address": {
				"@type": "PostalAddress",
				"streetAddress": "Rural Route, Hill Spring Area",
				"addressLocality": "Hill Spring",
				"addressRegion": "Alberta",
				"addressCountry": "CA"
			},
			"geo": {
				"@type": "GeoCoordinates",
				"latitude": "49.0",
				"longitude": "-113.0"
			},
			"openingHours": "Mo-Su 09:00-18:00",
			"priceRange": "$35-$105",
			"image": "https://bgbouquet.com/og-image.jpg",
			"sameAs": []
		}
		<\/script>`, '</head> <body data-astro-cid-sckkx6r4> <!-- Skip to main content link for accessibility --> <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-dusty-rose text-white px-4 py-2 rounded z-50" data-astro-cid-sckkx6r4>\nSkip to main content\n</a> ', ' <main id="main-content" class="pt-16" data-astro-cid-sckkx6r4> ', " </main> </body></html>"])), addAttribute(description, "content"), addAttribute(canonical, "href"), addAttribute(Astro2.generator, "content"), renderComponent($$result, "CriticalCSS", $$CriticalCSS, { "data-astro-cid-sckkx6r4": true }), fullTitle, addAttribute(fullTitle, "content"), addAttribute(description, "content"), addAttribute(type, "content"), addAttribute(canonical, "content"), addAttribute(fullTitle, "content"), addAttribute(description, "content"), addAttribute(new URL(image, Astro2.url).href, "content"), addAttribute(siteName, "content"), addAttribute(canonical, "content"), addAttribute(fullTitle, "content"), addAttribute(description, "content"), addAttribute(new URL(image, Astro2.url).href, "content"), renderHead(), renderComponent($$result, "Navigation", $$Navigation, { "data-astro-cid-sckkx6r4": true }), renderSlot($$result, $$slots["default"]));
}, "/home/tallred/bgbouquet/bg/src/layouts/Layout.astro", void 0);

export { $$Layout as $ };
