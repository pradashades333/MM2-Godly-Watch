import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  getMarketData,
  getMarketStats,
  getRecentMoves,
  refreshMarketData
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
const TRADE_SLOT_COUNT = 4;

// ── Module-level helpers ─────────────────────────────────────────────────────

function deriveTier(item) {
  const value = item.current?.supreme?.value ?? 0;
  const name = (item.name ?? '').toLowerCase();
  if (item.category === 'sets') {
    if (name.includes('chroma')) return { key: 'legend', label: 'LEGEND', color: 'var(--tier-legend)' };
    return { key: 'sets', label: 'SETS', color: 'var(--tier-vintage)' };
  }
  if (value >= 5000) return { key: 'legend', label: 'LEGEND', color: 'var(--tier-legend)' };
  if (value >= 100) return { key: 'godly', label: 'GODLY', color: 'var(--tier-godly)' };
  return { key: 'ancient', label: 'ANCIENT', color: 'var(--tier-ancient)' };
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
          <img className="gw-card-art-img" src={item.imageUrl} alt={item.name} />
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
            ? <img src={item.imageUrl} alt={item.name} />
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
  const [refreshing, setRefreshing] = useState(false);
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

  async function handleRefresh() {
    setRefreshing(true);
    setError("");

    try {
      const refreshed = await refreshMarketData();
      const stats = await getMarketStats();
      const moves = await getRecentMoves();

      startTransition(() => {
        setMarketData({
          items: refreshed.items,
          refreshedAt: refreshed.refreshedAt
        });
        setServerStats(stats);
        setRecentMoves(moves);
      });
    } catch (err) {
      setError(err.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
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
              searchValue: searchValues[slotIndex] || "",
              item: slot.itemId ? itemLookup.get(slot.itemId) : null,
              items,
              currency: "EUR",
              applyTradeInput,
              updateTradeSlot,
              updateTradeQuantity,
              clearTradeSlot
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
                <button className="refresh-button" onClick={handleRefresh} disabled={refreshing} style={{ padding: '8px 14px', fontSize: 13 }}>
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
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
              <div className="gw-placeholder-panel">
                <span className="gw-placeholder-badge">Coming Soon</span>
                <h1 className="gw-placeholder-title">Inventory Tracker</h1>
                <p className="gw-placeholder-text">
                  Track your owned items, quantities, and total portfolio value over time.
                  The backend is ready — item shapes, history, and refresh flow are all in place.
                </p>
              </div>
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
    </div>
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
  sideKey,
  slot,
  slotIndex,
  searchValue,
  item,
  items,
  currency = "EUR",
  applyTradeInput,
  updateTradeSlot,
  updateTradeQuantity,
  clearTradeSlot
}) {
  const supremeValue = item?.current?.supreme?.value ?? null;
  const ebayValue = item?.current?.ebay?.totalPrice ?? null;
  const stackSupremeValue = supremeValue != null ? supremeValue * slot.quantity : null;
  const stackEbayValue = ebayValue != null ? Number((ebayValue * slot.quantity).toFixed(2)) : null;

  return (
    <article key={`${sideKey}-${slotIndex}`} className="trade-slot-card">
      <div className={`trade-slot-tile ${item ? "filled" : "empty"}`}>
        {item?.imageUrl ? (
          <img className="trade-slot-image" src={item.imageUrl} alt={item.name} />
        ) : (
          <div className="trade-slot-visual">{item ? getInitials(item.name) : "+"}</div>
        )}

        <div className="trade-slot-overlay">
          <span className="trade-slot-number">Slot {slotIndex + 1}</span>
          <strong>{item?.name || "Choose an item"}</strong>
          <p>
            {item
              ? `${capitalize(item.category)} - ${formatValue(supremeValue)} value each`
              : "Empty trade slot"}
          </p>
        </div>
      </div>

      <div className="trade-slot-controls">
        <label className="trade-input-group trade-item-search">
          <span>Item</span>
          <input
            list="trade-item-options"
            value={searchValue}
            onChange={(event) => applyTradeInput(sideKey, slotIndex, event.target.value)}
            placeholder="Add weapon"
          />
        </label>

        <div className="trade-control-row">
          <label className="trade-input-group quantity">
            <span>Qty</span>
            <input
              type="number"
              min="1"
              max="99"
              value={slot.quantity}
              onChange={(event) => updateTradeQuantity(sideKey, slotIndex, event.target.value)}
            />
          </label>

          <label className="trade-input-group quick-pick">
            <span>Quick pick</span>
            <select
              value={slot.itemId || ""}
              onChange={(event) => updateTradeSlot(sideKey, slotIndex, event.target.value || null)}
            >
              <option value="">No item selected</option>
              {items.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
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
