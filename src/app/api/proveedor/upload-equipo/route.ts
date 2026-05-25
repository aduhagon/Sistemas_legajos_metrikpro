// src/app/api/proveedor/upload-equipo/route.ts
// Espejo de /api/proveedor/upload pero para documentos de equipos contratista

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // 1. Verificar sesión
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2. Verificar que el usuario es proveedor activo (titular)
  const { data: provUser } = await supabase
    .from("proveedores_usuarios")
    .select("proveedor_id, rol")
    .eq("user_id", user.id)
    .eq("activo", true)
    .single();

  if (!provUser) {
    return NextResponse.json({ error: "Sin acceso de proveedor" }, { status: 403 });
  }

  // 3. Leer form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const docId = formData.get("doc_id") as string | null;
  const fechaVenc = formData.get("fecha_venc") as string | null; // ISO date "YYYY-MM-DD" o null

  if (!file || !docId) {
    return NextResponse.json({ error: "Faltan campos: file, doc_id" }, { status: 400 });
  }

  // 4. Validar tipo y tamaño
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido. Use PDF, JPG, PNG o WEBP" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 10 MB" },
      { status: 400 }
    );
  }

  // 5. Verificar que el doc_id pertenece a un equipo del proveedor
  const { data: docEquipo } = await supabase
    .from("documentos_equipo")
    .select("id, equipo_id, equipos_contratista!inner(proveedor_id)")
    .eq("id", docId)
    .eq("equipos_contratista.proveedor_id", provUser.proveedor_id)
    .single();

  if (!docEquipo) {
    return NextResponse.json(
      { error: "Documento no encontrado o sin permisos" },
      { status: 403 }
    );
  }

  // 6. Calcular hash SHA-256 server-side
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // 7. Upload a Storage
  const ext = file.name.split(".").pop() ?? "pdf";
  const storagePath = `equipos/${provUser.proveedor_id}/${docId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[upload-equipo] Storage error:", uploadError);
    return NextResponse.json(
      { error: "Error al subir el archivo" },
      { status: 500 }
    );
  }

  // 8. Obtener URL firmada (1 año)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("documentos")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signedError || !signedData?.signedUrl) {
    console.error("[upload-equipo] SignedUrl error:", signedError);
    return NextResponse.json(
      { error: "Error al generar URL del archivo" },
      { status: 500 }
    );
  }

  // 9. Llamar RPC presentar_documento_equipo
  const { error: rpcError } = await supabase.rpc("presentar_documento_equipo", {
    p_doc_id: docId,
    p_archivo_url: signedData.signedUrl,
    p_hash_sha256: hash,
    p_fecha_venc: fechaVenc || null,
  });

  if (rpcError) {
    console.error("[upload-equipo] RPC error:", rpcError);
    return NextResponse.json(
      { error: "Error al registrar el documento" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, archivo_url: signedData.signedUrl });
}
