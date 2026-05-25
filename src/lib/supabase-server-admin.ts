// src/lib/supabase-server-admin.ts
// Cliente con service role para queries que deben bypassear RLS.
// SOLO usar en Server Components y API routes — NUNCA exponer al cliente.

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
