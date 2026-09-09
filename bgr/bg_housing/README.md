# Dwelling Lens / Bulgaria

A responsive public-data dashboard for new-dwelling price dynamics and recent commissioning evidence in Sofia and Plovdiv. The product deliberately keeps the two official lenses separate:

- NSI quarterly House Price Index (HPI) levels describe quality-adjusted household transaction-price change for **new dwellings**.
- Municipal commissioning registers evidence permits/certificates for individual buildings, but do **not** contain transaction prices.

A third, visually separate layer adds dated commercial asking-price references from imot.bg and Yavlena. These are market offers, not achieved sale prices.

The official core therefore does not manufacture €/m² estimates or claim a transaction-level join.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

`npm run dev` starts the refresh API on port 4173 and Vite on port 5173. Open the Vite URL. For a production check:

```bash
npm run build
npm start
```

The production server serves both the built site and `/api/commercial`. Static-only variants remain available as `npm run dev:static` and `npm run preview:static`.

## Project structure

```text
src/
  App.tsx          Thin app entry
  Dashboard.tsx    UI, interactions, chart, tables, export
  content.ts       Official datasets, commentary and source links
  marketTrends.ts  Sold-versus-listing aggregation and rebasing
  styles.css       Responsive editorial design system
data/
  commercial-seed.json  Bundled commercial baseline
server/
  index.mjs        Production server and refresh API
  sources/         Bounded imot.bg and Yavlena adapters
scripts/
  read-xlsx.mjs    Zero-dependency NSI workbook inspection helper
test/
  *.test.mjs       Refresh, fetch and parser regression tests
```

The UI has no image or font downloads. Its custom SVG chart, symbols and decoration are local markup/CSS.

## Data model

### Quarterly price series

`PriceRow` contains:

- `quarter`: reference quarter (`YYYY Qn`)
- `city`: `Sofia` or `Plovdiv`
- `index`: official NSI new-dwelling HPI level, 2025 = 100
- `qoq`: official NSI published quarter-on-quarter change
- `yoy`: official NSI published year-on-year change

NSI’s published one-decimal rates are authoritative. The formulas below define the changes and are used as validation checks; recalculating from rounded two-decimal index levels can differ by 0.1 percentage point:

```text
QoQ = (index[t] / index[t-1] - 1) × 100
YoY = (index[t] / index[t-4] - 1) × 100
```

The primary dashboard and downloadable table default to the latest eight published quarters, Q2 2024–Q1 2026. The extra Q1 2024 observation is retained as a context/baseline row and can be revealed in the chart.

### Commissioning sample

`CommissioningRecord` contains a public-register reference, date, city, construction-category label where available, project description, district, cadastral/address locator and official detail URL.

The eligibility window is 31 July 2024–31 July 2026. Displayed rows are an explicitly non-exhaustive, manually curated residential sample. At the 31 July 2026 data cut, the fragile Plovdiv legacy endpoint’s newest visible record was dated 27 March 2026.

### Commercial asking-price references

`AskingMarketPulse` contains dated source-level context, while `AskingPriceReference` contains a 283-record linked baseline: 274 imot.bg offers and nine Yavlena offers with a stated recent Act 16 or commissioning claim. Price, area and €/m² fields reproduce only the minimal factual snapshot needed for comparison; descriptions, imagery and contact details are not copied.

The records are mutable advertiser or broker offers. Their asking prices are not completed-sale prices, and their Act 16 claims are not treated as official until matched to a commissioning register. The source label is normalized to `yavlena.com` (Явлена); the user-supplied `vavlena.com` hostname did not resolve during verification.

At the 31 August 2026 refresh, 110 new rows were added and 11 were updated. The imot.bg scan accepted 143 current qualifying cards; the bounded Yavlena detail batch yielded no new strict matches, so its nine previously verified rows were retained. The source imbalance reflects qualifying public results and bounded verification, not source weight or market share. Pages saying “before Act 16,” “expected Act 16,” or showing contradictory construction years are excluded.

The filter cards compute simple unweighted medians and ranges over the currently visible records. They describe only this curated sample and do not normalize VAT, finish, parking, common-area treatment, duplicate buildings or listing selection.

The paired view plots the official NSI new-dwelling transaction HPI alongside a current asking-price cohort profile. Commercial records are grouped by original listing quarter, with at least ten records required per point, but their prices were observed in the current database snapshot—not necessarily on their listing dates. The lines are independently rebased to their first adequately sampled shared quarter, 2026 Q1 = 100, only as a diagnostic comparison. The listing curve is survivor-, source-, and property-mix biased; 2026 Q3 is partial; and the official line stops at the latest available NSI quarter rather than being interpolated.

## Commercial database refresh

The **Refresh records** button sends `POST /api/commercial/refresh`. The server scans bounded public result pages from imot.bg and Yavlena, validates qualifying rows, merges them by full source identity, persists the result atomically, and returns records newest-first. A failed source retains its prior rows; concurrent refreshes are rejected; and a successful refresh starts a 15-minute cooldown.

The imot.bg adapter checks at most two filtered pages per city and decodes Windows-1251 HTML. The Yavlena adapter checks at most two result pages per city, observes a five-second request interval, and reviews a small rotating batch of unseen details. The operation is intentionally bounded and is not a claim of exhaustive portal coverage.

Eligibility is conservative: a Sofia or Plovdiv apartment needs an explicit completed Act 16 or commissioning statement dated 2025 or 2026. Future, pre-Act-16, Act 14/15, and unsupported property types are rejected. Because portal evidence is normally year-level, the rolling window is conservative at its boundary.

Runtime data default to `var/commercial-records.json`; override this with `COMMERCIAL_DATA_PATH`. Set `COMMERCIAL_REFRESH_DISABLED=1` to disable refreshes. Production needs persistent storage and a single writer, or a shared database and lock for multiple instances. Review portal terms and obtain appropriate permission before production-scale collection or redistribution.

## Official-data maintenance workflow

1. Download the current NSI index, quarter-on-quarter and year-on-year HPI workbooks from the primary housing-price statistics pages.
2. Inspect a worksheet without adding an XLSX dependency:

   ```bash
   npm run data:inspect -- /path/to/HPI.xlsx
   # Optional worksheet entry:
   npm run data:inspect -- /path/to/HPI.xlsx xl/worksheets/sheet2.xml
   ```

   The helper requires the system `unzip` command.

3. Transcribe verified Sofia/Plovdiv new-dwelling index levels into `levels` and the official QoQ/YoY series into `publishedRates` in `src/content.ts`; do not paste total-dwelling or existing-dwelling series.
4. Recompute headline labels from the official rate series and match any inflation comparison to a clearly labeled reference period.
5. Review municipal registers for in-window residential records. Keep each record separate unless the source explicitly proves records are phases of one project.
6. Periodically audit a sample of commercial links and update parser fixtures when source markup changes. Confirm Act 16 wording, price, and area extraction without copying descriptions, photos, or contact details.
7. Update the visible data-cut labels, sources and this README if coverage changes.
8. Run `npm test` and `npm run build`, then check refresh states, newest-first ordering, both price plots, filtering, record links, and CSV export at desktop and mobile widths.

Recommended cadence: after every quarterly NSI HPI publication, plus a monthly commissioning-register review when official endpoints are available.

## Interpretation boundaries

- “Act 16” is a colloquial umbrella. Final commissioning is a use permit or commissioning certificate depending on construction category.
- Municipal certificate registers principally cover categories IV/V. Categories I–III use permits are issued by DNCC/DNSK and require the separate DNSK register.
- imot.bg and Yavlena values are asking prices or broker market commentary, not notarized transaction prices.
- A listing statement about Act 16 is advertiser-supplied evidence and remains unverified unless separately matched to an official register.
- The app keeps only minimal attributed facts and direct links. Portal terms may restrict systematic reuse; obtain permission and legal review before production-scale collection or redistribution, and do not copy descriptions, imagery, or contact details.
- NSI HPI is not limited to buildings commissioned during this dashboard’s two-year cutoff; Q1 2026 data are preliminary.
- Commissioning records prove administrative status, not a sale, sale price, floor area or buyer type.
- The Q1 2026 HPI YoY minus March 2026 HICP YoY gaps are descriptive percentage-point comparisons, not formally deflated real HPI series.
- June 2026 HICP and housing-credit growth are later macro pulses; the site labels their reference period and does not pair them as simultaneous Q1 observations.
- Euro conversion uses the fixed rate €1 = BGN 1.95583. Conversion arithmetic cannot isolate an adoption effect; Sofia–Plovdiv divergence is a useful warning against monocausal claims.

Official primary source links are displayed in the Methodology section. Commercial references link directly from their cards and rows. The bundled commercial baseline is `data/commercial-seed.json`; successful refreshes write the runtime snapshot at `COMMERCIAL_DATA_PATH` (default `var/commercial-records.json`).
