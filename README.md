# Recipe scaler / 食譜份量換算

Scale a complete ingredient list when the serving count changes. Browser inputs stay in the current page's memory, without uploads, automatic storage, analytics or remote fonts. Switching to taste clears the numerical amount; edits invalidate the old result until you calculate again.

從原份數與目標份數換算整份食材清單，保留單位文字與「適量」。4 份改 6 份的示例：米 300 g 變為 450 g、水 1.2 L 變為 1.8 L，鹽仍為適量。工具不轉換單位，也不推測烹調時間、溫度或營養。

The public source is a production candidate for `https://recipe.glossquote.com/index.html` and `/en/index.html`. Source publication and live hosting are separate milestones. Deployment and external acceptance are managed separately; a candidate does not establish a live release.

## Run locally

Use Node.js 24.x and npm. There are no dependencies to install.

```text
npm test
npm run check
npm run build
npm run dev
```

The preview binds only to `127.0.0.1`, preferring port 4200 with an OS-assigned fallback if occupied. Preview pages and robots remain noindex/nofollow. No existing process is terminated to claim a port.

## Production candidate

```text
npm run build:production
npm run check:production
npm run serve:production
node scripts/manifest.mjs
```

`dist-production/` contains the fixed bilingual SEO, JSON-LD, CSP hashes, security headers, two-URL sitemap, robots and 404 page. The origin is fixed in source, not taken from request Host, query strings or environment. `serve:production` is a loopback Node HTTP candidate server; it is not a Cloudflare runtime or a deployment command. The Cloudflare configuration uses static assets only, disables HTML rewriting and SPA fallback, and keeps metrics, logs and traces off.

`public/` remains the preview source. Production builds remove only the preview footer caption and add release metadata. The worksheet's JavaScript, CSS and original semantic tests remain the accepted M1 bytes, enforced by `scripts/m1-frozen.json`.

## Input and precision

- Original and target servings: 1–1000, up to four ASCII digits.
- Ingredients: 1–50 complete rows. Names: up to 80 UTF-16 code units after trim; units: up to 24. Raw limits are checked before trimming.
- Amounts: 0–1000000, ASCII decimal notation with up to three decimal places. Fractions, signs, commas, scientific notation and whitespace are rejected.
- One-row textareas preserve pasted line breaks and oversized drafts for validation instead of silently joining or truncating digits.
- BigInt ratios round half up to at most three decimals. Positive values that round to zero are displayed as `< 0.001` /「小於 0.001」. Approximate values are marked.
- To-taste ingredients remain unchanged. Units are labels, not conversions.

The calculation is a mathematical ratio. Cookware, cooking time, temperature, seasoning and food safety still require your judgment.

Tests use fake data and built-in `node:test`. The exact schema and fixed cases are documented in [TECHNICAL.md](TECHNICAL.md) and [ACCEPTANCE.md](ACCEPTANCE.md). [RELEASE.md](RELEASE.md) describes the candidate's verification boundary. No real user recipes or credentials are included in this repository.

Manual checks not claimed: physical devices, actual 200% browser zoom, OS IME composition, screen-reader speech, full manual Network/Storage/beacon inspection and genuine clipboard denial. Clipboard fallback and stale promises are tested as unit cases, not represented as native denial evidence.
