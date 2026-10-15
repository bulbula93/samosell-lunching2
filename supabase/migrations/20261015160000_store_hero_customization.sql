-- Storefront owner-authored hero content. Stage this migration only;
-- do NOT apply to Production until the release gate is approved.
--
-- Existing profiles stay valid; empty JSON means fall back to the
-- store's current name/bio without inventing promotional copy.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_hero jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_store_hero_shape_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_store_hero_shape_check
  CHECK (
    jsonb_typeof(store_hero) = 'object'
    AND octet_length(store_hero::text) <= 2400
    AND length(coalesce(store_hero->>'eyebrow', '')) <= 55
    AND length(coalesce(store_hero->>'headline', '')) <= 88
    AND length(coalesce(store_hero->>'description', '')) <= 300
    AND length(coalesce(store_hero->>'coverTitle', '')) <= 110
    AND length(coalesce(store_hero->>'coverSubtitle', '')) <= 90
  );

COMMENT ON COLUMN public.profiles.store_hero IS
  'Owner-editable storefront hero copy (eyebrow, headline, description, coverTitle, coverSubtitle). RLS inherits existing profiles access policy.';
