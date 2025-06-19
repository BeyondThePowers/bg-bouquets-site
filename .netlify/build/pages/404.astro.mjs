import { f as createComponent, l as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_DIFcwkh2.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_Ctap6mkd.mjs';
/* empty css                               */
export { renderers } from '../renderers.mjs';

const $$404 = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Page Not Found - BG Bouquet Garden", "description": "The page you're looking for doesn't exist. Return to BG Bouquet Garden to explore our beautiful flower fields.", "data-astro-cid-zetdm5md": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="min-h-screen flex items-center justify-center px-4 py-20" data-astro-cid-zetdm5md> <div class="max-w-2xl mx-auto text-center" data-astro-cid-zetdm5md> <!-- Decorative flower image --> <div class="mb-8" data-astro-cid-zetdm5md> <img src="/src/assets/images/bg-bouquet-cherry-blossoms.webp" alt="Cherry blossoms decoration" class="w-32 h-32 mx-auto object-cover rounded-full opacity-80" loading="eager" data-astro-cid-zetdm5md> </div> <!-- 404 Header --> <h1 class="text-6xl md:text-8xl font-allura text-dusty-rose mb-4" data-astro-cid-zetdm5md>
404
</h1> <h2 class="text-2xl md:text-3xl font-playfair font-bold text-charcoal mb-6" data-astro-cid-zetdm5md>
Oops! This page seems to have wandered off
</h2> <p class="text-lg font-roboto text-charcoal mb-8 leading-relaxed" data-astro-cid-zetdm5md>
Like a flower that's bloomed and moved on, the page you're looking for isn't here anymore. 
				But don't worry – there are plenty of beautiful things to discover at BG Bouquet Garden!
</p> <!-- Action buttons --> <div class="flex flex-col sm:flex-row gap-4 justify-center items-center" data-astro-cid-zetdm5md> <a href="/" class="inline-flex items-center px-6 py-3 bg-dusty-rose text-white font-roboto font-semibold rounded-lg hover:bg-opacity-90 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-dusty-rose focus:ring-offset-2" data-astro-cid-zetdm5md> <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-astro-cid-zetdm5md> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" data-astro-cid-zetdm5md></path> </svg>
Return Home
</a> <a href="/#flowers" class="inline-flex items-center px-6 py-3 border-2 border-dusty-rose text-dusty-rose font-roboto font-semibold rounded-lg hover:bg-dusty-rose hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-dusty-rose focus:ring-offset-2" data-astro-cid-zetdm5md> <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-astro-cid-zetdm5md> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 4v10a2 2 0 002 2h6a2 2 0 002-2V8M7 8h10M9 12h6" data-astro-cid-zetdm5md></path> </svg>
Browse Flowers
</a> </div> <!-- Helpful links --> <div class="mt-12 pt-8 border-t border-gray-200" data-astro-cid-zetdm5md> <p class="text-sm font-roboto text-gray-600 mb-4" data-astro-cid-zetdm5md>
Looking for something specific? Try these popular pages:
</p> <div class="flex flex-wrap justify-center gap-4 text-sm" data-astro-cid-zetdm5md> <a href="/#about" class="text-dusty-rose hover:underline font-roboto" data-astro-cid-zetdm5md>About Us</a> <a href="/#location" class="text-dusty-rose hover:underline font-roboto" data-astro-cid-zetdm5md>Location</a> <a href="/#contact" class="text-dusty-rose hover:underline font-roboto" data-astro-cid-zetdm5md>Contact</a> <a href="/#booking" class="text-dusty-rose hover:underline font-roboto" data-astro-cid-zetdm5md>Book a Visit</a> </div> </div> </div> </section> ` })} `;
}, "/home/tallred/bgbouquet/bg/src/pages/404.astro", void 0);

const $$file = "/home/tallred/bgbouquet/bg/src/pages/404.astro";
const $$url = "/404";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$404,
	file: $$file,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
