# Growth report export

Admin Growth dashboard provides Georgian Copy report and Download CSV buttons.
Exports capture the selected period's already-loaded aggregate snapshot: activity,
sequential cohort funnel/conversion/drop-off, first-touch UTM source/campaign,
confirmed gross live revenue, Meta daily spend, acquisition costs and blended ROAS.
Report timestamps/range and CSV filename use the dashboard's Tbilisi calendar boundaries.

Reports include consent/coverage limitations, backend availability, Meta freshness,
errors and FX coverage. Missing data stays unavailable; cached spend does not enable
costs/ROAS after failed or stale sync. No raw events, user IDs, emails or secrets.
Admin authorization remains on the existing server page; no new endpoint, query,
mutation, dependency or schema change. Only a small export control is client-rendered.
Clipboard denial exposes a selectable readonly report; CSV is generated locally
with UTF-8 BOM, quoted fields and spreadsheet formula neutralization.

Validation covers date rollover, all metrics and attribution, cohort separation,
failed/stale/missing data, CSV quoting/formulas, clipboard denial/recovery and
local download/object-URL cleanup. Run full Vitest, ESLint, TypeScript and build
before release. Owner explicitly authorized main/Production release of this feature.
