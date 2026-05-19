// godlywatch — v2 components.
// One opinionated direction. Item card = mini graded-slab with a real
// eBay-vs-Supreme overlay chart, condensed display type, bar gauges, and
// no decorative cruft. Page chrome = wordmark + portfolio bar + scrolling
// recent-sales ticker + tier-filter sidebar (Steam inventory feel).

const G = {
  bg: '#0d0b14',
  bgDeep: '#08070d',
  card: '#16131f',
  cardHi: '#1c1828',
  sidebar: '#110f19',
  line: 'rgba(255,255,255,0.06)',
  lineHi: 'rgba(255,255,255,0.10)',
  ink: '#ece8df',           // cream-tinted near-white
  inkDim: 'rgba(236,232,223,0.62)',
  inkFaint: 'rgba(236,232,223,0.36)',
  inkGhost: 'rgba(236,232,223,0.18)',
  up: 'oklch(0.74 0.16 145)',    // green (appreciating)
  down: 'oklch(0.65 0.2 25)',     // red (depreciating)
  // Tier colors — used as outlines/stripes, never as fills
  legend: 'oklch(0.72 0.18 295)',
  godly:  'oklch(0.72 0.2 350)',
  ancient:'oklch(0.78 0.16 60)',
  vintage:'oklch(0.7 0.14 220)',
  fontDisplay: '"Saira Condensed", "Arial Narrow", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',
  fontText: 'system-ui, sans-serif',
};

// ─────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────

// Subtle item placeholder. Diagonal grain + tier radial glow.
// Always square so the grid stays tidy.
function ItemArt({ tierColor, label, ratio = 1.4 }) {
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: ratio,
      background: `radial-gradient(60% 50% at 50% 55%, ${tierColor}22, transparent 70%), repeating-linear-gradient(135deg, rgba(255,255,255,0.018) 0 6px, transparent 6px 12px), ${G.bgDeep}`,
      borderBottom: `1px solid ${G.line}`,
      display: 'grid', placeItems: 'center',
      overflow: 'hidden',
    }}>
      <span style={{
        fontFamily: G.fontMono, fontSize: 10, letterSpacing: '0.06em',
        color: G.inkGhost,
      }}>{label}</span>
    </div>
  );
}

// Dual-line sparkline: eBay € (solid) + Supreme value normalized (dashed).
// data: { ebay: [], supreme: [] }, each 0..N numeric.
function DualLine({ data, height = 44, upTone = G.up }) {
  const w = 100, h = 60;
  function norm(series) {
    const max = Math.max(...series), min = Math.min(...series);
    const range = max - min || 1;
    return series.map((v, i) => [
      (i / (series.length - 1)) * w,
      h - ((v - min) / range) * (h - 8) - 4,
    ]);
  }
  function path(pts) {
    return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  }
  const ebayPts = norm(data.ebay);
  const supPts = norm(data.supreme);

  const fillId = 'fill_' + Math.random().toString(36).slice(2, 7);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
         style={{ width: '100%', height, display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={upTone} stopOpacity="0.22" />
          <stop offset="100%" stopColor={upTone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* eBay fill area */}
      <path d={path(ebayPts) + ` L ${w} ${h} L 0 ${h} Z`} fill={`url(#${fillId})`} />
      {/* Supreme dashed line — book value */}
      <path d={path(supPts)} fill="none" stroke={G.inkFaint} strokeWidth="1"
            strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      {/* eBay solid line — actual sales */}
      <path d={path(ebayPts)} fill="none" stroke={upTone} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Bar gauge: 5 segments, value/5 filled. Compact, replaces pip dots.
function Gauge({ value, max = 5, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{
        fontFamily: G.fontMono, fontSize: 9, letterSpacing: '0.12em',
        color: G.inkFaint, textTransform: 'uppercase',
      }}>{label}</span>
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4,
            background: i < value ? color : 'rgba(255,255,255,0.06)',
            borderRadius: 1,
          }} />
        ))}
      </div>
      <span style={{ fontFamily: G.fontMono, fontSize: 10, color: G.inkDim, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

// 7-day trend %, shown on the eBay series alone (eBay and Supreme aren't
// directly convertible at a fixed rate, so we don't try).
function TrendTag({ trend }) {
  const up = trend >= 0;
  const pct = Math.abs(trend * 30); // scale the drift to a real-ish %
  const c = up ? G.up : G.down;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: G.fontMono, fontSize: 10, color: c,
      padding: '1px 5px', borderRadius: 3,
      background: `${c}14`,
    }}>
      <span>{up ? '▲' : '▼'}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
      <span style={{ color: G.inkFaint, fontSize: 9, letterSpacing: '0.08em' }}>7D</span>
    </span>
  );
}

function formatSV(n) {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ─────────────────────────────────────────────────────────────
// THE card
// ─────────────────────────────────────────────────────────────
function Card({ item }) {
  const c = item.tierColor;
  return (
    <div style={{
      position: 'relative',
      background: G.card,
      borderRadius: 6,
      border: `1px solid ${G.line}`,
      overflow: 'hidden',
      fontFamily: G.fontText,
      color: G.ink,
      // Top tier stripe
      boxShadow: `inset 0 3px 0 0 ${c}`,
    }}>
      {/* Serial number top-right */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 2,
        fontFamily: G.fontMono, fontSize: 9, color: G.inkFaint,
        letterSpacing: '0.1em',
      }}>
        #{item.serial}
      </div>

      {/* Star/fav top-left when favorited */}
      {item.favorited && (
        <div style={{
          position: 'absolute', top: 8, left: 10, zIndex: 2,
          color: G.up, fontSize: 12,
        }}>★</div>
      )}

      <div style={{ paddingTop: 3 }}>
        <ItemArt tierColor={c} label={item.slot} ratio={1.45} />
      </div>

      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Tier label — date sits below to avoid wrapping */}
        <div style={{
          fontFamily: G.fontMono, fontSize: 9.5, letterSpacing: '0.18em',
          color: c, textTransform: 'uppercase', fontWeight: 600,
        }}>{item.tier}</div>

        {/* Name — fixed 2-line slot so every card aligns */}
        <h3 style={{
          margin: 0, fontFamily: G.fontDisplay, fontWeight: 600,
          fontSize: 24, lineHeight: 0.95, letterSpacing: '-0.005em',
          color: G.ink,
          minHeight: '2em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{item.name}</h3>

        {/* Price row: eBay + Supreme side-by-side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: G.fontMono, fontSize: 9, letterSpacing: '0.14em',
              color: G.inkFaint, textTransform: 'uppercase',
            }}>eBay</div>
            <div style={{
              fontFamily: G.fontDisplay, fontWeight: 500, fontSize: 22,
              lineHeight: 1, marginTop: 3, fontVariantNumeric: 'tabular-nums',
            }}>€{item.ebay.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div style={{
              fontFamily: G.fontMono, fontSize: 9, letterSpacing: '0.14em',
              color: G.inkFaint, textTransform: 'uppercase',
            }}>Supreme</div>
            <div style={{
              fontFamily: G.fontDisplay, fontWeight: 500, fontSize: 22,
              lineHeight: 1, marginTop: 3, fontVariantNumeric: 'tabular-nums',
            }}>{formatSV(item.supreme)}</div>
          </div>
        </div>

        {/* Trend + chart */}
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 4,
          }}>
            <TrendTag trend={item.trend} />
            <span style={{
              fontFamily: G.fontMono, fontSize: 9, color: G.inkFaint, letterSpacing: '0.12em',
            }}>{item.checkedShort}</span>
          </div>
          <DualLine data={item.history} height={32}
                    upTone={item.trend >= 0 ? G.up : G.down} />
          {/* Mini legend */}
          <div style={{
            display: 'flex', gap: 10, marginTop: 4,
            fontFamily: G.fontMono, fontSize: 8, letterSpacing: '0.1em',
            color: G.inkFaint, textTransform: 'uppercase',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 1.5, background: item.trend >= 0 ? G.up : G.down }} />
              eBay
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 1.5, background: G.inkFaint, opacity: 0.7,
                backgroundImage: `repeating-linear-gradient(90deg, ${G.inkFaint} 0 2px, transparent 2px 4px)`,
              }} />
              SV
            </span>
          </div>
        </div>

        {/* Gauges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          <Gauge value={item.demand} color={G.up} label="DEM" />
          <Gauge value={item.rarity} color={c} label="RAR" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page chrome: wordmark + portfolio + ticker + sidebar
// ─────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px',
      background: G.bg,
      borderBottom: `1px solid ${G.line}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 22 }}>
        <div style={{
          fontFamily: G.fontDisplay, fontSize: 26, fontWeight: 700,
          letterSpacing: '-0.005em', color: G.ink,
        }}>
          godly<span style={{ color: G.up }}>watch</span>
          <span style={{
            marginLeft: 8, fontFamily: G.fontMono, fontSize: 10,
            color: G.inkFaint, letterSpacing: '0.18em', fontWeight: 400,
          }}>BETA</span>
        </div>
        <nav style={{ display: 'flex', gap: 6 }}>
          {[
            ['Board', true],
            ['Values', false],
            ['Trade Checker', false],
            ['Inventory Tracker', false],
            ['Recent Changes', false],
            ['Seller Dashboard', false],
          ].map(([t, on]) => (
            <span key={t} style={{
              padding: '7px 14px', borderRadius: 8,
              fontFamily: G.fontDisplay, fontSize: 14, fontWeight: 600,
              letterSpacing: '0.01em',
              background: on ? G.cardHi : G.bgDeep,
              border: `1px solid ${on ? G.lineHi : G.line}`,
              color: on ? G.ink : G.inkDim,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>{t}</span>
          ))}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{
          padding: '6px 10px', borderRadius: 4,
          border: `1px solid ${G.lineHi}`, background: G.bgDeep,
          fontFamily: G.fontMono, fontSize: 11, color: G.inkDim,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ opacity: 0.7 }}>⌕</span>
          <span>search 184 items</span>
          <span style={{ marginLeft: 4, padding: '0 4px', borderRadius: 3, background: G.cardHi, color: G.inkFaint, fontSize: 9 }}>⌘K</span>
        </div>
      </div>
    </div>
  );
}

function Ticker({ items }) {
  // Recent-sales ticker. Doubles the list so the CSS marquee can loop.
  const row = items.concat(items);
  return (
    <div style={{
      background: G.bgDeep,
      borderBottom: `1px solid ${G.line}`,
      position: 'relative', overflow: 'hidden',
      height: 36,
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 96, zIndex: 2, display: 'flex', alignItems: 'center',
        padding: '0 14px',
        background: `linear-gradient(90deg, ${G.bgDeep} 70%, transparent)`,
        fontFamily: G.fontMono, fontSize: 10, letterSpacing: '0.18em',
        color: G.up, textTransform: 'uppercase',
      }}>
        ● LIVE
      </div>
      <div style={{
        display: 'flex', gap: 28, whiteSpace: 'nowrap',
        animation: 'gw-marquee 60s linear infinite',
        height: '100%', alignItems: 'center', paddingLeft: 100,
      }}>
        {row.map((s, i) => (
          <span key={i} style={{
            fontFamily: G.fontMono, fontSize: 11, color: G.inkDim,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 1, background: s.tierColor,
              display: 'inline-block',
            }} />
            <span style={{ color: G.ink }}>{s.name}</span>
            <span>sold</span>
            <span style={{ color: G.up }}>€{s.price.toFixed(2)}</span>
            <span style={{ color: G.inkFaint }}>· {s.ago} ago</span>
            <span style={{ color: G.inkGhost, padding: '0 4px' }}>│</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ tierCounts, activeTier, onTier }) {
  return (
    <aside style={{
      width: 240, flex: '0 0 240px',
      background: G.sidebar,
      borderRight: `1px solid ${G.line}`,
      padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 26,
    }}>
      <div>
        <div style={{
          fontFamily: G.fontMono, fontSize: 10, color: G.inkFaint,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10,
        }}>Tier</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tierCounts.map(t => {
            const active = t.key === activeTier;
            return (
              <div key={t.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 8px', borderRadius: 4,
                background: active ? G.cardHi : 'transparent',
                cursor: 'pointer',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 1,
                    background: t.color ?? G.inkFaint,
                  }} />
                  <span style={{
                    fontFamily: G.fontDisplay, fontWeight: 500, fontSize: 16,
                    color: active ? G.ink : G.inkDim,
                  }}>{t.label}</span>
                </span>
                <span style={{
                  fontFamily: G.fontMono, fontSize: 11, color: G.inkFaint,
                  fontVariantNumeric: 'tabular-nums',
                }}>{t.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{
          fontFamily: G.fontMono, fontSize: 10, color: G.inkFaint,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10,
        }}>Filter</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['★ Favorites', '24'],
            ['Movers today', '17'],
            ['Stable 7d', '92'],
            ['New listings', '6'],
          ].map(([l, n]) => (
            <div key={l} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px', cursor: 'pointer',
            }}>
              <span style={{
                fontFamily: G.fontText, fontSize: 14, color: G.inkDim,
              }}>{l}</span>
              <span style={{
                fontFamily: G.fontMono, fontSize: 10, color: G.inkFaint,
              }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{
          fontFamily: G.fontMono, fontSize: 10, color: G.inkFaint,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10,
        }}>Sort</div>
        <div style={{
          padding: '8px 10px', borderRadius: 4,
          border: `1px solid ${G.lineHi}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: G.fontText, fontSize: 13, color: G.ink,
        }}>
          <span>Most-watched</span>
          <span style={{ color: G.inkFaint }}>▾</span>
        </div>
      </div>

      <div style={{ marginTop: 'auto', borderTop: `1px solid ${G.line}`, paddingTop: 16 }}>
        <div style={{
          fontFamily: G.fontMono, fontSize: 9, color: G.inkFaint,
          letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6,
        }}>Last refresh</div>
        <div style={{ fontFamily: G.fontMono, fontSize: 12, color: G.ink }}>
          2 min ago · auto
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

function gen(seed, base, drift) {
  const arr = [];
  let v = base;
  for (let i = 0; i < 30; i++) {
    const w = Math.sin(i * 0.55 + seed) * (base * 0.06)
            + Math.cos(i * 0.27 + seed * 1.7) * (base * 0.04);
    v += w + drift;
    arr.push(Math.round(v * 100) / 100);
  }
  return arr;
}

function mkItem(seed, opts) {
  return {
    serial: String(seed * 73 % 99999).padStart(5, '0'),
    checkedShort: opts.checked ?? '18 MAY · 17:37',
    slot: (opts.name || 'item').toLowerCase().replace(/\s+/g, '-') + '.png',
    history: {
      ebay: gen(seed, opts.ebay, opts.trend * 0.3),
      supreme: gen(seed + 7, opts.supreme, opts.trend * (opts.supreme / opts.ebay) * 0.3),
    },
    trend: opts.trend,
    ...opts,
  };
}

const ITEMS_V2 = [
  mkItem(1,  { name: 'Orion Lance',     tier: 'Legend',  tierColor: G.legend,  ebay: 50.33, supreme: 3200, demand: 5, rarity: 3, favorited: true,  trend:  0.4 }),
  mkItem(2,  { name: 'Cobalt Crow',     tier: 'Godly',   tierColor: G.godly,   ebay: 51.99, supreme: 2050, demand: 5, rarity: 3, favorited: true,  trend: -0.3, checked: '18 MAY · 15:54' }),
  mkItem(3,  { name: 'Patriot Mk II',   tier: 'Vintage', tierColor: G.vintage, ebay:  3.00, supreme:   25, demand: 2, rarity: 2, favorited: false, trend:  0.1, checked: '18 MAY · 15:54' }),
  mkItem(4,  { name: 'Aurora Slab',     tier: 'Ancient', tierColor: G.ancient, ebay: 11.16, supreme:   15, demand: 2, rarity: 3, favorited: false, trend: -0.06,checked: '18 MAY · 16:56' }),
  mkItem(5,  { name: 'Halcyon Edge',    tier: 'Legend',  tierColor: G.legend,  ebay: 78.40, supreme: 4800, demand: 4, rarity: 4, favorited: false, trend:  0.5, checked: '18 MAY · 14:12' }),
  mkItem(6,  { name: 'Verdant Spear',   tier: 'Godly',   tierColor: G.godly,   ebay: 22.18, supreme: 1200, demand: 4, rarity: 2, favorited: false, trend:  0.2, checked: '18 MAY · 11:40' }),
  mkItem(7,  { name: 'Solstice Blade',  tier: 'Ancient', tierColor: G.ancient, ebay:  6.50, supreme:   80, demand: 3, rarity: 4, favorited: false, trend: -0.1, checked: '17 MAY · 23:01' }),
  mkItem(8,  { name: 'Mirage Coil',     tier: 'Godly',   tierColor: G.godly,   ebay: 14.90, supreme:  640, demand: 3, rarity: 3, favorited: true,  trend:  0.15,checked: '18 MAY · 09:18' }),
  mkItem(9,  { name: 'Tempest Bow',     tier: 'Legend',  tierColor: G.legend,  ebay: 64.20, supreme: 4100, demand: 5, rarity: 4, favorited: false, trend:  0.6, checked: '18 MAY · 08:04' }),
  mkItem(10, { name: 'Frostmaul',       tier: 'Ancient', tierColor: G.ancient, ebay:  9.40, supreme:  120, demand: 3, rarity: 5, favorited: false, trend: -0.2, checked: '17 MAY · 22:50' }),
  mkItem(11, { name: 'Aether Whip',     tier: 'Godly',   tierColor: G.godly,   ebay: 18.55, supreme:  870, demand: 4, rarity: 2, favorited: false, trend:  0.1, checked: '18 MAY · 12:22' }),
  mkItem(12, { name: 'Nova Sigil',      tier: 'Legend',  tierColor: G.legend,  ebay: 92.10, supreme: 5400, demand: 5, rarity: 5, favorited: true,  trend:  0.8, checked: '18 MAY · 13:33' }),
  mkItem(13, { name: 'Saber X',         tier: 'Vintage', tierColor: G.vintage, ebay:  4.20, supreme:   40, demand: 1, rarity: 1, favorited: false, trend:  0.0, checked: '18 MAY · 10:11' }),
  mkItem(14, { name: 'Twilight Bloom',  tier: 'Legend',  tierColor: G.legend,  ebay: 55.00, supreme: 3400, demand: 4, rarity: 3, favorited: false, trend:  0.3, checked: '18 MAY · 07:48' }),
  mkItem(15, { name: 'Vortex Trident',  tier: 'Godly',   tierColor: G.godly,   ebay: 24.99, supreme: 1500, demand: 4, rarity: 4, favorited: false, trend:  0.2, checked: '18 MAY · 06:12' }),
];

const TIERS_V2 = [
  { key: 'all',     label: 'All',     count: 184, color: null },
  { key: 'legend',  label: 'Legend',  count: 24,  color: G.legend },
  { key: 'godly',   label: 'Godly',   count: 87,  color: G.godly },
  { key: 'ancient', label: 'Ancient', count: 38,  color: G.ancient },
  { key: 'vintage', label: 'Vintage', count: 35,  color: G.vintage },
];

const TICKER_V2 = [
  { name: 'Nova Sigil',     price: 92.10, ago: '4m',  tierColor: G.legend },
  { name: 'Cobalt Crow',    price: 51.99, ago: '11m', tierColor: G.godly },
  { name: 'Halcyon Edge',   price: 78.40, ago: '18m', tierColor: G.legend },
  { name: 'Mirage Coil',    price: 14.90, ago: '24m', tierColor: G.godly },
  { name: 'Orion Lance',    price: 50.33, ago: '32m', tierColor: G.legend },
  { name: 'Frostmaul',      price:  9.40, ago: '47m', tierColor: G.ancient },
  { name: 'Aether Whip',    price: 18.55, ago: '1h',  tierColor: G.godly },
  { name: 'Tempest Bow',    price: 64.20, ago: '1h',  tierColor: G.legend },
  { name: 'Aurora Slab',    price: 11.16, ago: '2h',  tierColor: G.ancient },
];

Object.assign(window, { G, Card, TopBar, Ticker, Sidebar, ITEMS_V2, TIERS_V2, TICKER_V2 });
