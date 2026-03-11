"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import StatusBadge from "@/components/StatusBadge";

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface PersonalRecord {
  id: string;
  createdTime?: string;
  fields: {
    "ID Empleado": string;
    "Nombre completo": string;
    "Tipo Personal": string;
    "Estado de actividad": string;
    "Correo electrónico": string;
    "Teléfono": string;
    "Numero Documento": string;
    "Cargo": string;
    "Area": string;
    "Fecha de Ingreso": string;
    "Fecha de Retiro": string;
  };
}

interface DocRecord {
  id: string;
  fields: {
    "ID Registro": string;
    "ID_Empleado": string;
    "Nombre_Empleado": string;
    "Código_Documento": string;
    "Nombre_Documento": string;
    "Capítulo": string;
    "Periodicidad": string;
    "Estado": string;
    "Período": string;
    "Fecha de Cumplimiento": string;
    "Fecha de Carga": string;
    "Ruta_Carpeta": string;
    "URL_OneDrive": string;
    "Observaciones": string;
    "Tipo_Documento_ID": string;
  };
}

interface FormData {
  nombreCompleto: string;
  tipoPersonal: string;
  estadoActividad: string;
  correo: string;
  telefono: string;
  cedula: string;
  cargo: string;
  area: string;
  fechaIngreso: string;
  fechaRetiro: string;
}

type SectionKey = "personal" | "documentos";
type VinculacionTab = "activos" | "inactivos" | "proceso";
type DocTab = "todos" | "pendiente" | "cumplido" | "proceso";
type ModalMode = "create" | "edit" | "view" | null;

const EMPTY_FORM: FormData = {
  nombreCompleto: "",
  tipoPersonal: "Empleado",
  estadoActividad: "Activo",
  correo: "",
  telefono: "",
  cedula: "",
  cargo: "",
  area: "",
  fechaIngreso: "",
  fechaRetiro: "",
};

const TIPOS_PERSONAL = ["Empleado", "Contratista", "Aprendiz", "Practicante"];
const ESTADOS_ACTIVIDAD = ["Activo", "Inactivo", "Retirado", "En proceso", "Pendiente"];
const DOC_ESTADOS = ["Pendiente", "En proceso", "Cumplido", "No aplica"];

const CHAPTER_LABELS: Record<string, string> = {
  VLC: "Vinculación Laboral",
  SPS: "Salarios y Prestaciones",
  SSP: "Seguridad Social",
  SST: "Seguridad y Salud",
  JYD: "Jornadas y Descansos",
  OGE: "Obligaciones Generales",
  DVL: "Desvinculación",
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function VinculacionPage() {
  // Top-level section
  const [section, setSection] = useState<SectionKey>("personal");

  // ── Personal state ──
  const [personal, setPersonal] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<VinculacionTab>("activos");
  const [search, setSearch] = useState("");

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedRecord, setSelectedRecord] = useState<PersonalRecord | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<PersonalRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Documentos state ──
  const [docRecords, setDocRecords] = useState<DocRecord[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docTab, setDocTab] = useState<DocTab>("todos");
  const [docSearch, setDocSearch] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterChapter, setFilterChapter] = useState("");

  // Doc detail modal
  const [selectedDoc, setSelectedDoc] = useState<DocRecord | null>(null);
  const [editDocState, setEditDocState] = useState("");
  const [editDocObs, setEditDocObs] = useState("");
  const [editDocUrl, setEditDocUrl] = useState("");
  const [docSaving, setDocSaving] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     PERSONAL — Fetch + CRUD
     ═══════════════════════════════════════════════════════════════════════════ */

  const fetchPersonal = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vinculacion");
      if (!res.ok) throw new Error("Error al cargar datos");
      const data = await res.json();
      setPersonal(data.personal);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonal();
  }, [fetchPersonal]);

  const handleCreate = async () => {
    if (!form.nombreCompleto.trim()) { setFormError("El nombre completo es obligatorio"); return; }
    if (!form.tipoPersonal) { setFormError("El tipo de personal es obligatorio"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/vinculacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear registro");
      }
      showToast("Empleado vinculado exitosamente");
      setModalMode(null);
      setForm(EMPTY_FORM);
      await fetchPersonal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRecord) return;
    if (!form.nombreCompleto.trim()) { setFormError("El nombre completo es obligatorio"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/vinculacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRecord.id, ...form }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar registro");
      }
      showToast("Registro actualizado exitosamente");
      setModalMode(null);
      setSelectedRecord(null);
      setForm(EMPTY_FORM);
      await fetchPersonal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/vinculacion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar registro");
      }
      showToast("Registro eliminado exitosamente");
      setDeleteTarget(null);
      await fetchPersonal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setSelectedRecord(null);
    setModalMode("create");
  };

  const openEdit = (record: PersonalRecord) => {
    setSelectedRecord(record);
    setForm({
      nombreCompleto: record.fields["Nombre completo"] || "",
      tipoPersonal: record.fields["Tipo Personal"] || "Empleado",
      estadoActividad: record.fields["Estado de actividad"] || "Activo",
      correo: record.fields["Correo electrónico"] || "",
      telefono: record.fields["Teléfono"] || "",
      cedula: record.fields["Numero Documento"] || "",
      cargo: record.fields["Cargo"] || "",
      area: record.fields["Area"] || "",
      fechaIngreso: record.fields["Fecha de Ingreso"] || "",
      fechaRetiro: record.fields["Fecha de Retiro"] || "",
    });
    setFormError(null);
    setModalMode("edit");
  };

  const openView = (record: PersonalRecord) => {
    setSelectedRecord(record);
    setModalMode("view");
  };

  // Personal filters
  const activos = personal.filter((p) => p.fields["Estado de actividad"] === "Activo");
  const inactivos = personal.filter((p) => ["Inactivo", "Retirado"].includes(p.fields["Estado de actividad"]));
  const enProceso = personal.filter((p) => ["En proceso", "Pendiente"].includes(p.fields["Estado de actividad"]));
  const currentList = tab === "activos" ? activos : tab === "inactivos" ? inactivos : enProceso;
  const filtered = currentList.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.fields["Nombre completo"] || "").toLowerCase().includes(s) ||
      (p.fields["ID Empleado"] || "").toLowerCase().includes(s) ||
      (p.fields["Correo electrónico"] || "").toLowerCase().includes(s) ||
      (p.fields["Numero Documento"] || "").toLowerCase().includes(s) ||
      (p.fields["Cargo"] || "").toLowerCase().includes(s)
    );
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     DOCUMENTOS — Fetch + Update
     ═══════════════════════════════════════════════════════════════════════════ */

  const fetchDocs = useCallback(async () => {
    try {
      setDocLoading(true);
      const res = await fetch("/api/documentos");
      if (!res.ok) throw new Error("Error al cargar documentos");
      const data = await res.json();
      setDocRecords(data.registros);
      setDocError(null);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDocLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === "documentos" && docRecords.length === 0 && !docLoading) {
      fetchDocs();
    }
  }, [section, docRecords.length, docLoading, fetchDocs]);

  // Set of contractor names — excluded from document management
  const contractorNames = useMemo(() => {
    const set = new Set<string>();
    personal.forEach((p) => {
      if (p.fields["Tipo Personal"] === "Contratista") {
        const name = (p.fields["Nombre completo"] || "").replace(/\s+/g, " ").trim();
        if (name) set.add(name);
      }
    });
    return set;
  }, [personal]);

  // Employee → Area map from personal records (excluding contractors)
  const employeeAreaMap = useMemo(() => {
    const map = new Map<string, string>();
    personal.forEach((p) => {
      const name = (p.fields["Nombre completo"] || "").replace(/\s+/g, " ").trim();
      if (name && p.fields["Area"] && !contractorNames.has(name)) map.set(name, p.fields["Area"]);
    });
    return map;
  }, [personal, contractorNames]);

  // Areas list (excluding contractors)
  const areas = useMemo(() => {
    const set = new Set<string>();
    personal.forEach((p) => {
      if (p.fields["Area"] && p.fields["Tipo Personal"] !== "Contratista") set.add(p.fields["Area"]);
    });
    return Array.from(set).sort();
  }, [personal]);

  // Employees filtered by area selection (excluding contractors)
  const docEmployees = useMemo(() => {
    const names = new Set<string>();
    docRecords.forEach((r) => {
      const name = r.fields.Nombre_Empleado;
      if (!name || name === "Documento General / Corporativo") return;
      if (contractorNames.has(name)) return;
      if (filterArea) {
        const empArea = employeeAreaMap.get(name);
        if (empArea !== filterArea) return;
      }
      names.add(name);
    });
    return Array.from(names).sort();
  }, [docRecords, filterArea, employeeAreaMap, contractorNames]);

  // Chapters
  const chapters = useMemo(() => {
    const caps = new Set<string>();
    docRecords.forEach((r) => {
      const code = r.fields["Código_Documento"]?.split("-")[0];
      if (code) caps.add(code);
    });
    return Array.from(caps).sort();
  }, [docRecords]);

  // Doc stats (excluding contractors)
  const docStats = useMemo(() => {
    const docs = docRecords.filter((r) => !contractorNames.has(r.fields.Nombre_Empleado));
    const total = docs.length;
    const pendiente = docs.filter((r) => r.fields.Estado === "Pendiente").length;
    const cumplido = docs.filter((r) => r.fields.Estado === "Cumplido").length;
    const enProceso = docs.filter((r) => r.fields.Estado === "En proceso").length;
    const noAplica = docs.filter((r) => r.fields.Estado === "No aplica").length;
    const pct = total > 0 ? Math.round((cumplido / (total - noAplica || 1)) * 100) : 0;
    return { total, pendiente, cumplido, enProceso, noAplica, pct };
  }, [docRecords, contractorNames]);

  // Per-employee summary grouped by area (excluding contractors)
  const employeeDocSummary = useMemo(() => {
    const map = new Map<string, { total: number; pendiente: number; cumplido: number; enProceso: number; area: string }>();
    docRecords.forEach((r) => {
      const name = r.fields.Nombre_Empleado;
      if (!name || name === "Documento General / Corporativo") return;
      if (contractorNames.has(name)) return;
      if (!map.has(name)) {
        const area = employeeAreaMap.get(name) || "Sin área";
        map.set(name, { total: 0, pendiente: 0, cumplido: 0, enProceso: 0, area });
      }
      const s = map.get(name)!;
      s.total++;
      if (r.fields.Estado === "Pendiente") s.pendiente++;
      else if (r.fields.Estado === "Cumplido") s.cumplido++;
      else if (r.fields.Estado === "En proceso") s.enProceso++;
    });
    return map;
  }, [docRecords, employeeAreaMap, contractorNames]);

  // Filtered docs (excluding contractors)
  const filteredDocs = useMemo(() => {
    let list = docRecords.filter((r) => !contractorNames.has(r.fields.Nombre_Empleado));

    if (docTab === "pendiente") list = list.filter((r) => r.fields.Estado === "Pendiente");
    else if (docTab === "cumplido") list = list.filter((r) => r.fields.Estado === "Cumplido");
    else if (docTab === "proceso") list = list.filter((r) => r.fields.Estado === "En proceso");

    if (filterArea) {
      list = list.filter((r) => {
        if (r.fields.Nombre_Empleado === "Documento General / Corporativo") return true;
        return employeeAreaMap.get(r.fields.Nombre_Empleado) === filterArea;
      });
    }

    if (filterEmployee) list = list.filter((r) => r.fields.Nombre_Empleado === filterEmployee);
    if (filterChapter) list = list.filter((r) => r.fields["Código_Documento"]?.startsWith(filterChapter + "-"));

    if (docSearch) {
      const s = docSearch.toLowerCase();
      list = list.filter((r) =>
        r.fields.Nombre_Empleado?.toLowerCase().includes(s) ||
        r.fields["Nombre_Documento"]?.toLowerCase().includes(s) ||
        r.fields["Código_Documento"]?.toLowerCase().includes(s) ||
        r.fields.ID_Empleado?.toLowerCase().includes(s)
      );
    }

    return list;
  }, [docRecords, docTab, filterArea, filterEmployee, filterChapter, docSearch, employeeAreaMap, contractorNames]);

  // Doc update handler
  const handleDocUpdate = async () => {
    if (!selectedDoc) return;
    setDocSaving(true);
    try {
      const body: Record<string, string> = { id: selectedDoc.id };
      if (editDocState !== selectedDoc.fields.Estado) body["Estado"] = editDocState;
      if (editDocObs !== (selectedDoc.fields.Observaciones || "")) body["Observaciones"] = editDocObs;
      if (editDocUrl !== (selectedDoc.fields.URL_OneDrive || "")) body["URL_OneDrive"] = editDocUrl;
      if (editDocState === "Cumplido" && !selectedDoc.fields["Fecha de Cumplimiento"]) {
        body["Fecha de Cumplimiento"] = new Date().toISOString().split("T")[0];
      }
      if (Object.keys(body).length <= 1) {
        setSelectedDoc(null);
        return;
      }
      const res = await fetch("/api/documentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar");
      }
      showToast("Registro actualizado exitosamente");
      setSelectedDoc(null);
      await fetchDocs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al actualizar", "error");
    } finally {
      setDocSaving(false);
    }
  };

  const openDocDetail = (r: DocRecord) => {
    setSelectedDoc(r);
    setEditDocState(r.fields.Estado);
    setEditDocObs(r.fields.Observaciones || "");
    setEditDocUrl(r.fields.URL_OneDrive || "");
    setUploadFile(null);
    setUploadProgress("");
  };

  const handleFileUpload = async () => {
    if (!selectedDoc || !uploadFile) return;
    const ruta = selectedDoc.fields.Ruta_Carpeta;
    if (!ruta) {
      showToast("Este registro no tiene carpeta OneDrive asignada", "error");
      return;
    }
    setUploading(true);
    setUploadProgress("Subiendo archivo...");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("recordId", selectedDoc.id);
      fd.append("rutaCarpeta", ruta);
      const res = await fetch("/api/documentos/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir archivo");
      setUploadProgress("");
      showToast("Archivo subido exitosamente a OneDrive");
      setSelectedDoc(null);
      setUploadFile(null);
      await fetchDocs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al subir", "error");
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     Loading / Error
     ═══════════════════════════════════════════════════════════════════════════ */

  if (loading && personal.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">Cargando personal...</p>
        </div>
      </div>
    );
  }

  if (error && personal.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-2xl bg-white/[0.03] border border-red-500/20 p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-white">Error al cargar</h2>
          <p className="text-white/40 mt-2 text-sm">{error}</p>
          <button onClick={fetchPersonal} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <>
      <div className="space-y-8">
        {/* ── Section Toggle ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.08] w-fit">
          {([
            { key: "personal" as SectionKey, label: "Personal", icon: "👥" },
            { key: "documentos" as SectionKey, label: "Gestión Documental", icon: "📄" },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                section === s.key
                  ? "bg-white/[0.12] text-white border border-white/[0.15] shadow-lg shadow-black/10"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
           SECTION: PERSONAL
           ════════════════════════════════════════════════════════════════ */}
        {section === "personal" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Vinculados (Activos)",
                  count: activos.length,
                  icon: (
                    <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  ),
                },
                {
                  label: "Desvinculados",
                  count: inactivos.length,
                  icon: (
                    <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  ),
                },
                {
                  label: "En Proceso",
                  count: enProceso.length,
                  icon: (
                    <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] p-5 shadow-2xl shadow-black/20 hover:bg-white/[0.1] transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{stat.label}</p>
                      <p className="text-3xl font-extrabold text-white mt-1">{stat.count}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center backdrop-blur-sm">
                      {stat.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: "activos" as VinculacionTab, label: "Activos", count: activos.length },
                    { key: "inactivos" as VinculacionTab, label: "Desvinculados", count: inactivos.length },
                    { key: "proceso" as VinculacionTab, label: "En Proceso", count: enProceso.length },
                  ]).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        tab === t.key
                          ? "bg-white/[0.08] text-white border border-white/[0.1]"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                      }`}
                    >
                      {t.label} ({t.count})
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative max-w-xs w-full">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Buscar empleado..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    />
                  </div>
                  <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.12] hover:bg-white/[0.18] backdrop-blur-sm border border-white/[0.15] text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-black/10 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Nuevo Empleado
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
              <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg backdrop-blur-sm">
                      👥
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {tab === "activos" ? "Personal Vinculado" : tab === "inactivos" ? "Personal Desvinculado" : "En Proceso de Vinculación"}
                      </h3>
                      <p className="text-sm text-white/40 mt-0.5">{filtered.length} empleados</p>
                    </div>
                  </div>
                  {loading && <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                      {["ID Empleado", "Nombre Completo", "Cédula", "Tipo", "Cargo", "Estado", "Correo", "Teléfono", "Acciones"].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-16 text-center">
                          <p className="text-white/30 text-sm">No se encontraron registros</p>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.03] group transition-colors">
                          <td className="px-5 py-4 text-sm font-medium text-white/60 font-mono">{p.fields["ID Empleado"] || "—"}</td>
                          <td className="px-5 py-4">
                            <button onClick={() => openView(p)} className="text-sm font-medium text-white hover:text-white/70 transition-colors text-left">
                              {p.fields["Nombre completo"] || "—"}
                            </button>
                          </td>
                          <td className="px-5 py-4 text-sm text-white/50 font-mono">{p.fields["Numero Documento"] || "—"}</td>
                          <td className="px-5 py-4 text-sm text-white/50">{p.fields["Tipo Personal"] || "—"}</td>
                          <td className="px-5 py-4 text-sm text-white/50">{p.fields["Cargo"] || "—"}</td>
                          <td className="px-5 py-4">
                            <StatusBadge status={p.fields["Estado de actividad"]} />
                          </td>
                          <td className="px-5 py-4 text-sm text-white/50 max-w-[200px] truncate">{p.fields["Correo electrónico"] || "—"}</td>
                          <td className="px-5 py-4 text-sm text-white/50">{p.fields["Teléfono"] || "—"}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openView(p)} className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors" title="Ver detalle">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                              <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors" title="Editar">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteTarget(p)} className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-red-300 transition-colors" title="Eliminar">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
           SECTION: DOCUMENTOS
           ════════════════════════════════════════════════════════════════ */}
        {section === "documentos" && (
          <>
            {docLoading && docRecords.length === 0 ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
                  <p className="mt-6 text-white/40 font-medium text-sm">Cargando gestión documental...</p>
                </div>
              </div>
            ) : docError && docRecords.length === 0 ? (
              <div className="flex items-center justify-center py-32">
                <div className="rounded-2xl bg-white/[0.03] border border-red-500/20 p-8 max-w-md text-center">
                  <h2 className="text-lg font-semibold text-white">Error al cargar documentos</h2>
                  <p className="text-white/40 mt-2 text-sm">{docError}</p>
                  <button onClick={fetchDocs} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
                    Reintentar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Doc Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Registros", count: docStats.total, icon: "📋" },
                    { label: "Pendientes", count: docStats.pendiente, icon: "⏳" },
                    { label: "Cumplidos", count: docStats.cumplido, icon: "✅" },
                    { label: "Cumplimiento", count: `${docStats.pct}%`, icon: "📊" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] p-5 shadow-2xl shadow-black/20 hover:bg-white/[0.1] transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{stat.label}</p>
                          <p className="text-3xl font-extrabold text-white mt-1">{stat.count}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xl backdrop-blur-sm">
                          {stat.icon}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cumplimiento por Área / Empleado */}
                <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
                  <div className="px-6 py-4 border-b border-white/[0.08] bg-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg">🏢</div>
                      <div>
                        <h3 className="text-base font-bold text-white">Cumplimiento por Área y Empleado</h3>
                        <p className="text-xs text-white/40">{areas.length} áreas · {docEmployees.length} empleados</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
                    {areas.map((area) => {
                      const areaEmployees = Array.from(employeeDocSummary.entries())
                        .filter(([, s]) => s.area === area)
                        .sort((a, b) => b[1].pendiente - a[1].pendiente);

                      if (areaEmployees.length === 0) return null;

                      const areaTotal = areaEmployees.reduce((acc, [, s]) => acc + s.total, 0);
                      const areaCumplido = areaEmployees.reduce((acc, [, s]) => acc + s.cumplido, 0);
                      const areaPct = areaTotal > 0 ? Math.round((areaCumplido / areaTotal) * 100) : 0;

                      return (
                        <div key={area} className="rounded-xl border border-white/[0.08] overflow-hidden">
                          <button
                            onClick={() => setFilterArea(filterArea === area ? "" : area)}
                            className={`w-full flex items-center justify-between px-4 py-3 transition-all ${
                              filterArea === area ? "bg-white/[0.1]" : "bg-white/[0.03] hover:bg-white/[0.06]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm">🏢</span>
                              <span className="text-sm font-semibold text-white">{area}</span>
                              <span className="text-xs text-white/30">{areaEmployees.length} empleados</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                <div className="h-full bg-white/40 rounded-full" style={{ width: `${areaPct}%` }} />
                              </div>
                              <span className="text-xs text-white/50 font-mono w-8 text-right">{areaPct}%</span>
                            </div>
                          </button>

                          {(filterArea === area || !filterArea) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-black/10">
                              {areaEmployees.map(([name, s]) => {
                                const pct = s.total > 0 ? Math.round((s.cumplido / s.total) * 100) : 0;
                                return (
                                  <button
                                    key={name}
                                    onClick={() => {
                                      setFilterEmployee(filterEmployee === name ? "" : name);
                                      setFilterArea(area);
                                    }}
                                    className={`text-left rounded-lg p-3 border transition-all hover:bg-white/[0.08] ${
                                      filterEmployee === name
                                        ? "bg-white/[0.1] border-white/[0.2]"
                                        : "bg-white/[0.02] border-white/[0.06]"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-xs font-semibold text-white truncate pr-2">{name}</p>
                                      <span className="text-[10px] text-white/50 font-mono">{pct}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                                      <div className="h-full bg-white/40 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40">
                                      <span>✅ {s.cumplido}</span>
                                      <span>⏳ {s.pendiente}</span>
                                      <span>🔄 {s.enProceso}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Employees without area */}
                    {(() => {
                      const noArea = Array.from(employeeDocSummary.entries()).filter(([, s]) => s.area === "Sin área");
                      if (noArea.length === 0) return null;
                      return (
                        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                          <div className="px-4 py-3 bg-white/[0.02]">
                            <span className="text-sm font-semibold text-white/40">Sin área asignada</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-black/10">
                            {noArea.map(([name, s]) => {
                              const pct = s.total > 0 ? Math.round((s.cumplido / s.total) * 100) : 0;
                              return (
                                <button
                                  key={name}
                                  onClick={() => {
                                    setFilterEmployee(filterEmployee === name ? "" : name);
                                    setFilterArea("");
                                  }}
                                  className={`text-left rounded-lg p-3 border transition-all hover:bg-white/[0.08] ${
                                    filterEmployee === name
                                      ? "bg-white/[0.1] border-white/[0.2]"
                                      : "bg-white/[0.02] border-white/[0.06]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-xs font-semibold text-white truncate pr-2">{name}</p>
                                    <span className="text-[10px] text-white/50 font-mono">{pct}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                                    <div className="h-full bg-white/40 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40">
                                    <span>✅ {s.cumplido}</span>
                                    <span>⏳ {s.pendiente}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Doc Toolbar: Tabs + Filters */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex gap-2 flex-wrap">
                      {([
                        { key: "todos" as DocTab, label: "Todos", count: docStats.total },
                        { key: "pendiente" as DocTab, label: "Pendientes", count: docStats.pendiente },
                        { key: "proceso" as DocTab, label: "En Proceso", count: docStats.enProceso },
                        { key: "cumplido" as DocTab, label: "Cumplidos", count: docStats.cumplido },
                      ]).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setDocTab(t.key)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            docTab === t.key
                              ? "bg-white/[0.08] text-white border border-white/[0.1]"
                              : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                          }`}
                        >
                          {t.label} ({t.count})
                        </button>
                      ))}
                    </div>
                    <div className="relative max-w-xs w-full">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar documento o empleado..."
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <select
                      value={filterArea}
                      onChange={(e) => {
                        setFilterArea(e.target.value);
                        setFilterEmployee("");
                      }}
                      className="px-4 py-2 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] backdrop-blur-sm appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-gray-900">Todas las áreas</option>
                      {areas.map((a) => (
                        <option key={a} value={a} className="bg-gray-900">{a}</option>
                      ))}
                    </select>
                    <select
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="px-4 py-2 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] backdrop-blur-sm appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-gray-900">Todos los empleados</option>
                      {docEmployees.map((emp) => (
                        <option key={emp} value={emp} className="bg-gray-900">{emp}</option>
                      ))}
                    </select>
                    <select
                      value={filterChapter}
                      onChange={(e) => setFilterChapter(e.target.value)}
                      className="px-4 py-2 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] backdrop-blur-sm appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-gray-900">Todos los capítulos</option>
                      {chapters.map((ch) => (
                        <option key={ch} value={ch} className="bg-gray-900">{ch} - {CHAPTER_LABELS[ch] || ch}</option>
                      ))}
                    </select>
                    {(filterArea || filterEmployee || filterChapter) && (
                      <button
                        onClick={() => {
                          setFilterArea("");
                          setFilterEmployee("");
                          setFilterChapter("");
                        }}
                        className="px-3 py-2 text-xs text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                      >
                        ✕ Limpiar filtros
                      </button>
                    )}
                    <span className="ml-auto text-xs text-white/30">{filteredDocs.length} registros</span>
                  </div>
                </div>

                {/* Doc Table */}
                <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
                  <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg backdrop-blur-sm">
                          📄
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white tracking-tight">Registro de Cumplimiento Documental</h3>
                          <p className="text-sm text-white/40 mt-0.5">{filteredDocs.length} documentos</p>
                        </div>
                      </div>
                      {docLoading && <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-black/20">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Código</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Documento</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider hidden lg:table-cell">Empleado</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider hidden md:table-cell">Capítulo</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Estado</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider hidden sm:table-cell">Periodicidad</th>
                          <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {filteredDocs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-16 text-white/30 text-sm">
                              No se encontraron registros con los filtros seleccionados
                            </td>
                          </tr>
                        ) : (
                          filteredDocs.slice(0, 100).map((r) => (
                            <tr key={r.id} className="hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => openDocDetail(r)}>
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs text-white/60 bg-white/[0.06] px-2 py-0.5 rounded">{r.fields["Código_Documento"]}</span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-white/80 text-sm line-clamp-1 max-w-[300px]">{r.fields["Nombre_Documento"]}</p>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <p className="text-white/60 text-sm truncate max-w-[180px]">
                                  {r.fields.Nombre_Empleado === "Documento General / Corporativo" ? (
                                    <span className="italic text-white/30">General</span>
                                  ) : (
                                    r.fields.Nombre_Empleado
                                  )}
                                </p>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-xs text-white/40">{r.fields["Código_Documento"]?.split("-")[0]}</span>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={r.fields.Estado} />
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className="text-xs text-white/40">{r.fields.Periodicidad}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openDocDetail(r); }}
                                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-all"
                                  title="Ver detalle"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {filteredDocs.length > 100 && (
                      <div className="px-6 py-3 border-t border-white/[0.06] text-center">
                        <p className="text-xs text-white/30">Mostrando 100 de {filteredDocs.length} registros. Use los filtros para reducir resultados.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         MODALS
         ══════════════════════════════════════════════════════════════════ */}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl ${
              toast.type === "success"
                ? "bg-white/[0.1] border-white/[0.15] text-emerald-300"
                : "bg-white/[0.1] border-white/[0.15] text-red-300"
            }`}
          >
            {toast.type === "success" ? (
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/[0.15] shadow-2xl">
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-white/[0.1] bg-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.08] ring-1 ring-white/[0.12]">
                    {modalMode === "create" ? (
                      <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {modalMode === "create" ? "Vincular Nuevo Empleado" : "Editar Empleado"}
                    </h2>
                    <p className="text-sm text-white/40">
                      {modalMode === "create"
                        ? "Ingresa los datos del nuevo colaborador"
                        : `Editando: ${selectedRecord?.fields["Nombre completo"]}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }} className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.12] text-red-300 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Nombre Completo <span className="text-red-400">*</span></label>
                  <input type="text" value={form.nombreCompleto} onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" placeholder="Nombre y apellido" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Cédula / Documento</label>
                  <input type="text" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" placeholder="Número de documento" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Tipo Personal <span className="text-red-400">*</span></label>
                  <select value={form.tipoPersonal} onChange={(e) => setForm({ ...form, tipoPersonal: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm appearance-none">
                    {TIPOS_PERSONAL.map((t) => <option key={t} value={t} className="bg-gray-950">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Estado de Actividad</label>
                  <select value={form.estadoActividad} onChange={(e) => setForm({ ...form, estadoActividad: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm appearance-none">
                    {ESTADOS_ACTIVIDAD.map((e) => <option key={e} value={e} className="bg-gray-950">{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Cargo</label>
                  <input type="text" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" placeholder="Cargo del empleado" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Área</label>
                  <input type="text" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" placeholder="Área o departamento" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Correo Electrónico</label>
                  <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Teléfono</label>
                  <input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" placeholder="300 123 4567" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Fecha de Ingreso</label>
                  <input type="date" value={form.fechaIngreso} onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" />
                </div>
                {modalMode === "edit" && (
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Fecha de Retiro</label>
                    <input type="date" value={form.fechaRetiro} onChange={(e) => setForm({ ...form, fechaRetiro: e.target.value })} className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm" />
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 px-6 py-4 border-t border-white/[0.1] bg-black/30 backdrop-blur-xl flex items-center justify-end gap-3">
              <button onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
                Cancelar
              </button>
              <button
                onClick={modalMode === "create" ? handleCreate : handleUpdate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-white/[0.12] hover:bg-white/[0.18] backdrop-blur-sm border border-white/[0.15] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-black/10"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {modalMode === "create" ? "Vincular Empleado" : "Guardar Cambios"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Detail Modal ──────────────────────────────────────────── */}
      {modalMode === "view" && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setModalMode(null); setSelectedRecord(null); }} />
          <div className="relative w-full max-w-lg rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/[0.15] shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.1] bg-white/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.1] border border-white/[0.15] flex items-center justify-center text-white text-xl font-bold backdrop-blur-sm">
                    {(selectedRecord.fields["Nombre completo"] || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedRecord.fields["Nombre completo"]}</h2>
                    <p className="text-sm text-white/40 font-mono">{selectedRecord.fields["ID Empleado"] || "Sin ID"}</p>
                  </div>
                </div>
                <button onClick={() => { setModalMode(null); setSelectedRecord(null); }} className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Cédula / Documento", value: selectedRecord.fields["Numero Documento"], icon: "🪪" },
                { label: "Tipo Personal", value: selectedRecord.fields["Tipo Personal"], icon: "👤" },
                { label: "Estado", value: selectedRecord.fields["Estado de actividad"], icon: "📊", badge: true },
                { label: "Cargo", value: selectedRecord.fields["Cargo"], icon: "💼" },
                { label: "Área", value: selectedRecord.fields["Area"], icon: "🏢" },
                { label: "Correo Electrónico", value: selectedRecord.fields["Correo electrónico"], icon: "✉️" },
                { label: "Teléfono", value: selectedRecord.fields["Teléfono"], icon: "📱" },
                { label: "Fecha de Ingreso", value: selectedRecord.fields["Fecha de Ingreso"], icon: "📅" },
                { label: "Fecha de Retiro", value: selectedRecord.fields["Fecha de Retiro"], icon: "🚪" },
              ]
                .filter((f) => f.value)
                .map((field) => (
                  <div key={field.label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/20 border border-white/[0.08]">
                    <span className="text-lg">{field.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{field.label}</p>
                      {field.badge ? (
                        <StatusBadge status={field.value as string} />
                      ) : (
                        <p className="text-sm text-white font-medium truncate">{field.value as string}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between">
              <button
                onClick={() => {
                  setDeleteTarget(selectedRecord);
                  setModalMode(null);
                  setSelectedRecord(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-300 hover:bg-white/[0.08] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Eliminar
              </button>
              <button onClick={() => openEdit(selectedRecord)} className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.12] hover:bg-white/[0.18] backdrop-blur-sm border border-white/[0.15] text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-black/10">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/[0.15] shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">¿Eliminar este registro?</h3>
              <p className="text-sm text-white/40 mb-1">Estás a punto de eliminar permanentemente a:</p>
              <p className="text-sm text-white font-semibold mb-1">{deleteTarget.fields["Nombre completo"]}</p>
              <p className="text-xs text-white/30 font-mono mb-6">{deleteTarget.fields["ID Empleado"] || deleteTarget.id}</p>
              <p className="text-xs text-red-400/70 mb-6">Esta acción no se puede deshacer. El registro se eliminará de Airtable.</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-black/10"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Sí, Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Detail / Edit Modal ────────────────────────────────── */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
          <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/[0.15] shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.1] bg-white/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-white/60 bg-white/[0.08] px-2.5 py-1 rounded-lg">
                    {selectedDoc.fields["Código_Documento"]}
                  </span>
                  <StatusBadge status={selectedDoc.fields.Estado} />
                </div>
                <button onClick={() => setSelectedDoc(null)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Documento</p>
                <p className="text-white font-medium text-sm">{selectedDoc.fields["Nombre_Documento"]}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Empleado</p>
                  <p className="text-white/70 text-sm">{selectedDoc.fields.Nombre_Empleado}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">ID Empleado</p>
                  <p className="text-white/70 text-sm font-mono">{selectedDoc.fields.ID_Empleado}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Capítulo</p>
                  <p className="text-white/70 text-sm">
                    {selectedDoc.fields["Código_Documento"]?.split("-")[0]} — {CHAPTER_LABELS[selectedDoc.fields["Código_Documento"]?.split("-")[0]] || ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Periodicidad</p>
                  <p className="text-white/70 text-sm">{selectedDoc.fields.Periodicidad}</p>
                </div>
              </div>
              {selectedDoc.fields.Ruta_Carpeta && (
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Carpeta OneDrive</p>
                  <p className="text-white/50 text-xs font-mono bg-white/[0.04] p-2 rounded-lg break-all">{selectedDoc.fields.Ruta_Carpeta}</p>
                </div>
              )}

              {/* ── Upload section (only when Ruta_Carpeta exists) ── */}
              {selectedDoc.fields.Ruta_Carpeta && (
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">Cargar Archivo</p>
                  {selectedDoc.fields.URL_OneDrive ? (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-emerald-300/80 text-xs">Archivo ya cargado</span>
                      <a href={selectedDoc.fields.URL_OneDrive} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                        Ver
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label
                        className={`flex flex-col items-center justify-center w-full py-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                          uploadFile
                            ? "border-indigo-400/40 bg-indigo-500/10"
                            : "border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.2]"
                        }`}
                      >
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          disabled={uploading}
                        />
                        {uploadFile ? (
                          <div className="text-center">
                            <svg className="w-6 h-6 text-indigo-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-white/80 text-xs font-medium">{uploadFile.name}</p>
                            <p className="text-white/40 text-[10px] mt-0.5">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <svg className="w-6 h-6 text-white/30 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-white/40 text-xs">Haz clic para seleccionar archivo</p>
                            <p className="text-white/25 text-[10px] mt-0.5">PDF, Word, imagen u otro (máx. 50 MB)</p>
                          </div>
                        )}
                      </label>
                      {uploadFile && (
                        <button
                          onClick={handleFileUpload}
                          disabled={uploading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-300 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                        >
                          {uploading ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              {uploadProgress || "Subiendo..."}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              Subir a OneDrive
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <hr className="border-white/[0.08]" />
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Estado</label>
                <div className="flex flex-wrap gap-2">
                  {DOC_ESTADOS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEditDocState(e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        editDocState === e
                          ? "bg-white/[0.12] text-white border-white/[0.2]"
                          : "bg-white/[0.03] text-white/40 border-white/[0.08] hover:bg-white/[0.06]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">URL OneDrive</label>
                <input
                  type="url"
                  value={editDocUrl}
                  onChange={(e) => setEditDocUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15]"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Observaciones</label>
                <textarea
                  value={editDocObs}
                  onChange={(e) => setEditDocObs(e.target.value)}
                  rows={3}
                  placeholder="Agregar observaciones..."
                  className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/[0.1] bg-white/[0.03] flex items-center justify-end gap-3">
              <button onClick={() => setSelectedDoc(null)} className="px-5 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all">
                Cancelar
              </button>
              <button
                onClick={handleDocUpdate}
                disabled={docSaving}
                className="px-5 py-2.5 bg-white/[0.12] hover:bg-white/[0.18] backdrop-blur-sm border border-white/[0.15] text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-black/10 disabled:opacity-40"
              >
                {docSaving ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Guardando...
                  </span>
                ) : (
                  "Guardar Cambios"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
