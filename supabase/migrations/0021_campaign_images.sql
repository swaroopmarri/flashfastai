-- Storage bucket for images pasted into campaign bodies (rich-text compose).
-- Public read (SES-sent emails need publicly loadable image URLs), writes
-- restricted to authenticated users and scoped to a path prefixed with
-- their own user id so nobody can overwrite another account's images.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0020.

insert into storage.buckets (id, name, public)
values ('campaign-images', 'campaign-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to campaign images" on storage.objects;
create policy "Public read access to campaign images"
  on storage.objects for select
  using (bucket_id = 'campaign-images');

drop policy if exists "Users manage their own campaign images" on storage.objects;
create policy "Users manage their own campaign images"
  on storage.objects for all
  using (
    bucket_id = 'campaign-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'campaign-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
