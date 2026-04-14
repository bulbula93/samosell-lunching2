# Phase 6 — Next.js security upgrade + home cleanup

## What changed

### Security/framework upgrade
- Upgraded `next` from `16.2.1` to `16.2.3`
- Upgraded `eslint-config-next` from `16.2.1` to `16.2.3`
- Refreshed `package-lock.json` so CI/local installs resolve the patched versions
- Re-ran install and verified `npm audit` shows `0 vulnerabilities`

### Home page cleanup
Removed legacy / unused home-page code that was left behind after page componentization:
- `app/page.tsx.pre-landing-redesign`
- `components/home/HeroSection.tsx`
- `components/home/LandingHeroSection.tsx`
- `components/home/LandingHeroSearch.tsx`
- `components/home/LandingHeroSearchPopup.tsx`
- `components/home/Samosell.tsx`
- `components/home/TrustConversionSection.tsx`

## Verification
- `npm run lint` ✅
- `npm run build` ✅
- `npm audit` ✅

## Result
The project is now on the patched Next.js 16.2.3 line and the home-page area no longer carries the old, unused implementation files that could confuse future edits.
