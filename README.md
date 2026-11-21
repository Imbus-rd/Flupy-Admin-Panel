# Flupy Time · Admin panel

Next.js admin UI for Flupy Time (connects to the existing Ponches / Flupy API).

## Requirements

- **Node.js 20+** (required for Tailwind CSS v4 / `@tailwindcss/oxide` native bindings)
- `NEXT_PUBLIC_API_URL` — public API origin, no trailing slash (e.g. `https://api.flupy.io`)

## Local development

```bash
cp .env.local.example .env.local
# Edit NEXT_PUBLIC_API_URL

npm install
npm run dev
```

## Production build (Linux VPS)

If `npm run build` fails with **Cannot find native binding** (`@tailwindcss/oxide`) or **EBADENGINE**:

1. **Upgrade Node to 20 LTS** (Debian/Ubuntu example):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v   # should show v20.x
```

2. **Clean install** (fixes npm optional-dependency issues on Linux):

```bash
cd /var/www/Flupy-Time-Admin   # or your clone path
rm -rf node_modules package-lock.json
npm install
npm run build
```

3. Run:

```bash
npm start
# or e.g. PORT=3000 pm2 start npm --name flupy-admin -- start
```

Use `.env` or `.env.production` on the server with `NEXT_PUBLIC_API_URL=...` before `npm run build` so the value is baked into the client bundle.

## Scripts

| Command           | Description              |
|-------------------|--------------------------|
| `npm run dev`     | Development server       |
| `npm run build`   | Production build         |
| `npm run start`   | Start production server  |
| `npm run clean`   | Remove `.next`           |
| `npm run build:clean` | Clean + build        |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)

## Calidad Claro

`/time/claro-quality` uses the company-scoped backend comparison of child orders with Flupy Time and QR Online/Offline. ADMIN can import and view all company regions in this module; other modules retain their regional restrictions. The quality target is 96%, with below-target scores in red. Monthly charts, comparison columns and target indicators are included in Excel exports. The chart in Excel is a printable image; its source values are in the Mensual sheet.

The Claro wordmark in `public/claro-logo.svg` is an unmodified asset by Claro from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_de_Claro.svg), marked PD-textlogo with trademark restrictions. It identifies the audit source; it does not imply affiliation. No external image request is made when viewing the panel.

The monthly chart has an optional "Comparar con el año anterior" checkbox. It queries the existing authorized report endpoint for the applied date range shifted back one year, retaining all other filters and the selected initial/final evaluation. Full-month ends include leap days; partial periods retain their day limits. A dashed blue series aligns each prior month with its selected counterpart, with two-decimal labels and gaps for missing samples. Failed/stale requests cannot replace a newer comparison. When enabled, Excel includes both series, prior-year monthly metrics and an aligned comparison sheet. This feature needs only a panel rebuild/deployment, not a backend, APK, schema or environment change; historical samples must already be imported.

Region, supervisor, technician, product, technology and outcome support multiple checkbox selections. Empty means all; values within a filter are OR, filters are AND. Supervisor choices depend on region/process; technician choices also depend on the selected supervisors, using the imported audit associations. Upstream changes clear selected technicians and prune invalid supervisors. Failed option refreshes block applying uncertain filters. Excel exports the applied report and lists every selected value.

Deploy the matching backend first, then rebuild/deploy this panel. No new database migration or environment variable is required. QR Online fuel restocking marked NOT_APPLICABLE is displayed as No aplica (including the printable report), not as a failed criterion.

## Integrated performance KPIs

QR Offline photo cards and the expanded viewer show the API's individual OK/FE/ERROR decision and comment; FE and Error also appear as PDF findings. The grid and Excel use the backend `findingsCount`, including Offline photo findings, instead of only group ratings. Deploy the matching backend first for corrected list/dashboard counts. This does not change the existing one-order/one-sample quality classification or FE scoring policy.

The dashboard and Quality Intelligence KPI view share /quality-intelligence/report and its existing regional and company authorization. Claro uses final weighted scores, the actual sample month and a 96% target; it is not merged into QR Offline's formula. Excel exports separate KPI sheets for totals, technicians, supervisors, month and Claro process. The approved overall score uses equal weights among available values of the seven requested KPIs. Online is normalized to 100; missing samples are excluded, observed zeros count, and coverage N/7 is always shown.

Process/project controls are Claro-specific. Current punctuality covers first recorded non-automatic check-ins with known office schedules, not unproven absence. For this stage Retro+ uses completed submissions as the approved proxy, with one submission per technician and observed active day; extras cannot cover a different day. Actual positive customer ratings remain unverified. Inspection detail and PDF include the freshly saved OT proximity status when supplied by the backend.
