-- Hydra Agro - banco de produção (Supabase/PostgreSQL)
-- Execute este arquivo uma única vez no SQL Editor do projeto Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  plan text not null default 'free' check(plan in ('free','pro')),
  vip boolean not null default false,
  is_admin boolean not null default false,
  banned_at timestamptz,
  banned_reason text,
  subscription_status text not null default 'inactive',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists vip boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists banned_reason text;
alter table public.profiles add column if not exists subscription_status text not null default 'inactive';

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text not null,
  state text not null,
  area numeric not null default 0,
  activity text not null default 'Pecuária e agricultura',
  water_goal integer not null default 3500,
  created_at timestamptz not null default now()
);

create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tag text not null,
  name text not null,
  species text not null default 'Bovino',
  breed text not null default '',
  sector text not null,
  status text not null default 'Saudável',
  weight numeric not null default 0,
  last_seen timestamptz not null default now(),
  unique(farm_id, tag)
);

create table if not exists public.reservoirs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  sector text not null,
  capacity integer not null,
  level integer not null check(level between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sector text not null,
  liters integer not null check(liters > 0),
  recorded_at timestamptz not null default now()
);

create table if not exists public.drones (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  model text not null,
  status text not null default 'Na base',
  battery integer not null default 100 check(battery between 0 and 100),
  mission text not null default 'Disponível'
);

create table if not exists public.drone_missions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  drone_id uuid not null references public.drones(id) on delete cascade,
  mission text not null,
  completed_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  category text not null default 'Atualização',
  content text not null check(char_length(content) between 3 and 500),
  image_url text,
  reactions integer not null default 0,
  comments integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  title text not null,
  description text not null,
  target integer not null,
  progress integer not null default 0,
  unit text not null,
  ends_at date not null,
  joined boolean not null default true
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check(char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);

create table if not exists public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.farm_follows (
  farm_id uuid not null references public.farms(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (farm_id, follower_id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifications boolean not null default true,
  animations boolean not null default true,
  compact_mode boolean not null default false,
  dark_mode boolean not null default false
);

alter table public.user_settings add column if not exists dark_mode boolean not null default false;

create table if not exists public.nfc_scans (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  animal_id uuid references public.animals(id) on delete set null,
  tag text not null,
  result text not null check(result in ('identified','unregistered')),
  scanned_at timestamptz not null default now()
);

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  type text not null check(type in ('info','update','maintenance')),
  title text not null check(char_length(title) between 3 and 100),
  message text not null check(char_length(message) between 3 and 500),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.vip_allowlist (
  email text primary key,
  plan text not null default 'pro',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  status text not null,
  provider text not null,
  provider_reference text,
  started_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists farms_owner_idx on public.farms(owner_id);
create index if not exists animals_farm_idx on public.animals(farm_id);
create index if not exists water_logs_farm_date_idx on public.water_logs(farm_id, recorded_at desc);
create index if not exists drone_missions_farm_date_idx on public.drone_missions(farm_id, completed_at desc);
create index if not exists posts_farm_date_idx on public.posts(farm_id, created_at desc);
create index if not exists post_comments_post_date_idx on public.post_comments(post_id, created_at);
create index if not exists farm_follows_follower_idx on public.farm_follows(follower_id);
create index if not exists nfc_scans_farm_date_idx on public.nfc_scans(farm_id, scanned_at desc);
create index if not exists announcements_active_date_idx on public.app_announcements(active, starts_at, ends_at);
create index if not exists admin_audit_date_idx on public.admin_audit_log(created_at desc);

create or replace function public.owns_farm(target_farm uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.farms where id = target_farm and owner_id = (select auth.uid())) $$;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and is_admin = true and banned_at is null) $$;

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.animals enable row level security;
alter table public.reservoirs enable row level security;
alter table public.water_logs enable row level security;
alter table public.drones enable row level security;
alter table public.drone_missions enable row level security;
alter table public.posts enable row level security;
alter table public.challenges enable row level security;
alter table public.notifications enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_saves enable row level security;
alter table public.farm_follows enable row level security;
alter table public.user_settings enable row level security;
alter table public.post_reports enable row level security;
alter table public.vip_allowlist enable row level security;
alter table public.subscriptions enable row level security;
alter table public.nfc_scans enable row level security;
alter table public.app_announcements enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "profile owner access" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "farm owner access" on public.farms for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "animal farm owner access" on public.animals for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "reservoir farm owner access" on public.reservoirs for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "water farm owner access" on public.water_logs for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "drone farm owner access" on public.drones for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "drone missions farm owner access" on public.drone_missions for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "post owner write" on public.posts for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "post community read" on public.posts for select to authenticated using (true);
create policy "challenge farm owner access" on public.challenges for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "notification farm owner access" on public.notifications for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)));
create policy "likes community read" on public.post_likes for select to authenticated using (true);
create policy "likes owner write" on public.post_likes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "comments community read" on public.post_comments for select to authenticated using (true);
create policy "comments author write" on public.post_comments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saves owner access" on public.post_saves for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "follows community read" on public.farm_follows for select to authenticated using (true);
create policy "follows owner write" on public.farm_follows for all to authenticated using ((select auth.uid()) = follower_id) with check ((select auth.uid()) = follower_id);
create policy "settings owner access" on public.user_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reports author insert" on public.post_reports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "subscriptions owner read" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "nfc farm owner access" on public.nfc_scans for all to authenticated using ((select public.owns_farm(farm_id))) with check ((select public.owns_farm(farm_id)) and (select auth.uid()) = user_id);
create policy "announcements active read" on public.app_announcements for select to authenticated using (active and starts_at <= now() and (ends_at is null or ends_at > now()) or (select public.is_app_admin()));
create policy "announcements admin write" on public.app_announcements for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()) and author_id = (select auth.uid()));
create policy "audit admin access" on public.admin_audit_log for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()) and admin_id = (select auth.uid()));
create policy "profiles admin read" on public.profiles for select to authenticated using ((select public.is_app_admin()));
create policy "farms admin read" on public.farms for select to authenticated using ((select public.is_app_admin()));
create policy "reports admin read" on public.post_reports for select to authenticated using ((select public.is_app_admin()));

insert into public.vip_allowlist(email,plan,note)
values ('danqxy7@gmail.com','pro','VIP vitalício do criador')
on conflict (email) do update set plan=excluded.plan,note=excluded.note;

update public.profiles
set plan='pro', vip=true, subscription_status='active', is_admin=true
where id in (select id from auth.users where lower(email)='danqxy7@gmail.com');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.owns_farm(uuid) to authenticated;
grant execute on function public.is_app_admin() to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant update(name, avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public)
values ('farm-media', 'farm-media', true)
on conflict (id) do nothing;

create policy "farm media authenticated upload" on storage.objects for insert to authenticated with check (bucket_id = 'farm-media');
create policy "farm media public read" on storage.objects for select to public using (bucket_id = 'farm-media');
create policy "farm media owner delete" on storage.objects for delete to authenticated using (bucket_id = 'farm-media' and owner_id = (select auth.uid()::text));
