import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  getMarketData,
  getMarketStats,
  getRecentMoves
} from "./api/marketApi";
import { calculateMarketStats } from "./utils/calculateMarketStats";
import { formatCurrency } from "./utils/formatCurrency";
import { formatValue } from "./utils/formatValue";
import { GAMES, GAME_LIST, DEFAULT_GAME, getGameConfig } from "./config/games";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const GAME_STORAGE_KEY = "mm2-goldywatch-game";

const PROXIED_IMAGE_HOSTS = ["wikia.nocookie.net", "amvgg.com"];

function proxyImg(url) {
  if (!url) return null;
  if (!PROXIED_IMAGE_HOSTS.some((host) => url.includes(host))) return url;
  return `${API_BASE}/img?url=${encodeURIComponent(url)}`;
}

function readStoredGame() {
  try {
    const stored = localStorage.getItem(GAME_STORAGE_KEY);
    return GAMES[stored] ? stored : DEFAULT_GAME;
  } catch {
    return DEFAULT_GAME;
  }
}

const LOCAL_ITEM_IMAGES = {
  'alien-set':          '/items/alien-set.png',
  'bat':                '/items/bat.png',
  'candy-set':          '/items/candy-set.png',
  'chroma-bringer-set': '/items/chroma-bringer-set.png',
  'darkshot':           '/items/darkshot.png',
  'dark-set':           '/items/dark-set.png',
  'darksword':          '/items/darksword.png',
  'darkbringer':        '/items/darkbringer.png',
  'full-swirly-set':    '/items/full-swirly-set.png',
  'hallowgun':          '/items/hallowgun.png',
  'hallow-set':         '/items/hallow-set.png',
  'heart-wand':         '/items/heart-wand.png',
  'iceblaster':         '/items/iceblaster.png',
  'lightbringer':       '/items/lightbringer.png',
  'luger':              '/items/luger.png',
  'phantom':            '/items/phantom.png',
  'plasmabeam':         '/items/plasmabeam.png',
  'plasmablade':        '/items/plasmablade.png',
  'plasma-set':         '/items/plasma-set.png',
  'rainbow':            '/items/rainbow.png',
  'rainbow-gun':        '/items/rainbow-gun.png',
  'rainbow-set':        '/items/rainbow-set.png',
  'raygun':             '/items/raygun.png',
  'sakura-set':         '/items/sakura-set.png',
  'snow-dagger':        '/items/snow-dagger.png',
  'snow-set':           '/items/snow-set.png',
  'snowcannon':         '/items/snowcannon.png',
  'spectre-set':        '/items/spectre-set.png',
  'spectre':            '/items/spectre.png',
  'sunset':             '/items/sunset.png',
  'sun-set':            '/items/sun-set.png',
  'sunrise':            '/items/sunrise.png',
  'sweet-set':          '/items/sweet-set.png',
  'sweet':              '/items/sweet.png',
  'treat':              '/items/treat.png',
  'vampires-gun':       '/items/vampires-gun.png',
  'vampires-set':       '/items/vampires-set.png',
  'celestial-set':      '/items/celestial-set.png',
};

const SHOP_LISTINGS = [
  { id: 'sun-set',            name: 'Sun Set',                       img: '/items/sun-set.png',            url: 'https://www.ebay.com/itm/366291698619' },
  { id: 'heart-wand',         name: 'Heart Wand',                    img: '/items/heart-wand.png',         url: 'https://www.ebay.com/itm/366426866726', price: 6.69 },
  { id: 'rainbow-set',        name: 'Rainbow Set',                   img: '/items/rainbow-set.png',        url: 'https://www.ebay.com/itm/366291681066' },
  { id: 'rainbow',            name: 'Rainbow',                       img: '/items/rainbow.png',            url: 'https://www.ebay.com/itm/366291678057' },
  { id: 'rainbow-gun',        name: 'Rainbow Gun',                   img: '/items/rainbow-gun.png',        url: 'https://www.ebay.com/itm/366291671327' },
  { id: 'raygun',             name: 'Ray Gun',                       img: '/items/raygun.png',             url: 'https://www.ebay.com/itm/366348855771' },
  { id: 'spectre-set',        name: 'Spectre Set',                   img: '/items/spectre-set.png',        url: 'https://www.ebay.com/itm/366198830308' },
  { id: 'spectre',            name: 'Spectre',                       img: '/items/spectre.png',            url: 'https://www.ebay.com/itm/366198829225' },
  { id: 'phantom',            name: 'Phantom',                       img: '/items/phantom.png',            url: 'https://www.ebay.com/itm/366198828082' },
  { id: 'iceblaster',         name: 'Iceblaster',                    img: '/items/iceblaster.png',         url: 'https://www.ebay.com/itm/366198823883' },
  { id: 'icebreaker',         name: 'Icebreaker',                    img: '/items/icebreaker.png',         url: 'https://www.ebay.com/itm/366198821009' },
  { id: 'chroma-bringer-set', name: 'Chroma Bringer Set',            img: '/items/chroma-bringer-set.png', url: 'https://www.ebay.com/itm/366198786014' },
  { id: 'chroma-lightbringer',name: 'Chroma Lightbringer',           img: '/items/chroma-lightbringer.png',url: 'https://www.ebay.com/itm/366198783636', marketId: 'c-lightbringer' },
  { id: 'chroma-darkbringer', name: 'Chroma Darkbringer',            img: '/items/chroma-darkbringer.png', url: 'https://www.ebay.com/itm/366198782316', marketId: 'c-darkbringer' },
  { id: 'hallowgun',          name: 'Hallowgun',                     img: '/items/hallowgun.png',          url: 'https://www.ebay.com/itm/366198774694' },
  { id: 'hallow-set',         name: 'Hallow Set',                    img: '/items/hallow-set.png',         url: 'https://www.ebay.com/itm/366198769851' },
  { id: 'bat',                name: 'Bat',                           img: '/items/bat.png',                url: 'https://www.ebay.com/itm/366263868152' },
  { id: 'sweet-set',          name: 'Sweet Set',                     img: '/items/sweet-set.png',          url: 'https://www.ebay.com/itm/366253491540', price: 8.80 },
  { id: 'treat',              name: 'Treat',                         img: '/items/treat.png',              url: 'https://www.ebay.com/itm/366253490794', price: 5.05 },
  { id: 'sweet',              name: 'Sweet',                         img: '/items/sweet.png',              url: 'https://www.ebay.com/itm/366253489789', price: 5.05 },
  { id: 'icepiercer',         name: 'Icepiercer',                    img: '/items/icepiercer.png',         url: 'https://www.ebay.com/itm/366330760327' },
  { id: 'harve-icep-bundle',  name: 'Harvester + Icepiercer Bundle', img: '/items/harve-icep-bundle.png',  url: 'https://www.ebay.com/itm/366175300058' },
  { id: 'snow-set',           name: 'Snow Set',                      img: '/items/snow-set.png',           url: 'https://www.ebay.com/itm/366386306234' },
  { id: 'alien-set',          name: 'Alien Set',                     img: '/items/alien-set.png',          url: 'https://www.ebay.com/itm/366325388728' },
  { id: 'snow-dagger',        name: 'Snow Dagger',                   img: '/items/snow-dagger.png',        url: 'https://www.ebay.com/itm/366386305640' },
  { id: 'snowcannon',         name: 'Snowcannon',                    img: '/items/snowcannon.png',         url: 'https://www.ebay.com/itm/366386305064' },
];

function getItemImg(item) {
  if (!item) return null;
  const local = LOCAL_ITEM_IMAGES[item.id];
  if (local) return local;
  return proxyImg(item.imageUrl);
}

function normalizeMarketplaceName(value) {
  return (value ?? '')
    .toLowerCase()
    .replace(/\bc\.\s*/g, 'chroma ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findMarketplaceItem(items, listing) {
  return items.find((item) => {
    if (item.id === listing.id) return true;
    if (listing.marketId && item.id === listing.marketId) return true;
    return normalizeMarketplaceName(item.name) === normalizeMarketplaceName(listing.name);
  });
}

const TABS = [
  { id: "home", label: "Home" },
  { id: "board", label: "Board" },
  { id: "trade-checker", label: "Trade Checker" },
  { id: "inventory-tracker", label: "Inventory Tracker" },
  { id: "marketplace", label: "Marketplace" }
];

const TAB_SLUGS = {
  home: "",
  board: "board",
  "trade-checker": "trade-checker",
  "inventory-tracker": "inventory",
  marketplace: "marketplace",
};

const SLUG_TO_TAB = {};
for (const [tab, slug] of Object.entries(TAB_SLUGS)) SLUG_TO_TAB[slug] = tab;
SLUG_TO_TAB["market"] = "marketplace";
SLUG_TO_TAB["marketplace"] = "marketplace";

const GAME_ID_SET = new Set(Object.keys(GAMES));

function buildPath(gameId, tabId) {
  const slug = TAB_SLUGS[tabId] ?? "";
  if (!slug) return `/${gameId}`;
  return `/${gameId}/${slug}`;
}

function parseLocation() {
  let p = window.location.pathname;
  if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
  const parts = p.split("/").filter(Boolean);

  if (parts.length === 0) return { game: null, tab: "home" };

  if (parts.length === 1) {
    if (GAME_ID_SET.has(parts[0])) return { game: parts[0], tab: "home" };
    return { game: null, tab: SLUG_TO_TAB[parts[0]] || "home" };
  }

  const game = GAME_ID_SET.has(parts[0]) ? parts[0] : null;
  const tab = SLUG_TO_TAB[parts[1]] || "home";
  return { game, tab };
}

const FAVORITES_STORAGE_KEY = "mm2-goldywatch-favorites";
const INVENTORY_STORAGE_KEY  = "mm2-goldywatch-inventory";
const TRADE_SLOT_COUNT = 4;
const ADOPTME_TRADE_SLOT_COUNT = 9;

function getTradeSlotCount(gameId) {
  return gameId === "adoptme" ? ADOPTME_TRADE_SLOT_COUNT : TRADE_SLOT_COUNT;
}

function readStoredInventory() {
  try { return JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY)) || []; }
  catch { return []; }
}
function writeStoredInventory(inv) {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inv));
}

// ── Module-level helpers ─────────────────────────────────────────────────────

function isChroma(item) {
  if (item.category === 'chromas') return true;
  const name = (item.name ?? '').toLowerCase();
  return name.startsWith('chroma ') || name.startsWith('c. ');
}

// Adopt Me pets have a value/demand for every combination of
// tier (Regular/Neon/Mega) x potions (none/Fly/Ride/Fly+Ride).
const ADOPTME_VALUE_FIELDS = {
  regular: { none: 'npRegularValue', f: 'fValue', r: 'rValue', fr: 'regularValue' },
  neon: { none: 'npNeonValue', f: 'nfValue', r: 'nrValue', fr: 'neonValue' },
  mega: { none: 'npMegaValue', f: 'mfValue', r: 'mrValue', fr: 'megaValue' },
};
const ADOPTME_DEMAND_FIELDS = {
  regular: { none: 'npRegularDemand', f: 'fDemand', r: 'rDemand', fr: 'regularDemand' },
  neon: { none: 'npNeonDemand', f: 'nfDemand', r: 'nrDemand', fr: 'neonDemand' },
  mega: { none: 'npMegaDemand', f: 'mfDemand', r: 'mrDemand', fr: 'megaDemand' },
};

function getAdoptMePotionKey(fly, ride) {
  if (fly && ride) return 'fr';
  if (fly) return 'f';
  if (ride) return 'r';
  return 'none';
}

// Resolves a trade slot's value, accounting for the selected Adopt Me
// variant (Regular/Neon/Mega x Fly/Ride potions) when present.
function getSlotValue(item, slot) {
  if (!item) return 0;

  if (item.game === 'adoptme' && slot.variant) {
    const potionKey = getAdoptMePotionKey(slot.variant.fly, slot.variant.ride);
    const field = ADOPTME_VALUE_FIELDS[slot.variant.tier]?.[potionKey];
    const value = item.current?.adoptme?.[field];
    if (value != null) return value;
  }

  return item.current?.supreme?.value ?? 0;
}

function deriveAdoptMeTier(item) {
  const value = item.current?.adoptme?.regularValue ?? item.current?.supreme?.value ?? 0;
  if (value >= 1) return { key: 'legendary', label: 'LEGENDARY', color: 'var(--tier-legend)' };
  if (value >= 0.25) return { key: 'ultra-rare', label: 'ULTRA-RARE', color: 'var(--tier-chroma)' };
  if (value >= 0.05) return { key: 'rare', label: 'RARE', color: 'var(--tier-godly)' };
  if (value >= 0.01) return { key: 'uncommon', label: 'UNCOMMON', color: 'var(--tier-ancient)' };
  return { key: 'common', label: 'COMMON', color: 'var(--tier-vintage)' };
}

function deriveGrowAGardenTier(item) {
  const value = item.current?.supreme?.value ?? 0;
  if (value >= 1e21) return { key: 'mythical', label: 'MYTHICAL', color: 'var(--tier-legend)' };
  if (value >= 1e9) return { key: 'legendary', label: 'LEGENDARY', color: 'var(--tier-chroma)' };
  if (value >= 1e6) return { key: 'rare', label: 'RARE', color: 'var(--tier-godly)' };
  if (value >= 1e3) return { key: 'uncommon', label: 'UNCOMMON', color: 'var(--tier-ancient)' };
  return { key: 'common', label: 'COMMON', color: 'var(--tier-vintage)' };
}

function deriveTier(item) {
  if (item.game === 'adoptme') return deriveAdoptMeTier(item);
  if (item.game === 'growagarden') return deriveGrowAGardenTier(item);

  const value = item.current?.supreme?.value ?? 0;
  if (isChroma(item)) return { key: 'chroma', label: 'CHROMA', color: 'var(--tier-chroma)' };
  if (item.category === 'sets') return { key: 'sets', label: 'SETS', color: 'var(--tier-vintage)' };
  if (item.category === 'ancients') return { key: 'ancient', label: 'ANCIENT', color: 'var(--tier-ancient)' };
  if (value >= 5000) return { key: 'legend', label: 'LEGEND', color: 'var(--tier-legend)' };
  if (value >= 100) return { key: 'godly', label: 'GODLY', color: 'var(--tier-godly)' };
  return { key: 'godly', label: 'GODLY', color: 'var(--tier-godly)' };
}

function formatSV(n) {
  if (n == null) return '--';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatCheckedShort(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function getItemSerial(item) {
  let h = 0;
  for (let i = 0; i < (item.id ?? '').length; i++) {
    h = Math.imul(31, h) + (item.id ?? '').charCodeAt(i) | 0;
  }
  return String(Math.abs(h) % 99999).padStart(5, '0');
}

function getItemTrend(item) {
  const hist = (item.history ?? []).map(p => p.ebayPrice).filter(v => v != null);
  if (hist.length < 2) return 0;
  const a = hist[Math.max(0, hist.length - 8)];
  const b = hist[hist.length - 1];
  return a ? (b - a) / a : 0;
}

function getChartData(item) {
  const hist = item.history ?? [];
  const slice = hist.slice(-30);
  const ebay = slice.map(p => p.ebayPrice ?? 0);
  const sup = slice.map(p => p.supremeValue ?? 0);
  if (ebay.length < 2) {
    return { ebay: [0, 0], supreme: [0, 0] };
  }
  return { ebay, supreme: sup };
}

// ── New GW Card Components ───────────────────────────────────────────────────

function GWDualLine({ data, upTone, id = "x" }) {
  const W = 100, H = 60;
  function norm(series) {
    const max = Math.max(...series), min = Math.min(...series);
    const range = max - min || 1;
    return series.map((v, i) => [
      (i / (series.length - 1)) * W,
      H - ((v - min) / range) * (H - 8) - 4
    ]);
  }
  function pts2path(pts) {
    return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  }
  const ep = norm(data.ebay);
  const sp = norm(data.supreme);
  const gradId = `gw-fill-${id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: '100%', height: 32, display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={upTone} stopOpacity="0.22" />
          <stop offset="100%" stopColor={upTone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pts2path(ep) + ` L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradId})`} />
      <path d={pts2path(sp)} fill="none" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <path d={pts2path(ep)} fill="none" stroke={upTone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Sparkline({ item }) {
  const hist = item.history ?? [];
  const vals = hist.map(p => p.supremeValue ?? null).filter(v => v != null);
  const current = item.current?.supreme?.value;
  if (current == null) return null;
  if (current != null) vals.push(current);
  if (vals.length < 2) vals.unshift(current);
  const series = vals.slice(-20);
  const W = 80, H = 28;
  const max = Math.max(...series), min = Math.min(...series);
  const range = max - min || 1;
  const pts = series.map((v, i) => [
    (i / Math.max(series.length - 1, 1)) * W,
    H - ((v - min) / range) * (H - 6) - 3
  ]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const up = series[series.length - 1] >= series[0];
  const color = up ? 'var(--up)' : 'var(--down)';
  const gradId = `spark-${item.id}`;
  return (
    <svg className="gw-sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path + ` L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function GWGauge({ value, max = 5, color, label }) {
  return (
    <div className="gw-gauge">
      <span className="gw-gauge-label">{label}</span>
      <div className="gw-gauge-bar">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className="gw-gauge-seg" style={{ background: i < value ? color : 'rgba(255,255,255,0.06)' }} />
        ))}
      </div>
      <span className="gw-gauge-value">{value ?? '--'}</span>
    </div>
  );
}

function GWCard({ item, isFavorite, onToggleFavorite, onOpenChart, onAddToInventory }) {
  const tier = deriveTier(item);
  const serial = getItemSerial(item);
  const trend = getItemTrend(item);
  const chartData = getChartData(item);
  const ebayPrice = item.current?.ebay?.totalPrice ?? null;
  const supremeValue = item.current?.supreme?.value ?? null;
  const demand = item.current?.supreme?.demand ?? 0;
  const rarity = item.current?.supreme?.rarity ?? 0;
  const trendUp = trend >= 0;
  const trendColor = trendUp ? 'var(--up)' : 'var(--down)';
  const trendPct = (Math.abs(trend) * 100).toFixed(1);

  return (
    <article
      className="gw-card"
      style={{ boxShadow: `inset 0 3px 0 0 ${tier.color}` }}
      onClick={onOpenChart}
    >
      <div className="gw-card-serial">#{serial}</div>
      <button
        className={`gw-card-fav${isFavorite ? ' active' : ''}`}
        onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
        title={isFavorite ? 'Remove favorite' : 'Add to favorites'}
      >★</button>

      {/* Art */}
      <div
        className="gw-card-art"
        style={{ background: `radial-gradient(60% 50% at 50% 55%, ${tier.color}22, transparent 70%), var(--bg-deep)` }}
      >
        {item.imageUrl ? (
          <img
            className="gw-card-art-img"
            src={proxyImg(item.imageUrl)}
            alt={item.name}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-ghost)' }}>
            {item.name}
          </span>
        )}
      </div>

      <div className="gw-card-body">
        <div className="gw-card-tier" style={{ color: tier.color }}>{tier.label}</div>

        <h3 className="gw-card-name">{item.name}</h3>

        <div className="gw-card-prices">
          <div>
            <div className="gw-price-label">eBay</div>
            <div className="gw-price-value">
              {ebayPrice != null ? `€${ebayPrice.toFixed(2)}` : '--'}
            </div>
          </div>
          <div className="gw-price-right">
            <div className="gw-price-label">Supreme</div>
            <div className="gw-price-value">{formatSV(supremeValue)}</div>
          </div>
        </div>

        <div>
          <div className="gw-card-trend-row">
            <span
              className="gw-trend-tag"
              style={{ color: trendColor, background: `${trendColor}20` }}
            >
              <span>{trendUp ? '▲' : '▼'}</span>
              <span className="gw-trend-pct">{trendPct}%</span>
              <span className="gw-trend-period">7D</span>
            </span>
            <span className="gw-card-checked">{formatCheckedShort(item.lastCheckedAt)}</span>
          </div>
          <GWDualLine data={chartData} upTone={trendColor} id={item.id} />
          <div className="gw-chart-legend">
            <span className="gw-legend-entry">
              <span className="gw-legend-swatch" style={{ background: trendColor }} />
              eBay
            </span>
            <span className="gw-legend-entry">
              <span className="gw-legend-swatch" style={{ background: 'var(--ink-faint)', backgroundImage: `repeating-linear-gradient(90deg, var(--ink-faint) 0 2px, transparent 2px 4px)` }} />
              SV
            </span>
          </div>
        </div>

        <div className="gw-gauges">
          <GWGauge value={demand} color="var(--tier-ancient)" label="DEM" />
          <GWGauge value={rarity} color="var(--tier-vintage)" label="RAR" />
        </div>
      </div>
      {onAddToInventory && (
        <button
          className="gw-card-add-inv"
          onClick={e => { e.stopPropagation(); onAddToInventory(); }}
          title="Add to Inventory"
        >+ inventory</button>
      )}
    </article>
  );
}

function AdoptMeCard({ item, isFavorite, onToggleFavorite, onOpenChart, onAddToInventory }) {
  const tier = deriveTier(item);
  const isPet = item.category === 'pets';
  const adoptme = item.current?.adoptme ?? {};
  const [variant, setVariant] = useState({ tier: 'regular', fly: true, ride: true });

  const potionKey = getAdoptMePotionKey(variant.fly, variant.ride);
  const currentValue = isPet
    ? adoptme[ADOPTME_VALUE_FIELDS[variant.tier][potionKey]]
    : item.current?.supreme?.value;
  const currentDemand = isPet
    ? (adoptme[ADOPTME_DEMAND_FIELDS[variant.tier][potionKey]] ?? 0)
    : (item.current?.supreme?.demand ?? 0);
  const hasValue = currentValue != null;

  function toggleFly(e) { e.stopPropagation(); setVariant(v => ({ ...v, fly: !v.fly })); }
  function toggleRide(e) { e.stopPropagation(); setVariant(v => ({ ...v, ride: !v.ride })); }
  function toggleNeon(e) { e.stopPropagation(); setVariant(v => ({ ...v, tier: v.tier === 'neon' ? 'regular' : 'neon' })); }
  function toggleMega(e) { e.stopPropagation(); setVariant(v => ({ ...v, tier: v.tier === 'mega' ? 'regular' : 'mega' })); }

  return (
    <article
      className={`gw-card${hasValue ? '' : ' no-value'}`}
      style={{ boxShadow: `inset 0 3px 0 0 ${tier.color}`, cursor: hasValue ? 'pointer' : 'default' }}
      onClick={hasValue ? onOpenChart : undefined}
    >
      <button
        className={`gw-card-fav${isFavorite ? ' active' : ''}`}
        onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
        title={isFavorite ? 'Remove favorite' : 'Add to favorites'}
      >★</button>

      <div
        className="gw-card-art"
        style={{ background: `radial-gradient(60% 50% at 50% 55%, ${tier.color}22, transparent 70%), var(--bg-deep)` }}
      >
        {item.imageUrl ? (
          <img
            className="gw-card-art-img"
            src={proxyImg(item.imageUrl)}
            alt={item.name}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-ghost)' }}>
            {item.name}
          </span>
        )}
      </div>

      <div className="gw-card-body">
        <div className="gw-card-tier" style={{ color: tier.color }}>{tier.label}</div>

        <h3 className="gw-card-name">{item.name}</h3>

        <div className="gw-card-prices">
          <div>
            <div className="gw-price-label">Value</div>
            <div className="gw-price-value">{formatValue(currentValue)}</div>
          </div>
          {isPet && (
            <div className="gw-price-right">
              <div className="gw-price-label">Origin</div>
              <div className="gw-price-value" style={{ fontSize: 10, lineHeight: 1.3 }}>{adoptme.origin ?? '--'}</div>
            </div>
          )}
        </div>

        {isPet && (
          <div className="gw-am-variants">
            <button
              className={`gw-am-variant-btn fly${variant.fly ? ' active' : ''}`}
              onClick={toggleFly}
              title="Fly"
            >F</button>
            <button
              className={`gw-am-variant-btn ride${variant.ride ? ' active' : ''}`}
              onClick={toggleRide}
              title="Ride"
            >R</button>
            <button
              className={`gw-am-variant-btn neon${variant.tier === 'neon' ? ' active' : ''}`}
              onClick={toggleNeon}
              title="Neon"
            >N</button>
            <button
              className={`gw-am-variant-btn mega${variant.tier === 'mega' ? ' active' : ''}`}
              onClick={toggleMega}
              title="Mega"
            >M</button>
          </div>
        )}

        <div className="gw-gauges">
          <GWGauge value={currentDemand} color="var(--tier-ancient)" label="DEM" />
        </div>
        {hasValue && <Sparkline item={item} />}
      </div>
      {onAddToInventory && (
        <button
          className="gw-card-add-inv"
          onClick={e => { e.stopPropagation(); onAddToInventory(); }}
          title="Add to Inventory"
        >+ inventory</button>
      )}
    </article>
  );
}

function GrowAGardenCard({ item, isFavorite, onToggleFavorite, onOpenChart, onAddToInventory }) {
  const tier = deriveTier(item);
  const value = item.current?.supreme?.value ?? null;
  const demandRaw = item.current?.supreme?.demandRaw ?? 0;
  const hasValue = value != null;

  return (
    <article
      className={`gw-card${hasValue ? '' : ' no-value'}`}
      style={{ boxShadow: `inset 0 3px 0 0 ${tier.color}`, cursor: hasValue ? 'pointer' : 'default' }}
      onClick={hasValue ? onOpenChart : undefined}
    >
      <button
        className={`gw-card-fav${isFavorite ? ' active' : ''}`}
        onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
        title={isFavorite ? 'Remove favorite' : 'Add to favorites'}
      >★</button>

      <div
        className="gw-card-art"
        style={{ background: `radial-gradient(60% 50% at 50% 55%, ${tier.color}22, transparent 70%), var(--bg-deep)` }}
      >
        {item.imageUrl ? (
          <img
            className="gw-card-art-img"
            src={proxyImg(item.imageUrl)}
            alt={item.name}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-ghost)' }}>
            {item.name}
          </span>
        )}
      </div>

      <div className="gw-card-body">
        <div className="gw-card-tier" style={{ color: tier.color }}>{tier.label}</div>

        <h3 className="gw-card-name">{item.name}</h3>

        <div className="gw-card-prices">
          <div>
            <div className="gw-price-label">Value</div>
            <div className="gw-price-value">{formatValue(value)}</div>
          </div>
        </div>

        {demandRaw > 0 && (
          <div className="gw-card-demand-row">
            <span className="gw-price-label">Demand</span>
            <span className="gw-card-demand-num" style={{ color: demandRaw >= 8 ? 'var(--tier-legend)' : demandRaw >= 5 ? 'var(--tier-ancient)' : 'var(--ink-faint)' }}>
              {demandRaw}<span style={{ opacity: 0.45, fontSize: '0.75em' }}>/10</span>
            </span>
          </div>
        )}
        {hasValue && <Sparkline item={item} />}
      </div>
      {onAddToInventory && (
        <button
          className="gw-card-add-inv"
          onClick={e => { e.stopPropagation(); onAddToInventory(); }}
          title="Add to Inventory"
        >+ inventory</button>
      )}
    </article>
  );
}

function GWSparkline({ data, up, w = 120, h = 28 }) {
  const vals = (data || []).filter(v => v != null);
  if (vals.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 2;
  const xs = i => pad + (i / (data.length - 1)) * (w - pad * 2);
  const ys = v => v == null ? h / 2 : h - pad - ((v - min) / range) * (h - pad * 2);
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={up ? '#4ade80' : '#ef4444'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function GWListRow({ item, index, isFavorite, onToggleFavorite, onOpenChart, onAddToInventory }) {
  const tier = deriveTier(item);
  const trend = getItemTrend(item);
  const trendUp = trend >= 0;
  const trendPct = (Math.abs(trend) * 100).toFixed(1);
  const pctVal = trend * 100;
  const ebayPrice = item.current?.ebay?.totalPrice;
  const supValue = item.current?.supreme?.value;
  const demand = item.current?.supreme?.demand ?? 0;
  const rarity = item.current?.supreme?.rarity ?? 0;
  const chartData = getChartData(item);
  const serial = getItemSerial(item);

  function pctClass(v) {
    if (v === 0) return 'p0';
    if (v > 8) return 'p3'; if (v > 2) return 'p2'; if (v > 0) return 'p1';
    if (v < -8) return 'n3'; if (v < -2) return 'n2'; return 'n1';
  }

  return (
    <tr className="gw-list-row" onClick={onOpenChart}>
      <td className="gw-row-mark"><span style={{ background: tier.color }} /></td>
      <td className="gw-row-idx">{String(index + 1).padStart(3, ' ')}</td>
      <td className="gw-row-thumb">
        <div className="gw-thumb-wrap">
          {item.imageUrl
            ? <img src={proxyImg(item.imageUrl)} alt={item.name} onError={e => { e.currentTarget.style.display = 'none'; }} />
            : <span style={{ fontSize: 8, color: 'var(--ink-faint)', textAlign: 'center', lineHeight: 1.2 }}>{item.name.slice(0, 3)}</span>
          }
        </div>
      </td>
      <td className="l gw-row-name">
        <span className="gw-item-name">{item.name}</span>
        <span className="gw-item-sym">#{serial}</span>
      </td>
      <td className="l gw-row-tier">
        <span className="gw-tier-tag" style={{ color: tier.color }}>
          <span className="gw-tier-d" style={{ background: tier.color }} />
          {tier.label}
        </span>
      </td>
      <td className="gw-num gw-muted">{ebayPrice != null ? ebayPrice.toFixed(2) : '—'}</td>
      <td className="gw-num gw-big">{supValue != null ? supValue.toLocaleString() : '—'}</td>
      <td className="gw-pct">
        <span className={`gw-pct-cell ${pctClass(pctVal)}`}>{trendUp ? '+' : ''}{trendPct}%</span>
      </td>
      <td className="gw-spark c">
        <GWSparkline data={chartData.ebay} up={trendUp} />
      </td>
      <td className="gw-dr gw-list-hide-mobile">
        <div className="gw-drbar">
          <span>D</span>
          <div className="gw-drpips">{Array.from({ length: 5 }).map((_, n) => <i key={n} style={{ background: n < demand ? 'var(--amber)' : undefined }} />)}</div>
          <span style={{ marginLeft: 4 }}>R</span>
          <div className="gw-drpips">{Array.from({ length: 5 }).map((_, n) => <i key={n} style={{ background: n < rarity ? 'var(--cyan)' : undefined }} />)}</div>
        </div>
      </td>
      <td className="gw-action">
        {onAddToInventory && (
          <button
            className="gw-row-add-inv"
            onClick={e => { e.stopPropagation(); onAddToInventory(); }}
            title="Add to Inventory"
          >+inv</button>
        )}
        <button
          className={`gw-row-star${isFavorite ? ' active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
        >{isFavorite ? '★' : '☆'}</button>
      </td>
    </tr>
  );
}

function GWListView({ items, favoriteIds, onToggleFavorite, onOpenChart, onAddToInventory }) {
  return (
    <div className="gw-table-wrap">
      <table className="gw-table">
        <thead>
          <tr>
            <th style={{ width: 4 }} />
            <th className="l" style={{ width: 40 }}>#</th>
            <th style={{ width: 50 }} />
            <th className="l">Item</th>
            <th className="l">Tier</th>
            <th>eBay €</th>
            <th>Supreme</th>
            <th>7d</th>
            <th className="c">Trend</th>
            <th className="gw-list-hide-mobile">Dem · Rar</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <GWListRow
              key={item.id}
              item={item}
              index={i}
              isFavorite={favoriteIds.includes(item.id)}
              onToggleFavorite={() => onToggleFavorite(item.id)}
              onOpenChart={() => onOpenChart(item.id)}
              onAddToInventory={onAddToInventory ? () => onAddToInventory(item.id) : undefined}
            />
          ))}
          {!items.length ? (
            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-faint)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>No items match this filter.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function GWSidebar({ items, gameConfig, activeTier, onTierChange, activeFilter, onFilterChange, refreshedAt, favoriteIds, recentMoves }) {
  const tierCounts = useMemo(() => {
    const counts = {};
    items.forEach(item => {
      const t = deriveTier(item);
      counts[t.key] = (counts[t.key] ?? 0) + 1;
    });
    return [
      { key: 'all', label: 'All', count: items.length, color: null },
      ...gameConfig.tiers.map(t => ({ ...t, count: counts[t.key] ?? 0 })),
    ];
  }, [items, gameConfig]);

  return (
    <aside className="gw-sidebar">
      <div>
        <div className="gw-sidebar-section-label">Tier</div>
        {tierCounts.map(t => (
          <div
            key={t.key}
            className={`gw-tier-row${activeTier === t.key ? ' active' : ''}`}
            onClick={() => onTierChange(t.key)}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="gw-tier-dot" style={{ background: t.color ?? 'var(--ink-faint)' }} />
              <span className="gw-tier-label">{t.label}</span>
            </span>
            <span className="gw-tier-count">{t.count}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="gw-sidebar-section-label">Filter</div>
        <div
          className={`gw-filter-row${activeFilter === 'favorites' ? ' active' : ''}`}
          onClick={() => onFilterChange(activeFilter === 'favorites' ? 'all' : 'favorites')}
          style={{ cursor: 'pointer', borderRadius: 4, background: activeFilter === 'favorites' ? 'var(--card-hi)' : 'transparent' }}
        >
          <span className="gw-filter-label" style={{ color: activeFilter === 'favorites' ? 'var(--amber)' : undefined }}>★ Favorites</span>
          <span className="gw-filter-count">{favoriteIds.length}</span>
        </div>
        <div
          className={`gw-filter-row${activeFilter === 'movers' ? ' active' : ''}`}
          onClick={() => onFilterChange(activeFilter === 'movers' ? 'all' : 'movers')}
          style={{ cursor: 'pointer', borderRadius: 4, background: activeFilter === 'movers' ? 'var(--card-hi)' : 'transparent' }}
        >
          <span className="gw-filter-label" style={{ color: activeFilter === 'movers' ? 'var(--up)' : undefined }}>↗ Movers</span>
          <span className="gw-filter-count">{recentMoves.length}</span>
        </div>
      </div>

      <div className="gw-sidebar-footer">
        <div className="gw-last-refresh-label">Last refresh</div>
        <div className="gw-last-refresh-value">{formatTimestamp(refreshedAt)}</div>
      </div>
    </aside>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState(() => parseLocation().tab);
  const [activeGame, setActiveGame] = useState(() => {
    const loc = parseLocation();
    if (loc.game) { try { localStorage.setItem(GAME_STORAGE_KEY, loc.game); } catch {} return loc.game; }
    return readStoredGame();
  });
  const activeGameRef = useRef(activeGame);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const gameMenuRef = useRef(null);
  const [marketData, setMarketData] = useState({ items: [], refreshedAt: null });
  const [serverStats, setServerStats] = useState(null);
  const [recentMoves, setRecentMoves] = useState([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChartItemId, setSelectedChartItemId] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(readStoredFavoriteIds);
  const [haveTradeSlots, setHaveTradeSlots] = useState(() => createEmptyTradeSide(getTradeSlotCount(readStoredGame())));
  const [wantTradeSlots, setWantTradeSlots] = useState(() => createEmptyTradeSide(getTradeSlotCount(readStoredGame())));
  const [haveTradeSearch, setHaveTradeSearch] = useState(() => createEmptyTradeSearch(getTradeSlotCount(readStoredGame())));
  const [wantTradeSearch, setWantTradeSearch] = useState(() => createEmptyTradeSearch(getTradeSlotCount(readStoredGame())));
  const [activeTier, setActiveTier] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showOnlyValued, setShowOnlyValued] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [inventoryItems, setInventoryItems] = useState(readStoredInventory);
  const [inventorySearch, setInventorySearch] = useState("");
  const [invTimeframe, setInvTimeframe] = useState('3M');
  const [invChartMode, setInvChartMode] = useState('eur');
  const [tradePickerState, setTradePickerState] = useState(null); // { sideKey, slotIndex }
  const [tradePickerSearch, setTradePickerSearch] = useState("");
  const [tradeVariantState, setTradeVariantState] = useState(null); // { itemId, fly, ride, tier, quantity }
  const [mpSearch, setMpSearch] = useState('');
  const [mpTier, setMpTier] = useState('all');
  const [mpSort, setMpSort] = useState('price-asc');
  const [homeBoardTier, setHomeBoardTier] = useState('chroma');
  const [cartItems, setCartItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gw-cart')) || []; } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutDiscord, setCheckoutDiscord] = useState('');
  const [orderStatus, setOrderStatus] = useState('idle');
  const [orderRef, setOrderRef] = useState('');

  const gameConfig = getGameConfig(activeGame);

  const deferredQuery = useDeferredValue(query);
  const items = marketData.items || [];
  const derivedStats = calculateMarketStats(items);
  const homeTrackedItems = serverStats?.totalItems ?? marketData.items?.length ?? null;
  const homeRecentMoves = Array.isArray(recentMoves) ? recentMoves.length : null;
  const ebayCoveragePct = serverStats?.totalItems
    ? Math.round(((serverStats?.itemsWithEbayPrice ?? 0) / serverStats.totalItems) * 100)
    : null;

  const itemLookup = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  const itemNameLookup = useMemo(
    () =>
      new Map(items.map((item) => [normalizeTradeName(item.name), item.id])),
    [items]
  );

  function navigateToTab(tabId, { replace = false } = {}) {
    const path = buildPath(activeGame, tabId);
    const nextUrl = `${path}${window.location.hash || ""}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", nextUrl);
    setActiveTab(tabId);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const loc = parseLocation();
    if (!loc.game && loc.tab === "home" && window.location.pathname !== "/") {
      navigateToTab("home", { replace: true });
    }

    const handlePopState = () => {
      const next = parseLocation();
      setActiveTab(next.tab);
      if (next.game && next.game !== activeGameRef.current) {
        changeGame(next.game);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    writeStoredFavoriteIds(favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    writeStoredInventory(inventoryItems);
  }, [inventoryItems]);

  useEffect(() => {
    localStorage.setItem('gw-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('order') === 'success') {
      const sessionId = params.get('session_id') || '';
      const shortRef = sessionId ? sessionId.replace('cs_test_', '').replace('cs_live_', '').slice(0, 12).toUpperCase() : '';
      setCartItems([]);
      setOrderRef(shortRef);
      setCheckoutOpen(true);
      setOrderStatus('success');
      navigateToTab('marketplace', { replace: true });
    }
  }, []);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  function addToCart(itemId) {
    setCartItems(prev => {
      const hit = prev.find(i => i.id === itemId);
      if (hit) return prev.map(i => i.id === itemId ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: itemId, qty: 1 }];
    });
  }

  function setCartQty(itemId, qty) {
    if (qty < 1) {
      setCartItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      setCartItems(prev => prev.map(i => i.id === itemId ? { ...i, qty } : i));
    }
  }

  function buildEnrichedCart() {
    return cartItems.map(ci => {
      const item = items.find(it => it.id === ci.id);
      const price = item?.current?.ebay?.totalPrice ?? 0;
      return { id: ci.id, name: item?.name ?? ci.id, price, qty: ci.qty };
    });
  }

  function cartTotal() {
    return buildEnrichedCart().reduce((s, i) => s + i.price * i.qty, 0);
  }


  async function payWithStripe() {
    const enriched = buildEnrichedCart();
    const total = cartTotal();
    setOrderStatus('loading');
    try {
      const origin = window.location.origin;
      const res = await fetch(`${API_BASE}/order/stripe-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: enriched,
          discord: checkoutDiscord,
          total,
          successUrl: `${origin}/?order=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/?order=cancel`,
        }),
      });
      if (!res.ok) throw new Error('failed');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setOrderStatus('error');
    }
  }

  function addInventoryItem(itemId) {
    setInventoryItems(prev => {
      const hit = prev.find(i => i.id === itemId);
      if (hit) return prev.map(i => i.id === itemId ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: itemId, qty: 1 }];
    });
    setInventorySearch("");
  }

  function updateInventoryQty(itemId, delta) {
    setInventoryItems(prev =>
      prev.map(i => i.id === itemId ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
          .filter(i => i.qty > 0)
    );
  }

  function clearInventory() { setInventoryItems([]); }

  async function loadDashboard(game = activeGame) {
    setLoading(true);
    setError("");

    try {
      const [market, stats, moves] = await Promise.all([
        getMarketData(game),
        getMarketStats(game),
        getRecentMoves(game)
      ]);

      setMarketData(market);
      setServerStats(stats);
      setRecentMoves(moves);
    } catch (err) {
      setError("Market data temporarily unavailable. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  function changeGame(gameId) {
    if (gameId === activeGameRef.current || !GAMES[gameId]) return;
    setActiveGame(gameId);
    activeGameRef.current = gameId;
    setActiveTier('all');
    setActiveFilter('all');
    setCategoryFilter('all');
    setShowOnlyValued(false);
    setQuery('');
    setSelectedChartItemId(null);
    const slotCount = getTradeSlotCount(gameId);
    setHaveTradeSlots(createEmptyTradeSide(slotCount));
    setWantTradeSlots(createEmptyTradeSide(slotCount));
    setHaveTradeSearch(createEmptyTradeSearch(slotCount));
    setWantTradeSearch(createEmptyTradeSearch(slotCount));
    try { localStorage.setItem(GAME_STORAGE_KEY, gameId); } catch {}
    window.history.pushState({}, "", buildPath(gameId, activeTab));
    loadDashboard(gameId);
  }

  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      if (showOnlyValued) {
        const v = item.current?.supreme?.value;
        if (v == null || v === 0) return false;
      }

      return matchesQuery && matchesCategory;
    });

    result.sort((left, right) => {
      if (sortBy === "name") {
        return left.name.localeCompare(right.name);
      }

      if (sortBy === "value-desc") {
        return (right.current?.supreme?.value ?? 0) - (left.current?.supreme?.value ?? 0);
      }

      if (sortBy === "value-asc") {
        return (left.current?.supreme?.value ?? 0) - (right.current?.supreme?.value ?? 0);
      }

      if (sortBy === "ebay-desc") {
        return (right.current?.ebay?.totalPrice ?? -1) - (left.current?.ebay?.totalPrice ?? -1);
      }

      return 0;
    });

    return result;
  }, [items, deferredQuery, categoryFilter, sortBy, showOnlyValued]);

  const pinnedItems = useMemo(() => {
    return favoriteIds
      .map((itemId) => itemLookup.get(itemId))
      .filter(Boolean);
  }, [favoriteIds, itemLookup]);

  const tickerItems = recentMoves.length
    ? recentMoves.slice(0, 7)
    : filteredItems.slice(0, 7).map((item) => ({
        id: item.id,
        name: item.name,
        current: item.current?.supreme?.value ?? null,
        diff: item.current?.supreme?.lastChange ?? 0,
        timestamp: item.lastCheckedAt
      }));
  const tickerLoopItems = [...tickerItems, ...tickerItems];

  const shownCount = filteredItems.length;
  const boardItems = filteredItems;

  const moverIds = useMemo(() => new Set(recentMoves.map(m => m.id)), [recentMoves]);

  const tierBoardItems = useMemo(() => {
    let result = activeTier === 'all' ? boardItems : boardItems.filter(item => deriveTier(item).key === activeTier);
    if (activeFilter === 'favorites') result = result.filter(item => favoriteIds.includes(item.id));
    if (activeFilter === 'movers') result = result.filter(item => moverIds.has(item.id));
    return result;
  }, [boardItems, activeTier, activeFilter, favoriteIds, moverIds]);

  const yourTradeTotal = getTradeSideTotal(haveTradeSlots, itemLookup);
  const theirTradeTotal = getTradeSideTotal(wantTradeSlots, itemLookup);
  const yourTradeEbayTotal = getTradeSideEbayTotal(haveTradeSlots, itemLookup);
  const theirTradeEbayTotal = getTradeSideEbayTotal(wantTradeSlots, itemLookup);
  const tradeDifference = theirTradeTotal - yourTradeTotal;
  const tradeVerdict = getTradeVerdict(yourTradeTotal, theirTradeTotal);
  const selectedChartItem = selectedChartItemId
    ? itemLookup.get(selectedChartItemId) || null
    : null;

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setSelectedChartItemId(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!gameMenuOpen) return;

    function handleOutsideClick(event) {
      if (gameMenuRef.current && !gameMenuRef.current.contains(event.target)) {
        setGameMenuOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setGameMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [gameMenuOpen]);

  function applyTradeInput(sideKey, slotIndex, nextValue) {
    const setSearch = sideKey === "have" ? setHaveTradeSearch : setWantTradeSearch;

    setSearch((current) =>
      current.map((value, index) => (index === slotIndex ? nextValue : value))
    );

    const matchedId = itemNameLookup.get(normalizeTradeName(nextValue)) || null;

    if (matchedId) {
      updateTradeSlot(sideKey, slotIndex, matchedId);
    } else if (!nextValue.trim()) {
      updateTradeSlot(sideKey, slotIndex, null);
    }
  }

  function updateTradeSlot(sideKey, slotIndex, itemId) {
    const setSlots = sideKey === "have" ? setHaveTradeSlots : setWantTradeSlots;
    const setSearch = sideKey === "have" ? setHaveTradeSearch : setWantTradeSearch;

    setSlots((current) =>
      current.map((slot, index) =>
        index === slotIndex
          ? {
              ...slot,
              itemId,
              variant: null
            }
          : slot
      )
    );

    setSearch((current) =>
      current.map((value, index) => {
        if (index !== slotIndex) {
          return value;
        }

        return itemId ? itemLookup.get(itemId)?.name || "" : "";
      })
    );
  }

  function applyTradeSlotSelection(sideKey, slotIndex, { itemId, quantity, variant }) {
    const setSlots = sideKey === "have" ? setHaveTradeSlots : setWantTradeSlots;
    const setSearch = sideKey === "have" ? setHaveTradeSearch : setWantTradeSearch;

    setSlots((current) =>
      current.map((slot, index) =>
        index === slotIndex
          ? { ...slot, itemId, quantity: clampTradeQuantity(quantity), variant }
          : slot
      )
    );

    setSearch((current) =>
      current.map((value, index) => (index === slotIndex ? itemLookup.get(itemId)?.name || "" : value))
    );
  }

  function updateTradeQuantity(sideKey, slotIndex, quantityValue) {
    const setSlots = sideKey === "have" ? setHaveTradeSlots : setWantTradeSlots;
    const nextQuantity = clampTradeQuantity(quantityValue);

    setSlots((current) =>
      current.map((slot, index) =>
        index === slotIndex
          ? {
              ...slot,
              quantity: nextQuantity
            }
          : slot
      )
    );
  }

  function clearTradeSlot(sideKey, slotIndex) {
    updateTradeSlot(sideKey, slotIndex, null);
    updateTradeQuantity(sideKey, slotIndex, 1);
  }

  function clearTradeState() {
    const slotCount = getTradeSlotCount(activeGame);
    setHaveTradeSlots(createEmptyTradeSide(slotCount));
    setWantTradeSlots(createEmptyTradeSide(slotCount));
    setHaveTradeSearch(createEmptyTradeSearch(slotCount));
    setWantTradeSearch(createEmptyTradeSearch(slotCount));
  }

  function swapTradeSides() {
    setHaveTradeSlots(wantTradeSlots);
    setWantTradeSlots(haveTradeSlots);
    setHaveTradeSearch(wantTradeSearch);
    setWantTradeSearch(haveTradeSearch);
  }

  function openTradePicker(sideKey, slotIndex) {
    setTradePickerState({ sideKey, slotIndex });
    setTradePickerSearch("");
  }

  function closeTradePicker() {
    setTradePickerState(null);
    setTradePickerSearch("");
    setTradeVariantState(null);
  }

  function selectTradeItem(itemId) {
    if (!tradePickerState) return;
    updateTradeSlot(tradePickerState.sideKey, tradePickerState.slotIndex, itemId);
    closeTradePicker();
  }

  function openTradeVariantPicker(item) {
    if (!tradePickerState) return;

    if (activeGame !== "adoptme" || !item.current?.adoptme) {
      selectTradeItem(item.id);
      return;
    }

    const slots = tradePickerState.sideKey === "have" ? haveTradeSlots : wantTradeSlots;
    const slot = slots[tradePickerState.slotIndex];
    const existingVariant = slot?.itemId === item.id ? slot.variant : null;

    setTradeVariantState({
      itemId: item.id,
      fly: existingVariant?.fly ?? true,
      ride: existingVariant?.ride ?? true,
      tier: existingVariant?.tier ?? "regular",
      quantity: slot?.itemId === item.id ? slot.quantity : 1
    });
  }

  function confirmTradeVariantSelection() {
    if (!tradePickerState || !tradeVariantState) return;

    applyTradeSlotSelection(tradePickerState.sideKey, tradePickerState.slotIndex, {
      itemId: tradeVariantState.itemId,
      quantity: tradeVariantState.quantity,
      variant: { fly: tradeVariantState.fly, ride: tradeVariantState.ride, tier: tradeVariantState.tier }
    });

    closeTradePicker();
  }

  function renderTradeVariantPicker() {
    const item = itemLookup.get(tradeVariantState.itemId);
    if (!item) return null;

    const value = getSlotValue(item, {
      variant: { tier: tradeVariantState.tier, fly: tradeVariantState.fly, ride: tradeVariantState.ride }
    });

    return (
      <div className="tp-overlay" onClick={closeTradePicker}>
        <div className="tp-modal tp-variant-modal" onClick={e => e.stopPropagation()}>
          <div className="tp-header">
            <button className="tp-back" onClick={() => setTradeVariantState(null)} title="Back">‹</button>
            <span className="tp-title">Select Variant</span>
            <button className="tp-close" onClick={closeTradePicker}>×</button>
          </div>
          <div className="tp-variant-body">
            <div className="tp-variant-art">
              {item.imageUrl
                ? <img src={proxyImg(item.imageUrl)} className="tp-variant-img" alt="" />
                : <div className="tp-variant-img tp-item-img-empty">{getInitials(item.name)}</div>}
              <span className="tp-variant-value">{formatValue(value)}</span>
            </div>
            <h3 className="tp-variant-name">{item.name}</h3>
            <div className="gw-am-variants tp-variant-toggles">
              <button
                className={`gw-am-variant-btn fly${tradeVariantState.fly ? ' active' : ''}`}
                onClick={() => setTradeVariantState(v => ({ ...v, fly: !v.fly }))}
                title="Fly"
              >F</button>
              <button
                className={`gw-am-variant-btn ride${tradeVariantState.ride ? ' active' : ''}`}
                onClick={() => setTradeVariantState(v => ({ ...v, ride: !v.ride }))}
                title="Ride"
              >R</button>
              <button
                className={`gw-am-variant-btn neon${tradeVariantState.tier === 'neon' ? ' active' : ''}`}
                onClick={() => setTradeVariantState(v => ({ ...v, tier: v.tier === 'neon' ? 'regular' : 'neon' }))}
                title="Neon"
              >N</button>
              <button
                className={`gw-am-variant-btn mega${tradeVariantState.tier === 'mega' ? ' active' : ''}`}
                onClick={() => setTradeVariantState(v => ({ ...v, tier: v.tier === 'mega' ? 'regular' : 'mega' }))}
                title="Mega"
              >M</button>
            </div>
            <div className="tp-variant-qty">
              <span>Quantity</span>
              <select
                value={tradeVariantState.quantity}
                onChange={e => setTradeVariantState(v => ({ ...v, quantity: clampTradeQuantity(Number(e.target.value)) }))}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button className="tp-variant-select" onClick={confirmTradeVariantSelection}>Select</button>
          </div>
        </div>
      </div>
    );
  }

  function renderTradePicker() {
    if (!tradePickerState) return null;

    if (tradeVariantState) {
      return renderTradeVariantPicker();
    }

    const q = tradePickerSearch.trim().toLowerCase();
    const filtered = q
      ? items.filter(i => i.name.toLowerCase().includes(q))
      : items;

    const tiers = gameConfig.tiers;
    const grouped = tiers.map(t => ({
      ...t,
      items: filtered.filter(i => deriveTier(i).key === t.key)
    })).filter(t => t.items.length > 0);

    return (
      <div className="tp-overlay" onClick={closeTradePicker}>
        <div className="tp-modal" onClick={e => e.stopPropagation()}>
          <div className="tp-header">
            <span className="tp-title">Select Item</span>
            <input
              autoFocus
              className="tp-search"
              placeholder={
                activeGame === "adoptme"
                  ? "Search pets..."
                  : activeGame === "growagarden"
                    ? "Search items..."
                    : "Search weapons..."
              }
              value={tradePickerSearch}
              onChange={e => setTradePickerSearch(e.target.value)}
            />
            <button className="tp-close" onClick={closeTradePicker}>×</button>
          </div>
          <div className="tp-body">
            {grouped.map(group => (
              <div key={group.key} className="tp-group">
                {!q && <div className="tp-group-label" style={{ color: group.color }}>{group.label}</div>}
                <div className="tp-grid">
                  {group.items.map(item => (
                    <button key={item.id} className="tp-item" onClick={() => openTradeVariantPicker(item)}>
                      {item.imageUrl
                        ? <img src={proxyImg(item.imageUrl)} className="tp-item-img" alt="" />
                        : <div className="tp-item-img tp-item-img-empty">{getInitials(item.name)}</div>}
                      <span className="tp-item-name">{item.name}</span>
                      <span className="tp-item-tier" style={{ color: group.color }}>
                        {item.current?.supreme?.value != null ? formatValue(item.current.supreme.value) : group.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && <div className="tp-empty">No items found</div>}
          </div>
        </div>
      </div>
    );
  }

  function toggleFavorite(itemId) {
    setFavoriteIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  }

  function renderTradeSlots(sideKey, slots, searchValues, title, toneClass) {
    return (
      <section className={`trade-side ${toneClass}`}>
        <div className="trade-side-header">
          <div>
            <h2>{title}</h2>
            <p>You may only add up to 4 different items</p>
          </div>
          <span>{slots.filter((slot) => slot.itemId).length} / {TRADE_SLOT_COUNT} used</span>
        </div>

        <div className="trade-side-body">
          <div className="trade-slot-grid">
          {slots.map((slot, slotIndex) =>
            buildTradeSlot({
              sideKey,
              slot,
              slotIndex,
              item: slot.itemId ? itemLookup.get(slot.itemId) : null,
              currency: "EUR",
              updateTradeQuantity,
              clearTradeSlot,
              openPicker: openTradePicker
            })
          )}
          </div>

          <aside className="trade-side-values-box">
            <div className="trade-side-values-title">MM2Values</div>
            <div className="trade-side-values-copy">
              <span>Supreme total</span>
              <strong>{formatValue(getTradeSideTotal(slots, itemLookup))}</strong>
            </div>
            <div className="trade-side-values-copy">
              <span>eBay total</span>
              <strong>{formatCurrency(getTradeSideEbayTotal(slots, itemLookup), "EUR")}</strong>
            </div>
            <button className="trade-clear-table-button" onClick={clearTradeState}>
              Clear Table
            </button>
          </aside>
        </div>
      </section>
    );
  }

  function renderTradeChecker() {
    if (activeGame === "adoptme") {
      return renderAdoptMeTradeChecker();
    }

    return (
      <section className="trade-checker-panel">
        <h1 className="trade-checker-title">Trade Checker</h1>

        <div className="trade-intro-card">
          {activeGame === "growagarden"
            ? "Welcome to the GodlyWatch Trade Checker. This tool lets you compare two trade sides using live Grow a Garden values. Items are stackable, quantities multiply item value, and the verdict below tells you whether the offer is a Win, Fair, or Loss."
            : "Welcome to the MM2Values Trade Checker. This tool lets you compare two trade sides using the tracked Supreme values from your rebuilt backend. Weapons are stackable, quantities multiply item value, and the verdict below tells you whether the offer is a Win, Fair, or Loss."}
        </div>

        <div className="trade-link-card">
          Not sure how to check a trade? Watch this video! Click here
        </div>

        <datalist id="trade-item-options">
          {items.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>

        <div className="trade-board retro-board">
          {renderTradeSlots("have", haveTradeSlots, haveTradeSearch, activeGame === "mm2" ? "Weapons You Have" : "Items You Have", "trade-have")}
          {renderTradeSlots("want", wantTradeSlots, wantTradeSearch, activeGame === "mm2" ? "Weapons They Offer" : "Items They Offer", "trade-want")}
        </div>

        <div className="trade-summary retro-summary">
          <h3>Trade Summary</h3>
          <div className="trade-summary-grid">
            <SummaryMetric label="Your total" value={formatValue(yourTradeTotal)} accent="muted" />
            <SummaryMetric label="Their total" value={formatValue(theirTradeTotal)} accent="muted" />
            <SummaryMetric
              label="Difference"
              value={tradeDifference === 0 ? "0" : signedValue(tradeDifference)}
              accent={tradeDifference > 0 ? "positive" : tradeDifference < 0 ? "negative" : "fair"}
            />
            <SummaryMetric label="Verdict" value={tradeVerdict} accent={tradeVerdict.toLowerCase()} />
          </div>

          <div className="trade-summary-actions">
            <button className="trade-generate-button">Generate Summary</button>
            <button className="trade-generate-button" onClick={clearTradeState}>Clear Summary</button>
          </div>

          <div className="trade-summary-foot">
            <ValueBox label="Your eBay total" value={formatCurrency(yourTradeEbayTotal, "EUR")} />
            <ValueBox label="Their eBay total" value={formatCurrency(theirTradeEbayTotal, "EUR")} />
          </div>

          <p className="trade-summary-note">
            Don&apos;t forget to read up on our <span>Scam Prevention Tips</span>
          </p>
        </div>
      </section>
    );
  }

  function renderAmTradeSide(sideKey, slots, label) {
    const filledCount = slots.filter((slot) => slot.itemId).length;
    const total = getTradeSideTotal(slots, itemLookup);

    return (
      <section className="am-trade-side">
        <div className="am-trade-side-header">
          <h2>{label}</h2>
          <span className="am-trade-side-count">{filledCount} / {slots.length}</span>
        </div>

        <div className="am-trade-grid">
          {slots.map((slot, slotIndex) =>
            buildAmTradeSlot({
              sideKey,
              slot,
              slotIndex,
              item: slot.itemId ? itemLookup.get(slot.itemId) : null,
              openPicker: openTradePicker,
              clearTradeSlot
            })
          )}
        </div>

        <div className="am-trade-side-total">
          <span>{gameConfig.valueLabel} Total</span>
          <strong>{formatValue(total)}</strong>
        </div>
      </section>
    );
  }

  function renderAdoptMeTradeChecker() {
    return (
      <section className="trade-checker-panel am-trade-checker">
        <h1 className="trade-checker-title">Trade Checker</h1>

        <div className="trade-intro-card">
          Build both sides of an Adopt Me trade and compare values instantly. Add up to{" "}
          {ADOPTME_TRADE_SLOT_COUNT} pets per side, then check the verdict below.
        </div>

        <div className="am-trade-board">
          {renderAmTradeSide("have", haveTradeSlots, "You")}

          <div className="am-trade-divider">
            <button
              className="am-trade-swap"
              onClick={swapTradeSides}
              title="Swap sides"
              aria-label="Swap sides"
            >
              ⇄
            </button>
            <span className="am-trade-divider-label">Trade</span>
          </div>

          {renderAmTradeSide("want", wantTradeSlots, "Them")}
        </div>

        <div className="trade-summary retro-summary">
          <h3>Trade Summary</h3>
          <div className="trade-summary-grid">
            <SummaryMetric label="Your total" value={formatValue(yourTradeTotal)} accent="muted" />
            <SummaryMetric label="Their total" value={formatValue(theirTradeTotal)} accent="muted" />
            <SummaryMetric
              label="Difference"
              value={tradeDifference === 0 ? "0" : signedValue(tradeDifference)}
              accent={tradeDifference > 0 ? "positive" : tradeDifference < 0 ? "negative" : "fair"}
            />
            <SummaryMetric label="Verdict" value={tradeVerdict} accent={tradeVerdict.toLowerCase()} />
          </div>

          <div className="trade-summary-actions">
            <button className="trade-generate-button" onClick={clearTradeState}>Clear Trade</button>
          </div>
        </div>
      </section>
    );
  }

  function renderInventoryTracker() {
    const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

    const inventoryWithItems = inventoryItems
      .map(({ id, qty }) => ({ item: itemLookup.get(id), qty }))
      .filter(({ item }) => item != null);

    const totalEbay = inventoryWithItems.reduce(
      (s, { item, qty }) => s + (item.current?.ebay?.totalPrice ?? 0) * qty, 0
    );
    const totalSV = inventoryWithItems.reduce(
      (s, { item, qty }) => s + (item.current?.supreme?.value ?? 0) * qty, 0
    );
    const totalQty = inventoryWithItems.reduce((s, { qty }) => s + qty, 0);

    const useEbay = gameConfig.hasEbay;
    const effectiveMode = useEbay ? invChartMode : 'sv';

    const primaryTotal = effectiveMode === 'sv' ? totalSV : totalEbay;
    const secondaryTotal = effectiveMode === 'sv' ? totalEbay : totalSV;
    const chartColor = effectiveMode === 'sv' ? '#b794f4' : '#5eff8d';

    const portfolioSeries = buildPortfolioSeries(inventoryWithItems, effectiveMode);
    const filteredSeries = filterByTimeframe(portfolioSeries, invTimeframe);
    const startVal = filteredSeries.length > 1 ? filteredSeries[0].value : 0;
    const portfolioDelta = startVal > 0 ? (primaryTotal - startVal) / startVal : 0;

    const d7Series = filterByTimeframe(portfolioSeries, '1W');
    const d7Start = d7Series.length > 1 ? d7Series[0].value : 0;
    const d7Pct = d7Start > 0 ? (primaryTotal - d7Start) / d7Start : null;

    const chartVals = filteredSeries.map(p => p.value);

    const suggestions = inventorySearch.trim().length > 0
      ? items.filter(i => i.name.toLowerCase().includes(inventorySearch.toLowerCase())).slice(0, 8)
      : [];

    const movers = [...inventoryWithItems]
      .map(({ item, qty }) => ({ item, qty, trend: getItemTrend(item) }))
      .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));
    const topMovers = [
      ...movers.filter(m => m.trend > 0).slice(0, 3),
      ...movers.filter(m => m.trend < 0).slice(0, 2),
    ];

    const allocItems = [...inventoryWithItems]
      .map(({ item, qty }) => ({
        item, qty,
        value: (useEbay ? (item.current?.ebay?.totalPrice ?? 0) : (item.current?.supreme?.value ?? 0)) * qty,
        tier: deriveTier(item),
      }))
      .filter(a => a.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const allocTotal = allocItems.reduce((s, a) => s + a.value, 0);

    const searchBar = (
      <div className="inv2-search-wrap">
        <div className="inv2-search-box">
          <span className="inv2-search-icon">⌕</span>
          <input
            className="inv2-search-input"
            placeholder="search and add items..."
            value={inventorySearch}
            onChange={e => setInventorySearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && suggestions.length > 0) addInventoryItem(suggestions[0].id);
              if (e.key === 'Escape') setInventorySearch('');
            }}
          />
          {suggestions.length > 0 && (
            <div className="inv2-suggestions">
              {suggestions.map(item => {
                const tier = deriveTier(item);
                return (
                  <button key={item.id} className="inv2-suggestion-row" onClick={() => addInventoryItem(item.id)}>
                    {item.imageUrl && <img src={proxyImg(item.imageUrl)} className="inv2-suggestion-img" alt="" />}
                    <span className="inv2-suggestion-name">{item.name}</span>
                    <span className="inv2-suggestion-tier" style={{ color: tier.color }}>{tier.label}</span>
                    {item.current?.ebay?.totalPrice != null && (
                      <span className="inv2-suggestion-price">€{item.current.ebay.totalPrice.toFixed(2)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );

    if (inventoryWithItems.length === 0) {
      return (
        <section className="inv2-wrap">
          <div className="inv2-header-row">
            <div>
              <h1 className="inv2-page-title">Inventory Tracker</h1>
              <p className="inv2-page-sub">Track your {gameConfig.name} portfolio. Saved in your browser.</p>
            </div>
          </div>
          {searchBar}
          <div className="inv2-empty">Search above to add items to your inventory.</div>
        </section>
      );
    }

    return (
      <section className="inv2-wrap">
        <div className="inv2-header-row">
          <div>
            <h1 className="inv2-page-title">Inventory Tracker</h1>
            <p className="inv2-page-sub">Track your {gameConfig.name} portfolio. Saved in your browser.</p>
          </div>
          <button className="inv2-clear-btn" onClick={clearInventory}>Clear All</button>
        </div>

        <div className="inv2-layout">
          {/* ── Main column ── */}
          <div className="inv2-main">
            {/* Hero card */}
            <div className="inv2-hero">
              <div className="inv2-hero-head">
                <div className="inv2-hero-left">
                  <div className="inv2-label">portfolio value</div>
                  <div className="inv2-hero-value-row">
                    <span className="inv2-portfolio-val" style={{ color: effectiveMode === 'sv' ? '#b794f4' : 'var(--ink)' }}>
                      {effectiveMode === 'sv'
                        ? (totalSV > 0 ? formatSV(totalSV) : '—')
                        : (totalEbay > 0 ? `€${totalEbay.toFixed(2)}` : '—')}
                    </span>
                    {primaryTotal > 0 && filteredSeries.length > 1 && (
                      <span className={`inv2-delta-badge ${portfolioDelta >= 0 ? 'up' : 'down'}`}>
                        {portfolioDelta >= 0 ? '▲' : '▼'} {(Math.abs(portfolioDelta) * 100).toFixed(1)}%
                      </span>
                    )}
                    <span className="inv2-period-label">{invTimeframe}</span>
                  </div>
                  <div className="inv2-hero-secondary">
                    {effectiveMode === 'eur' && totalSV > 0 && (
                      <span className="inv2-secondary-val">{formatSV(totalSV)} <span style={{ color: 'var(--ink-faint)' }}>SV</span></span>
                    )}
                    {effectiveMode === 'sv' && totalEbay > 0 && (
                      <span className="inv2-secondary-val">€{totalEbay.toFixed(2)} <span style={{ color: 'var(--ink-faint)' }}>eBay</span></span>
                    )}
                  </div>
                  <div className="inv2-stats-row">
                    {d7Pct != null && (
                      <>
                        <span className="inv2-stat-pair">
                          <span className="inv2-stat-label">7d</span>
                          <span className="inv2-stat-val" style={{ color: d7Pct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                            {d7Pct >= 0 ? '+' : ''}{(d7Pct * 100).toFixed(1)}%
                          </span>
                        </span>
                        <span className="inv2-sep">·</span>
                      </>
                    )}
                    <span className="inv2-stat-pair">
                      <span className="inv2-stat-label">items</span>
                      <span className="inv2-stat-val">{totalQty}</span>
                    </span>
                  </div>
                </div>
                <div className="inv2-hero-right">
                  <div className="inv2-pills">
                    {TIMEFRAMES.map(tf => (
                      <button
                        key={tf}
                        className={`inv2-pill${invTimeframe === tf ? ' active' : ''}`}
                        onClick={() => setInvTimeframe(tf)}
                      >{tf}</button>
                    ))}
                  </div>
                  {useEbay && (
                    <div className="inv2-chart-toggle">
                      <button
                        className={`inv2-ct-btn${invChartMode === 'eur' ? ' active' : ''}`}
                        onClick={() => setInvChartMode('eur')}
                      >eBay €</button>
                      <button
                        className={`inv2-ct-btn${invChartMode === 'sv' ? ' active active-sv' : ''}`}
                        onClick={() => setInvChartMode('sv')}
                      >SV</button>
                    </div>
                  )}
                </div>
              </div>
              <PortfolioAreaChart values={chartVals} series={filteredSeries} color={chartColor} gradId={`inv2-grad-${invChartMode}`} mode={invChartMode} />
            </div>

            {/* Search */}
            {searchBar}

            {/* Holdings table */}
            <div className="inv2-table-wrap">
              <table className="inv2-table">
                <thead>
                  <tr>
                    <th style={{ width: 4 }} />
                    <th className="l" style={{ width: 28 }}>#</th>
                    <th style={{ width: 44 }} />
                    <th className="l">Item</th>
                    <th className="l">Tier</th>
                    {useEbay && <th>eBay €</th>}
                    <th>{useEbay ? 'SV' : gameConfig.valueLabel}</th>
                    <th>7d</th>
                    <th>Qty</th>
                    <th>Position</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {inventoryWithItems.map(({ item, qty }, i) => {
                    const tier = deriveTier(item);
                    const ebay = item.current?.ebay?.totalPrice ?? null;
                    const sv = item.current?.supreme?.value ?? null;
                    const trend = getItemTrend(item);
                    const trendUp = trend >= 0;
                    const trendPct = (Math.abs(trend) * 100).toFixed(1);
                    const pctVal = trend * 100;
                    const posTotal = ebay != null ? ebay * qty : null;
                    const posSV = sv != null ? sv * qty : null;
                    const serial = getItemSerial(item);

                    function pctClass(v) {
                      if (v === 0) return 'p0';
                      if (v > 8) return 'p3'; if (v > 2) return 'p2'; if (v > 0) return 'p1';
                      if (v < -8) return 'n3'; if (v < -2) return 'n2'; return 'n1';
                    }

                    return (
                      <tr key={item.id} className="inv2-row">
                        <td className="inv2-rail-cell">
                          <span className="inv2-rail" style={{ background: tier.color }} />
                        </td>
                        <td className="inv2-idx">{i + 1}</td>
                        <td className="inv2-thumb-td">
                          <div className="inv2-thumb-wrap">
                            {item.imageUrl
                              ? <img src={proxyImg(item.imageUrl)} alt="" />
                              : <span style={{ fontSize: 8, color: 'var(--ink-faint)' }}>{getInitials(item.name)}</span>}
                          </div>
                        </td>
                        <td className="l inv2-name-cell">
                          <span className="inv2-item-name">{item.name}</span>
                          <span className="inv2-item-id">#{serial}</span>
                        </td>
                        <td className="l">
                          <span className="inv2-tier-tag" style={{ color: tier.color }}>
                            <span className="inv2-tier-d" style={{ background: tier.color }} />
                            {tier.label}
                          </span>
                        </td>
                        {useEbay && <td className="inv2-num inv2-muted">{ebay != null ? ebay.toFixed(2) : '—'}</td>}
                        <td className="inv2-num inv2-muted">{sv != null ? formatSV(sv) : '—'}</td>
                        <td className="inv2-pct-td">
                          <span className={`inv2-pct-cell ${pctClass(pctVal)}`}>
                            {trendUp ? '+' : ''}{trendPct}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="inv2-qty">
                            <button className="inv2-qty-btn" onClick={() => updateInventoryQty(item.id, -1)}>−</button>
                            <span className="inv2-qty-num">{qty}</span>
                            <button className="inv2-qty-btn" onClick={() => updateInventoryQty(item.id, 1)}>+</button>
                          </div>
                        </td>
                        <td className="inv2-pos-cell">
                          {useEbay ? (
                            <>
                              <span className="inv2-pos-total">{posTotal != null ? `€${posTotal.toFixed(2)}` : '—'}</span>
                              <span className="inv2-pos-sv">{posSV != null ? formatSV(posSV) + ' SV' : ''}</span>
                            </>
                          ) : (
                            <span className="inv2-pos-total">{posSV != null ? formatValue(posSV) : '—'}</span>
                          )}
                        </td>
                        <td style={{ padding: '0 8px' }}>
                          <button className="inv2-remove" onClick={() => updateInventoryQty(item.id, -qty)}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="inv2-sidebar">
            {/* Top Movers */}
            <div className="inv2-card">
              <div className="inv2-card-label">top movers · 7d</div>
              {topMovers.length === 0 ? (
                <div className="inv2-sidebar-empty">No movement data yet.</div>
              ) : (
                <div className="inv2-movers-list">
                  {topMovers.map(({ item, trend }) => {
                    const tier = deriveTier(item);
                    const ebay = item.current?.ebay?.totalPrice ?? null;
                    const moverValue = useEbay ? ebay : (item.current?.supreme?.value ?? null);
                    const trendUp = trend >= 0;
                    return (
                      <div key={item.id} className="inv2-mover-row">
                        <div className="inv2-mover-thumb">
                          {item.imageUrl
                            ? <img src={proxyImg(item.imageUrl)} alt="" />
                            : <span style={{ fontSize: 8, color: tier.color }}>{getInitials(item.name)}</span>}
                        </div>
                        <div className="inv2-mover-info">
                          <span className="inv2-mover-name">{item.name}</span>
                          <span className="inv2-mover-price">{moverValue != null ? (useEbay ? `€${moverValue.toFixed(2)}` : formatValue(moverValue)) : '—'}</span>
                        </div>
                        <span className={`inv2-mover-pct ${trendUp ? 'up' : 'down'}`}>
                          {trendUp ? '+' : ''}{(Math.abs(trend) * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Allocation */}
            <div className="inv2-card">
              <div className="inv2-card-label">allocation</div>
              {allocItems.length === 0 ? (
                <div className="inv2-sidebar-empty">{useEbay ? 'No eBay price data for allocation.' : 'No value data for allocation.'}</div>
              ) : (
                <>
                  <div className="inv2-alloc-bar">
                    {allocItems.map(({ item, value, tier }) => (
                      <div
                        key={item.id}
                        className="inv2-alloc-seg"
                        style={{ width: `${(value / allocTotal) * 100}%`, background: tier.color }}
                        title={`${item.name}: ${((value / allocTotal) * 100).toFixed(1)}%`}
                      />
                    ))}
                  </div>
                  <div className="inv2-alloc-legend">
                    {allocItems.slice(0, 6).map(({ item, value, tier }) => (
                      <div key={item.id} className="inv2-alloc-row">
                        <span className="inv2-alloc-swatch" style={{ background: tier.color }} />
                        <span className="inv2-alloc-name">{item.name}</span>
                        <span className="inv2-alloc-pct">{((value / allocTotal) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  function renderMarketplace() {
    if (!gameConfig.hasMarketplace) {
      return (
        <section className="mp-wrap">
          <h1 className="trade-checker-title">Marketplace</h1>
          <div className="inv2-empty">
            The {gameConfig.label} marketplace isn't available yet. Switch back to MM2 to browse listings.
          </div>
        </section>
      );
    }

    const q = mpSearch.trim().toLowerCase();
    const filtered = q ? SHOP_LISTINGS.filter(l => l.name.toLowerCase().includes(q)) : SHOP_LISTINGS;

    const sortedListings = [...filtered].sort((a, b) => {
      const aM = findMarketplaceItem(items, a);
      const bM = findMarketplaceItem(items, b);
      const aP = a.price ?? aM?.current?.ebay?.totalPrice ?? 0;
      const bP = b.price ?? bM?.current?.ebay?.totalPrice ?? 0;
      if (mpSort === 'price-desc') return bP - aP;
      if (mpSort === 'price-asc') return aP - bP;
      if (mpSort === 'name') return a.name.localeCompare(b.name);
      if (mpSort === 'type') {
        const order = { chroma: 0, ancient: 1, sets: 2, godly: 3 };
        const aT = aM ? (order[deriveTier(aM).key] ?? 9) : 9;
        const bT = bM ? (order[deriveTier(bM).key] ?? 9) : 9;
        return aT !== bT ? aT - bT : bP - aP;
      }
      if (mpSort === 'robux') return Math.round(bP * 83) - Math.round(aP * 83);
      return 0;
    });

    const SORT_OPTS = [
      ['price-desc', 'price ↓'],
      ['price-asc',  'price ↑'],
      ['name',       'name'],
      ['type',       'type'],
      ['robux',      'robux'],
    ];

    return (
      <section className="mp-wrap">

        {/* Hero */}
        <div className="mkt-hero">
          <div className="mkt-hero-left">
            <div className="mkt-eyebrow">
              <span className="mkt-eye-dots">
                {['var(--tier-godly)','var(--tier-chroma)','var(--tier-legend)','var(--up)'].map((c,i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </span>
              <span className="mkt-eye-label">MM2 MARKETPLACE</span>
            </div>
            <h1 className="mkt-headline">
              Buy MM2 godlies,<br/><span className="mkt-accent">safely</span> &amp; fast.
            </h1>
            <p className="mkt-subhead">
              Pay on <strong>eBay</strong>, compare every listing against live market value, and claim your item fast after checkout.
            </p>
            <div className="mkt-steps">
              <span className="mkt-step"><span className="mkt-step-idx">01</span> browse listings</span>
              <span className="mkt-arrow">→</span>
              <span className="mkt-step"><span className="mkt-step-idx">02</span> pay on eBay</span>
              <span className="mkt-arrow">→</span>
              <span className="mkt-step"><span className="mkt-step-idx">03</span> claim your item</span>
            </div>
            <div className="mkt-cta-row">
              <button className="mkt-btn-primary" onClick={() => document.getElementById('mp-listings')?.scrollIntoView({ behavior: 'smooth' })}>
                ↓ browse {SHOP_LISTINGS.length} listings
              </button>
              <button className="mkt-btn-secondary" onClick={() => navigateToTab('board')}>
                open value board
              </button>
            </div>
            <div className="mkt-hours">
              <span className="mkt-live-dot green" />
              Online daily <strong>10:00 – 01:00</strong> <span className="mkt-tz">(GMT+2)</span>
            </div>
          </div>

          <div className="mkt-status">
            <div className="mkt-status-head">
              <span className="mkt-live-dot green" />
              MARKET STATUS
            </div>
            <div className="mkt-row">
              <span className="mkt-row-val" style={{ color: 'var(--up)', fontVariantNumeric: 'tabular-nums' }}>{SHOP_LISTINGS.length}</span>
              <span className="mkt-row-label">listings<br/>live now</span>
            </div>
            <div className="mkt-row">
              <span className="mkt-row-val">&lt; 10 min</span>
              <span className="mkt-row-label">median<br/>delivery</span>
            </div>
            <div className="mkt-row">
              <span className="mkt-row-val mkt-ebay-word">eBay</span>
              <span className="mkt-row-label">buyer<br/>protection</span>
            </div>
            <div className="mkt-row">
              <span className="mkt-row-val mkt-row-sm">eBay · Robux</span>
              <span className="mkt-row-label">payment<br/>accepted</span>
            </div>
          </div>
        </div>

        <div className="mkt-proof-band">
          <div className="mkt-proof-card">
            <div className="mkt-proof-shot">
              <img src="/ebay-proof.png" alt="GodlyMarket eBay proof" className="mkt-proof-image" />
            </div>
            <div className="mkt-proof-copy">
              <span className="mkt-proof-kicker">Proof</span>
              <h3>Real eBay store, real track record</h3>
              <p>Buy through eBay first, then use your order details to claim delivery and support.</p>
            </div>
          </div>

          <div className="mkt-quick-trust">
            <div className="mkt-quick-pill">
              <span className="mkt-quick-num">01</span>
              <div>
                <strong>Pick your item</strong>
                <p>See the price and market value first.</p>
              </div>
            </div>
            <div className="mkt-quick-pill">
              <span className="mkt-quick-num">02</span>
              <div>
                <strong>Pay on eBay</strong>
                <p>Buyer protection stays on the checkout side.</p>
              </div>
            </div>
            <div className="mkt-quick-pill">
              <span className="mkt-quick-num">03</span>
              <div>
                <strong>Claim your item</strong>
                <p>Use your order details for delivery and support.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Listings header */}
        <div className="mkt-listhead" id="mp-listings">
          <div className="mkt-listhead-left">
            <h2>All items</h2>
            <span>{sortedListings.length} listings</span>
          </div>
          <div className="mkt-listhead-right">
            <input
              className="mp-search"
              type="search"
              placeholder="search..."
              value={mpSearch}
              onChange={e => setMpSearch(e.target.value)}
            />
            <span className="mkt-sort-label">sort</span>
            <div className="mkt-sort-pills">
              {SORT_OPTS.map(([key, label]) => (
                <button
                  key={key}
                  className={`mkt-sort-pill${mpSort === key ? ' active' : ''}`}
                  onClick={() => setMpSort(key)}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="mp-grid">
          {sortedListings.map(listing => {
            const marketItem = findMarketplaceItem(items, listing);
            const tier = marketItem ? deriveTier(marketItem) : { label: 'GODLY', color: 'var(--tier-godly)' };
            const price = listing.price ?? marketItem?.current?.ebay?.totalPrice;
            const sv = marketItem?.current?.supreme?.value;
            return (
              <div key={listing.id} className="mp-card">
                <div className="mp-card-img-wrap" style={{ background: `radial-gradient(60% 50% at 50% 55%, ${tier.color}18, transparent 70%), var(--bg-deep)` }}>
                  <img src={listing.img} alt={listing.name} className="mp-card-img" />
                  <span className="mp-card-tier" style={{ color: tier.color }}>{tier.label}</span>
                </div>
                <div className="mp-card-body">
                  <span className="mp-card-name">{listing.name}</span>
                  <div className="mp-card-stats">
                    {sv != null && <span className="mp-card-sv">SV {sv.toLocaleString()}</span>}
                    <span className="mp-card-price">{price != null ? `€${price.toFixed(2)}` : '—'}</span>
                  </div>
                  {price != null && (
                    <div className="mp-card-robux">
                      <svg width="13" height="13" viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
                        <defs><linearGradient id="rg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e8d48a"/><stop offset="100%" stopColor="#b8922a"/></linearGradient></defs>
                        <path d="M50 2 L93 26 L93 74 L50 98 L7 74 L7 26 Z" fill="url(#rg2)" />
                        <path d="M50 14 L82 31 L82 69 L50 86 L18 69 L18 31 Z" fill="#0d1018" />
                        <rect x="33" y="33" width="34" height="34" rx="5" fill="url(#rg2)" />
                      </svg>
                      <span>{Math.round(price * 83).toLocaleString()} Robux</span>
                    </div>
                  )}
                  <a className="mp-buy-btn" href={listing.url} target="_blank" rel="noopener noreferrer">
                    Buy on eBay →
                  </a>
                </div>
              </div>
            );
          })}
          {!sortedListings.length && <p className="mp-empty" style={{ gridColumn: '1/-1' }}>No items match your search.</p>}
        </div>
      </section>
    );
  }

  const HERO_GAMES = ['MM2', 'Adopt Me', 'Grow a Garden'];
  const [heroGameIdx, setHeroGameIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setHeroGameIdx(i => (i + 1) % HERO_GAMES.length), 2200);
    return () => clearInterval(id);
  }, []);

  function renderHome() {
    const heroData = items.slice(0, 5).map(item => {
      const tier = deriveTier(item);
      const trend = getItemTrend(item);
      const up = trend >= 0;
      const val = item.current?.supreme?.value ?? item.current?.ebay?.totalPrice ?? null;
      return {
        name: item.name,
        tier: tier.label,
        tierColor: tier.color,
        price: val != null ? formatValue(val) : '--',
        change: `${up ? '+' : ''}${(trend * 100).toFixed(1)}%`,
        up,
      };
    });

    const gameCards = [
      { id: 'mm2', label: 'MM2', game: 'mm2' },
      { id: 'adoptme', label: 'Adopt Me', game: 'adoptme' },
      { id: 'growagarden', label: 'Grow a Garden', game: 'growagarden' },
    ];

    const liveCards = heroData.slice(0, 3);
    const trendingChips = heroData.slice(0, 5);

    return (
      <section className="gw-home">
        <header className="gw-home-header">
          <div className="gw-home-header-inner">
            <div className="gw-home-header-logo" onClick={() => navigateToTab('home')}>
              <span className="gw-home-header-icon">↗</span>
              <strong>godlywatch</strong>
            </div>
            <nav className="gw-home-header-nav">
              {gameCards.map(g => (
                <button key={g.id} onClick={() => { changeGame(g.game); navigateToTab('board'); }}>
                  {g.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <section className="gw-home-hero">
          <div className="gw-home-hero-inner">
            <span className="gw-home-pill">
              <span className="gw-home-pill-dot" />
              Tracking {homeTrackedItems ?? '2,480'}+ items across 3 games
            </span>

            <h1 className="gw-home-headline">
              <span>Every value in</span>
              <span className="gw-home-headline-game" key={heroGameIdx}>
                {HERO_GAMES[heroGameIdx]}
              </span>
              <span>one place.</span>
            </h1>

            <p className="gw-home-subhead">
              Live prices for MM2, Adopt Me &amp; Grow a Garden. Pick a game and know what your items are worth before you trade.
            </p>

            <div className="gw-home-picker">
              {gameCards.map(g => (
                <button
                  key={g.id}
                  className="gw-home-picker-card"
                  onClick={() => { changeGame(g.game); navigateToTab('board'); }}
                >
                  <div>
                    <strong>{g.label}</strong>
                    <span>View values</span>
                  </div>
                  <span className="gw-home-picker-arrow">↗</span>
                </button>
              ))}
            </div>

            {trendingChips.length > 0 && (
              <div className="gw-home-trending">
                <span className="gw-home-trending-label">↗ Trending now</span>
                {trendingChips.map(c => (
                  <span key={c.name} className={`gw-home-trending-chip${c.up ? ' up' : ' down'}`}>
                    {c.name} <span>{c.change}</span>
                  </span>
                ))}
              </div>
            )}

            {liveCards.length > 0 && (
              <div className="gw-home-live-cards">
                {liveCards.map(card => (
                  <div key={card.name} className="gw-home-live-card">
                    <div className="gw-home-live-card-left">
                      <strong>{card.name}</strong>
                      <span style={{ color: card.tierColor }}>{card.tier}</span>
                    </div>
                    <div className="gw-home-live-card-right">
                      <strong>{card.price}</strong>
                      <span className={card.up ? 'up' : 'down'}>
                        {card.up ? '↗' : '↘'} {card.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="gw-home-footer">
          <div className="gw-home-footer-grid">
            <div className="gw-home-footer-brand">
              <div className="gw-home-footer-logo">
                <span className="gw-home-footer-logo-box">↗</span>
                <strong>godlywatch</strong>
              </div>
              <p>Live values and trade tools for MM2, Adopt Me, and Grow a Garden. Not affiliated with Roblox.</p>
            </div>
            <div className="gw-home-footer-links">
              <span>Product</span>
              <button onClick={() => navigateToTab('board')}>Value Board</button>
              <button onClick={() => navigateToTab('trade-checker')}>Trade Checker</button>
              <button onClick={() => navigateToTab('marketplace')}>Marketplace</button>
              <button onClick={() => navigateToTab('inventory-tracker')}>Inventory</button>
            </div>
            <div className="gw-home-footer-links">
              <span>Games</span>
              {gameCards.map(g => (
                <button key={g.id} onClick={() => { changeGame(g.game); navigateToTab('board'); }}>{g.label}</button>
              ))}
            </div>
          </div>
          <div className="gw-home-footer-bottom">
            <span>&copy; 2026 godlywatch. Not affiliated with Roblox.</span>
          </div>
        </footer>
      </section>
    );
  }

  return (
    <div className="gw-page">
      {/* TopBar */}
      <header className="gw-topbar">
        <div className="gw-topbar-left">
          <div className="gw-wordmark" onClick={() => navigateToTab('home')} style={{ cursor: 'pointer' }}>
            godly<span className="gw-wordmark-accent">watch</span>
            <span className="gw-wordmark-beta">BETA</span>
          </div>
          <div className="gw-game-switcher-wrap" ref={gameMenuRef}>
            <button
              type="button"
              className="gw-game-switcher"
              onClick={() => setGameMenuOpen(open => !open)}
              aria-expanded={gameMenuOpen}
              title="Switch game"
            >
              <span className="gw-game-badge" style={{ background: gameConfig.color }}>
                {gameConfig.icon
                  ? <img className="gw-game-badge-img" src={gameConfig.icon} alt="" />
                  : gameConfig.shortLabel}
              </span>
              <span className="gw-game-switcher-text">
                <span className="gw-game-switcher-name">{gameConfig.label}</span>
                <span className="gw-game-switcher-count">{items.length} items</span>
              </span>
              <span className={`gw-game-switcher-chevron${gameMenuOpen ? ' open' : ''}`}>⌄</span>
            </button>
            {gameMenuOpen && (
              <div className="gw-game-menu">
                {GAME_LIST.map(game => (
                  <button
                    key={game.id}
                    type="button"
                    className={`gw-game-menu-item${game.id === activeGame ? ' active' : ''}`}
                    onClick={() => { changeGame(game.id); setGameMenuOpen(false); }}
                  >
                    <span className="gw-game-badge" style={{ background: game.color }}>
                      {game.icon
                        ? <img className="gw-game-badge-img" src={game.icon} alt="" />
                        : game.shortLabel}
                    </span>
                    <span className="gw-game-menu-name">{game.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <nav className="gw-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`gw-nav-pill${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => navigateToTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="gw-topbar-right">
        <div className="gw-search">
          <span className="gw-search-icon">⌕</span>
          <input
            className="gw-search-input"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`search ${items.length} items`}
          />
          <span className="gw-keycap">⌘K</span>
        </div>
        </div>
      </header>

      {/* Ticker */}
      <div className="gw-ticker">
        <div className="gw-ticker-live">● LIVE</div>
        <div className="gw-ticker-track">
          {[...tickerLoopItems, ...tickerLoopItems].map((item, i) => {
            const tier = deriveTier(item);
            return (
              <span key={i} className="gw-ticker-entry">
                <span className="gw-ticker-dot" style={{ background: tier.color }} />
                <span className="gw-ticker-name">{item.name}</span>
                <span>moved</span>
                <span className="gw-ticker-price">{formatValue(item.current ?? item.current)}</span>
                <span className="gw-ticker-ago">· {compactDate(item.timestamp ?? new Date().toISOString())}</span>
                <span className="gw-ticker-sep">│</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Banners */}
      {error ? <div className="gw-banner error">{error}</div> : null}
      {loading ? <div className="gw-banner">Fetching latest {gameConfig.label} prices...</div> : null}

      {!loading && activeTab === 'home' ? (
        <div className="gw-tab-content">
          {renderHome()}
        </div>
      ) : null}

      {/* Board tab */}
      {!loading && activeTab === 'board' ? (
        <div className="gw-board-body">
          <GWSidebar
            items={items}
            gameConfig={gameConfig}
            activeTier={activeTier}
            onTierChange={t => { setActiveTier(t); setActiveFilter('all'); }}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            refreshedAt={marketData.refreshedAt}
            favoriteIds={favoriteIds}
            recentMoves={recentMoves}
          />
          <main className="gw-main">
            <div className="gw-board-search-row">
              <div className="gw-search gw-search-board">
                <span className="gw-search-icon">⌕</span>
                <input
                  className="gw-search-input"
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`search ${items.length} items`}
                />
                <span className="gw-keycap">⌘K</span>
              </div>
              {gameConfig.categories ? (
                <div className="gw-category-pills">
                  {[
                    { key: 'all', label: 'All', color: 'var(--ink-faint)' },
                    ...gameConfig.categories,
                  ].map(c => (
                    <button
                      key={c.key}
                      className={`gw-category-pill${categoryFilter === c.key ? ' active' : ''}`}
                      style={categoryFilter === c.key ? { borderColor: c.color, color: c.color } : {}}
                      onClick={() => { setCategoryFilter(c.key); setActiveTier('all'); setActiveFilter('all'); }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                className={`gw-value-toggle${showOnlyValued ? ' active' : ''}`}
                onClick={() => setShowOnlyValued(v => !v)}
                title={showOnlyValued ? 'Showing items with values only' : 'Showing all items'}
              >
                {showOnlyValued ? '◉ Valued' : '○ All'}
              </button>
              <select className="gw-mobile-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="name">A–Z</option>
                <option value="value-desc">Highest {gameConfig.valueLabel}</option>
                <option value="value-asc">Lowest {gameConfig.valueLabel}</option>
                {gameConfig.hasEbay && <option value="ebay-desc">Highest eBay</option>}
              </select>
            </div>

            {/* Mobile tier filter strip */}
            <div className="gw-mobile-filters">
              {[
                { key: 'all', label: 'All', color: 'var(--ink-faint)' },
                ...gameConfig.tiers,
              ].map(t => (
                <button
                  key={t.key}
                  className={`gw-mobile-chip${activeTier === t.key ? ' active' : ''}`}
                  style={activeTier === t.key ? { borderColor: t.color, color: t.color } : {}}
                  onClick={() => { setActiveTier(t.key); setActiveFilter('all'); }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="gw-main-header">
              <div>
                <h1 className="gw-main-title">Board</h1>
                <p className="gw-main-sub">
                  {shownCount} items · refreshed {formatTimestamp(marketData.refreshedAt)}
                </p>
              </div>
              {gameConfig.hasListView && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="gw-view-toggle">
                    <button className={`gw-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}>Grid</button>
                    <button className={`gw-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>List</button>
                  </div>
                </div>
              )}
            </div>
            {viewMode === 'grid' || !gameConfig.hasListView ? (
              <div className="gw-grid">
                {tierBoardItems.map((item, index) => {
                  const CardComponent = item.game === 'adoptme'
                    ? AdoptMeCard
                    : item.game === 'growagarden'
                      ? GrowAGardenCard
                      : GWCard;
                  return (
                    <CardComponent
                      key={item.id}
                      item={item}
                      index={index}
                      isFavorite={favoriteIds.includes(item.id)}
                      onToggleFavorite={() => toggleFavorite(item.id)}
                      onOpenChart={() => setSelectedChartItemId(item.id)}
                      onAddToInventory={() => addInventoryItem(item.id)}
                    />
                  );
                })}
                {!tierBoardItems.length ? (
                  <p style={{ gridColumn: '1/-1', color: 'var(--ink-faint)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                    No items match this filter.
                  </p>
                ) : null}
              </div>
            ) : (
              <GWListView
                items={tierBoardItems}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                onOpenChart={(id) => setSelectedChartItemId(id)}
                onAddToInventory={addInventoryItem}
              />
            )}
          </main>
        </div>
      ) : null}

      {/* Non-board tabs */}
      {!loading ? (
        <>
          {activeTab === "trade-checker" ? (
            <div className="gw-tab-content">
              {renderTradeChecker()}
            </div>
          ) : null}

{activeTab === "inventory-tracker" ? (
            <div className="gw-tab-content">
              {renderInventoryTracker()}
            </div>
          ) : null}

          {activeTab === "marketplace" ? (
            <div className="gw-tab-content">
              {renderMarketplace()}
            </div>
          ) : null}

        </>
      ) : null}

      {selectedChartItem ? (
        <ChartModal
          item={selectedChartItem}
          isFavorite={favoriteIds.includes(selectedChartItem.id)}
          onToggleFavorite={() => toggleFavorite(selectedChartItem.id)}
          onClose={() => setSelectedChartItemId(null)}
        />
      ) : null}

      {renderTradePicker()}

    </div>
  );
}

// ── Inventory Tracker helpers ────────────────────────────────────────────────

function buildPortfolioSeries(inventoryWithItems, mode = 'eur') {
  const histKey = mode === 'sv' ? 'supremeValue' : 'ebayPrice';
  const getCurrent = (item) => mode === 'sv'
    ? (item.current?.supreme?.value ?? 0)
    : (item.current?.ebay?.totalPrice ?? 0);

  const currentPriceMap = new Map();
  inventoryWithItems.forEach(({ item, qty }) => {
    currentPriceMap.set(item.id, { qty, current: getCurrent(item) });
  });

  const tsMap = new Map();
  inventoryWithItems.forEach(({ item }) => {
    (item.history ?? []).forEach(point => {
      if (!tsMap.has(point.timestamp)) tsMap.set(point.timestamp, new Map());
      if (point[histKey] != null) tsMap.get(point.timestamp).set(item.id, point[histKey]);
    });
  });

  if (tsMap.size < 2) return [];

  const sortedTs = [...tsMap.keys()].sort();
  const lastKnown = new Map();
  inventoryWithItems.forEach(({ item }) => lastKnown.set(item.id, null));

  const series = [];
  for (const ts of sortedTs) {
    const prices = tsMap.get(ts);
    prices.forEach((price, id) => lastKnown.set(id, price));
    let total = 0;
    let hasAny = false;
    inventoryWithItems.forEach(({ item, qty }) => {
      const p = lastKnown.get(item.id) ?? currentPriceMap.get(item.id)?.current ?? 0;
      if (p > 0) hasAny = true;
      total += p * qty;
    });
    if (hasAny) series.push({ timestamp: ts, value: total });
  }

  const lastTs = new Date().toISOString();
  let currentTotal = 0;
  inventoryWithItems.forEach(({ item, qty }) => {
    currentTotal += getCurrent(item) * qty;
  });
  if (currentTotal > 0) series.push({ timestamp: lastTs, value: currentTotal });

  return series;
}

function filterByTimeframe(series, tf) {
  if (!series.length) return series;
  const cutoffs = {
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    'ALL': Infinity,
  };
  const cutoff = cutoffs[tf] ?? Infinity;
  const now = Date.now();
  const filtered = series.filter(p => (now - new Date(p.timestamp).getTime()) <= cutoff);
  return filtered.length >= 2 ? filtered : series;
}

function PortfolioAreaChart({ values, series = [], color = '#5eff8d', gradId = 'inv2-area-grad', mode = 'eur' }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const containerRef = useRef(null);

  const W = 600, H = 180;
  if (!values || values.length < 2) {
    return (
      <div className="inv2-chart inv2-chart-empty">
        <span>History builds up after a few price refreshes</span>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 10;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - pad - ((v - min) / range) * (H - pad * 2),
  ]);
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const last = pts[pts.length - 1];

  function handleMouseMove(e) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverIdx(Math.round(pct * (values.length - 1)));
  }

  const hovPt = hoverIdx != null ? pts[hoverIdx] : null;
  const hovVal = hoverIdx != null ? values[hoverIdx] : null;
  const hovTs = (hoverIdx != null && series[hoverIdx]) ? series[hoverIdx].timestamp : null;
  const hovLabel = hovVal != null ? (mode === 'sv' ? formatSV(hovVal) : `€${hovVal.toFixed(2)}`) : null;

  return (
    <div className="inv2-chart" ref={containerRef} style={{ position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(y => (
          <line key={y} x1="0" y1={H * y} x2={W} y2={H * y}
            stroke="rgba(255,255,255,0.05)" strokeWidth="0.6"
            strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {!hovPt && (
          <>
            <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="4"
              fill="var(--bg)" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
            <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="8"
              fill={color} opacity="0.15" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {hovPt && (
          <>
            <line x1={hovPt[0].toFixed(1)} y1="0" x2={hovPt[0].toFixed(1)} y2={H}
              stroke="rgba(255,255,255,0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={hovPt[0].toFixed(1)} cy={hovPt[1].toFixed(1)} r="4"
              fill="var(--bg)" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <circle cx={hovPt[0].toFixed(1)} cy={hovPt[1].toFixed(1)} r="9"
              fill={color} opacity="0.15" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hovPt && hovLabel && (
        <div className="inv2-chart-tooltip" style={{ left: `${(hovPt[0] / W) * 100}%` }}>
          <span className="inv2-tt-val">{hovLabel}</span>
          {hovTs && <span className="inv2-tt-date">{compactDate(hovTs)}</span>}
        </div>
      )}
    </div>
  );
}

function TrendChevron({ up }) {
  const color = up ? 'var(--up)' : 'var(--down)';
  const pts = up ? '2,11 6,5 10,11 15,3' : '2,5 6,11 10,5 15,13';
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" fill="none" style={{ display: 'block', margin: '0 auto' }}>
      <polyline points={pts} stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


// ── Preserved existing components ────────────────────────────────────────────

function ChartModal({ item, isFavorite, onToggleFavorite, onClose }) {
  const tier = deriveTier(item);
  const ebayPrice = item.current?.ebay?.totalPrice;
  const supValue = item.current?.supreme?.value;
  const trend = getItemTrend(item);
  const trendColor = trend >= 0 ? 'var(--up)' : 'var(--down)';
  const trendPct = (Math.abs(trend) * 100).toFixed(1);

  return (
    <div className="chart-modal-backdrop" onClick={onClose}>
      <div className="chart-modal" onClick={e => e.stopPropagation()}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: tier.color, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 4 }}>{tier.label}</div>
            <h2 style={{ fontFamily: 'Saira Condensed,Arial Narrow,sans-serif', fontSize: 28, fontWeight: 600, color: 'var(--ink)', margin: 0, letterSpacing: '-0.005em' }}>{item.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              onClick={onToggleFavorite}
              style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isFavorite ? '#f5c518' : 'rgba(255,255,255,0.3)', transition: 'color 120ms', lineHeight: 1, textShadow: isFavorite ? '0 0 12px rgba(245,197,24,0.5)' : 'none' }}
            >★</button>
            <button className="chart-modal-close" onClick={onClose} style={{ position: 'static', width: 32, height: 32 }}>✕</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[
            ebayPrice != null ? { label: 'eBay Price', value: `€${ebayPrice.toFixed(2)}` } : null,
            { label: item.game === 'mm2' ? 'Supreme Value' : 'Value', value: formatSV(supValue) },
            { label: '7D Trend', value: `${trend >= 0 ? '+' : ''}${trendPct}%`, color: trendColor },
          ].filter(Boolean).map(s => (
            <div key={s.label} style={{ background: 'var(--card-hi)', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: 'Saira Condensed,Arial Narrow,sans-serif', fontSize: 24, fontWeight: 600, color: s.color || 'var(--ink)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <DualHistoryChart item={item} trendColor={trendColor} />
      </div>
    </div>
  );
}

function DualHistoryChart({ item, trendColor = 'var(--up)' }) {
  const rawHistory = Array.isArray(item?.history) ? item.history : [];
  const ebayNow = item?.current?.ebay?.totalPrice ?? null;
  const supNow = item?.current?.supreme?.value ?? null;

  // Pad with current snapshot so there's always something to draw
  const now = { timestamp: new Date().toISOString(), ebayPrice: ebayNow, supremeValue: supNow };
  const history = rawHistory.length === 0
    ? [now, now]
    : rawHistory.length === 1
      ? [rawHistory[0], now]
      : rawHistory;

  const W = 100, H = 60;

  function norm(series) {
    const vals = series.filter(v => v != null);
    const max = vals.length ? Math.max(...vals) : 1;
    const min = vals.length ? Math.min(...vals) : 0;
    const range = max - min || 1;
    return series.map((v, i) => [
      (i / Math.max(series.length - 1, 1)) * W,
      v == null ? H / 2 : H - ((v - min) / range) * (H - 8) - 4
    ]);
  }

  function pts2path(pts) {
    return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  }

  const ebayData = history.map(p => p.ebayPrice);
  const supData = history.map(p => p.supremeValue);
  const hasEbay = ebayData.some(v => v != null);
  const hasSup = supData.some(v => v != null);

  const ep = norm(ebayData);
  const sp = norm(supData);
  const gradId = `cm-fill-${item.id}`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: '100%', height: 200, display: 'block', background: 'var(--bg-deep)', borderRadius: 4 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(y => (
          <line key={y} x1="0" x2={W} y1={H * y} y2={H * y}
            stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {hasEbay && <path d={pts2path(ep) + ` L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradId})`} />}
        {hasSup && <path d={pts2path(sp)} fill="none" stroke="var(--ink-faint)" strokeWidth="1"
          strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
        {hasEbay && <path d={pts2path(ep)} fill="none" stroke={trendColor} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      </svg>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {hasEbay && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 2, background: trendColor, display: 'inline-block', borderRadius: 1 }} />
            eBay Price
          </span>
        )}
        {hasSup && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 1.5, backgroundImage: `repeating-linear-gradient(90deg,var(--ink-faint) 0 3px,transparent 3px 6px)`, display: 'inline-block' }} />
            Supreme Value
          </span>
        )}
        {rawHistory.length < 2 && (
          <span style={{ marginLeft: 'auto', color: 'var(--ink-ghost)', fontSize: 8 }}>
            Showing current snapshot — more data after next refresh
          </span>
        )}
      </div>
    </div>
  );
}

function buildTradeSlot({
  sideKey, slot, slotIndex, item,
  currency = "EUR", updateTradeQuantity, clearTradeSlot, openPicker
}) {
  const supremeValue = item?.current?.supreme?.value ?? null;
  const ebayValue = item?.current?.ebay?.totalPrice ?? item?.current?.ebay?.price ?? null;
  const stackSupremeValue = supremeValue != null ? supremeValue * slot.quantity : null;
  const stackEbayValue = ebayValue != null ? Number((ebayValue * slot.quantity).toFixed(2)) : null;
  const tier = item ? deriveTier(item) : null;

  return (
    <article key={`${sideKey}-${slotIndex}`} className="trade-slot-card">
      <button
        className={`trade-slot-tile ${item ? "filled" : "empty"}`}
        onClick={() => openPicker(sideKey, slotIndex)}
      >
        {item?.imageUrl ? (
          <img className="trade-slot-image" src={proxyImg(item.imageUrl)} alt={item.name} />
        ) : (
          <div className="trade-slot-visual">+</div>
        )}
        <div className="trade-slot-overlay">
          <span className="trade-slot-number">Slot {slotIndex + 1}</span>
          <strong>{item?.name || "Click to add"}</strong>
          {item && tier && (
            <p style={{ color: tier.color }}>{tier.label} · {formatValue(supremeValue)}</p>
          )}
          {!item && <p>Empty slot</p>}
        </div>
      </button>

      {item && (
        <div className="trade-slot-controls">
          <div className="trade-control-row">
            <label className="trade-input-group quantity">
              <span>Qty</span>
              <input
                type="number" min="1" max="99" value={slot.quantity}
                onChange={e => updateTradeQuantity(sideKey, slotIndex, e.target.value)}
              />
            </label>
            <button className="trade-clear-slot-button" onClick={() => clearTradeSlot(sideKey, slotIndex)}>
              Remove
            </button>
          </div>
          <div className="trade-slot-values">
            <ValueBox label="Per-item value" value={formatValue(supremeValue)} />
            <ValueBox label="Stack total" value={formatValue(stackSupremeValue)} />
            <ValueBox label="eBay stack" value={formatCurrency(stackEbayValue, item?.current?.ebay?.currency || currency)} />
          </div>
        </div>
      )}
    </article>
  );
}

function buildAmTradeSlot({ sideKey, slot, slotIndex, item, openPicker, clearTradeSlot }) {
  const value = item ? getSlotValue(item, slot) : null;

  return (
    <div key={`${sideKey}-${slotIndex}`} className="am-trade-slot-wrap">
      <button
        className={`am-trade-slot ${item ? "filled" : "empty"}`}
        onClick={() => openPicker(sideKey, slotIndex)}
        title={item?.name || "Add item"}
      >
        {item?.imageUrl ? (
          <img className="am-trade-slot-image" src={proxyImg(item.imageUrl)} alt={item.name} />
        ) : (
          <span className="am-trade-slot-plus">+</span>
        )}
        {item && value != null && (
          <span className="am-trade-slot-value">{formatValue(value)}</span>
        )}
      </button>

      {item && (
        <button
          className="am-trade-slot-remove"
          onClick={(e) => { e.stopPropagation(); clearTradeSlot(sideKey, slotIndex); }}
          title="Remove"
          aria-label={`Remove ${item.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function ValueBox({ label, value }) {
  return (
    <div className="value-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryMetric({ label, value, accent }) {
  return (
    <article className={`summary-metric ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function readStoredFavoriteIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeStoredFavoriteIds(favoriteIds) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
  } catch {
    // Ignore storage issues and keep the UI usable.
  }
}

function createEmptyTradeSide(count = TRADE_SLOT_COUNT) {
  return Array.from({ length: count }, () => ({
    itemId: null,
    quantity: 1,
    variant: null
  }));
}

function createEmptyTradeSearch(count = TRADE_SLOT_COUNT) {
  return Array.from({ length: count }, () => "");
}

function normalizeTradeName(value) {
  return String(value || "").trim().toLowerCase();
}

function clampTradeQuantity(value) {
  const numeric = Number.parseInt(value, 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return 1;
  }

  return Math.min(numeric, 99);
}

function getTradeSideTotal(slots, itemLookup) {
  return slots.reduce((sum, slot) => {
    if (!slot.itemId) {
      return sum;
    }

    const item = itemLookup.get(slot.itemId);
    const value = getSlotValue(item, slot);

    return sum + value * slot.quantity;
  }, 0);
}

function getTradeSideEbayTotal(slots, itemLookup) {
  const total = slots.reduce((sum, slot) => {
    if (!slot.itemId) {
      return sum;
    }

    const item = itemLookup.get(slot.itemId);
    const value = item?.current?.ebay?.totalPrice;

    if (value == null) {
      return sum;
    }

    return sum + value * slot.quantity;
  }, 0);

  return total ? Number(total.toFixed(2)) : null;
}

function getTradeVerdict(yourTotal, theirTotal) {
  if (yourTotal === theirTotal) {
    return "Fair";
  }

  if (theirTotal > yourTotal) {
    return "Win";
  }

  return "Loss";
}

function hasChartableData(item) {
  return Array.isArray(item?.history) && item.history.length >= 2;
}

function summarizeHistory(item) {
  const history = Array.isArray(item?.history) ? item.history : [];

  if (history.length < 2) {
    return "Muted";
  }

  const latest = history[history.length - 1];
  const earliest = history[0];
  const supremeShift =
    (latest?.supremeValue ?? 0) - (earliest?.supremeValue ?? 0);

  if (Math.abs(supremeShift) >= 50) {
    return "Live";
  }

  return "Calm";
}

function buildHistoryNote(item) {
  const latest = item?.history?.[item.history.length - 1];
  const ebayLabel = latest?.ebayPrice != null ? formatCurrency(latest.ebayPrice, latest.ebayCurrency) : "No eBay sample";
  const supremeLabel = latest?.supremeValue != null ? formatValue(latest.supremeValue) : "No Supreme sample";
  return `Latest sample ${ebayLabel} eBay / ${supremeLabel} Supreme`;
}

function buildChartSeries(item) {
  const history = Array.isArray(item?.history) ? item.history : [];
  const maxLength = Math.max(history.length, 2);
  const width = 1;
  const chartHeight = 1;

  const ebayValues = history.map((point) => point.ebayPrice).filter((value) => value != null);
  const supremeValues = history.map((point) => point.supremeValue).filter((value) => value != null);

  const ebayMin = ebayValues.length ? Math.min(...ebayValues) : 0;
  const ebayMax = ebayValues.length ? Math.max(...ebayValues) : 1;
  const supremeMin = supremeValues.length ? Math.min(...supremeValues) : 0;
  const supremeMax = supremeValues.length ? Math.max(...supremeValues) : 1;

  function scaleX(index) {
    if (maxLength <= 1) return 0;
    return (index / (maxLength - 1)) * width;
  }

  function scaleY(value, min, max) {
    if (value == null) return null;
    if (max === min) return chartHeight / 2;
    const normalized = (value - min) / (max - min);
    return chartHeight - normalized * chartHeight;
  }

  function buildLine(values, min, max) {
    const points = values
      .map((point, index) => {
        const y = scaleY(point, min, max);
        if (y == null) return null;
        return [scaleX(index), y];
      })
      .filter(Boolean);

    if (points.length < 2) {
      return { line: null, area: null };
    }

    const line = points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
      .join(" ");

    const area = `${line} L ${points[points.length - 1][0]} ${chartHeight} L ${points[0][0]} ${chartHeight} Z`;

    return { line, area };
  }

  return {
    ebayPoints: buildLine(history.map((point) => point.ebayPrice), ebayMin, ebayMax),
    supremePoints: buildLine(history.map((point) => point.supremeValue), supremeMin, supremeMax)
  };
}

function formatTimestamp(value) {
  if (!value) return "Never";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Recently";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function compactDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "--";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short"
  }).format(d);
}

function signedValue(value) {
  if (value == null) return "--";
  if (value > 0) return `+${formatValue(value)}`;
  return formatValue(value);
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}


