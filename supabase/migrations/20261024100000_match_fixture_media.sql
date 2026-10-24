create table if not exists public.match_media (
  id uuid primary key default gen_random_uuid(),
  match_id bigint not null references public.fixtures(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  source_type text not null check (source_type in ('upload', 'link')),
  url text not null,
  storage_path text,
  mime_type text,
  title text not null default '',
  caption text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint match_media_source_check check (
    (source_type = 'link' and media_type = 'video' and storage_path is null)
    or (source_type = 'upload' and storage_path is not null)
  )
);

create index if not exists match_media_match_created_idx
  on public.match_media (match_id, created_at desc);

alter table public.match_media enable row level security;
revoke all on public.match_media from anon, authenticated;
grant all on public.match_media to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'match-media', 'match-media', true, 104857600,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
