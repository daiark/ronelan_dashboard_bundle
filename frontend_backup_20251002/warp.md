# Warp Runbook — Ronelan Frontend

This file is a focused, production‑sane runbook for working on the Ronelan Industrial Monitoring Panel frontend in Warp.

## What it is
A concise, repeatable set of commands and guardrails for local dev, build, theming, and Git operations on this Vite + React + Tailwind project.

## Mental model (CKH)
- Stack: Vite (dev/build), React 19, TypeScript, Tailwind. State via Zustand, charts via Recharts.
- Build: `npm run build` compiles TypeScript then bundles with Vite. No SWC React plugin; only `@vitejs/plugin-react`.
- Theme: Dark-first palette via `dark-*` and `accent-green-*` tokens defined in `tailwind.config.js`.
- Auth: Git uses Windows Credential Manager; pushing to GitHub prompts browser auth if credentials are missing or stale.

## Do this now

### 0) Safe checks
```powershell
node -v
npm -v
git --no-pager status
git --no-pager remote -v
```

### 1) Install
Normal install:
```powershell
npm install
```
If peer-dependency conflicts arise:
```powershell
npm install --legacy-peer-deps
```

### 2) Development server
```powershell
npm run dev
```
- Local: http://localhost:5173/
- To expose on LAN:
```powershell
npm run dev -- --host
```
- Change port if 5173 is busy:
```powershell
npm run dev -- --port 5174
```

### 3) Lint
```powershell
npm run lint
```

### 4) Build + preview
```powershell
npm run build
npm run preview
```
- Output in `dist/`. CSS size around ~19 kB indicates Tailwind tokens included.

### 5) Git (example flow)
Stage and craft a clear message:
```powershell
git add -A
git commit -m "feat: implement dark theme components; fix(build): remove swc plugin; add react-is"
```
Push to main (will prompt auth in browser if needed):
```powershell
git push origin main
```

## Theming guidance (dark mode tokens)
Use Tailwind tokens defined in `tailwind.config.js`:
- Backgrounds: `bg-dark-900`, `bg-dark-800`, borders `border-dark-700/600`
- Text: `text-dark-100` (primary), `text-dark-300/400` (secondary)
- Accents (brand): `bg-accent-green-600/700`
Avoid non-existent classes like `bg-primary-600`, `text-secondary-900`, etc.

## Pitfalls / Troubleshooting

### Build or dev errors referencing React plugin conflicts
- Ensure only `@vitejs/plugin-react` is installed and used.
```powershell
npm uninstall @vitejs/plugin-react-swc
```
- `vite.config.ts` should import `@vitejs/plugin-react` only.

### Recharts runtime errors about symbols/validation
Install `react-is` (peer for Recharts):
```powershell
npm install react-is
```

### Tailwind classes missing in output
- Verify `tailwind.config.js` content globs include:
  - `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
- Tokens exist under `theme.extend.colors.dark` and `accent-green`.
- Force a clean rebuild:
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
npm run dev
```

### Windows CRLF warnings from Git
Harmless in this repo. If desired:
```powershell
git config core.autocrlf true
```

### Port 5173 already in use
```powershell
npm run dev -- --port 5174
```

### GitHub authentication issues (wrong account or stale credentials)
List GitHub credentials:
```powershell
cmdkey /list | Select-String "github"
```
Delete the stored credential then push again to trigger browser auth:
```powershell
cmdkey /delete:"LegacyGeneric:target=git:https://github.com"
git push origin main
```

### Node version mismatch
Use nvm-windows if needed:
```powershell
nvm list
nvm install 18.20.4
nvm use 18.20.4
```

## References
- Vite: https://vitejs.dev/guide/
- React: https://react.dev/
- Tailwind: https://tailwindcss.com/docs/configuration
- Zustand: https://docs.pmnd.rs/zustand/getting-started/introduction
- Recharts: https://recharts.org/en-US/
- Repo (remote): https://github.com/daiark/ronelan_frontend

---
CKH note: Commands above are production‑sane defaults, with safe checks first and remediation steps documented for the highest‑frequency failures (plugin conflicts, peer deps, Tailwind scanning, auth).

