insert into storage.buckets (id, name, public, file_size_limit)
values ('galeria', 'galeria', true, 52428800)
on conflict (id) do nothing;

create policy "Public read gallery" on storage.objects
  for select using (bucket_id = 'galeria');

create policy "Auth upload gallery" on storage.objects
  for insert with check (bucket_id = 'galeria');

create policy "Auth delete gallery" on storage.objects
  for delete using (bucket_id = 'galeria');

create policy "Auth update gallery" on storage.objects
  for update using (bucket_id = 'galeria');