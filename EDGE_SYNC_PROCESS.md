# Edge code analysis and sync (2025-10-02)

## Summary
- Backend submodule before: e4376893fea883f1a2330f943248ea1b404886c9 (branch: main)
- Backend submodule after:  847baebd7a1283f58cc9d1c5f0163881fd290a00 (branch: edge-local-sync-20251002)
- Local bundle `edge/` contained `dnc-service/` not present in backend main; synced into `backend/edge/dnc-service/`.

## Analysis
- Structure comparison:
  - Local: `edge/dnc-service/...` (Python package with templates, README, env example)
  - Backend (pre-sync): `backend/edge/` contained `agent/`, `configs/`, `examples/`, `scripts/`; no `dnc-service/`.
- Markdown files:
  - Local: `edge/dnc-service/README.md` (mtime: 2025-09-15 16:40)
  - Backend (pre-sync): no markdowns under `backend/edge/`.
- Recent backend commits touching `edge/` (pre-sync):
  - 2025-07-15: fix offline buffer duplication and add dev tools
  - 2025-07-13: feat: edge agent architecture enhancements

## Actions performed
1) Created backend submodule branch `edge-local-sync-20251002` from `main`.
2) Copied `edge/dnc-service/` into `backend/edge/dnc-service/`.
3) Committed changes inside backend submodule.
4) Updated bundle to point backend submodule to new commit.

## Next steps
- Optionally open a PR from `edge-local-sync-20251002` to `main` in `daiark/ronelan_backend` to upstream the dnc-service.
- Consider extracting `edge/dnc-service` into its own repo and using it as an independent submodule if you want to decouple it from backend.
