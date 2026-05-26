import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type ApiKeyContext = {
  grupo_id: string
  permisos: string[]
  key_id: string
}

export type ApiAuthError = {
  error: { code: string; message: string; status: number }
}

/**
 * Extrae y valida la API key del header X-API-Key.
 * Retorna el contexto del tenant si es válida, o un error tipado si no.
 *
 * Uso en un route:
 *   const auth = await validateApiKey(request)
 *   if ('error' in auth) return apiError(auth.error)
 *   // auth.grupo_id, auth.permisos disponibles
 */
export async function validateApiKey(
  req: NextRequest
): Promise<ApiKeyContext | ApiAuthError> {
  const rawKey = req.headers.get('X-API-Key')

  if (!rawKey) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Header X-API-Key requerido',
        status: 401,
      },
    }
  }

  // Hashear la key recibida para comparar con lo almacenado
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const { data, error } = await supabaseAdmin.rpc('fn_validar_api_key', {
    p_key_hash: keyHash,
  })

  if (error || !data || data.length === 0) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'API key inválida, inactiva o expirada',
        status: 401,
      },
    }
  }

  const row = data[0]
  return {
    grupo_id: row.grupo_id,
    permisos: row.permisos,
    key_id: row.key_id,
  }
}

/**
 * Verifica que el contexto tenga un permiso específico.
 * Ejemplo: hasPermission(auth, 'write:proveedores')
 */
export function hasPermission(ctx: ApiKeyContext, permiso: string): boolean {
  return ctx.permisos.includes(permiso) || ctx.permisos.includes('*')
}

/**
 * Respuesta de error estándar para todos los routes v1
 */
export function apiError(err: { code: string; message: string; status: number }) {
  return Response.json(
    { ok: false, error: { code: err.code, message: err.message, status: err.status } },
    { status: err.status }
  )
}

/**
 * Genera una API key nueva: retorna { key, keyHash, keyPrefix }
 * El caller guarda keyHash y keyPrefix en BD; key se muestra solo una vez al usuario.
 */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `mlk_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(key).digest('hex')
  const keyPrefix = key.slice(0, 12) + '...'
  return { key, keyHash, keyPrefix }
}
