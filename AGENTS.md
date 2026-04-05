# AGENTS.md

## Cursor Cloud specific instructions

This is a **client-side-only React mortgage calculator** built with Vite. No backend, database, or Docker required.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (serves on port 5173 with HMR) |
| Build | `npm run build` (output in `dist/`) |
| Preview prod build | `npm run preview` |

### Notes

- The project uses Node 22 (matches CI). The VM ships with `nvm`; the default Node version is sufficient.
- There is no linter, formatter, or test framework configured in the repo. `package.json` has no `lint` or `test` scripts.
- The Vite dev server auto-reloads on file changes; no restart needed after editing source files.
- For the production build, Vite sets `base` to `/Mortage-Calculator/` (note the typo in the repo name) unless `GITHUB_REPOSITORY` is set. In dev mode, `base` is `/`.
- The entire app lives in a single component (`src/mortgage-calculator.jsx`) plus a PDF helper (`src/buildMortgagePdf.js`).
