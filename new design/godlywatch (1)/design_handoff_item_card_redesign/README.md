# Handoff: godlywatch — Item Card & Inventory Redesign

## Overview

A redesign of the item-tracking inventory grid for **godlywatch**, an app that tracks Roblox MM2 items by comparing **eBay sale prices (EUR)** against **SupremeValues book values (SV)**. The redesign moves the UI away from a generic dashboard look toward a **trading-card / market-ticker aesthetic** — denser, more characterful, and item-forward. The primary view is a responsive inventory grid that scales to 100–200+ tracked items.

## About the Design Files

The files in `design_files/` are **design references created in HTML/JSX** — prototypes showing the intended look and behavior. They are not production code to copy verbatim. The task is to **recreate these designs in the existing godlywatch React codebase**, using its existing component patterns, routing, data-fetching, and state management.

The prototype uses inline-style React components for speed of iteration; in the real codebase these should be translated into whatever styling system godlywatch already uses (CSS Modules, Tailwind, styled-components, vanilla CSS, etc.). The visual values (colors, fonts, sizes, spacing) listed below are the source of truth — match those, not the inline-style shape.

## Fidelity

**High-fidelity.** All colors, type sizes, spacing, and component composition are final. Pixel-match these values. The only thing you should *not* literally copy is the placeholder item art — the prototype renders a striped SVG placeholder; in production, render the real item image you already store/fetch.

---

## Screens / Views

There is one primary screen in this handoff: the **Inventory** page.

### Inventory page

**Purpose:** the user's daily-driver browse view. Scan tracked items, see prices on both markets at a glance, spot movers, jump into details.

**Layout (top to bottom, left to right):**

1. **TopBar** — full-width, 56–64 px tall
2. **Ticker** — full-width, 36 px tall, scrolling marquee of recent eBay sales
3. **Body** — flex row, two columns:
   - **Sidebar** — fixed 240 px wide on the left
   - **Main** — flex 1, padded `24px 28px 60px`, contains the inventory grid

The page is dark-mode only.

#### Component: TopBar

| | |
|---|---|
| Height | auto (≈56 px), padding `14px 28px` |
| Background | `--bg` (`#0d0b14`) |
| Border-bottom | `1px solid --line` |
| Layout | flex, `space-between`, `align-items: center` |

**Left cluster:**
- **Wordmark** "godly**watch**" — the "watch" half tinted `--up` (green). Saira Condensed, 26 px, weight 700, letter-spacing `-0.005em`. Followed by a small monospace tag "BETA" (JetBrains Mono, 10 px, letter-spacing `0.18em`, color `--ink-faint`).
- **Nav pills** — match the existing godlywatch top-nav style: pill buttons, padding `7px 14px`, border-radius 8, Saira Condensed 14 px weight 600, letter-spacing `0.01em`, `white-space: nowrap`. Inactive pill: background `--bg-deep`, border `1px solid --line`, color `--ink-dim`. Active pill: background `--card-hi`, border `1px solid --line-hi`, color `--ink`. The labels are the existing nav set: **Board, Values, Trade Checker, Inventory Tracker, Recent Changes, Seller Dashboard**. The active item for this view is `Board` (the all-items grid lives under Board, not Inventory Tracker). 6 px gap between pills.

**Right cluster:**
- **Search input** — pill, padding `6px 10px`, border-radius 4, border `1px solid --line-hi`, background `--bg-deep`, JetBrains Mono 11 px text color `--ink-dim`. Content: a `⌕` glyph (opacity 0.7) + placeholder `search 184 items` + a `⌘K` keycap (4 px padding, 3 px radius, background `--card-hi`, color `--ink-faint`, 9 px).

(No portfolio block on this view — portfolio is a concept that belongs under Inventory Tracker, not Board.)

#### Component: Ticker

| | |
|---|---|
| Height | 36 px |
| Background | `--bg-deep` |
| Border-bottom | `1px solid --line` |
| Overflow | hidden |

A horizontal marquee of recent eBay sales. To loop seamlessly, render the sales list twice in sequence and animate the inner container with:
```css
@keyframes gw-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
animation: gw-marquee 60s linear infinite;
```

**Left "LIVE" badge:**
- Absolutely positioned, 96 px wide, full ticker height.
- Background: `linear-gradient(90deg, --bg-deep 70%, transparent)` so the badge fades into the scrolling content.
- z-index 2 so it sits above the marquee.
- Content: `● LIVE` — JetBrains Mono, 10 px, letter-spacing `0.18em`, color `--up`, uppercase.

**Each sale entry (JetBrains Mono, 11 px):**
```
[tier-color square 6×6 px]  [name in --ink]  sold  [€price in --up]  · [time ago in --ink-faint]  │
```
Use a 28 px gap between sale entries; use a faint `│` separator between adjacent entries.

#### Component: Sidebar

| | |
|---|---|
| Width | 240 px, `flex: 0 0 240px` |
| Background | `--sidebar` (`#110f19`) |
| Border-right | `1px solid --line` |
| Padding | `22px 18px` |
| Layout | flex column, gap 26 px |

Three sections, each with a small-caps header (JetBrains Mono, 10 px, letter-spacing `0.18em`, color `--ink-faint`, uppercase, margin-bottom 10 px):

**1. Tier filter list:**
Rows of `padding: 7px 8px`, border-radius 4. Active row has background `--card-hi`.
- Left side: 8 × 8 px tier-color square + label (Saira Condensed, 16 px, weight 500, color `--ink` if active, `--ink-dim` if not).
- Right side: count (JetBrains Mono, 11 px, `--ink-faint`, tabular-nums).
- Tiers in this order: `All` (no color dot, use `--ink-faint`), `Legend`, `Godly`, `Ancient`, `Vintage`.

**2. Filter list:**
Rows of `padding: 6px 8px`. Plain row layout:
- Left: label (system sans, 14 px, color `--ink-dim`).
- Right: count (JetBrains Mono, 10 px, `--ink-faint`).
- Items: `★ Favorites`, `Movers today`, `Stable 7d`, `New listings`.

**3. Sort dropdown:**
Padding `8px 10px`, border-radius 4, `1px solid --line-hi`. System sans 13 px `--ink` on the left, `▾` arrow `--ink-faint` on the right. Default value: "Most-watched".

**Footer (margin-top: auto):**
- Border-top `1px solid --line`, padding-top 16.
- Small-caps "LAST REFRESH" header, then JetBrains Mono 12 px `--ink` value like `2 min ago · auto`.

#### Component: Main / Inventory grid

**Section header:**
- Flex row, `justify-content: space-between`, `align-items: baseline`, margin-bottom 18.
- Left:
  - `<h1>Board</h1>` — Saira Condensed, 32 px, weight 600. (Title mirrors the active nav pill.)
  - Sub-line — JetBrains Mono, 11 px, color `--ink-faint`, letter-spacing `0.06em`: e.g. `184 items · 17 movers today · refreshed 2 min ago`.
- Right: view-mode toggle, three pills (`Grid`, `List`, `Compact`). Padding `6px 12px`, border-radius 4, Saira Condensed 14 px weight 500. Active pill: background `--card-hi`, border `1px solid --line-hi`, color `--ink`. Inactive: transparent background, border `1px solid --line`, color `--ink-dim`.

**Grid:**
```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
gap: 14px;
```
This responsively packs 4–6 cards per row at desktop widths. **Do not** use a fixed column count — cards will clip on narrower viewports.

---

### Component: Item Card

**The hero component of this redesign.** Each card represents one tracked item.

| | |
|---|---|
| Background | `--card` (`#16131f`) |
| Border | `1px solid --line` |
| Border-radius | 6 px |
| Top edge | 3 px solid tier color, applied as `box-shadow: inset 0 3px 0 0 <tierColor>` |
| Overflow | hidden |
| Position | relative (children are absolute-positioned overlays) |

**Overlay #1 — Serial number (top-right):**
- Absolutely positioned, `top: 10px, right: 10px`, z-index 2.
- JetBrains Mono, 9 px, color `--ink-faint`, letter-spacing `0.1em`.
- Format: `#00073` (5-digit zero-padded). In production, derive deterministically from the item's DB id.

**Overlay #2 — Favorite star (top-left), only shown when favorited:**
- `top: 8px, left: 10px`, z-index 2, color `--up` (amber), 12 px.
- Use a real star glyph or icon component, not the literal `★` if you have an icon system.

**Section 1 — Item art:**
- Wrapped in a div with `padding-top: 3px` so the art clears the tier stripe.
- Aspect ratio `1.45` (slightly wider than tall — 16:11-ish).
- Border-bottom `1px solid --line`.
- In production: render the real item image from your existing image source. In the prototype this is a placeholder with a tier-colored radial glow + diagonal stripe pattern; you can keep a similar glow behind the real image to tie it visually to the tier:
  ```css
  background: radial-gradient(60% 50% at 50% 55%, <tierColor>22, transparent 70%), <imageUrl>;
  ```
  The `22` suffix is hex alpha (~13%). Object-fit: `contain` so item shapes don't distort.

**Section 2 — Card body** (`padding: 12px 14px 14px`, flex column, gap 10 px):

1. **Tier label** — JetBrains Mono, 9.5 px, letter-spacing `0.18em`, uppercase, weight 600, color = tier color. Just the tier name, e.g. `LEGEND`.

2. **Item name** (`h3`) — Saira Condensed, 24 px, weight 600, line-height `0.95`, letter-spacing `-0.005em`, color `--ink`. Clamp to 2 lines (`-webkit-line-clamp: 2`), `min-height: 2em` so every card aligns vertically.

3. **Price row** — 2-column grid, `1fr 1fr`, gap 8, items end-aligned.
   - Left cell: small-caps "EBAY" label (JetBrains Mono 9, letter-spacing `0.14em`, `--ink-faint`), then `€{value.toFixed(2)}` in Saira Condensed 22 px weight 500, tabular-nums, line-height 1.
   - Right cell: same layout, right-aligned, label "SUPREME", value formatted with `formatSV()` — `<10000` use locale string (e.g. `3,200`), `≥10000` use `1.2K` format. **Keep numbers tabular-nums** so columns of cards align cleanly.

4. **Trend tag + last-checked row** — flex `space-between`, margin-bottom 4.
   - Left: trend pill — `padding: 1px 5px`, border-radius 3, background `<color>14` (8% alpha), color = `--up` if trend ≥ 0 else `--down`. Content: `▲` or `▼`, then percent value (JetBrains Mono 10, weight 600, tabular-nums), then `7D` (JetBrains Mono 9, letter-spacing `0.08em`, `--ink-faint`).
   - Right: last-checked timestamp — JetBrains Mono 9, letter-spacing `0.12em`, `--ink-faint`. Format e.g. `18 MAY · 17:37` (compact).

5. **Dual-line chart** — 32 px tall, full card width. Renders two normalized series from 30 days of history:
   - **eBay € (solid line):** stroke = `--up` if 7-day trend up, else `--down`, stroke-width `1.5`, with a vertical gradient fill below (same color, 22% opacity at top, 0% at bottom).
   - **Supreme value (dashed line):** stroke = `--ink-faint`, stroke-width `1`, `stroke-dasharray="2 2"`.
   - Both series are independently min/max normalized into the same 0–60 SVG viewbox so trends are visually comparable even though the units differ.
   - Use `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke` so strokes don't distort.

6. **Chart legend** — flex row, gap 10, margin-top 4. JetBrains Mono 8 px, letter-spacing `0.1em`, uppercase, color `--ink-faint`. Two entries: a 8 × 1.5 px solid swatch + "EBAY", and an 8 × 1.5 px dashed swatch + "SV". This is critical: without the legend users can't tell which line is which.

7. **Demand + Rarity gauges** — flex column, gap 6, margin-top 2. Each gauge is a flex row, gap 6, with three parts:
   - Label — JetBrains Mono 9, letter-spacing `0.12em`, uppercase, `--ink-faint`. `DEM` for demand, `RAR` for rarity.
   - Bar — flex 1, height 4, made of 5 equal segments with `gap: 2px`, each segment border-radius 1. Filled segments use the gauge's color (Demand uses `--up`; Rarity uses the tier color); empty segments use `rgba(255,255,255,0.06)`.
   - Value — JetBrains Mono 10, tabular-nums, color `--ink-dim`. Single digit.

---

## Interactions & Behavior

- **Card hover:** subtle. Border color goes from `--line` to `--line-hi` over 150 ms; `translateY(-1px)` on the card root. No shadow, no glow, no scale.
- **Card click:** opens an item detail view (not designed in this handoff — flag as a follow-up).
- **Favorite toggle:** when star is tapped/clicked, optimistically toggle the overlay; persist server-side. No animation beyond a fade.
- **Ticker:** infinite CSS marquee, 60s per loop. Pause on hover (`animation-play-state: paused`) is recommended.
- **Sidebar tier row click:** filters the grid to that tier. Active state moves to the clicked row.
- **View toggle (`Grid` / `List` / `Compact`):** only Grid is designed; List and Compact are placeholders for a future round.
- **Search (`⌘K`):** opens a command palette. Not designed in this handoff.

## State Management

Per item card you need:
- `id`, `name`, `tier` (`Legend` | `Godly` | `Ancient` | `Vintage`), `tierColor` (derived from tier)
- `ebay` (number, EUR) — latest sold price on eBay
- `supreme` (number, SV) — current SupremeValues book
- `demand` (1–5), `rarity` (1–5)
- `favorited` (bool)
- `trend` (number, 7-day eBay drift; render `Math.abs(trend * 30)` as a %)
- `checkedShort` (string, formatted `DD MMM · HH:mm`)
- `history` — `{ ebay: number[30], supreme: number[30] }` — 30-day history for the chart
- `serial` (string, 5-digit zero-padded, derived from item id once)

Page-level state:
- `activeTier` (filter)
- `viewMode` (`grid` | `list` | `compact`)
- `sortBy` (default `most-watched`)
- 184 / 17 counters (derived)

---

## Design Tokens

Drop these into the existing theme system as CSS variables (or the equivalent JS object). Names below match the prototype's `G` constant in `design_files/cards-v2.jsx`.

```css
:root {
  /* Surfaces */
  --bg:       #0d0b14;
  --bg-deep:  #08070d;
  --card:     #16131f;
  --card-hi:  #1c1828;
  --sidebar:  #110f19;

  /* Lines */
  --line:    rgba(255,255,255,0.06);
  --line-hi: rgba(255,255,255,0.10);

  /* Ink */
  --ink:       #ece8df;                       /* cream-tinted near-white */
  --ink-dim:   rgba(236,232,223,0.62);
  --ink-faint: rgba(236,232,223,0.36);
  --ink-ghost: rgba(236,232,223,0.18);

  /* Movement */
  --up:   oklch(0.74 0.16 145);  /* green — appreciating */
  --down: oklch(0.65 0.2  25);   /* red — depreciating */

  /* Tiers */
  --tier-legend:  oklch(0.72 0.18 295);  /* violet */
  --tier-godly:   oklch(0.72 0.20 350);  /* rose */
  --tier-ancient: oklch(0.78 0.16  60);  /* amber-gold */
  --tier-vintage: oklch(0.70 0.14 220);  /* steel blue */
}
```

**Typography:**
- Display (names, big numbers, nav): **Saira Condensed** — weights 400, 500, 600, 700.
- Data (prices, dates, labels, ticker): **JetBrains Mono** — weights 400, 500, 600.
- Body/incidental (sidebar filter labels, sort): system-ui sans.

Load both from Google Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

**Spacing scale (informal — used inline):** 2, 4, 6, 8, 10, 12, 14, 18, 22, 28 px. No formal scale — match the values in the prototype.

**Border-radius:** 1 (gauge segments), 3 (trend pill), 4 (small chips, sidebar rows, view toggle), 6 (card root).

**No shadows** are used. Lift comes from the top tier-color stripe + 1 px borders + `translateY(-1px)` hover.

---

## Assets

- **Fonts:** Saira Condensed + JetBrains Mono — Google Fonts (linked above).
- **Item imagery:** the prototype uses placeholders. **Use the item images you already host/fetch** in the real app — no new asset work needed.
- **Icons:** the prototype uses unicode glyphs (`⌕`, `▲`, `▼`, `★`, `▾`, `●`). In production, prefer your existing icon library; the visual weight should remain light.

## Files

In `design_files/`:
- **`godlywatch redesign.html`** — the runnable prototype. Open in a browser to see the full inventory page in motion (ticker scrolls, hover works).
- **`cards-v2.jsx`** — all React components (`Card`, `Sidebar`, `TopBar`, `Ticker`, `Gauge`, `DualLine`, `TrendTag`, `ItemArt`, `formatSV`) plus the `G` palette and sample data shapes.

Both files are written in plain React + inline styles for portability. Refactor into your styling system of choice — but **keep the visual values from the Design Tokens section identical**.

## Implementation order (suggested)

1. Add the CSS variables and font links to the root theme.
2. Port the `Card` component first against your real item data shape — this is the biggest visual win.
3. Replace the existing inventory grid container with the responsive `auto-fill` grid.
4. Port `Sidebar` (filter + counts).
5. Port `TopBar` (mostly nav-pill restyling).
6. Port `Ticker` last — it's the lowest-priority piece if you're time-constrained, and needs a live recent-sales feed.

## Out of scope / Follow-ups

- Item **detail view** (clicking a card). Suggested direction: a slide-over panel showing a larger version of the dual-line chart, the full sale history, and trade/listing actions.
- `List` and `Compact` view modes.
- `⌘K` command palette.
- Empty/loading/error states for the grid.
- Mobile/tablet adaptation (the design is desktop-first; cards already responsively pack so basic shrinking works, but the sidebar will need to collapse).
