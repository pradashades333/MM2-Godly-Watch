import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  getMarketData,
  getMarketStats,
  getRecentMoves
} from "./api/marketApi";
import { calculateMarketStats } from "./utils/calculateMarketStats";
import { formatCurrency } from "./utils/formatCurrency";
import { formatValue } from "./utils/formatValue";

const TABS = [
  { id: "board", label: "Board" },
  { id: "trade-checker", label: "Trade Checker" },
  { id: "inventory-tracker", label: "Inventory Tracker" },
  { id: "seller-dashboard", label: "Seller Dashboard" }
];

const FAVORITES_STORAGE_KEY = "mm2-goldywatch-favorites";
const INVENTORY_STORAGE_KEY  = "mm2-goldywatch-inventory";
const TRADE_SLOT_COUNT = 4;

function readStoredInventory() {
  try { return JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY)) || []; }
  catch { return []; }
}
function writeStoredInventory(inv) {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inv));
}

// ── Module-level helpers ─────────────────────────────────────────────────────

function deriveTier(item) {
  const value = item.current?.supreme?.value ?? 0;
  const name = (item.name ?? '').toLowerCase();
  if (item.category === 'sets') {
    if (name.includes('chroma')) return { key: 'legend', label: 'LEGEND', color: 'var(--tier-legend)' };
    return { key: 'sets', label: 'SETS', color: 'var(--tier-vintage)' };
  }
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

function GWCard({ item, isFavorite, onToggleFavorite, onOpenChart }) {
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
            src={item.imageUrl}
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

function GWListRow({ item, index, isFavorite, onToggleFavorite, onOpenChart }) {
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
            ? <img src={item.imageUrl} alt={item.name} onError={e => { e.currentTarget.style.display = 'none'; }} />
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
        <button
          className={`gw-row-star${isFavorite ? ' active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
        >{isFavorite ? '★' : '☆'}</button>
      </td>
    </tr>
  );
}

function GWListView({ items, favoriteIds, onToggleFavorite, onOpenChart }) {
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

function GWSidebar({ items, activeTier, onTierChange, activeFilter, onFilterChange, sortBy, onSortChange, refreshedAt, favoriteIds, recentMoves }) {
  const tierCounts = useMemo(() => {
    const counts = { legend: 0, godly: 0, ancient: 0, sets: 0 };
    items.forEach(item => {
      const t = deriveTier(item);
      if (counts[t.key] != null) counts[t.key]++;
    });
    return [
      { key: 'all', label: 'All', count: items.length, color: null },
      { key: 'legend', label: 'Legend', count: counts.legend, color: 'var(--tier-legend)' },
      { key: 'godly', label: 'Godly', count: counts.godly, color: 'var(--tier-godly)' },
      { key: 'ancient', label: 'Ancient', count: counts.ancient, color: 'var(--tier-ancient)' },
      { key: 'sets', label: 'Sets', count: counts.sets, color: 'var(--tier-vintage)' },
    ];
  }, [items]);

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

      <div>
        <div className="gw-sidebar-section-label">Sort</div>
        <select className="gw-sort-select" value={sortBy} onChange={e => onSortChange(e.target.value)}>
          <option value="name">Name A–Z</option>
          <option value="value-desc">Highest value</option>
          <option value="value-asc">Lowest value</option>
          <option value="ebay-desc">Highest eBay price</option>
        </select>
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
  const [activeTab, setActiveTab] = useState("board");
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
  const [haveTradeSlots, setHaveTradeSlots] = useState(createEmptyTradeSide);
  const [wantTradeSlots, setWantTradeSlots] = useState(createEmptyTradeSide);
  const [haveTradeSearch, setHaveTradeSearch] = useState(createEmptyTradeSearch);
  const [wantTradeSearch, setWantTradeSearch] = useState(createEmptyTradeSearch);
  const [activeTier, setActiveTier] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [inventoryItems, setInventoryItems] = useState(readStoredInventory);
  const [inventorySearch, setInventorySearch] = useState("");
  const [invTimeframe, setInvTimeframe] = useState('3M');
  const [invChartMode, setInvChartMode] = useState('eur');
  const [announcementDismissed, setAnnouncementDismissed] = useState(
    () => localStorage.getItem('gw-announce-v1') === '1'
  );
  const [tradePickerState, setTradePickerState] = useState(null); // { sideKey, slotIndex }
  const [tradePickerSearch, setTradePickerSearch] = useState("");

  const deferredQuery = useDeferredValue(query);
  const items = marketData.items || [];
  const derivedStats = calculateMarketStats(items);

  const itemLookup = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  const itemNameLookup = useMemo(
    () =>
      new Map(items.map((item) => [normalizeTradeName(item.name), item.id])),
    [items]
  );

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    writeStoredFavoriteIds(favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    writeStoredInventory(inventoryItems);
  }, [inventoryItems]);

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

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [market, stats, moves] = await Promise.all([
        getMarketData(),
        getMarketStats(),
        getRecentMoves()
      ]);

      setMarketData(market);
      setServerStats(stats);
      setRecentMoves(moves);
    } catch (err) {
      setError(err.message || "Unable to load market data.");
    } finally {
      setLoading(false);
    }
  }


  const categories = useMemo(() => {
    return ["all", ...new Set(items.map((item) => item.category).filter(Boolean))];
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;

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
  }, [items, deferredQuery, categoryFilter, sortBy]);

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
              itemId
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
    setHaveTradeSlots(createEmptyTradeSide());
    setWantTradeSlots(createEmptyTradeSide());
    setHaveTradeSearch(createEmptyTradeSearch());
    setWantTradeSearch(createEmptyTradeSearch());
  }

  function openTradePicker(sideKey, slotIndex) {
    setTradePickerState({ sideKey, slotIndex });
    setTradePickerSearch("");
  }

  function closeTradePicker() {
    setTradePickerState(null);
    setTradePickerSearch("");
  }

  function selectTradeItem(itemId) {
    if (!tradePickerState) return;
    updateTradeSlot(tradePickerState.sideKey, tradePickerState.slotIndex, itemId);
    closeTradePicker();
  }

  function renderTradePicker() {
    if (!tradePickerState) return null;

    const q = tradePickerSearch.trim().toLowerCase();
    const filtered = q
      ? items.filter(i => i.name.toLowerCase().includes(q))
      : items;

    const tiers = [
      { key: 'legend', label: 'Legend', color: 'var(--tier-legend)' },
      { key: 'godly',  label: 'Godly',  color: 'var(--tier-godly)'  },
      { key: 'ancient',label: 'Ancient',color: 'var(--tier-ancient)' },
      { key: 'sets',   label: 'Sets',   color: 'var(--tier-vintage)' },
    ];
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
              placeholder="Search weapons..."
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
                    <button key={item.id} className="tp-item" onClick={() => selectTradeItem(item.id)}>
                      {item.imageUrl
                        ? <img src={item.imageUrl} className="tp-item-img" alt="" />
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
    return (
      <section className="trade-checker-panel">
        <h1 className="trade-checker-title">Trade Checker</h1>

        <div className="trade-intro-card">
          Welcome to the MM2Values Trade Checker. This tool lets you compare two trade sides
          using the tracked Supreme values from your rebuilt backend. Weapons are stackable,
          quantities multiply item value, and the verdict below tells you whether the offer is
          a Win, Fair, or Loss.
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
          {renderTradeSlots("have", haveTradeSlots, haveTradeSearch, "Weapons You Have", "trade-have")}
          {renderTradeSlots("want", wantTradeSlots, wantTradeSearch, "Weapons They Offer", "trade-want")}
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

    const primaryTotal = invChartMode === 'sv' ? totalSV : totalEbay;
    const secondaryTotal = invChartMode === 'sv' ? totalEbay : totalSV;
    const chartColor = invChartMode === 'sv' ? '#b794f4' : '#5eff8d';

    const portfolioSeries = buildPortfolioSeries(inventoryWithItems, invChartMode);
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
        value: (item.current?.ebay?.totalPrice ?? 0) * qty,
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
                    {item.imageUrl && <img src={item.imageUrl} className="inv2-suggestion-img" alt="" />}
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
              <p className="inv2-page-sub">Track your MM2 portfolio. Saved in your browser.</p>
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
            <p className="inv2-page-sub">Track your MM2 portfolio. Saved in your browser.</p>
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
                    <span className="inv2-portfolio-val" style={{ color: invChartMode === 'sv' ? '#b794f4' : 'var(--ink)' }}>
                      {invChartMode === 'sv'
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
                    {invChartMode === 'eur' && totalSV > 0 && (
                      <span className="inv2-secondary-val">{formatSV(totalSV)} <span style={{ color: 'var(--ink-faint)' }}>SV</span></span>
                    )}
                    {invChartMode === 'sv' && totalEbay > 0 && (
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
                </div>
              </div>
              <PortfolioAreaChart values={chartVals} color={chartColor} gradId={`inv2-grad-${invChartMode}`} />
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
                    <th>eBay €</th>
                    <th>SV</th>
                    <th>7d</th>
                    <th className="c">Trend</th>
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
                              ? <img src={item.imageUrl} alt="" />
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
                        <td className="inv2-num inv2-muted">{ebay != null ? ebay.toFixed(2) : '—'}</td>
                        <td className="inv2-num inv2-muted">{sv != null ? formatSV(sv) : '—'}</td>
                        <td className="inv2-pct-td">
                          <span className={`inv2-pct-cell ${pctClass(pctVal)}`}>
                            {trendUp ? '+' : ''}{trendPct}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0 8px' }}>
                          <TrendChevron up={trendUp} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="inv2-qty">
                            <button className="inv2-qty-btn" onClick={() => updateInventoryQty(item.id, -1)}>−</button>
                            <span className="inv2-qty-num">{qty}</span>
                            <button className="inv2-qty-btn" onClick={() => updateInventoryQty(item.id, 1)}>+</button>
                          </div>
                        </td>
                        <td className="inv2-pos-cell">
                          <span className="inv2-pos-total">{posTotal != null ? `€${posTotal.toFixed(2)}` : '—'}</span>
                          <span className="inv2-pos-sv">{posSV != null ? formatSV(posSV) + ' SV' : ''}</span>
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
                    const trendUp = trend >= 0;
                    return (
                      <div key={item.id} className="inv2-mover-row">
                        <div className="inv2-mover-thumb">
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt="" />
                            : <span style={{ fontSize: 8, color: tier.color }}>{getInitials(item.name)}</span>}
                        </div>
                        <div className="inv2-mover-info">
                          <span className="inv2-mover-name">{item.name}</span>
                          <span className="inv2-mover-price">{ebay != null ? `€${ebay.toFixed(2)}` : '—'}</span>
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
                <div className="inv2-sidebar-empty">No eBay price data for allocation.</div>
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

  return (
    <div className="gw-page">
      {/* TopBar */}
      <header className="gw-topbar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="gw-wordmark">
            godly<span className="gw-wordmark-accent">watch</span>
            <span className="gw-wordmark-beta">BETA</span>
          </div>
          <nav className="gw-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`gw-nav-pill${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <a
          href="https://discord.gg/6Ad4YvhkDg"
          target="_blank"
          rel="noopener noreferrer"
          title="Join our Discord"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: '#5865F2', color: '#fff', textDecoration: 'none',
            transition: 'opacity 120ms'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="24" height="18" viewBox="0 0 20 15" fill="currentColor">
            <path d="M16.93 1.33A16.47 16.47 0 0 0 12.86.02a.06.06 0 0 0-.06.03 11.46 11.46 0 0 0-.51 1.04 15.21 15.21 0 0 0-4.57 0C7.54.7 7.3.2 7.19.05a.06.06 0 0 0-.06-.03 16.43 16.43 0 0 0-4.07 1.31.05.05 0 0 0-.03.02C.45 5.37-.27 9.3.08 13.17c0 .02.01.03.03.04a16.57 16.57 0 0 0 4.99 2.52.06.06 0 0 0 .07-.02c.38-.53.73-1.08 1.02-1.66a.06.06 0 0 0-.03-.08 10.9 10.9 0 0 1-1.56-.74.06.06 0 0 1-.01-.1l.31-.24a.06.06 0 0 1 .06-.01c3.27 1.5 6.82 1.5 10.05 0a.06.06 0 0 1 .06.01l.31.25a.06.06 0 0 1-.01.1c-.5.29-1.02.54-1.56.74a.06.06 0 0 0-.03.08c.3.58.64 1.13 1.02 1.66a.06.06 0 0 0 .07.02 16.52 16.52 0 0 0 5-2.52.06.06 0 0 0 .03-.04c.42-4.31-.7-8.21-2.96-11.6a.05.05 0 0 0-.03-.04zM6.68 10.9c-.98 0-1.8-.9-1.8-2.01s.8-2.01 1.8-2.01c1.01 0 1.82.91 1.8 2.01 0 1.11-.8 2.01-1.8 2.01zm6.65 0c-.99 0-1.8-.9-1.8-2.01s.8-2.01 1.8-2.01c1.01 0 1.81.91 1.8 2.01 0 1.11-.79 2.01-1.8 2.01z"/>
          </svg>
        </a>
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

      {/* Promo announcement */}
      {!announcementDismissed && (
        <div className="gw-announce">
          <span className="gw-announce-dot" />
          <span className="gw-announce-text">
            🎉 First <strong>20 people</strong> to join our Discord get a <strong style={{ color: 'var(--tier-vintage)' }}>free Chroma weapon</strong>!
          </span>
          <a
            className="gw-announce-btn"
            href="https://discord.gg/6Ad4YvhkDg"
            target="_blank"
            rel="noopener noreferrer"
          >Join Discord →</a>
          <button
            className="gw-announce-close"
            onClick={() => {
              localStorage.setItem('gw-announce-v1', '1');
              setAnnouncementDismissed(true);
            }}
          >×</button>
        </div>
      )}

      {/* Banners */}
      {error ? <div className="gw-banner error">{error}</div> : null}
      {loading ? <div className="gw-banner">Loading market data...</div> : null}

      {/* Board tab */}
      {!loading && activeTab === 'board' ? (
        <div className="gw-board-body">
          <GWSidebar
            items={items}
            activeTier={activeTier}
            onTierChange={t => { setActiveTier(t); setActiveFilter('all'); }}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            refreshedAt={marketData.refreshedAt}
            favoriteIds={favoriteIds}
            recentMoves={recentMoves}
          />
          <main className="gw-main">
            {/* Mobile tier filter strip */}
            <div className="gw-mobile-filters">
              {[
                { key: 'all', label: 'All', color: 'var(--ink-faint)' },
                { key: 'legend', label: 'Legend', color: 'var(--tier-legend)' },
                { key: 'godly', label: 'Godly', color: 'var(--tier-godly)' },
                { key: 'ancient', label: 'Ancient', color: 'var(--tier-ancient)' },
                { key: 'sets', label: 'Sets', color: 'var(--tier-vintage)' },
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
              <select className="gw-mobile-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="name">A–Z</option>
                <option value="value-desc">Highest SV</option>
                <option value="value-asc">Lowest SV</option>
                <option value="ebay-desc">Highest eBay</option>
              </select>
            </div>

            <div className="gw-main-header">
              <div>
                <h1 className="gw-main-title">Board</h1>
                <p className="gw-main-sub">
                  {shownCount} items · refreshed {formatTimestamp(marketData.refreshedAt)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="gw-view-toggle">
                  <button className={`gw-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}>Grid</button>
                  <button className={`gw-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>List</button>
                </div>
              </div>
            </div>
            {viewMode === 'grid' ? (
              <div className="gw-grid">
                {tierBoardItems.map((item, index) => (
                  <GWCard
                    key={item.id}
                    item={item}
                    index={index}
                    isFavorite={favoriteIds.includes(item.id)}
                    onToggleFavorite={() => toggleFavorite(item.id)}
                    onOpenChart={() => setSelectedChartItemId(item.id)}
                  />
                ))}
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

          {activeTab === "seller-dashboard" ? (
            <div className="gw-tab-content">
              <div className="gw-placeholder-panel">
                <span className="gw-placeholder-badge">In Progress</span>
                <h1 className="gw-placeholder-title">Seller Dashboard</h1>
                <p className="gw-placeholder-text">
                  Surface best eBay listings, watch targets, price mismatch alerts,
                  and item-level selling signals built from your tracked market data.
                </p>
              </div>
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

function PortfolioAreaChart({ values, color = '#5eff8d', gradId = 'inv2-area-grad' }) {
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
  return (
    <div className="inv2-chart">
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
        <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="4"
          fill="var(--bg)" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="8"
          fill={color} opacity="0.15" vectorEffect="non-scaling-stroke" />
      </svg>
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
            { label: 'eBay Price', value: ebayPrice != null ? `€${ebayPrice.toFixed(2)}` : '--' },
            { label: 'Supreme Value', value: formatSV(supValue) },
            { label: '7D Trend', value: `${trend >= 0 ? '+' : ''}${trendPct}%`, color: trendColor },
          ].map(s => (
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
          <img className="trade-slot-image" src={item.imageUrl} alt={item.name} />
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

function createEmptyTradeSide() {
  return Array.from({ length: TRADE_SLOT_COUNT }, () => ({
    itemId: null,
    quantity: 1
  }));
}

function createEmptyTradeSearch() {
  return Array.from({ length: TRADE_SLOT_COUNT }, () => "");
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
    const value = item?.current?.supreme?.value ?? 0;

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

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function compactDate(value) {
  if (!value) return "--";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
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
