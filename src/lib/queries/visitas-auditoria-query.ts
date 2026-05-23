// src/lib/queries/visitas-auditoria.ts
// Query compartida para cargar visitas con joins completos

export const VISITAS_AUDITORIA_QUERY = `
  id,
  visitado_at,
  resultado,
  estado_supervision,
  observacion,
  supervision_obs,
  offline,
  lat,
  lng,
  auditor:auditor_id ( nombre ),
  proveedor:proveedor_id ( razon_social, cuit ),
  establecimiento:establecimiento_id ( nombre ),
  checklist:visitas_checklist (
    cumple,
    observacion,
    item:checklist_id ( nombre )
  )
`
