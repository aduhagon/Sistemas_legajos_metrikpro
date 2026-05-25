"use client";
// src/app/portal/components/EquiposTab.tsx
// Tab de equipos/bienes de uso en el portal del proveedor

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TipoEquipo {
  id: string;
  nombre: string;
  icono: string;
}

interface DocRequerido {
  id: string; // documentos_requeridos_equipo.id
  nombre: string;
  tipo_vigencia: "PERMANENTE" | "ANUAL" | "MENSUAL";
  obligatorio: boolean;
}

interface DocEquipo {
  id: string; // documentos_equipo.id
  tipo_doc_id: string;
  estado: "PENDIENTE" | "CARGADO" | "APROBADO" | "RECHAZADO" | "VENCIDO";
  fecha_venc: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  // join
  documentos_requeridos_equipo: DocRequerido;
}

interface Equipo {
  id: string;
  dominio: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  seguro_compania: string | null;
  seguro_poliza: string | null;
  seguro_vto: string | null;
  estado: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO" | "INACTIVO";
  tipos_equipo: TipoEquipo;
  documentos_equipo: DocEquipo[];
}

interface EquiposTabProps {
  proveedorId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  PENDIENTE:   { label: "Pendiente",   cls: "bg-gray-100 text-gray-600" },
  EN_REVISION: { label: "En revisión", cls: "bg-blue-100 text-blue-700" },
  APROBADO:    { label: "Aprobado",    cls: "bg-green-100 text-green-700" },
  RECHAZADO:   { label: "Rechazado",   cls: "bg-red-100 text-red-700" },
  INACTIVO:    { label: "Inactivo",    cls: "bg-gray-100 text-gray-400" },
};

const DOC_ESTADO_ICON: Record<string, string> = {
  PENDIENTE: "○",
  CARGADO:   "⏳",
  APROBADO:  "✓",
  RECHAZADO: "✗",
  VENCIDO:   "!",
};

const DOC_ESTADO_CLS: Record<string, string> = {
  PENDIENTE: "text-gray-400",
  CARGADO:   "text-blue-500",
  APROBADO:  "text-green-600",
  RECHAZADO: "text-red-500",
  VENCIDO:   "text-orange-500",
};

function requiereFechaVenc(vigencia: string) {
  return vigencia === "ANUAL" || vigencia === "MENSUAL";
}

// ─── Modal de Upload ──────────────────────────────────────────────────────────

interface UploadModalProps {
  doc: DocEquipo;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ doc, onClose, onSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fechaVenc, setFechaVenc] = useState(doc.fecha_venc ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const vigencia = doc.documentos_requeridos_equipo.tipo_vigencia;
  const needsFecha = requiereFechaVenc(vigencia);

  async function handleSubmit() {
    if (!file) { setError("Seleccioná un archivo"); return; }
    if (needsFecha && !fechaVenc) { setError("Ingresá la fecha de vencimiento"); return; }

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_id", doc.id);
    if (needsFecha && fechaVenc) fd.append("fecha_venc", fechaVenc);

    try {
      const res = await fetch("/api/proveedor/upload-equipo", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir");
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">
            Subir: {doc.documentos_requeridos_equipo.nombre}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* Drag & drop */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4 ${
            dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="text-sm">
              <p className="font-medium text-gray-700 truncate">{file.name}</p>
              <p className="text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              <p className="text-2xl mb-1">📄</p>
              <p>Arrastrá el archivo o hacé click</p>
              <p className="text-xs mt-1">PDF, JPG, PNG, WEBP · máx. 10 MB</p>
            </div>
          )}
        </div>

        {/* Fecha de vencimiento */}
        {needsFecha && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de vencimiento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fechaVenc}
              onChange={(e) => setFechaVenc(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !file}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Subiendo..." : "Subir documento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Nuevo Equipo ────────────────────────────────────────────────────

interface NuevoEquipoModalProps {
  proveedorId: string;
  tiposEquipo: TipoEquipo[];
  onClose: () => void;
  onSuccess: () => void;
}

function NuevoEquipoModal({ proveedorId, tiposEquipo, onClose, onSuccess }: NuevoEquipoModalProps) {
  const supabase = createClient();
  const [form, setForm] = useState({
    tipo_equipo_id: tiposEquipo[0]?.id ?? "",
    dominio: "",
    marca: "",
    modelo: "",
    anio: "",
    seguro_compania: "",
    seguro_poliza: "",
    seguro_vto: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.dominio.trim()) { setError("El dominio/patente es requerido"); return; }
    if (!form.tipo_equipo_id) { setError("Seleccioná un tipo de equipo"); return; }

    setLoading(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc("registrar_equipo", {
      p_proveedor_id: proveedorId,
      p_tipo_equipo_id: form.tipo_equipo_id,
      p_dominio: form.dominio.trim().toUpperCase(),
      p_marca: form.marca || null,
      p_modelo: form.modelo || null,
      p_anio: form.anio ? parseInt(form.anio) : null,
      p_seguro_compania: form.seguro_compania || null,
      p_seguro_poliza: form.seguro_poliza || null,
      p_seguro_vto: form.seguro_vto || null,
    });

    setLoading(false);

    if (rpcErr) { setError(rpcErr.message); return; }
    if (data && !data.ok) { setError(data.error ?? "Error al registrar"); return; }

    onSuccess();
    onClose();
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-8 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-800 text-lg">Registrar nuevo equipo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="space-y-4">
          {/* Tipo de equipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de equipo <span className="text-red-500">*</span>
            </label>
            <select
              value={form.tipo_equipo_id}
              onChange={(e) => set("tipo_equipo_id", e.target.value)}
              className={inputCls}
            >
              {tiposEquipo.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icono} {t.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Dominio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dominio / Patente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej: AB123CD"
              value={form.dominio}
              onChange={(e) => set("dominio", e.target.value.toUpperCase())}
              className={inputCls + " uppercase"}
            />
          </div>

          {/* Marca y Modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input
                type="text"
                placeholder="Ej: Ford"
                value={form.marca}
                onChange={(e) => set("marca", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input
                type="text"
                placeholder="Ej: F-100"
                value={form.modelo}
                onChange={(e) => set("modelo", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Año */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <input
              type="number"
              placeholder="Ej: 2018"
              min={1950}
              max={new Date().getFullYear() + 1}
              value={form.anio}
              onChange={(e) => set("anio", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Seguro */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Datos del seguro (opcional)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Compañía aseguradora</label>
                <input
                  type="text"
                  placeholder="Ej: La Caja"
                  value={form.seguro_compania}
                  onChange={(e) => set("seguro_compania", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nº de póliza</label>
                  <input
                    type="text"
                    placeholder="Ej: 1234567"
                    value={form.seguro_poliza}
                    onChange={(e) => set("seguro_poliza", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vencimiento del seguro</label>
                  <input
                    type="date"
                    value={form.seguro_vto}
                    onChange={(e) => set("seguro_vto", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mt-4">{error}</p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Registrando..." : "Registrar equipo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de Equipo ───────────────────────────────────────────────────────────

interface EquipoCardProps {
  equipo: Equipo;
  onUpload: (doc: DocEquipo) => void;
}

function EquipoCard({ equipo, onUpload }: EquipoCardProps) {
  const [open, setOpen] = useState(false);
  const badge = ESTADO_BADGE[equipo.estado] ?? ESTADO_BADGE.PENDIENTE;

  const docsVencidos = equipo.documentos_equipo.filter((d) => d.estado === "VENCIDO").length;
  const docsPendientes = equipo.documentos_equipo.filter((d) => d.estado === "PENDIENTE").length;

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      {/* Header del equipo */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-2xl">{equipo.tipos_equipo.icono}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 font-mono">
              {equipo.dominio}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
              {badge.label}
            </span>
            {docsVencidos > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                ⚠ {docsVencidos} vencido{docsVencidos > 1 ? "s" : ""}
              </span>
            )}
            {docsPendientes > 0 && docsVencidos === 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {docsPendientes} pendiente{docsPendientes > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {equipo.tipos_equipo.nombre}
            {equipo.marca && ` · ${equipo.marca}`}
            {equipo.modelo && ` ${equipo.modelo}`}
            {equipo.anio && ` (${equipo.anio})`}
          </p>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {/* Panel expandido */}
      {open && (
        <div className="border-t bg-gray-50 px-4 py-3 space-y-3">
          {/* Datos del seguro si existen */}
          {equipo.seguro_compania && (
            <div className="text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border">
              <span className="font-medium">Seguro:</span> {equipo.seguro_compania}
              {equipo.seguro_poliza && ` · Póliza ${equipo.seguro_poliza}`}
              {equipo.seguro_vto && ` · Vto: ${equipo.seguro_vto}`}
            </div>
          )}

          {/* Lista de documentos */}
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Documentos requeridos
          </p>
          {equipo.documentos_equipo.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Sin documentos configurados</p>
          ) : (
            <div className="space-y-2">
              {equipo.documentos_equipo.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border"
                >
                  <span
                    className={`text-lg font-bold w-5 text-center ${DOC_ESTADO_CLS[doc.estado]}`}
                  >
                    {DOC_ESTADO_ICON[doc.estado]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {doc.documentos_requeridos_equipo.nombre}
                    </p>
                    <p className="text-xs text-gray-400">
                      {doc.estado === "APROBADO" && doc.fecha_venc
                        ? `Vence: ${doc.fecha_venc}`
                        : doc.estado === "RECHAZADO" && doc.observaciones
                        ? `Rechazado: ${doc.observaciones}`
                        : doc.documentos_requeridos_equipo.tipo_vigencia === "PERMANENTE"
                        ? "Documento permanente"
                        : "Sin fecha de vencimiento"}
                    </p>
                  </div>
                  {/* Botón subir / renovar */}
                  {(doc.estado === "PENDIENTE" ||
                    doc.estado === "RECHAZADO" ||
                    doc.estado === "VENCIDO" ||
                    doc.estado === "CARGADO") && (
                    <button
                      onClick={() => onUpload(doc)}
                      className={`text-xs px-3 py-1 rounded-lg font-medium ${
                        doc.estado === "VENCIDO" || doc.estado === "RECHAZADO"
                          ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                          : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      }`}
                    >
                      {doc.estado === "PENDIENTE" ? "Subir" : "Renovar"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function EquiposTab({ proveedorId }: EquiposTabProps) {
  const supabase = createClient();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [tiposEquipo, setTiposEquipo] = useState<TipoEquipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [uploadDoc, setUploadDoc] = useState<DocEquipo | null>(null);

  async function cargarDatos() {
    setLoading(true);

    // Cargar tipos de equipo
    const { data: tipos } = await supabase
      .from("tipos_equipo")
      .select("id, nombre, icono")
      .eq("activo", true)
      .order("nombre");

    if (tipos) setTiposEquipo(tipos);

    // Cargar equipos con sus documentos
    const { data: eqs } = await supabase
      .from("equipos_contratista")
      .select(`
        id, dominio, marca, modelo, anio,
        seguro_compania, seguro_poliza, seguro_vto, estado,
        tipos_equipo (id, nombre, icono),
        documentos_equipo (
          id, tipo_doc_id, estado, fecha_venc, archivo_url, observaciones,
          documentos_requeridos_equipo (id, nombre, tipo_vigencia, obligatorio)
        )
      `)
      .eq("proveedor_id", proveedorId)
      .order("created_at", { ascending: false });

    if (eqs) setEquipos(eqs as unknown as Equipo[]);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId]);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-2xl mb-2">⚙️</p>
        <p>Cargando equipos...</p>
      </div>
    );
  }

  const totalVencidos = equipos.reduce(
    (acc, eq) => acc + eq.documentos_equipo.filter((d) => d.estado === "VENCIDO").length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Equipos y bienes de uso</h2>
          <p className="text-sm text-gray-400">
            {equipos.length} equipo{equipos.length !== 1 ? "s" : ""} registrado
            {equipos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowNuevoModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <span>+</span> Agregar equipo
        </button>
      </div>

      {/* Banner de alerta si hay docs vencidos */}
      {totalVencidos > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-orange-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-orange-800">
              {totalVencidos} documento{totalVencidos > 1 ? "s" : ""} vencido
              {totalVencidos > 1 ? "s" : ""} en tus equipos
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              Los equipos con documentos vencidos bloquean el acceso al establecimiento.
              Renovalos a la brevedad.
            </p>
          </div>
        </div>
      )}

      {/* Lista de equipos */}
      {equipos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-4xl mb-3">🚛</p>
          <p className="text-gray-500 font-medium">No tenés equipos registrados</p>
          <p className="text-sm text-gray-400 mt-1">
            Registrá tus vehículos y maquinaria para gestionar su documentación
          </p>
          <button
            onClick={() => setShowNuevoModal(true)}
            className="mt-4 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Registrar primer equipo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {equipos.map((eq) => (
            <EquipoCard key={eq.id} equipo={eq} onUpload={setUploadDoc} />
          ))}
        </div>
      )}

      {/* Modal nuevo equipo */}
      {showNuevoModal && (
        <NuevoEquipoModal
          proveedorId={proveedorId}
          tiposEquipo={tiposEquipo}
          onClose={() => setShowNuevoModal(false)}
          onSuccess={cargarDatos}
        />
      )}

      {/* Modal upload documento */}
      {uploadDoc && (
        <UploadModal
          doc={uploadDoc}
          onClose={() => setUploadDoc(null)}
          onSuccess={cargarDatos}
        />
      )}
    </div>
  );
}
