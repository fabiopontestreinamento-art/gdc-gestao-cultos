begin;

create extension if not exists pgcrypto;

-- =========================================================
-- GDC – Gestão de Cultos
-- Schema completo para Supabase PostgreSQL + RLS + Storage
-- Convenção de storage para mídias de culto:
--   cult-media/<church_id>/<service_record_id>/<arquivo>
-- Perfis vinculados ao Supabase Auth:
--   public.profiles.id = auth.users.id
-- =========================================================

-- =========================
-- ENUMS
-- =========================
do $$ begin
  create type public.cargo_enum as enum (
    'pastor',
    'ungido',
    'diacono',
    'obreiro',
    'secretaria',
    'louvor',
    'membro'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.target_type_enum as enum (
    'todos',
    'grupo',
    'pessoa'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.visit_status_enum as enum (
    'pendente',
    'confirmada'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.attendance_class_enum as enum (
    'criancas',
    'intermediarios',
    'adolescentes',
    'jovens',
    'senhoras',
    'varoes'
  );
exception
  when duplicate_object then null;
end $$;

-- =========================
-- TABELAS PRINCIPAIS
-- =========================
create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text not null,
  cnpj text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null,
  telefone text not null unique,
  cargo public.cargo_enum not null default 'membro',
  is_admin boolean not null default false,
  is_super_admin boolean not null default false,
  avatar_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pastor_is_admin check (cargo <> 'pastor' or is_admin = true)
);

create table if not exists public.user_churches (
  user_id uuid not null references public.profiles(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, church_id)
);

create table if not exists public.praises (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  titulo text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pre_services (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  data date not null default current_date,
  dia_semana text not null,
  dirigente_louvor_id uuid not null references public.profiles(id) on delete restrict,
  pregador_id uuid not null references public.profiles(id) on delete restrict,
  orientacoes text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pre_service_praises (
  id uuid primary key default gen_random_uuid(),
  pre_service_id uuid not null references public.pre_services(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  praise_id uuid references public.praises(id) on delete set null,
  titulo text not null,
  ordem integer not null default 1,
  created_at timestamptz not null default now(),
  unique (pre_service_id, ordem)
);

create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  pre_service_id uuid references public.pre_services(id) on delete set null,
  church_id uuid not null references public.churches(id) on delete cascade,
  data timestamptz not null default now(),
  palavra text not null default '',
  observacoes text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_record_praises (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.service_records(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  praise_id uuid references public.praises(id) on delete set null,
  titulo text not null,
  ministrado boolean not null default false,
  ordem integer not null default 1,
  created_at timestamptz not null default now(),
  unique (service_record_id, ordem)
);

create table if not exists public.service_attendance (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.service_records(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  classe public.attendance_class_enum not null,
  igreja_count integer not null default 0 check (igreja_count >= 0),
  visitante_count integer not null default 0 check (visitante_count >= 0),
  created_at timestamptz not null default now(),
  unique (service_record_id, classe)
);

create table if not exists public.service_media (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.service_records(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  storage_path text not null,
  nome text not null,
  tipo text not null,
  legenda text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  nome text not null,
  classe public.attendance_class_enum not null,
  responsavel_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  nome_completo text not null,
  telefone text,
  classe public.attendance_class_enum not null,
  person_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_visits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  responsavel_id uuid not null references public.profiles(id) on delete restrict,
  scheduled_for timestamptz not null,
  status public.visit_status_enum not null default 'pendente',
  observacoes text not null default '',
  confirmed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete restrict,
  target_type public.target_type_enum not null default 'todos',
  target_group_id uuid references public.groups(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  texto text not null,
  created_at timestamptz not null default now(),
  constraint messages_target_check check (
    (target_type = 'todos' and target_group_id is null and target_user_id is null)
    or (target_type = 'grupo' and target_group_id is not null and target_user_id is null)
    or (target_type = 'pessoa' and target_group_id is null and target_user_id is not null)
  )
);

-- =========================
-- ÍNDICES
-- =========================
create index if not exists idx_user_churches_church_id on public.user_churches(church_id);
create index if not exists idx_praises_church_id on public.praises(church_id);
create index if not exists idx_pre_services_church_id on public.pre_services(church_id);
create index if not exists idx_pre_service_praises_pre_service_id on public.pre_service_praises(pre_service_id);
create index if not exists idx_pre_service_praises_church_id on public.pre_service_praises(church_id);
create index if not exists idx_service_records_church_id on public.service_records(church_id);
create index if not exists idx_service_record_praises_service_record_id on public.service_record_praises(service_record_id);
create index if not exists idx_service_record_praises_church_id on public.service_record_praises(church_id);
create index if not exists idx_service_attendance_service_record_id on public.service_attendance(service_record_id);
create index if not exists idx_service_attendance_church_id on public.service_attendance(church_id);
create index if not exists idx_service_media_service_record_id on public.service_media(service_record_id);
create index if not exists idx_service_media_church_id on public.service_media(church_id);
create index if not exists idx_groups_church_id on public.groups(church_id);
create index if not exists idx_group_members_group_id on public.group_members(group_id);
create index if not exists idx_group_visits_group_id on public.group_visits(group_id);
create index if not exists idx_group_visits_church_id on public.group_visits(church_id);
create index if not exists idx_group_visits_scheduled_for on public.group_visits(scheduled_for desc);
create index if not exists idx_messages_church_id on public.messages(church_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
create unique index if not exists uq_praises_church_title on public.praises(church_id, lower(titulo));

-- =========================
-- FUNÇÕES UTILITÁRIAS / TRIGGERS
-- =========================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_pastor_admin()
returns trigger
language plpgsql
as $$
begin
  if new.cargo = 'pastor' then
    new.is_admin = true;
  end if;
  return new;
end;
$$;

create or replace function public.sync_visit_confirmation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmada' and old.status is distinct from 'confirmada' then
    new.confirmed_at = coalesce(new.confirmed_at, now());
  elsif new.status = 'pendente' then
    new.confirmed_at = null;
  end if;
  return new;
end;
$$;

create or replace function public.validate_pre_service_people()
returns trigger
language plpgsql
as $$
declare
  dirigente_ok boolean;
  pregador_ok boolean;
begin
  select exists (
    select 1
    from public.profiles p
    join public.user_churches uc on uc.user_id = p.id
    where p.id = new.dirigente_louvor_id
      and uc.church_id = new.church_id
      and p.is_super_admin = false
      and p.cargo in ('pastor', 'ungido', 'diacono', 'obreiro')
  ) into dirigente_ok;

  if not dirigente_ok then
    raise exception 'Dirigente do louvor inválido para esta igreja';
  end if;

  select exists (
    select 1
    from public.profiles p
    join public.user_churches uc on uc.user_id = p.id
    where p.id = new.pregador_id
      and uc.church_id = new.church_id
      and p.is_super_admin = false
      and p.cargo in ('pastor', 'ungido', 'diacono', 'obreiro')
  ) into pregador_ok;

  if not pregador_ok then
    raise exception 'Pregador inválido para esta igreja';
  end if;

  return new;
end;
$$;

create or replace function public.validate_group_responsavel()
returns trigger
language plpgsql
as $$
declare
  responsavel_ok boolean;
begin
  select exists (
    select 1
    from public.user_churches uc
    where uc.user_id = new.responsavel_id
      and uc.church_id = new.church_id
  ) into responsavel_ok;

  if not responsavel_ok then
    raise exception 'O responsável do grupo deve estar vinculado à igreja do grupo';
  end if;

  return new;
end;
$$;

create or replace function public.validate_group_visit_context()
returns trigger
language plpgsql
as $$
declare
  group_church_id uuid;
  group_responsavel_id uuid;
begin
  select g.church_id, g.responsavel_id
    into group_church_id, group_responsavel_id
  from public.groups g
  where g.id = new.group_id;

  if group_church_id is null then
    raise exception 'Grupo da visita não encontrado';
  end if;

  if new.church_id <> group_church_id then
    raise exception 'church_id da visita difere do church_id do grupo';
  end if;

  if new.responsavel_id <> group_responsavel_id then
    raise exception 'responsavel_id da visita deve ser o responsável atual do grupo';
  end if;

  return new;
end;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_super_admin = true
      and p.ativo = true
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.ativo = true
      and (p.is_admin = true or p.cargo = 'pastor')
  );
$$;

create or replace function public.is_member_of_church(target_church uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_churches uc
    join public.profiles p on p.id = uc.user_id
    where uc.user_id = auth.uid()
      and uc.church_id = target_church
      and p.ativo = true
  );
$$;

create or replace function public.is_admin_of_church(target_church uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_churches uc
    join public.profiles p on p.id = uc.user_id
    where uc.user_id = auth.uid()
      and uc.church_id = target_church
      and p.ativo = true
      and (p.is_admin = true or p.cargo = 'pastor')
  );
$$;

create or replace function public.is_leader_of_church(target_church uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_churches uc
    join public.profiles p on p.id = uc.user_id
    where uc.user_id = auth.uid()
      and uc.church_id = target_church
      and p.ativo = true
      and (
        p.is_admin = true
        or p.cargo in ('pastor', 'ungido', 'diacono', 'obreiro', 'secretaria', 'louvor')
      )
  );
$$;

create or replace function public.shares_church_with_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
  or target_profile = auth.uid()
  or exists (
    select 1
    from public.user_churches mine
    join public.user_churches other
      on other.church_id = mine.church_id
    where mine.user_id = auth.uid()
      and other.user_id = target_profile
  );
$$;

create or replace function public.can_manage_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
  or (
    public.current_user_is_admin()
    and exists (
      select 1
      from public.user_churches mine
      join public.user_churches other
        on other.church_id = mine.church_id
      where mine.user_id = auth.uid()
        and other.user_id = target_profile
    )
  );
$$;

create or replace function public.can_view_group_visits(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.groups g
    join public.profiles p on p.id = auth.uid()
    join public.user_churches uc on uc.user_id = auth.uid() and uc.church_id = g.church_id
    where g.id = target_group
      and p.ativo = true
      and (
        g.responsavel_id = auth.uid()
        or p.cargo = 'pastor'
        or p.is_admin = true
      )
  );
$$;

-- Triggers

drop trigger if exists trg_churches_touch_updated_at on public.churches;
create trigger trg_churches_touch_updated_at
before update on public.churches
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_profiles_enforce_pastor_admin on public.profiles;
create trigger trg_profiles_enforce_pastor_admin
before insert or update on public.profiles
for each row
execute function public.enforce_pastor_admin();

drop trigger if exists trg_praises_touch_updated_at on public.praises;
create trigger trg_praises_touch_updated_at
before update on public.praises
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_pre_services_touch_updated_at on public.pre_services;
create trigger trg_pre_services_touch_updated_at
before update on public.pre_services
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_pre_services_validate_people on public.pre_services;
create trigger trg_pre_services_validate_people
before insert or update on public.pre_services
for each row
execute function public.validate_pre_service_people();

drop trigger if exists trg_service_records_touch_updated_at on public.service_records;
create trigger trg_service_records_touch_updated_at
before update on public.service_records
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_groups_touch_updated_at on public.groups;
create trigger trg_groups_touch_updated_at
before update on public.groups
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_groups_validate_responsavel on public.groups;
create trigger trg_groups_validate_responsavel
before insert or update on public.groups
for each row
execute function public.validate_group_responsavel();

drop trigger if exists trg_group_visits_touch_updated_at on public.group_visits;
create trigger trg_group_visits_touch_updated_at
before update on public.group_visits
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_group_visits_sync_confirmation on public.group_visits;
create trigger trg_group_visits_sync_confirmation
before update on public.group_visits
for each row
execute function public.sync_visit_confirmation();

drop trigger if exists trg_group_visits_validate_context on public.group_visits;
create trigger trg_group_visits_validate_context
before insert or update on public.group_visits
for each row
execute function public.validate_group_visit_context();

-- =========================
-- STORAGE BUCKET
-- =========================
insert into storage.buckets (id, name, public)
values ('cult-media', 'cult-media', false)
on conflict (id) do nothing;

-- =========================
-- RLS
-- =========================
alter table public.churches enable row level security;
alter table public.profiles enable row level security;
alter table public.user_churches enable row level security;
alter table public.praises enable row level security;
alter table public.pre_services enable row level security;
alter table public.pre_service_praises enable row level security;
alter table public.service_records enable row level security;
alter table public.service_record_praises enable row level security;
alter table public.service_attendance enable row level security;
alter table public.service_media enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_visits enable row level security;
alter table public.messages enable row level security;

-- churches

drop policy if exists churches_select on public.churches;
create policy churches_select
on public.churches
for select
using (public.is_member_of_church(id));

drop policy if exists churches_insert on public.churches;
create policy churches_insert
on public.churches
for insert
with check (public.current_user_is_admin());

drop policy if exists churches_update on public.churches;
create policy churches_update
on public.churches
for update
using (public.is_admin_of_church(id))
with check (public.is_admin_of_church(id));

drop policy if exists churches_delete on public.churches;
create policy churches_delete
on public.churches
for delete
using (public.is_admin_of_church(id));

-- profiles

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
using (public.shares_church_with_profile(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert
on public.profiles
for insert
with check (public.current_user_is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles
for update
using (public.can_manage_profile(id) or id = auth.uid())
with check (public.can_manage_profile(id) or id = auth.uid());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete
on public.profiles
for delete
using (public.can_manage_profile(id));

-- user_churches

drop policy if exists user_churches_select on public.user_churches;
create policy user_churches_select
on public.user_churches
for select
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.is_member_of_church(church_id)
);

drop policy if exists user_churches_insert on public.user_churches;
create policy user_churches_insert
on public.user_churches
for insert
with check (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.is_admin_of_church(church_id)
);

drop policy if exists user_churches_delete on public.user_churches;
create policy user_churches_delete
on public.user_churches
for delete
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.is_admin_of_church(church_id)
);

-- praises

drop policy if exists praises_select on public.praises;
create policy praises_select
on public.praises
for select
using (public.is_member_of_church(church_id));

drop policy if exists praises_insert on public.praises;
create policy praises_insert
on public.praises
for insert
with check (public.is_leader_of_church(church_id));

drop policy if exists praises_update on public.praises;
create policy praises_update
on public.praises
for update
using (public.is_admin_of_church(church_id))
with check (public.is_admin_of_church(church_id));

drop policy if exists praises_delete on public.praises;
create policy praises_delete
on public.praises
for delete
using (public.is_admin_of_church(church_id));

-- pre_services

drop policy if exists pre_services_select on public.pre_services;
create policy pre_services_select
on public.pre_services
for select
using (public.is_leader_of_church(church_id));

drop policy if exists pre_services_insert on public.pre_services;
create policy pre_services_insert
on public.pre_services
for insert
with check (public.is_leader_of_church(church_id));

drop policy if exists pre_services_update on public.pre_services;
create policy pre_services_update
on public.pre_services
for update
using (public.is_leader_of_church(church_id))
with check (public.is_leader_of_church(church_id));

drop policy if exists pre_services_delete on public.pre_services;
create policy pre_services_delete
on public.pre_services
for delete
using (public.is_admin_of_church(church_id));

-- pre_service_praises

drop policy if exists pre_service_praises_select on public.pre_service_praises;
create policy pre_service_praises_select
on public.pre_service_praises
for select
using (public.is_leader_of_church(church_id));

drop policy if exists pre_service_praises_insert on public.pre_service_praises;
create policy pre_service_praises_insert
on public.pre_service_praises
for insert
with check (public.is_leader_of_church(church_id));

drop policy if exists pre_service_praises_update on public.pre_service_praises;
create policy pre_service_praises_update
on public.pre_service_praises
for update
using (public.is_leader_of_church(church_id))
with check (public.is_leader_of_church(church_id));

drop policy if exists pre_service_praises_delete on public.pre_service_praises;
create policy pre_service_praises_delete
on public.pre_service_praises
for delete
using (public.is_admin_of_church(church_id));

-- service_records

drop policy if exists service_records_select on public.service_records;
create policy service_records_select
on public.service_records
for select
using (public.is_leader_of_church(church_id));

drop policy if exists service_records_insert on public.service_records;
create policy service_records_insert
on public.service_records
for insert
with check (public.is_leader_of_church(church_id));

drop policy if exists service_records_update on public.service_records;
create policy service_records_update
on public.service_records
for update
using (public.is_leader_of_church(church_id))
with check (public.is_leader_of_church(church_id));

drop policy if exists service_records_delete on public.service_records;
create policy service_records_delete
on public.service_records
for delete
using (public.is_admin_of_church(church_id));

-- service_record_praises

drop policy if exists service_record_praises_select on public.service_record_praises;
create policy service_record_praises_select
on public.service_record_praises
for select
using (public.is_leader_of_church(church_id));

drop policy if exists service_record_praises_insert on public.service_record_praises;
create policy service_record_praises_insert
on public.service_record_praises
for insert
with check (public.is_leader_of_church(church_id));

drop policy if exists service_record_praises_update on public.service_record_praises;
create policy service_record_praises_update
on public.service_record_praises
for update
using (public.is_leader_of_church(church_id))
with check (public.is_leader_of_church(church_id));

drop policy if exists service_record_praises_delete on public.service_record_praises;
create policy service_record_praises_delete
on public.service_record_praises
for delete
using (public.is_admin_of_church(church_id));

-- service_attendance

drop policy if exists service_attendance_select on public.service_attendance;
create policy service_attendance_select
on public.service_attendance
for select
using (public.is_leader_of_church(church_id));

drop policy if exists service_attendance_insert on public.service_attendance;
create policy service_attendance_insert
on public.service_attendance
for insert
with check (public.is_leader_of_church(church_id));

drop policy if exists service_attendance_update on public.service_attendance;
create policy service_attendance_update
on public.service_attendance
for update
using (public.is_leader_of_church(church_id))
with check (public.is_leader_of_church(church_id));

drop policy if exists service_attendance_delete on public.service_attendance;
create policy service_attendance_delete
on public.service_attendance
for delete
using (public.is_admin_of_church(church_id));

-- service_media

drop policy if exists service_media_select on public.service_media;
create policy service_media_select
on public.service_media
for select
using (public.is_leader_of_church(church_id));

drop policy if exists service_media_insert on public.service_media;
create policy service_media_insert
on public.service_media
for insert
with check (public.is_leader_of_church(church_id));

drop policy if exists service_media_update on public.service_media;
create policy service_media_update
on public.service_media
for update
using (public.is_leader_of_church(church_id))
with check (public.is_leader_of_church(church_id));

drop policy if exists service_media_delete on public.service_media;
create policy service_media_delete
on public.service_media
for delete
using (public.is_admin_of_church(church_id));

-- groups

drop policy if exists groups_select on public.groups;
create policy groups_select
on public.groups
for select
using (public.is_leader_of_church(church_id));

drop policy if exists groups_insert on public.groups;
create policy groups_insert
on public.groups
for insert
with check (public.is_admin_of_church(church_id));

drop policy if exists groups_update on public.groups;
create policy groups_update
on public.groups
for update
using (public.is_admin_of_church(church_id))
with check (public.is_admin_of_church(church_id));

drop policy if exists groups_delete on public.groups;
create policy groups_delete
on public.groups
for delete
using (public.is_admin_of_church(church_id));

-- group_members

drop policy if exists group_members_select on public.group_members;
create policy group_members_select
on public.group_members
for select
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_id
      and public.is_leader_of_church(g.church_id)
  )
);

drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert
on public.group_members
for insert
with check (
  exists (
    select 1
    from public.groups g
    where g.id = group_id
      and public.is_admin_of_church(g.church_id)
  )
);

drop policy if exists group_members_update on public.group_members;
create policy group_members_update
on public.group_members
for update
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_id
      and public.is_admin_of_church(g.church_id)
  )
)
with check (
  exists (
    select 1
    from public.groups g
    where g.id = group_id
      and public.is_admin_of_church(g.church_id)
  )
);

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete
on public.group_members
for delete
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_id
      and public.is_admin_of_church(g.church_id)
  )
);

-- group_visits

drop policy if exists group_visits_select on public.group_visits;
create policy group_visits_select
on public.group_visits
for select
using (public.can_view_group_visits(group_id));

drop policy if exists group_visits_insert on public.group_visits;
create policy group_visits_insert
on public.group_visits
for insert
with check (public.can_view_group_visits(group_id));

drop policy if exists group_visits_update on public.group_visits;
create policy group_visits_update
on public.group_visits
for update
using (public.can_view_group_visits(group_id))
with check (public.can_view_group_visits(group_id));

drop policy if exists group_visits_delete on public.group_visits;
create policy group_visits_delete
on public.group_visits
for delete
using (public.is_admin_of_church(church_id));

-- messages

drop policy if exists messages_select on public.messages;
create policy messages_select
on public.messages
for select
using (
  public.is_member_of_church(church_id)
  and (
    target_type = 'todos'
    or from_id = auth.uid()
    or target_user_id = auth.uid()
    or public.current_user_is_admin()
  )
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert
on public.messages
for insert
with check (
  public.is_member_of_church(church_id)
  and (
    from_id = auth.uid()
    or public.is_super_admin()
  )
);

drop policy if exists messages_update on public.messages;
create policy messages_update
on public.messages
for update
using (
  from_id = auth.uid()
  or public.is_admin_of_church(church_id)
)
with check (
  from_id = auth.uid()
  or public.is_admin_of_church(church_id)
);

drop policy if exists messages_delete on public.messages;
create policy messages_delete
on public.messages
for delete
using (
  from_id = auth.uid()
  or public.is_admin_of_church(church_id)
);

-- =========================
-- STORAGE POLICIES
-- =========================
-- Caminho esperado: cult-media/<church_id>/<service_record_id>/<arquivo>

drop policy if exists cult_media_select on storage.objects;
create policy cult_media_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cult-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.is_leader_of_church((storage.foldername(name))[1]::uuid)
);

drop policy if exists cult_media_insert on storage.objects;
create policy cult_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cult-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.is_leader_of_church((storage.foldername(name))[1]::uuid)
);

drop policy if exists cult_media_update on storage.objects;
create policy cult_media_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cult-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.is_leader_of_church((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'cult-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.is_leader_of_church((storage.foldername(name))[1]::uuid)
);

drop policy if exists cult_media_delete on storage.objects;
create policy cult_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cult-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.is_admin_of_church((storage.foldername(name))[1]::uuid)
);

commit;
