-- ============================================================
--  AUTH-KIT: Schema base de autenticación y branding
--  Paso 1 de 2 — ejecutar primero
-- ============================================================

-- ── 1. GRUPOS DE TRABAJO (tenants / empresas cliente) ────────
create table if not exists grupos_trabajo (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,
  activo     boolean not null default true,
  created_at timestamptz default now()
);

-- Grupo inicial del cliente
insert into grupos_trabajo (nombre, slug)
values ('MétrikPro', 'metrikpro')
on conflict (slug) do nothing;

-- ── 2. USUARIOS INTERNOS ──────────────────────────────────────
-- Extiende auth.users de Supabase. id = mismo UUID que auth.users.
-- Roles del sistema de legajos: admin, evaluador, operador_acceso
create table if not exists usuarios (
  id           uuid primary key references auth.users(id) on delete cascade,
  grupo_id     uuid not null references grupos_trabajo(id) on delete cascade,
  nombre       text not null,
  email        text not null,
  rol          text not null default 'evaluador'
                 check (rol in ('admin', 'evaluador', 'operador_acceso')),
  primer_login boolean not null default true,
  activo       boolean not null default true,
  created_at   timestamptz default now()
);

create index if not exists usuarios_grupo_id_idx on usuarios(grupo_id);
create index if not exists usuarios_email_idx on usuarios(email);

-- ── 3. CONFIGURACIÓN VISUAL (branding por empresa) ───────────
create table if not exists grupos_config (
  id               uuid primary key default gen_random_uuid(),
  grupo_id         uuid not null unique references grupos_trabajo(id) on delete cascade,
  nombre_display   text,
  tagline          text,
  color_primario   text not null default '#1E3A5F',
  color_acento     text not null default '#2B5CE6',
  color_fondo      text not null default '#F2F0EB',
  tipografia       text not null default 'Inter',
  logo_url         text,
  fondo_login_url  text,
  updated_at       timestamptz default now()
);

-- Config inicial del cliente
insert into grupos_config (grupo_id, nombre_display, tagline)
select id, 'Sistema de Legajos', 'Gestión de proveedores y contratistas'
from grupos_trabajo where slug = 'metrikpro'
on conflict (grupo_id) do nothing;

-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────
alter table grupos_trabajo enable row level security;
alter table usuarios       enable row level security;
alter table grupos_config  enable row level security;

-- grupos_trabajo: todos pueden leer activos (para el login)
create policy "grupos_trabajo_read_all"
  on grupos_trabajo for select
  using (activo = true);

-- usuarios: solo puede ver/editar su propio registro
create policy "usuarios_select_own"
  on usuarios for select
  using (id = auth.uid());

create policy "usuarios_update_own"
  on usuarios for update
  using (id = auth.uid());

-- usuarios: admin puede ver todos los de su grupo
create policy "usuarios_admin_select"
  on usuarios for select
  using (
    grupo_id in (select grupo_id from usuarios where id = auth.uid())
    and exists (
      select 1 from usuarios where id = auth.uid() and rol = 'admin'
    )
  );

-- grupos_config: miembros del grupo pueden leer
create policy "grupos_config_read"
  on grupos_config for select
  using (grupo_id in (select grupo_id from usuarios where id = auth.uid()));

-- grupos_config: solo admin puede escribir
create policy "grupos_config_write"
  on grupos_config for all
  using (
    grupo_id in (
      select grupo_id from usuarios where id = auth.uid() and rol = 'admin'
    )
  );

-- ── 5. STORAGE: bucket "assets" ───────────────────────────────
-- Crear manualmente en Supabase: Storage → New bucket → "assets" → Public: ON
-- Luego ejecutar estas políticas:

create policy "assets_upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'assets');

create policy "assets_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'assets');

create policy "assets_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'assets');

-- ── 6. STORAGE: bucket "documentos" ──────────────────────────
-- Para los PDFs de los legajos (privado, control por rol)
-- Crear en Supabase: Storage → New bucket → "documentos" → Public: OFF

create policy "documentos_upload_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos');

create policy "documentos_read_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos');

-- ── 7. FUNCIÓN: crear usuario interno desde admin ─────────────
create or replace function crear_usuario_interno(
  p_grupo_id   uuid,
  p_email      text,
  p_nombre     text,
  p_rol        text default 'evaluador'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    gen_random_uuid(),
    p_email,
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', p_nombre),
    now(), now()
  )
  returning id into v_user_id;

  insert into usuarios (id, grupo_id, nombre, email, rol, primer_login, activo)
  values (v_user_id, p_grupo_id, p_nombre, p_email, p_rol, true, true);

  return v_user_id;
end;
$$;
