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
  { id: "values", label: "Values" },
  { id: "trade-checker", label: "Trade Checker" },
  { id: "inventory-tracker", label: "Inventory Tracker" },
  { id: "recent-changes", label: "Recent Changes" },
  { id: "seller-dashboard", label: "Seller Dashboard" }
];

const FAVORITES_STORAGE_KEY = "mm2-goldywatch-favorites";
const TRADE_SLOT_COUNT = 4;

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
        return (right.current?.ebay?.totalPriceEUR ?? -1) - (left.current?.ebay?.totalPriceEUR ?? -1);
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
        diff: item.current?.supreme?.lastChange ?? 0
      }));
  const tickerLoopItems = [...tickerItems, ...tickerItems];

  const shownCount = filteredItems.length;
  const boardItems = filteredItems;

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
              <strong>{formatCurrency(getTradeSideEbayTotal(slots, itemLookup))}</strong>
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
            <ValueBox label="Your eBay total" value={formatCurrency(yourTradeEbayTotal)} />
            <ValueBox label="Their eBay total" value={formatCurrency(theirTradeEbayTotal)} />
          </div>

          <p className="trade-summary-note">
            Don&apos;t forget to read up on our <span>Scam Prevention Tips</span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-glow glow-left" />
      <div className="background-glow glow-right" />

      <nav className="top-nav" aria-label="Primary">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === activeTab ? "nav-pill active" : "nav-pill"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="ticker-bar">
        <span className="ticker-label">Recent moves</span>
        <div className="ticker-window">
          <div className="ticker-track">
            {tickerLoopItems.map((item, index) => (
              <div key={`${item.id}-${index}`} className="ticker-pill">
                <strong>{item.name}</strong>
                <span>{formatValue(item.current)}</span>
                <em className={item.diff > 0 ? "positive" : item.diff < 0 ? "negative" : ""}>
                  {signedValue(item.diff)}
                </em>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <section className="banner error">{error}</section> : null}
      {loading ? <section className="banner">Loading market board...</section> : null}

      {!loading ? (
        <>
          <section className="hero-grid">
            <article className="hero-card">
              <p className="section-tag">Godly tracker</p>
              <h1>Track MM2 value against real eBay pricing.</h1>
              <p className="hero-copy">
                Supreme stays in value units. eBay stays in euros. This board keeps the important parts readable:
                price checks, recent movement, and the items you actually care about.
              </p>
            </article>

            <aside className="hero-sidecard">
              <button className="refresh-button" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? "Refreshing market data..." : "Refresh Market Data"}
              </button>

              <div className="side-meta">
                <p>Showing latest tracked data.</p>
                <p>eBay is running through the backend refresh flow and history snapshots are already being stored.</p>
              </div>
            </aside>
          </section>

          <section className="stat-strip">
            <MetricCard
              label="Tracked items"
              value={serverStats?.totalItems ?? 0}
              note="Current items in history"
            />
            <MetricCard
              label="Best Supreme value"
              value={
                derivedStats.topValueItem
                  ? `${derivedStats.topValueItem.name} / ${formatValue(derivedStats.topValueItem.current?.supreme?.value)}`
                  : "--"
              }
              note="Highest current item value"
            />
            <MetricCard
              label="Cheapest eBay listing"
              value={
                derivedStats.cheapestEbayItem
                  ? `${derivedStats.cheapestEbayItem.name} / ${formatCurrency(derivedStats.cheapestEbayItem.current?.ebay?.totalPriceEUR)}`
                  : "--"
              }
              note="Lowest landed price we found"
            />
            <MetricCard
              label="Last refresh"
              value={formatTimestamp(marketData.refreshedAt)}
              note="Latest saved market pull"
            />
          </section>

          <section className="filter-bar">
            <label className="filter-group search-group">
              <span>Search items</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by item name"
              />
            </label>

            <label className="filter-group">
              <span>Category</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === "all" ? "All categories" : capitalize(category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-group">
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="name">Name A-Z</option>
                <option value="value-desc">Highest value</option>
                <option value="value-asc">Lowest value</option>
                <option value="ebay-desc">Highest eBay price</option>
              </select>
            </label>

            <div className="showing-box">
              <span>Showing</span>
              <strong>{formatValue(shownCount)} items</strong>
            </div>
          </section>

          {activeTab === "board" ? (
            <>
              <section className="shelf-header">
                <div>
                  <p className="section-tag">Pinned shelf</p>
                  <h2>Favorites</h2>
                  <p>
                    Keep the items you care about most right at the top.
                  </p>
                </div>
                <div className="shelf-count">{pinnedItems.length}</div>
              </section>

              <section className="favorite-grid">
                {pinnedItems.length ? (
                  pinnedItems.map((item, index) => (
                    <BoardItemCard
                      key={item.id}
                      item={item}
                      variant="favorite"
                      index={index}
                      pinned
                      isFavorite={favoriteIds.includes(item.id)}
                      onToggleFavorite={() => toggleFavorite(item.id)}
                      onOpenChart={() => setSelectedChartItemId(item.id)}
                    />
                  ))
                ) : (
                  <article className="favorite-empty-card">
                    <p className="section-tag">No favorites yet</p>
                    <h3>Start pinning items from the board below.</h3>
                    <p>
                      Use the favorite button on any item card to build your own top shelf.
                    </p>
                  </article>
                )}
              </section>

              <section className="board-section">
                <div className="table-header">
                  <div>
                    <p className="section-tag">Board grid</p>
                    <h2>Tracked market cards</h2>
                    <p className="board-subcopy">
                      Full tracked item board with charts, values, and live pinned items above.
                    </p>
                  </div>
                </div>

                <div className="board-grid">
                  {boardItems.map((item, index) => (
                    <BoardItemCard
                      key={item.id}
                      item={item}
                      variant="board"
                      index={index}
                      isFavorite={favoriteIds.includes(item.id)}
                      onToggleFavorite={() => toggleFavorite(item.id)}
                      onOpenChart={() => setSelectedChartItemId(item.id)}
                    />
                  ))}
                </div>

                {!boardItems.length ? (
                  <article className="favorite-empty-card">
                    <p className="section-tag">No items showing</p>
                    <h3>No tracked items match this filter.</h3>
                    <p>
                      Try a broader search or switch categories.
                    </p>
                  </article>
                ) : null}
              </section>
            </>
          ) : null}

          {activeTab === "values" ? (
            <section className="alt-panel">
              <div className="panel-header">
                <p className="section-tag">Values</p>
                <h2>Full value ledger</h2>
              </div>

              <div className="ledger-grid">
                {filteredItems.map((item, index) => (
                  <article key={item.id} className="ledger-card">
                    <div className={`item-visual-stage ledger-visual visual-${index % 3}`}>
                      {item.imageUrl ? (
                        <img className="item-stage-image" src={item.imageUrl} alt={item.name} />
                      ) : (
                        <div className="item-stage-placeholder">
                          <div className="item-stage-frame" />
                          <strong>{item.name}</strong>
                          <span>{capitalize(item.category)}</span>
                        </div>
                      )}
                    </div>

                    <div className="ledger-body">
                      <div className="ledger-top">
                        <div>
                          <h3>{item.name}</h3>
                          <p>{capitalize(item.category)}</p>
                        </div>
                        <strong>{formatValue(item.current?.supreme?.value)}</strong>
                      </div>

                      <dl>
                        <div><dt>eBay</dt><dd>{formatCurrency(item.current?.ebay?.totalPriceEUR)}</dd></div>
                        <div><dt>Demand</dt><dd>{item.current?.supreme?.demand ?? "--"}</dd></div>
                        <div><dt>Rarity</dt><dd>{item.current?.supreme?.rarity ?? "--"}</dd></div>
                        <div><dt>Change</dt><dd>{signedValue(item.current?.supreme?.lastChange)}</dd></div>
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "trade-checker" ? renderTradeChecker() : null}

          {activeTab === "recent-changes" ? (
            <section className="alt-panel">
              <div className="panel-header">
                <p className="section-tag">Recent changes</p>
                <h2>Movement feed</h2>
              </div>

              <div className="moves-feed">
                {recentMoves.length ? recentMoves.map((move) => (
                  <article key={`${move.id}-${move.timestamp}`} className="move-card">
                    <div>
                      <h3>{move.name}</h3>
                      <p>{capitalize(move.category)} {" - "} {compactDate(move.timestamp)}</p>
                    </div>
                    <div className="move-side">
                      <span>{formatValue(move.previous)} to {formatValue(move.current)}</span>
                      <strong className={move.diff > 0 ? "positive" : "negative"}>{signedValue(move.diff)}</strong>
                    </div>
                  </article>
                )) : (
                  <p className="empty-state">No move history yet.</p>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "inventory-tracker" ? (
            <section className="alt-panel">
              <div className="panel-header">
                <p className="section-tag">{activeTab.replace("-", " ")}</p>
                <h2>{TABS.find((tab) => tab.id === activeTab)?.label}</h2>
              </div>

              <div className="placeholder-grid">
                <article className="placeholder-card">
                  <h3>Backend ready</h3>
                  <p>The merged item shape, recent moves, stats, and refresh flow are already usable for this screen.</p>
                </article>
                <article className="placeholder-card">
                  <h3>Best next feature</h3>
                  <p>
                    {activeTab === "inventory-tracker"
                      ? "Track owned items, quantities, and value totals over time."
                      : "Surface best listings, watch items, and mismatch alerts."}
                  </p>
                </article>
              </div>
            </section>
          ) : null}

          {activeTab === "seller-dashboard" ? (
            <section className="alt-panel coming-soon-panel">
              <div className="panel-header">
                <p className="section-tag">Seller dashboard</p>
                <h2>Coming Soon</h2>
              </div>

              <div className="coming-soon-card">
                <span className="coming-soon-badge">In Progress</span>
                <h3>Seller tools are on the way.</h3>
                <p>
                  This screen will eventually surface best listings, watch targets, mismatch alerts,
                  and item-level selling signals built from your tracked market data.
                </p>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {selectedChartItem ? (
        <ChartModal
          item={selectedChartItem}
          onClose={() => setSelectedChartItemId(null)}
        />
      ) : null}
    </div>
  );
}

function BoardItemCard({
  item,
  variant = "board",
  index = 0,
  pinned = false,
  isFavorite = false,
  onToggleFavorite,
  onOpenChart
}) {
  const chartable = hasChartableData(item);
  const historyNote = buildHistoryNote(item);

  return (
    <article className={`board-item-card ${variant === "favorite" ? "favorite-card" : ""}`}>
      <div className={`item-visual-stage visual-${index % 3}`}>
        {item.imageUrl ? (
          <img className="item-stage-image" src={item.imageUrl} alt={item.name} />
        ) : (
          <div className="item-stage-placeholder">
            <div className="item-stage-frame" />
            <strong>{item.name}</strong>
            <span>{capitalize(item.category)}</span>
          </div>
        )}
      </div>

      <div className="item-card-body">
        <div className="favorite-badges">
          {pinned ? <span>Pinned</span> : null}
          <span>{capitalize(item.category)}</span>
        </div>

        <div className="favorite-heading">
          <div>
            <h3>{item.name}</h3>
            <p>Checked {formatTimestamp(item.lastCheckedAt)}</p>
          </div>
          <div className="favorite-links">
            <span>{item.current?.supreme?.stability || "Stable"}</span>
            <span>{chartable ? "History live" : "History thin"}</span>
          </div>
        </div>

        <div className="card-actions-row">
          <button
            className={isFavorite ? "favorite-toggle active" : "favorite-toggle"}
            onClick={onToggleFavorite}
            type="button"
          >
            {isFavorite ? "Remove favorite" : "Add to favorites"}
          </button>
        </div>

        <p className="favorite-note">{historyNote}</p>

        <div className="favorite-metrics">
          <ValueBox label="Supreme value" value={formatValue(item.current?.supreme?.value)} />
          <ValueBox label="Lowest eBay price" value={formatCurrency(item.current?.ebay?.totalPriceEUR)} />
          <ValueBox label="Demand / rarity" value={`${item.current?.supreme?.demand ?? "--"} / ${item.current?.supreme?.rarity ?? "--"}`} />
        </div>

        <div className="item-chart-panel">
          <div className="item-chart-header">
            <div>
              <strong>History</strong>
              <span>{chartable ? "Live" : "Muted"}</span>
            </div>
            <button className="chart-open-button" onClick={onOpenChart}>
              Open detailed chart
            </button>
          </div>

          <div className="item-chart-legends">
            <span className="legend-pill ebay">eBay EUR</span>
            <span className="legend-pill supreme">Supreme value</span>
            <span className="legend-state">{summarizeHistory(item)}</span>
          </div>

          <div className="item-chart-surface">
            <div className="axis-label left">eBay</div>
            <div className="axis-label right">Supreme</div>
            {chartable ? (
              <DualHistoryChart item={item} compact />
            ) : (
              <div className="chart-empty-state">Not enough history yet to draw this item.</div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ChartModal({ item, onClose }) {
  const points = Array.isArray(item.history) ? item.history.length : 0;

  return (
    <div className="chart-modal-backdrop" onClick={onClose}>
      <div className="chart-modal" onClick={(event) => event.stopPropagation()}>
        <button className="chart-modal-close" onClick={onClose}>X</button>

        <div className="chart-modal-header">
          <div>
            <p className="section-tag">Detailed chart</p>
            <h2>{item.name}</h2>
          </div>
          <div className="chart-modal-stats">
            <ValueBox label="Current Supreme" value={formatValue(item.current?.supreme?.value)} />
            <ValueBox label="Current eBay" value={formatCurrency(item.current?.ebay?.totalPriceEUR)} />
            <ValueBox label="Sample count" value={formatValue(points)} />
          </div>
        </div>

        <div className="item-chart-legends modal-legends">
          <span className="legend-pill ebay">eBay EUR</span>
          <span className="legend-pill supreme">Supreme value</span>
        </div>

        <div className="chart-modal-surface">
          <div className="axis-label left">eBay</div>
          <div className="axis-label right">Supreme</div>
          {hasChartableData(item) ? (
            <DualHistoryChart item={item} />
          ) : (
            <div className="chart-empty-state">Not enough history yet to draw this item.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DualHistoryChart({ item, compact = false }) {
  const { ebayPoints, supremePoints } = buildChartSeries(item);
  const width = compact ? 320 : 760;
  const height = compact ? 150 : 280;
  const pad = compact ? 16 : 22;

  return (
    <svg
      className={compact ? "item-chart-svg compact" : "item-chart-svg"}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-label={`${item.name} history chart`}
    >
      <defs>
        <linearGradient id={`ebay-gradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(117, 217, 213, 0.42)" />
          <stop offset="100%" stopColor="rgba(117, 217, 213, 0)" />
        </linearGradient>
        <linearGradient id={`supreme-gradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(171, 140, 255, 0.35)" />
          <stop offset="100%" stopColor="rgba(171, 140, 255, 0)" />
        </linearGradient>
      </defs>

      <g className="chart-grid-lines">
        {[0.2, 0.45, 0.7, 0.95].map((line) => (
          <line
            key={line}
            x1={pad}
            x2={width - pad}
            y1={height * line}
            y2={height * line}
          />
        ))}
      </g>

      {ebayPoints.area ? (
        <path
          d={ebayPoints.area}
          fill={`url(#ebay-gradient-${item.id})`}
          opacity="0.9"
        />
      ) : null}

      {supremePoints.area ? (
        <path
          d={supremePoints.area}
          fill={`url(#supreme-gradient-${item.id})`}
          opacity="0.8"
        />
      ) : null}

      {ebayPoints.line ? (
        <path d={ebayPoints.line} className="chart-line ebay-line" />
      ) : null}

      {supremePoints.line ? (
        <path d={supremePoints.line} className="chart-line supreme-line" />
      ) : null}
    </svg>
  );
}

function buildTradeSlot({
  sideKey,
  slot,
  slotIndex,
  searchValue,
  item,
  items,
  applyTradeInput,
  updateTradeSlot,
  updateTradeQuantity,
  clearTradeSlot
}) {
  const supremeValue = item?.current?.supreme?.value ?? null;
  const ebayValue = item?.current?.ebay?.totalPriceEUR ?? null;
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
          <ValueBox label="eBay stack" value={formatCurrency(stackEbayValue)} />
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
    const value = item?.current?.ebay?.totalPriceEUR;

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
  const ebayLabel = latest?.ebayPriceEUR != null ? formatCurrency(latest.ebayPriceEUR) : "No eBay sample";
  const supremeLabel = latest?.supremeValue != null ? formatValue(latest.supremeValue) : "No Supreme sample";
  return `Latest sample ${ebayLabel} eBay / ${supremeLabel} Supreme`;
}

function buildChartSeries(item) {
  const history = Array.isArray(item?.history) ? item.history : [];
  const maxLength = Math.max(history.length, 2);
  const width = 1;
  const chartHeight = 1;

  const ebayValues = history.map((point) => point.ebayPriceEUR).filter((value) => value != null);
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
    ebayPoints: buildLine(history.map((point) => point.ebayPriceEUR), ebayMin, ebayMax),
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
