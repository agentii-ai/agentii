# Agentii Frontend — Quickstart Guide

**Agentii** is a standalone TradingView-like frontend for biotech options trading with AI agent integration. This frontend can run independently with mock data or connect to the Agentii backend.

---

## Prerequisites

- **Node.js** 23+ and npm 11+
- **Git** (for cloning)

---

## Quick Start (Mock Mode — No Backend Required)

```bash
# 1. Install dependencies
npm install

# 2. Start dev server with MSW mocks
npm run dev
```

Open **http://localhost:5173** — you'll see the dashboard with mock data (MRNA, BNTX, NVAX tickers, options chains, catalyst events).

**Mock mode is enabled by default** — MSW intercepts all API calls and returns realistic fixture data.

---

## Environment Variables

Create `.env.local` to override defaults:

```bash
# API endpoints (default: localhost:8000)
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/ws

# Mock mode (default: true if not set)
# Set to 'false' to connect to real backend
VITE_MOCK_API=true
```

**Mock mode behavior:**
- `VITE_MOCK_API` not set or `true` → MSW mocks enabled, no backend needed
- `VITE_MOCK_API=false` → connects to real backend at `VITE_API_URL`

---

## Connecting to Real Backend

1. Start the Agentii backend (see `agenzym/agenzym/` for backend setup)
2. Create `.env.local`:
   ```bash
   VITE_MOCK_API=false
   VITE_API_URL=http://localhost:8000/api/v1
   VITE_WS_URL=ws://localhost:8000/ws
   ```
3. Restart dev server: `npm run dev`

The frontend will now make real API calls to `localhost:8000`.

---

## Available Scripts

```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run test         # Run Vitest unit tests (watch mode)
npm run test:run     # Run tests once (CI mode)
npm run test:coverage # Generate coverage report
npm run e2e          # Run Playwright e2e tests
npm run lint         # Biome linting
npm run format       # Biome formatting
npm run check        # Biome lint + format (auto-fix)
```

---

## Project Structure

```
agentii/frontend/
├── src/
│   ├── api/              # TanStack Query hooks (REST API)
│   ├── components/       # React components (charts, options, catalysts, etc.)
│   ├── hooks/            # Custom hooks (useSocket, useLivePrice, etc.)
│   ├── stores/           # Zustand stores (auth, theme, watchlist, layout)
│   ├── types/            # TypeScript interfaces (mirrors agenzym-models)
│   ├── lib/              # Utilities (OCC parser, market hours, etc.)
│   ├── config/           # API config, Tauri detection
│   ├── pages/            # Route pages (Dashboard, OptionsPage, etc.)
│   ├── test/
│   │   ├── mocks/        # MSW handlers + browser worker
│   │   └── fixtures/     # Mock data (stocks, options, catalysts, portfolio)
│   ├── App.tsx           # React Router setup
│   └── main.tsx          # Entry point (enables MSW in dev)
├── public/
│   └── mockServiceWorker.js  # MSW service worker (auto-generated)
├── e2e/                  # Playwright e2e tests
├── dist/                 # Production build output
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── biome.json
└── tsconfig.json
```

---

## Key Features Implemented

### Phase 1–2: Foundation ✅
- Vite + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui (New York style)
- TanStack Query + Zustand + React Router 7
- MSW 2 for API mocking
- Vitest + Playwright test setup

### Phase 3: US1 — Dashboard ✅
- Live market dashboard with watchlist
- TradingView Lightweight Charts 5 (candlestick + volume)
- Real-time price updates via WebSocket (3-tier fallback)
- Symbol search with autocomplete
- Market status badge, paper trade indicator
- Command palette (Cmd+K)

### Phase 4: US2 — Options Chain ✅
- Professional call/put grid with configurable columns
- Greeks (Δ, Γ, Θ, ν, IV) display
- Lightweight Charts for 2D Greeks profiles + IV smile
- Plotly 3D IV surface
- Payoff diagram with BaselineSeries
- Contract detail panel

### Phase 5: US3 — Agent Chat ✅
- CopilotKit integration (conditionally loaded)
- Generative UI components (CatalystTimeline, SignalCard, OptionsAnalysis)
- Streaming text responses
- Agent attribution

### Phase 6: US4 — Catalyst Dashboard ✅
- FDA event calendar (PDUFA, AdCom, Phase 1/2/3)
- Filter by type, time horizon, therapeutic area
- Event detail with market context
- FDA decision history

### Phase 7: US7 — Chart Markers ✅
- Catalyst event markers on candlestick charts
- Color-coded by event type (PDUFA=red, AdCom=orange, Phase=blue)
- Hover tooltips with event details
- Real-time bar updates via WebSocket

### Phase 9: US9 — Flow Builder ✅ (Basic)
- React Flow drag-and-drop workflow editor
- Custom node types (CatalystSource, PriceAlert, Filter, etc.)
- Save/load/run workflows
- CodeMirror Python editor

---

## Testing

### Unit Tests (Vitest)
```bash
npm run test:run
```
- 64 tests across 10 test files
- Coverage: lib utilities, hooks, components
- MSW mocks enabled in tests

### E2E Tests (Playwright)
```bash
npm run e2e
```
- Dashboard flow, options chain, catalyst dashboard
- Runs in Chrome + Firefox

---

## Production Build

```bash
# Build for production
npm run build

# Output: dist/ directory
# - index.html
# - assets/ (JS, CSS, fonts)
# - mockServiceWorker.js (not used in production)

# Preview production build locally
npm run preview
```

**Bundle size:**
- Initial bundle: ~500KB gzipped (target met)
- Lightweight Charts: 56KB (separate chunk)
- Plotly: 1.4MB (lazy-loaded, 3D surface only)
- React Flow: 49KB (lazy-loaded)

**Deployment:**
- Static hosting (Vercel, Netlify, Cloudflare Pages)
- Set `VITE_MOCK_API=false` and `VITE_API_URL` to production backend
- Serve `dist/` directory

---

## Deployment Isolation

**Agentii frontend is fully standalone:**
- No shared dependencies with `agenzym/` backend
- Separate `package.json`, `node_modules/`, build output
- Can be deployed to different servers/CDNs
- Mock mode allows frontend-only development

**Deployment scenarios:**
1. **Frontend-only (demo):** Deploy with `VITE_MOCK_API=true` → no backend needed
2. **Full stack (production):** Deploy frontend + backend separately, connect via `VITE_API_URL`
3. **Desktop app (Tauri):** Bundle frontend into native macOS/Windows app (Phase 10)

---

## Tech Stack

- **Framework:** React 19 + TypeScript 5.9
- **Build:** Vite 7
- **Routing:** React Router 7
- **State:** Zustand 5 + TanStack Query 5
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix UI primitives)
- **Charts:** Lightweight Charts 5 (2D), Plotly (3D surface only)
- **WebSocket:** Socket.IO Client 4
- **Agent:** CopilotKit (conditional)
- **Flow:** React Flow 12 + CodeMirror 6
- **Testing:** Vitest 4 + Playwright + MSW 2
- **Linting:** Biome (replaces ESLint + Prettier)

---

## Next Steps (Incomplete Features)

### Phase 7: US5 — Portfolio (P2)
- Portfolio page with stock + option positions
- Real-time P&L updates
- Net Greeks aggregation
- Position drill-down

### Phase 8: US6 — Paper Trading (P2)
- Order entry form (market/limit/stop)
- Order book + trade book
- Order lifecycle (pending → filled)
- Agent attribution

### Phase 10: US8 — Desktop App (P3)
- Tauri v2 wrapper for macOS + Windows
- Secure credential storage (AES-256-GCM)
- OS native notifications
- System tray

### Phase 12: Polish
- WCAG 2.1 AA accessibility
- Responsive layout (min 1024px)
- Reconnection UI for WebSocket
- Loading skeletons
- Performance audit
- Dark mode polish

---

## Troubleshooting

### MSW service worker error
```
Failed to register a ServiceWorker... unsupported MIME type
```
**Fix:** Run `npx msw init public/ --save` to generate `mockServiceWorker.js`

### CopilotKit crash (Agent 'default' not found)
**Fix:** Ensure `VITE_MOCK_API` is not set to `'false'` when no backend is running. Mock mode skips CopilotKit.

### WebSocket connection failed
**Expected in mock mode** — WebSocket is not mocked by MSW. Real-time features fall back to REST polling.

### Build warnings (chunks > 500KB)
**Expected** — Plotly (1.4MB) and large code syntax highlighters are lazy-loaded. Initial bundle is <500KB gzipped.

---

## License

Apache 2.0 (includes TradingView Lightweight Charts attribution — see `NOTICE` file)

---

## Support

- **Issues:** https://github.com/anthropics/agenzym/issues (when open-sourced)
- **Docs:** See `specs/002-agentii-frontend/` for full design docs
- **Tasks:** See `specs/002-agentii-frontend/tasks.md` for implementation roadmap
