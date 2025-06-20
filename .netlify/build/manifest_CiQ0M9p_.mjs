import 'kleur/colors';
import { v as NOOP_MIDDLEWARE_HEADER, w as decodeKey } from './chunks/astro/server_DIFcwkh2.mjs';
import 'clsx';
import 'cookie';
import './chunks/shared_B6bdXPNh.mjs';
import 'es-module-lexer';
import 'html-escaper';

const NOOP_MIDDLEWARE_FN = async (_ctx, next) => {
  const response = await next();
  response.headers.set(NOOP_MIDDLEWARE_HEADER, "true");
  return response;
};

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///home/tallred/bgbouquet/bg/","cacheDir":"file:///home/tallred/bgbouquet/bg/node_modules/.astro/","outDir":"file:///home/tallred/bgbouquet/bg/dist/","srcDir":"file:///home/tallred/bgbouquet/bg/src/","publicDir":"file:///home/tallred/bgbouquet/bg/public/","buildClientDir":"file:///home/tallred/bgbouquet/bg/dist/","buildServerDir":"file:///home/tallred/bgbouquet/bg/.netlify/build/","adapterName":"@astrojs/netlify","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.C1rG1Y8G.css"},{"type":"inline","content":"@keyframes float{0%,to{transform:translateY(0)}50%{transform:translateY(-10px)}}img[data-astro-cid-zetdm5md]{animation:float 3s ease-in-out infinite}a[data-astro-cid-zetdm5md]:focus-visible{outline:2px solid #E8B4B8;outline-offset:2px}\n"}],"routeData":{"route":"/404","isIndex":false,"type":"page","pattern":"^\\/404\\/?$","segments":[[{"content":"404","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/404.astro","pathname":"/404","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/availability","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/availability\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"availability","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/availability.ts","pathname":"/api/availability","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/bookings","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/bookings\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"bookings","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/bookings.ts","pathname":"/api/bookings","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/test-db","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/test-db\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"test-db","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/test-db.ts","pathname":"/api/test-db","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.C1rG1Y8G.css"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/home/tallred/bgbouquet/bg/src/pages/404.astro",{"propagation":"none","containsHead":true}],["/home/tallred/bgbouquet/bg/src/pages/index.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000astro-internal:middleware":"_astro-internal_middleware.mjs","\u0000noop-actions":"_noop-actions.mjs","\u0000@astro-page:src/pages/404@_@astro":"pages/404.astro.mjs","\u0000@astro-page:src/pages/api/availability@_@ts":"pages/api/availability.astro.mjs","\u0000@astro-page:src/pages/api/bookings@_@ts":"pages/api/bookings.astro.mjs","\u0000@astro-page:src/pages/api/test-db@_@ts":"pages/api/test-db.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_CiQ0M9p_.mjs","/home/tallred/bgbouquet/bg/node_modules/unstorage/drivers/fs-lite.mjs":"chunks/fs-lite_COtHaKzy.mjs","/home/tallred/bgbouquet/bg/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_C0OfdsLs.mjs","/home/tallred/bgbouquet/bg/src/pages/index.astro?astro&type=script&index=0&lang.ts":"_astro/index.astro_astro_type_script_index_0_lang.DEPBI7-Y.js","/home/tallred/bgbouquet/bg/src/components/Navigation.astro?astro&type=script&index=0&lang.ts":"_astro/Navigation.astro_astro_type_script_index_0_lang.CcUH1sdG.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[["/home/tallred/bgbouquet/bg/src/components/Navigation.astro?astro&type=script&index=0&lang.ts","const c=document.getElementById(\"mobile-menu-button\"),t=document.getElementById(\"mobile-menu\"),m=document.getElementById(\"mobile-menu-close\"),d=document.getElementById(\"mobile-backdrop\"),r=document.querySelector(\".hamburger\"),f=document.querySelectorAll(\".mobile-nav-link\");function a(){const e=window.innerHeight*.01;if(document.documentElement.style.setProperty(\"--vh\",`${e}px`),t){t.style.height=`${window.innerHeight}px`;const i=t.querySelector(\".flex.flex-col\");i&&(i.style.height=`${window.innerHeight}px`)}}a();let s=window.scrollY,l=!1;const o=document.getElementById(\"main-nav\");function u(){const e=window.scrollY,i=t?.classList.contains(\"open\");window.innerWidth<768&&!i?e<s||e<100?o?.classList.remove(\"-translate-y-full\"):e>s&&e>100&&o?.classList.add(\"-translate-y-full\"):o?.classList.remove(\"-translate-y-full\"),s=e,l=!1}function v(){l||(requestAnimationFrame(u),l=!0)}window.addEventListener(\"scroll\",v,{passive:!0});function w(){t?.classList.add(\"open\"),d?.classList.remove(\"hidden\"),r?.classList.add(\"open\"),c?.setAttribute(\"aria-expanded\",\"true\"),document.body.style.overflow=\"hidden\"}function n(){t?.classList.remove(\"open\"),d?.classList.add(\"hidden\"),r?.classList.remove(\"open\"),c?.setAttribute(\"aria-expanded\",\"false\"),document.body.style.overflow=\"\"}c?.addEventListener(\"click\",w);m?.addEventListener(\"click\",n);d?.addEventListener(\"click\",n);f.forEach(e=>{e.addEventListener(\"click\",n)});document.addEventListener(\"keydown\",e=>{e.key===\"Escape\"&&t?.classList.contains(\"open\")&&n()});window.addEventListener(\"resize\",()=>{a(),window.innerWidth>=768?(n(),o?.classList.remove(\"-translate-y-full\")):u()});window.addEventListener(\"orientationchange\",()=>{setTimeout(a,100)});"]],"assets":["/_astro/index.C1rG1Y8G.css","/_headers","/favicon.svg","/manifest.json","/robots.txt","/sdsdadasds_redirects","/sitemap.xml","/_astro/index.astro_astro_type_script_index_0_lang.DEPBI7-Y.js","/fonts/AbrilFatface-Regular.woff","/fonts/AbrilFatface-Regular.woff2","/fonts/Allura-Regular.woff","/fonts/Allura-Regular.woff2","/fonts/README.md","/fonts/playfairdisplay-italic-variablefont.woff","/fonts/playfairdisplay-italic-variablefont.woff2","/fonts/playfairdisplay-variablefont.woff","/fonts/playfairdisplay-variablefont.woff2","/fonts/roboto-variable.woff","/fonts/roboto-variable.woff2","/images/bg-bouguet-top-flowers.png","/images/bg-bouguet-top-flowers.webp","/images/bg-bouquet-bluebells.webp","/images/bg-bouquet-cherry-blossoms.webp","/images/bg-bouquet-left-flower.png","/images/bg-bouquet-left-flower.webp","/images/bg-bouquet-right-flower.png","/images/bg-bouquet-right-flower.webp","/images/bg-bouquet-vintage-flower-wheelbarrow.png","/images/bg-bouquet-vintage-flower-wheelbarrow.webp","/images/bg-bouquet-yellow-flowers.webp","/images/distressed-background.png","/images/distressed-background.webp","/images/distressed-section-edge-2.svg","/images/distressed-section-edge-3.svg","/images/distressed-section-edge.svg","/images/distressed-wood-background.png","/images/distressed-wood-background.webp","/images/flowers/aster_thumbnail.webp","/images/flowers/babys-breath_thumbnail.webp","/images/flowers/bachelor-buttons_thumbnail.webp","/images/flowers/daisies_thumbnail.webp","/images/flowers/eucalyptus_thumbnail.webp","/images/flowers/foxgloves_thumbnail.webp","/images/flowers/lavender_thumbnail.webp","/images/flowers/lupin_thumbnail.webp","/images/flowers/marigolds_thumbnail.webp","/images/flowers/peonies_thumbnail.webp","/images/flowers/roses_thumbnail.webp","/images/flowers/snapdragons_thumbnail.webp","/images/flowers/sunflower_thumbnail.webp","/images/flowers/sweatpea_thumbnail.webp","/images/flowers/zinnia_thumbnail.webp"],"buildFormat":"directory","checkOrigin":true,"serverIslandNameMap":[],"key":"SOX+jVTziyXR57iKBeZObMEhfdZ0AzpeUSmRE1wE920=","sessionConfig":{"driver":"fs-lite","options":{"base":"/home/tallred/bgbouquet/bg/node_modules/.astro/sessions"}}});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = () => import('./chunks/fs-lite_COtHaKzy.mjs');

export { manifest };
