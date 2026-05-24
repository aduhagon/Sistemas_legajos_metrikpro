// ============================================================
// Tipos del Panel SuperAdmin — MétrikPro
// ============================================================

export type Severidad = 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFO'
export type Plan = 'core' | 'addon' | 'premium'

export interface Tenant {
  id: string
  nombre: string
  slug: string
  activo: boolean
  created_at: string
}

export interface GrupoModulo {
  id: string
  grupo_id: string
  modulo: string
  activo: boolean
  plan: Plan
  config: Record<string, unknown> | null
  updated_at: string
  updated_by: string | null
}

export interface SuperadminAlerta {
  id: string
  grupo_id: string | null
  tipo: string
  severidad: Severidad
  mensaje: string
  datos_json: Record<string, unknown> | null
  resuelta: boolean
  created_at: string
  // join
  grupo_nombre?: string
}

export interface SuperadminAuditLog {
  id: string
  superadmin_id: string
  accion: string
  grupo_id: string | null
  datos_json: Record<string, unknown> | null
  created_at: string
}

export interface TenantConEstado extends Tenant {
  alertas_criticas: number
  alertas_activas: number
  total_proveedores: number
  modulos_activos: string[]
  semaforo: 'verde' | 'amarillo' | 'rojo'
}

export interface KPIsGlobales {
  tenants_activos: number
  tenants_totales: number
  tenants_con_alertas: number
  proveedores_totales: number
  alertas_criticas_activas: number
}

// Módulos del sistema con metadata
export const MODULOS_CONFIG: Record<string, {
  nombre: string
  plan: Plan
  descripcion: string
  toggleable: boolean
  dependencias?: string[]
}> = {
  m1_autoregistro:  { nombre: 'Autoregistro',       plan: 'core',    descripcion: 'Registro público de proveedores',          toggleable: false },
  m2_documentos:    { nombre: 'Documentos',          plan: 'core',    descripcion: 'Gestión documental con vencimientos',       toggleable: false },
  m3_evaluacion:    { nombre: 'Evaluación',          plan: 'core',    descripcion: 'Evaluación humana del legajo',             toggleable: false },
  m4_qr:            { nombre: 'Carnet QR',           plan: 'core',    descripcion: 'Carnet QR dinámico por proveedor',         toggleable: false },
  m7_cron:          { nombre: 'Cron vencimientos',   plan: 'core',    descripcion: 'Notificaciones automáticas a las 8am',     toggleable: false },
  m8_portal:        { nombre: 'Portal proveedor',    plan: 'core',    descripcion: 'Portal autenticado del proveedor',         toggleable: false },
  m5_gps:           { nombre: 'GPS',                 plan: 'addon',   descripcion: 'Control de acceso georeferencial',         toggleable: true  },
  m9_equipos:       { nombre: 'Equipos',             plan: 'addon',   descripcion: 'Gestión de equipos y bienes de uso',       toggleable: true  },
  m10_usuarios:     { nombre: 'Usuarios internos',   plan: 'addon',   descripcion: 'Evaluadores, operarios, porteros',         toggleable: true  },
  m11_auditoria:    { nombre: 'Auditoría campo',     plan: 'addon',   descripcion: 'App de auditoría offline-first',           toggleable: true  },
  m13_admin_prov:   { nombre: 'Admin proveedor',     plan: 'addon',   descripcion: 'Rol para cargar docs en nombre del titular', toggleable: true },
  scope_establec:   { nombre: 'Scope establec.',     plan: 'addon',   descripcion: 'Scope de establecimientos por usuario',    toggleable: true  },
  multi_rubro:      { nombre: 'Multi-rubro',         plan: 'addon',   descripcion: 'Proveedores con múltiples rubros',         toggleable: true  },
  m12_ia:           { nombre: 'IA (Claude API)',      plan: 'premium', descripcion: 'Evaluación documental con IA',             toggleable: true  },
  api_publica:      { nombre: 'API pública',         plan: 'premium', descripcion: 'API REST para integración ERP',            toggleable: true  },
  white_label:      { nombre: 'White-label',         plan: 'premium', descripcion: 'Branding personalizado',                  toggleable: true  },
}
