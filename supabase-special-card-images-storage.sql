-- Public images for TCG special cards. The image bytes are stored in Storage;
-- site_settings.specialCards retains only each image's public URL and metadata.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'special-card-images',
  'special-card-images',
  true,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Match the application's admin gate: the owner account or an account listed
-- in public.admin_permissions. SECURITY DEFINER lets this check work even if
-- that table has restrictive RLS policies.
create or replace function public.is_urtt_card_storage_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'kolti@urtt.fr'
    or exists (
      select 1
      from public.admin_permissions as permission
      where lower(permission.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

revoke all on function public.is_urtt_card_storage_admin() from public;
grant execute on function public.is_urtt_card_storage_admin() to authenticated;

drop policy if exists "Public can read special card images" on storage.objects;
create policy "Public can read special card images"
on storage.objects for select
to public
using (bucket_id = 'special-card-images');

drop policy if exists "Admins can upload special card images" on storage.objects;
create policy "Admins can upload special card images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'special-card-images'
  and public.is_urtt_card_storage_admin()
);

drop policy if exists "Admins can update special card images" on storage.objects;
create policy "Admins can update special card images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'special-card-images'
  and public.is_urtt_card_storage_admin()
)
with check (
  bucket_id = 'special-card-images'
  and public.is_urtt_card_storage_admin()
);

drop policy if exists "Admins can delete special card images" on storage.objects;
create policy "Admins can delete special card images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'special-card-images'
  and public.is_urtt_card_storage_admin()
);
