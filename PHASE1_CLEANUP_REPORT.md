# Phase 1 cleanup

This pass focuses on repository hygiene and safe sharing:

- Added `.gitignore`
- Removed local secrets file `.env.local`
- Removed generated/build artifacts (`node_modules`, `.next`, `tsconfig.tsbuildinfo`)
- Removed backup/archive clutter (`*.bak`, root `*.zip` artifacts)
- Kept `.env.local.example` as the template for local setup

## Before running locally again

1. Copy `.env.local.example` to `.env.local`
2. Fill in your real Supabase/TBC values
3. Run `npm install`
4. Run `npm run dev`
