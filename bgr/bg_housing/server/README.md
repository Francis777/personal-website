# Commercial refresh service

The React bundle remains a read-only client. `server/index.mjs` serves `dist/` and owns the mutable commercial snapshot.

## Run

```bash
npm run build
npm start
```

The default address is `127.0.0.1:4173`. Set `HOST`, `PORT`, and `COMMERCIAL_DATA_PATH` for deployment. The data path must be on a durable volume; `var/commercial-records.json` is only the local default. During development, `npm run dev` starts the commercial API on port 4173 and Vite on port 5173; the existing `/api` proxy keeps browser requests same-origin. Use `npm run dev:static` only when intentionally testing the bundled snapshot without refresh.

Optional controls:

- `COMMERCIAL_REFRESH_COOLDOWN_MS` — global cooldown, default 900000 ms.
- `COMMERCIAL_REFRESH_DISABLED=1` — serve stored data but reject refresh requests.

## API

- `GET /api/commercial` returns `{ records, meta }`.
- `POST /api/commercial/refresh` performs one bounded synchronous scan and returns `{ records, meta, refresh }`.

Records are merged by normalized source plus string ID and returned by `recordDateIso` descending. A successful refresh is written to a temporary file and atomically renamed. If runtime data is absent or unreadable, the API serves `data/commercial-seed.json`. One source may fail without discarding the other source or the last good snapshot. Concurrent refreshes return 409; cooldown requests return 429 with `Retry-After`.

The endpoint validates advertiser wording and a rolling two-year completion window. A year-only claim is accepted only when that whole calendar year falls inside the window; the ambiguous partial boundary year is excluded. It does not convert listing claims into official municipal verification.

The JSON store and in-process lock assume one Node process. Use a transactional database and distributed job lock before running multiple replicas.
