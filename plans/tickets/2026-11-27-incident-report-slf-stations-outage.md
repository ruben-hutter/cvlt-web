# Incident 2026-11-27: SLF wind stations silently gone from /vento

## Symptom

A user reported that the SLF weather stations on cvlt.ch "no longer work":
the wind station list on `/vento` showed no `SLF-*` entries. No error was
shown — the stations were simply missing from the list.

## Timeline & evidence

- **2026-11-27** — reproduction against production:
  `GET https://cvlt.ch/api/vento/others` returned 10 stations, **zero** of
  them `SLF-*`, while PWS/Holfuy/Windbird/OASI/Faido sources all reported.
- `public-meas-data.slf.ch` — the API host hardcoded in the vento route —
  **no longer resolves**: NXDOMAIN via the system resolver and via both
  1.1.1.1 and 8.8.8.8. The host was removed from DNS, not merely down
  (curl exit 6, `getent hosts` empty).
- The SLF-run avalanche site whiterisk.ch references
  `https://public-meas-data-v2.slf.ch` in its page source — the v2 successor.
- The v2 host serves the **same paths with the same payload shapes**
  (HTTP 200: geojson with 288 station features; per-station timeseries with
  identical `windVelocityMean`/`windVelocityMax`/`windDirectionMean`/
  `temperatureAir` fields).
- Two of our 17 hardcoded station IDs are gone upstream on v2 (HTTP 404):
  `BED2` and `MTR1`. `BED4` (Sabbioni, Val Bedretto, 2305 m, with wind data)
  exists and is the observed successor in BED2's valley.

## Root cause

**Upstream provider change, invisible to our client-facing code.** SLF renamed
its public measurement API host (`public-meas-data.slf.ch` →
`public-meas-data-v2.slf.ch`) and removed the old name from DNS. Our code
hardcoded the old hostname; every SLF request failed at DNS level.
`Promise.allSettled` isolated those errors and stations without data were
skipped, so the API returned no SLF stations instead of surfacing an error.
No diagnostic was logged, and the breakage surfaced only through a user
report.

## Repair

- `src/app/(frontend)/api/vento/slf.ts` now defines the SLF API host,
  defensive payload parsers, and station-to-view-model mapping. The route
  `others/route.ts` imports it instead of maintaining its own inline copy.
- `fetchWithTimeout` accepts an optional fetch implementation so tests can
  exercise the SLF source functions used by the route without making external
  requests.
- Station list refreshed: `BED2`/`MTR1` removed (404 upstream), `BED4`
  added; `SLF-Sabbioni` mapped to the *Alpi ticinesi* region in
  `VentoClient.tsx`.

## Verification

- A development-server request to `/api/vento/others` after the repair
  returned all 16 configured SLF stations from the live v2 API, including
  `SLF-Sabbioni`, alongside the other sources.
- `tests/slf-stations.test.ts` exercises the SLF source functions imported by
  the route, using a real v2 geojson fixture and the real timeseries field
  mapping. Coverage pins the new v2 URLs and includes DNS failure (the
  incident pattern), HTTP 500, payload-format changes, partial station
  removals, valid payload parsing, and the latitude data required by the
  route's existing sort.
