-- Social Media Agent OS: Story companions for product posts.
-- A Story is its own social_posts row (content_type 'story') with its own QA, approval and jobs,
-- so every existing guard (version trigger, approvals, idempotent jobs, kill switch) applies unchanged.
alter table public.social_posts drop constraint if exists social_posts_content_type_check;
alter table public.social_posts add constraint social_posts_content_type_check
  check (content_type in ('single_image', 'carousel', 'text_link', 'story'));
-- Off by default; an admin turns it on in the Control Center.
alter table public.social_control add column if not exists stories_enabled boolean not null default false;
