# Wine Atlas Bulgaria

A map-first, interactive directory for exploring Bulgarian wineries, wine regions, grapes, and visitor experiences. The interface takes inspiration from travel and housing marketplaces: filtered results stay synchronized with a national map, while a separate database view supports sorting and CSV export.

## What is included

- Split list/map explorer on desktop
- Dedicated List / Map modes on mobile
- Search across winery, settlement, province, region, grape, and wine style
- Region chips and a five-region distribution summary
- Wine-style, visitor-experience, organic, and saved-place filters
- Synchronized card, marker, and detail-drawer selection
- Sortable directory table and client-side CSV export
- Saved wineries persisted in local storage
- Shareable query, region, and view URL parameters
- Self-contained SVG map and vineyard artwork with no tile or image dependency
- Responsive layouts, keyboard focus states, reduced-motion support, and a non-map table fallback

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Data notes

The current records are a representative, curated seed set—not a complete winery register. Coordinates are intended for national orientation, and visitor information should be confirmed directly with the producer before travel.

The product uses Bulgaria's familiar five geographic/viticultural regions as a touring lens. These should not be treated as bottle-level appellations or automatically mapped to protected geographical indications. Bulgaria's Ministry of Agriculture materials distinguish the five wine-growing areas used for structural analysis from the country's current protected regional-wine framework.

Primary references used for the first edition:

- [Bulgarian Ministry of Agriculture — Vineyard Structure Survey 2020](https://www.mzh.government.bg/en/statistics-and-analyses/farm-structure/vineyard-structure-survey-bulgaria-2020/)
- [Visit Bulgaria — Wine Tourism](https://visitbulgaria.com/wine-tourism-landing-page/)
- [Executive Agency on Vine and Wine — producer register](https://vineregister.eavw.com/manufacturers)
- Individual winery websites linked from each record
- [Natural Earth Admin 0 Countries](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) for the public-domain Bulgaria outline

## Project structure

- `src/data.ts` — region metadata and winery seed records
- `src/App.tsx` — explorer, map, filters, database, and detail UI
- `src/styles.css` — complete responsive visual system
- `src/main.tsx` — React entry point

## Next data milestone

For production use, normalize records against the state producer register and keep source-level fields for Bulgarian and English names, addresses, coordinate precision, source URLs, verification dates, visitor access, and explicit bottle-level PGI/PDO data. A small ingestion and review workflow can then replace the static seed file without changing the interface.
