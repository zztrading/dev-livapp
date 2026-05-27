-- Onboarding V2 — bucket Storage pras imagens UAU 1 (Visual)
--
-- 9 imagens (3 estilos × 3 temas) geradas via página admin
-- /admin/uau-images-gen. Bucket público pra frontend ler sem auth.
-- Upload restrito a admin/dev (defense-in-depth).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uau-images',
  'uau-images',
  true,
  5242880, -- 5 MB max por imagem
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (anon + authenticated)
create policy "uau-images: anyone can read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'uau-images');

-- Upload restrito a admin ou dev
create policy "uau-images: admin/dev can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'uau-images'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'dev')
    )
  );

-- Update (upsert) restrito a admin/dev
create policy "uau-images: admin/dev can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'uau-images'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'dev')
    )
  );

-- Delete restrito a admin/dev
create policy "uau-images: admin/dev can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'uau-images'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'dev')
    )
  );
