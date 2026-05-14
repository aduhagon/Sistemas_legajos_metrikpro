-- ============================================================
--  SISTEMA DE LEGAJOS: Schema de negocio
--  Paso 2 de 2 — ejecutar después del 01_auth_kit.sql
-- ============================================================

-- ── 1. ESTABLECIMIENTOS ───────────────────────────────────────
create table if not exists establecimientos (
  id           uuid primary key default gen_random_uuid(),
  grupo_id     uuid not null references grupos_trabajo(id) on delete cascade,
  nombre       text not null,
  lat_centro   numeric(10,7),
  lng_centro   numeric(10,7),
  radio_metros integer not null default 100,
  id_externo   text,                          -- para futura integración ERP
  activo       boolean not null default true,
  created_at   timestamptz default now()
);

-- ── 2. RUBROS ─────────────────────────────────────────────────
create table if not exists rubros (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos_trabajo(id) on delete cascade,
  codigo      integer not null,               -- 1-9 del sistema Access legado
  nombre      text not null,
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz default now(),
  unique (grupo_id, codigo)
);

-- Seed: 9 rubros validados operativamente en el sistema Access
insert into rubros (grupo_id, codigo, nombre) 
select g.id, r.codigo, r.nombre
from grupos_trabajo g
cross join (values
  (1, 'Fletes'),
  (2, 'Intermediarios de fletes'),
  (3, 'Arrendamiento'),
  (4, 'Insumos agrícolas'),
  (5, 'Operadores de granos'),
  (6, 'Prestadores de servicios'),
  (7, 'Construcción de obra'),
  (8, 'Operadores de derivados'),
  (9, 'General')
) as r(codigo, nombre)
where g.slug = 'metrikpro'
on conflict (grupo_id, codigo) do nothing;

-- ── 3. DOCUMENTOS REQUERIDOS POR RUBRO ───────────────────────
create type tipo_vigencia as enum ('PERMANENTE', 'ANUAL', 'MENSUAL');

create table if not exists documentos_requeridos (
  id                    uuid primary key default gen_random_uuid(),
  grupo_id              uuid not null references grupos_trabajo(id) on delete cascade,
  rubro_id              uuid references rubros(id),  -- null = aplica a todos los rubros
  codigo                text not null,               -- G-01, I-01, V-03, etc.
  nombre                text not null,
  descripcion           text,
  obligatorio           boolean not null default true,
  aplica_persona_fisica boolean not null default true,
  aplica_persona_juridica boolean not null default true,
  tipo_vigencia         tipo_vigencia not null default 'ANUAL',
  activo                boolean not null default true,
  created_at            timestamptz default now(),
  unique (grupo_id, codigo)
);

-- Seed: catálogo de documentos del sistema Access (muestra principal)
-- Documentos generales (rubro_id = null → aplican a todos)
insert into documentos_requeridos (grupo_id, codigo, nombre, tipo_vigencia, aplica_persona_fisica, aplica_persona_juridica)
select g.id, d.codigo, d.nombre, d.vigencia::tipo_vigencia, d.apf, d.apj
from grupos_trabajo g
cross join (values
  ('G-01', 'Apertura de Operaciones',            'PERMANENTE', false, false),  -- INDIVIDUAL
  ('G-02', 'Acta Constitutiva / Estatuto / Contrato Social', 'ANUAL', false, true),
  ('G-05', 'Balance auditado y certificado',      'ANUAL',      false, true),
  ('G-06', 'Copia DNI del contratista',           'PERMANENTE', true,  false),
  ('G-07', 'Carta de indemnidad',                 'PERMANENTE', false, false),  -- INDIVIDUAL
  ('G-08', 'Documentación sub-contratistas',      'ANUAL',      true,  true),
  ('I-01', 'Constancia inscripción AFIP',         'MENSUAL',    true,  true),
  ('I-02', 'Constancia inscripción IIBB',         'ANUAL',      true,  true),
  ('I-03', 'CM 05 - Convenio Multilateral',       'ANUAL',      true,  true),
  ('V-03', 'Comprobante pago Resp. Civil Equipos','MENSUAL',    true,  true)
) as d(codigo, nombre, vigencia, apf, apj)
where g.slug = 'metrikpro'
on conflict (grupo_id, codigo) do nothing;

-- ── 4. PROVEEDORES EXTERNOS ───────────────────────────────────
create type tipo_proveedor as enum ('PF', 'PJ');          -- Persona Física / Jurídica
create type tipo_contratista as enum ('PERMANENTE', 'ESPORADICO', 'INDIVIDUAL');
create type estado_proveedor as enum ('PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO');

create table if not exists proveedores (
  id                  uuid primary key default gen_random_uuid(),
  grupo_id            uuid not null references grupos_trabajo(id) on delete cascade,
  establecimiento_id  uuid references establecimientos(id),
  razon_social        text not null,
  cuit                text not null,
  tipo_proveedor      tipo_proveedor not null default 'PJ',
  tipo_contratista    tipo_contratista not null default 'PERMANENTE',
  rubro_id            uuid references rubros(id),
  contacto_interno_id uuid references usuarios(id),      -- evaluador asignado
  email               text not null,
  telefono            text,
  estado              estado_proveedor not null default 'PENDIENTE',
  proveedor_id_padre  uuid references proveedores(id),   -- para subcontratistas
  id_externo          text,                              -- para futura integración ERP
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (grupo_id, cuit)
);

create index if not exists proveedores_grupo_id_idx    on proveedores(grupo_id);
create index if not exists proveedores_estado_idx      on proveedores(estado);
create index if not exists proveedores_rubro_id_idx    on proveedores(rubro_id);

-- ── 5. DOCUMENTOS DEL LEGAJO ──────────────────────────────────
create type estado_documento as enum ('PENDIENTE', 'CARGADO', 'APROBADO', 'RECHAZADO', 'VENCIDO');

create table if not exists documentos_legajo (
  id              uuid primary key default gen_random_uuid(),
  proveedor_id    uuid not null references proveedores(id) on delete cascade,
  tipo_doc_id     uuid not null references documentos_requeridos(id),
  archivo_url     text,                                  -- URL en Supabase Storage
  hash_sha256     text,                                  -- integridad del archivo
  fecha_venc      date,
  estado          estado_documento not null default 'PENDIENTE',
  observaciones   text,
  evaluador_id    uuid references usuarios(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists documentos_legajo_proveedor_idx on documentos_legajo(proveedor_id);
create index if not exists documentos_legajo_estado_idx    on documentos_legajo(estado);
create index if not exists documentos_legajo_venc_idx      on documentos_legajo(fecha_venc);

-- ── 6. EVALUACIONES DEL LEGAJO ────────────────────────────────
create type tipo_evaluacion as enum ('IA', 'HUMANO');
create type resultado_evaluacion as enum ('APROBADO', 'RECHAZADO', 'PENDIENTE_CORRECCIONES');

create table if not exists evaluaciones (
  id           uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  evaluador_id uuid references usuarios(id),             -- null si tipo = IA
  tipo         tipo_evaluacion not null,
  resultado    resultado_evaluacion not null,
  observaciones text,
  created_at   timestamptz default now()
);

-- ── 7. HABILITACIONES Y CARNET QR ────────────────────────────
create type estado_habilitacion as enum ('VIGENTE', 'VENCIDA', 'SUSPENDIDA', 'DOC_PENDIENTE');

create table if not exists habilitaciones (
  id           uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  fecha_alta   date not null default current_date,
  fecha_venc   date,
  qr_token     text not null unique default gen_random_uuid()::text,
  estado       estado_habilitacion not null default 'VIGENTE',
  emitida_por  uuid references usuarios(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── 8. REGISTROS DE ACCESO GEOREFERENCIAL ────────────────────
create type tipo_acceso as enum ('INGRESO', 'EGRESO');

create table if not exists registros_acceso (
  id              uuid primary key default gen_random_uuid(),
  habilitacion_id uuid not null references habilitaciones(id),
  tipo            tipo_acceso not null,
  lat             numeric(10,7),
  lng             numeric(10,7),
  precision_m     numeric(6,1),                          -- precisión GPS en metros
  device_id       text,
  dentro_perimetro boolean,                              -- validado contra radio del establecimiento
  created_at      timestamptz default now()
);

create index if not exists registros_acceso_habilitacion_idx on registros_acceso(habilitacion_id);
create index if not exists registros_acceso_created_idx      on registros_acceso(created_at desc);

-- ── 9. LOG DE AUDITORÍA (append-only, inmutable) ─────────────
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,                                      -- null para acciones del sistema/IA
  entidad     text not null,                             -- nombre de la tabla afectada
  entidad_id  uuid,
  accion      text not null,                             -- CREATE, UPDATE, APPROVE, REJECT, etc.
  datos_json  jsonb,                                     -- snapshot del estado anterior/nuevo
  ip          inet,
  created_at  timestamptz default now()
);

create index if not exists audit_log_entidad_idx    on audit_log(entidad, entidad_id);
create index if not exists audit_log_user_id_idx    on audit_log(user_id);
create index if not exists audit_log_created_idx    on audit_log(created_at desc);

-- Audit log es de solo lectura para todos los roles (append-only)
alter table audit_log enable row level security;

create policy "audit_log_read_admin"
  on audit_log for select
  using (
    exists (
      select 1 from usuarios where id = auth.uid() and rol = 'admin'
    )
  );

-- Solo el sistema puede insertar en audit_log (vía función SECURITY DEFINER)
-- Ningún rol puede hacer UPDATE ni DELETE

-- ── 10. RLS PARA TABLAS DE NEGOCIO ───────────────────────────
alter table establecimientos    enable row level security;
alter table rubros              enable row level security;
alter table documentos_requeridos enable row level security;
alter table proveedores         enable row level security;
alter table documentos_legajo   enable row level security;
alter table evaluaciones        enable row level security;
alter table habilitaciones      enable row level security;
alter table registros_acceso    enable row level security;

-- Establecimientos: solo usuarios del mismo grupo
create policy "establecimientos_grupo"
  on establecimientos for all
  using (grupo_id in (select grupo_id from usuarios where id = auth.uid()));

-- Rubros: lectura para todos los autenticados del grupo; escritura solo admin
create policy "rubros_read"
  on rubros for select
  using (grupo_id in (select grupo_id from usuarios where id = auth.uid()));

create policy "rubros_write_admin"
  on rubros for all
  using (grupo_id in (select grupo_id from usuarios where id = auth.uid() and rol = 'admin'));

-- Documentos requeridos: igual que rubros
create policy "docs_requeridos_read"
  on documentos_requeridos for select
  using (grupo_id in (select grupo_id from usuarios where id = auth.uid()));

create policy "docs_requeridos_write_admin"
  on documentos_requeridos for all
  using (grupo_id in (select grupo_id from usuarios where id = auth.uid() and rol = 'admin'));

-- Proveedores: admin y evaluador ven todos del grupo; operador_acceso ve solo los habilitados
create policy "proveedores_read_interno"
  on proveedores for select
  using (grupo_id in (select grupo_id from usuarios where id = auth.uid()));

create policy "proveedores_write_evaluador"
  on proveedores for update
  using (grupo_id in (
    select grupo_id from usuarios where id = auth.uid() and rol in ('admin', 'evaluador')
  ));

-- Documentos legajo: admin y evaluador
create policy "documentos_legajo_read"
  on documentos_legajo for select
  using (
    proveedor_id in (
      select p.id from proveedores p
      join usuarios u on u.grupo_id = p.grupo_id
      where u.id = auth.uid()
    )
  );

-- Habilitaciones: todos los roles internos pueden leer
create policy "habilitaciones_read"
  on habilitaciones for select
  using (
    proveedor_id in (
      select p.id from proveedores p
      join usuarios u on u.grupo_id = p.grupo_id
      where u.id = auth.uid()
    )
  );

-- Registros acceso: admin y operador_acceso
create policy "registros_acceso_read"
  on registros_acceso for select
  using (
    exists (select 1 from usuarios where id = auth.uid() and rol in ('admin', 'operador_acceso', 'evaluador'))
  );

-- ── 11. FUNCIÓN: insertar en audit_log (uso interno) ─────────
create or replace function log_auditoria(
  p_user_id    uuid,
  p_entidad    text,
  p_entidad_id uuid,
  p_accion     text,
  p_datos_json jsonb default null,
  p_ip         inet  default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into audit_log (user_id, entidad, entidad_id, accion, datos_json, ip)
  values (p_user_id, p_entidad, p_entidad_id, p_accion, p_datos_json, p_ip);
end;
$$;

-- ── 12. FUNCIÓN: validar QR en punto de acceso ────────────────
create or replace function validar_qr(p_qr_token text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_hab habilitaciones%rowtype;
  v_prov proveedores%rowtype;
begin
  select * into v_hab from habilitaciones where qr_token = p_qr_token;
  
  if not found then
    return jsonb_build_object('valido', false, 'motivo', 'QR no encontrado');
  end if;

  if v_hab.estado != 'VIGENTE' then
    return jsonb_build_object('valido', false, 'motivo', v_hab.estado, 'habilitacion_id', v_hab.id);
  end if;

  if v_hab.fecha_venc is not null and v_hab.fecha_venc < current_date then
    return jsonb_build_object('valido', false, 'motivo', 'HABILITACION_VENCIDA', 'habilitacion_id', v_hab.id);
  end if;

  select * into v_prov from proveedores where id = v_hab.proveedor_id;

  return jsonb_build_object(
    'valido',          true,
    'habilitacion_id', v_hab.id,
    'proveedor_id',    v_prov.id,
    'razon_social',    v_prov.razon_social,
    'cuit',            v_prov.cuit,
    'estado',          v_hab.estado,
    'fecha_venc',      v_hab.fecha_venc
  );
end;
$$;
