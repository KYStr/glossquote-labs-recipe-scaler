import { createHash } from 'node:crypto';

export const productionOrigin = 'https://recipe.glossquote.com';
export const pages = Object.freeze([
  Object.freeze({ file: 'index.html', language: 'zh-Hant', locale: 'zh_TW', name: '食譜份量換算',
    title: '食譜份量換算：按人數調整食材用量 | GlossQuote',
    description: '輸入食譜原份數與目標份數，在瀏覽器本機按比例換算各項食材。保留單位文字，支援適量項目，不做單位或烹調時間推測。',
    home: 'https://glossquote.com/index.html' }),
  Object.freeze({ file: 'en/index.html', language: 'en', locale: 'en_US', name: 'Recipe scaler',
    title: 'Recipe Scaler: Adjust Ingredient Quantities by Servings | GlossQuote',
    description: 'Scale recipe ingredient amounts locally by changing the original and target servings. Keep unit labels and leave “to taste” ingredients unchanged; no unit or cooking-time conversion.',
    home: 'https://glossquote.com/en/index.html' })
]);
export const pageUrl = page => `${productionOrigin}/${page.file}`;
export function jsonLdText(page) {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: page.name,
    description: page.description, url: pageUrl(page), inLanguage: page.language,
    applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript, ES modules and BigInt support.', isAccessibleForFree: true });
}
export const jsonLdHashes = Object.freeze(pages.map(page => `sha256-${createHash('sha256').update(jsonLdText(page)).digest('base64')}`));
export const securityHeaders = Object.freeze({
  'Content-Security-Policy': `default-src 'none'; script-src 'self' ${jsonLdHashes.map(hash => `'${hash}'`).join(' ')}; style-src 'self'; img-src 'none'; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), clipboard-write=(self)',
  'Strict-Transport-Security': 'max-age=31536000', 'Cache-Control': 'no-cache'
});
export const productionRobots = `User-agent: *\nAllow: /\nSitemap: ${productionOrigin}/sitemap.xml\n`;
export const productionSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(page => `  <url><loc>${pageUrl(page)}</loc></url>`).join('\n')}\n</urlset>\n`;
export const productionHeadersText = `/*\n${Object.entries(securityHeaders).map(([key, value]) => `  ${key}: ${value}`).join('\n')}\n\n/index.html\n  X-Robots-Tag: index, follow\n\n/en/index.html\n  X-Robots-Tag: index, follow\n\n/404.html\n  X-Robots-Tag: noindex, nofollow\n`;
function attribute(value) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'); }
export function productionHtml(source, page) {
  if ((source.match(/<meta name="robots" content="noindex,nofollow">/g) || []).length !== 1 || source.includes('rel="canonical"')) throw new Error('UNEXPECTED_PREVIEW_HEAD');
  const seo = [
    `  <link rel="canonical" href="${pageUrl(page)}">`,
    ...pages.map(other => `  <link rel="alternate" hreflang="${other.language}" href="${pageUrl(other)}">`),
    `  <link rel="alternate" hreflang="x-default" href="${pageUrl(pages[0])}">`,
    '  <meta property="og:type" content="website">',
    `  <meta property="og:title" content="${attribute(page.title)}">`,
    `  <meta property="og:description" content="${attribute(page.description)}">`,
    `  <meta property="og:url" content="${pageUrl(page)}">`,
    `  <meta property="og:locale" content="${page.locale}">`,
    `  <script type="application/ld+json">${jsonLdText(page)}</script>`
  ].join('\n');
  // Environment-only preview caption is omitted in the production artifact.
  // The worksheet, validation and all behavior remain byte-identical.
  return source.replace('<meta name="robots" content="noindex,nofollow">', '<meta name="robots" content="index,follow">')
    .replace('</head>', `${seo}\n</head>`)
    .replace('Gloss Tools by GlossQuote · 本機預覽</footer>', 'Gloss Tools by GlossQuote</footer>')
    .replace('Gloss Tools by GlossQuote · Local preview</footer>', 'Gloss Tools by GlossQuote</footer>');
}
