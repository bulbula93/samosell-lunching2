# Phase 3 — Chat route cleanup + test page protection

## What changed

### 1) Canonicalized chat routes
Legacy dashboard chat routes now permanently redirect to the newer canonical routes:

- `/dashboard/chat` -> `/dashboard/chats`
- `/dashboard/chat/[chatId]` -> `/dashboard/chats/[chatId]`

This keeps old bookmarks working while removing the duplicate UI path as a maintenance concern.

### 2) Removed unused legacy chat pieces
Deleted files that were only used by the legacy chat pages:

- `components/chat/SendMessageForm.tsx`
- `app/dashboard/chat/actions/sendMessage.ts`

### 3) Protected internal test pages
Added `lib/test-page-access.ts` and applied it to:

- `app/test-db/page.tsx`
- `app/test-marketplace/page.tsx`

Behavior now:

- In development (`NODE_ENV=development`): test pages still open normally.
- Outside development: only admins can open them; everyone else is redirected to `/dashboard`.

## Why this helps

- Removes route duplication and future drift between old/new chat UIs.
- Preserves compatibility for old links through redirects.
- Prevents public exposure of internal diagnostic pages in production.

## Files changed

- `app/dashboard/chat/page.tsx`
- `app/dashboard/chat/[chatId]/page.tsx`
- `app/test-db/page.tsx`
- `app/test-marketplace/page.tsx`
- `lib/test-page-access.ts`

## Files removed

- `components/chat/SendMessageForm.tsx`
- `app/dashboard/chat/actions/sendMessage.ts`
