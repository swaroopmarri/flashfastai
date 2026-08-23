-- Lets an org admin upload an image (e.g. the landing page hero) without a
-- code deploy. Uses Supabase Storage for the file itself, and a small
-- "slot -> current URL" table so the public landing page (and any future
-- image slot) knows which uploaded file is live.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0009.

-- Public, admin-writable storage bucket for site images.
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to site images" on storage.objects;
create policy "Public read access to site images"
  on storage.objects for select
  using (bucket_id = 'site-images');

drop policy if exists "Admins manage site images" on storage.objects;
create policy "Admins manage site images"
  on storage.objects for all
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active'
    )
  )
  with check (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active'
    )
  );

-- Which uploaded file is "live" for a given named slot (e.g. 'landing_hero').
-- Publicly readable (the landing page is public and needs to render it for
-- logged-out visitors); only an active org admin can change it.

create table if not exists public.site_images (
  slot text primary key,
  url text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.site_images enable row level security;

drop policy if exists "Anyone can view site images" on public.site_images;
create policy "Anyone can view site images"
  on public.site_images for select
  using (true);

drop policy if exists "Admins manage site images metadata" on public.site_images;
create policy "Admins manage site images metadata"
  on public.site_images for all
  using (exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active'
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active'
  ));
