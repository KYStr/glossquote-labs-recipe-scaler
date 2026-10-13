# Production candidate verification

This release keeps the numerical algorithm, browser interaction code, CSS and original semantic fixtures at their accepted M1 byte hashes. Only release helpers, static SEO, matching-language family links and deployment asset configuration change.

The two canonical URLs are fixed to `https://recipe.glossquote.com/index.html` and `https://recipe.glossquote.com/en/index.html`. Both pages have reciprocal zh-Hant/en hreflang, a Chinese x-default, matching Open Graph URLs and factual WebApplication JSON-LD. CSP contains the SHA-256 hashes of the exact inline JSON-LD bytes; no unsafe-inline or unsafe-eval is allowed.

Preview remains noindex/nofollow. Production has explicit robots and a sitemap containing exactly the two canonical pages. A bilingual 404 asset is returned for missing routes, with no SPA fallback. HTML, CSS, ESM JavaScript, XML and TXT have declared MIME types and security headers.

`npm run check:production` verifies a closed candidate tree, reproducible bytes, frozen M1 hashes, metadata, configuration and actual loopback Node HTTP GET/HEAD/405/404 responses, including unknown/encoded paths and hostile Host/query values. This is local candidate evidence. It does not claim native Cloudflare HTTP behavior, a deployment or external acceptance. Those are separate checks after release.

Cloudflare uses static assets only, with `html_handling: none` and `not_found_handling: 404-page`. No Worker script, API, secret binding, telemetry or runtime dependency is added. Logs, traces and Wrangler metrics remain off by project contract.

Platform references reviewed 2026-10-13: [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/), [custom headers](https://developers.cloudflare.com/workers/static-assets/headers/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

Fixed source archives must match every Git blob byte and hash. A clean extraction must pass `npm test`, `npm run check:production` and `npm run build:production`, and its production manifest must match the reviewed candidate. Build output, local evidence, credentials, private task metadata and unrelated projects are excluded from source publication.
