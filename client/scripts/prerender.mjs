// Post-build prerendering: emits static HTML (real title/meta/canonical +
// crawlable content) for every core page and every tracked item, plus a full
// sitemap. Runs after `vite build`; on any failure it exits 0 so the deploy
// still ships the plain SPA.
//
// Env: PRERENDER_API (default: production Render API), SKIP_PRERENDER=1 to skip.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GAMES } from "../src/config/games.js";
import {
  SITE_URL,
  HOME_META,
  GAME_META,
  getItemPageMeta,
  getItemDescriptionText,
} from "../src/config/pageMeta.js";
import { formatValue } from "../src/utils/formatValue.js";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const API_BASE = process.env.PRERENDER_API || "https://mm2-godly-watch.onrender.com/api";
const GAME_IDS = Object.keys(GAMES);

// Core tab pages per game: [url slug, GAME_META key]
const CORE_TABS = [
  ["", "home"],
  ["board", "board"],
  ["trade-checker", "trade-checker"],
  ["inventory", "inventory-tracker"],
];

function esc(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      const wait = (i + 1) * 10_000;
      console.warn(`[prerender] fetch failed (${err.message}), retry in ${wait / 1000}s: ${url}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}

function applyMeta(template, { title, description, canonicalUrl, jsonLd }) {
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${canonicalUrl}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${canonicalUrl}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`);
  if (jsonLd) {
    html = html.replace(
      "</head>",
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head>`
    );
  }
  return html;
}

async function writePage(template, urlPath, meta, contentHtml) {
  let html = applyMeta(template, meta);
  if (contentHtml) {
    // Static content inside #root — visible to crawlers, replaced on hydrate.
    html = html.replace('<div id="root"></div>', `<div id="root">${contentHtml}</div>`);
  }
  const outDir = path.join(DIST, ...urlPath.split("/").filter(Boolean));
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
}

function itemValueText(item) {
  const value = item.current?.supreme?.value;
  return value != null ? formatValue(value) : null;
}

function itemContentHtml(gameId, item, related) {
  const game = GAMES[gameId];
  const valueText = itemValueText(item);
  const ebay = item.current?.ebay?.totalPrice;
  const demand = item.current?.supreme?.demand ?? 0;
  const rarity = item.current?.supreme?.rarity ?? 0;
  const description = getItemDescriptionText(gameId, item.name, {
    valueText,
    demandText: demand > 0 ? `${demand}/5` : null,
    categoryText: item.category ? item.category.replace(/s$/, "") : null,
  });

  const facts = [
    valueText ? `<li>${esc(game.valueLabel)}: <strong>${esc(valueText)}</strong></li>` : null,
    ebay != null ? `<li>eBay price: <strong>€${ebay.toFixed(2)}</strong></li>` : null,
    demand > 0 ? `<li>Demand: <strong>${demand}/5</strong></li>` : null,
    rarity > 0 ? `<li>Rarity: <strong>${rarity}/5</strong></li>` : null,
    item.lastCheckedAt ? `<li>Last updated: ${esc(new Date(item.lastCheckedAt).toDateString())}</li>` : null,
  ].filter(Boolean).join("");

  const relatedLinks = related
    .map((r) => `<li><a href="/${gameId}/item/${esc(r.id)}">${esc(r.name)}</a> — ${esc(itemValueText(r) ?? "--")}</li>`)
    .join("");

  return `<main style="max-width:720px;margin:40px auto;padding:0 20px">
<nav><a href="/">GodlyWatch</a> › <a href="/${gameId}/board">${esc(game.label)} value list</a> › ${esc(item.name)}</nav>
<h1>${esc(item.name)} Value — ${esc(game.label)}</h1>
<p>${esc(description)}</p>
<ul>${facts}</ul>
${relatedLinks ? `<h2>Related ${esc(game.label)} values</h2><ul>${relatedLinks}</ul>` : ""}
<p><a href="/${gameId}/trade-checker">Free ${esc(game.label)} trade checker</a> · <a href="/${gameId}/board">Full ${esc(game.label)} value list</a></p>
</main>`;
}

function boardContentHtml(gameId, items, meta) {
  const game = GAMES[gameId];
  const links = items
    .map((item) => `<li><a href="/${gameId}/item/${esc(item.id)}">${esc(item.name)}</a> — ${esc(itemValueText(item) ?? "--")}</li>`)
    .join("");
  return `<main style="max-width:720px;margin:40px auto;padding:0 20px">
<h1>${esc(game.name)} Value List</h1>
<p>${esc(meta.description)}</p>
<ul>${links}</ul>
</main>`;
}

function breadcrumbJsonLd(gameId, item) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "GodlyWatch", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: `${GAMES[gameId].label} values`, item: `${SITE_URL}/${gameId}/board` },
      { "@type": "ListItem", position: 3, name: item.name, item: `${SITE_URL}/${gameId}/item/${item.id}` },
    ],
  };
}

async function main() {
  if (process.env.SKIP_PRERENDER) {
    console.log("[prerender] skipped (SKIP_PRERENDER set)");
    return;
  }

  const template = await fs.readFile(path.join(DIST, "index.html"), "utf8");
  const sitemapEntries = [{ loc: `${SITE_URL}/`, changefreq: "daily", priority: "1.0" }];
  let pageCount = 0;

  for (const gameId of GAME_IDS) {
    const data = await fetchWithRetry(`${API_BASE}/market?game=${gameId}`);
    const items = (data.items || []).filter((item) => item?.id && item?.name);
    const lastmod = (data.refreshedAt || new Date().toISOString()).slice(0, 10);
    console.log(`[prerender] ${gameId}: ${items.length} items`);

    // Core pages
    for (const [slug, metaKey] of CORE_TABS) {
      const meta = GAME_META[gameId]?.[metaKey];
      if (!meta) continue;
      const urlPath = slug ? `/${gameId}/${slug}` : `/${gameId}`;
      const content = metaKey === "board" || metaKey === "home"
        ? boardContentHtml(gameId, metaKey === "home" ? items.slice(0, 50) : items, meta)
        : null;
      await writePage(template, urlPath, {
        title: meta.title,
        description: meta.description,
        canonicalUrl: `${SITE_URL}${urlPath}`,
      }, content);
      sitemapEntries.push({ loc: `${SITE_URL}${urlPath}`, changefreq: "daily", priority: "0.9", lastmod });
      pageCount++;
    }

    if (gameId === "mm2" && GAME_META.mm2.marketplace) {
      const meta = GAME_META.mm2.marketplace;
      await writePage(template, "/mm2/marketplace", {
        title: meta.title,
        description: meta.description,
        canonicalUrl: `${SITE_URL}/mm2/marketplace`,
      }, null);
      sitemapEntries.push({ loc: `${SITE_URL}/mm2/marketplace`, changefreq: "daily", priority: "0.8", lastmod });
      pageCount++;
    }

    // Item pages
    for (const item of items) {
      const urlPath = `/${gameId}/item/${item.id}`;
      const meta = getItemPageMeta(gameId, item.name, itemValueText(item));
      const related = items.filter((other) => other.id !== item.id && other.category === item.category).slice(0, 6);
      await writePage(template, urlPath, {
        title: meta.title,
        description: meta.description,
        canonicalUrl: `${SITE_URL}${urlPath}`,
        jsonLd: breadcrumbJsonLd(gameId, item),
      }, itemContentHtml(gameId, item, related));
      sitemapEntries.push({
        loc: `${SITE_URL}${urlPath}`,
        changefreq: "daily",
        priority: "0.7",
        lastmod: item.lastCheckedAt ? item.lastCheckedAt.slice(0, 10) : lastmod,
      });
      pageCount++;
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${entry.loc}</loc>${entry.lastmod ? `
    <lastmod>${entry.lastmod}</lastmod>` : ""}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
  await fs.writeFile(path.join(DIST, "sitemap.xml"), sitemap, "utf8");

  console.log(`[prerender] done: ${pageCount} pages + sitemap (${sitemapEntries.length} urls)`);
}

main().catch((err) => {
  console.warn(`[prerender] FAILED (${err.message}) — shipping plain SPA build`);
  process.exit(0);
});
