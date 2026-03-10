"use client";

import { useEffect, useState, useCallback } from "react";
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

type VinculacionTab = "activos" | "inactivos" | "proceso";
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

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function VinculacionPage() {
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

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Fetch data ─────────────────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
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
    fetchData();
  }, [fetchData]);

  /* ── CRUD handlers ──────────────────────────────────────────────────────── */

  const handleCreate = async () => {
    if (!form.nombreCompleto.trim()) {
      setFormError("El nombre completo es obligatorio");
      return;
    }
    if (!form.tipoPersonal) {
      setFormError("El tipo de personal es obligatorio");
      return;
    }

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
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRecord) return;
    if (!form.nombreCompleto.trim()) {
      setFormError("El nombre completo es obligatorio");
      return;
    }

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
      await fetchData();
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
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Open modal helpers ─────────────────────────────────────────────────── */

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

  /* ── Filter logic ───────────────────────────────────────────────────────── */

  const activos = personal.filter((p) => p.fields["Estado de actividad"] === "Activo");
  const inactivos = personal.filter((p) =>
    ["Inactivo", "Retirado"].includes(p.fields["Estado de actividad"])
  );
  const enProceso = personal.filter((p) =>
    ["En proceso", "Pendiente"].includes(p.fields["Estado de actividad"])
  );

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

  /* ── Loading / Error states ─────────────────────────────────────────────── */

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
          <button onClick={fetchData} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <>
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Vinculados (Activos)", count: activos.length, icon: (
              <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            )},
            { label: "Desvinculados", count: inactivos.length, icon: (
              <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            )},
            { label: "En Proceso", count: enProceso.length, icon: (
              <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )},
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] p-5 shadow-2xl shadow-black/20 hover:bg-white/[0.1] transition-all"
            >
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

        {/* Toolbar: Tabs + Search + Create Button */}
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
              {loading && (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              )}
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
                      <td className="px-5 py-4 text-sm font-medium text-white/60 font-mono">
                        {p.fields["ID Empleado"] || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => openView(p)}
                          className="text-sm font-medium text-white hover:text-white/70 transition-colors text-left"
                        >
                          {p.fields["Nombre completo"] || "—"}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50 font-mono">
                        {p.fields["Numero Documento"] || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">
                        {p.fields["Tipo Personal"] || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">
                        {p.fields["Cargo"] || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={p.fields["Estado de actividad"]} />
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50 max-w-[200px] truncate">
                        {p.fields["Correo electrónico"] || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">
                        {p.fields["Teléfono"] || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* View */}
                          <button
                            onClick={() => openView(p)}
                            className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
                            title="Ver detalle"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => openEdit(p)}
                            className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-red-300 transition-colors"
                            title="Eliminar"
                          >
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
      </div>

      {/* ── Toast Notification ─────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl ${
            toast.type === "success"
              ? "bg-white/[0.1] border-white/[0.15] text-emerald-300"
              : "bg-white/[0.1] border-white/[0.15] text-red-300"
          }`}>
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

      {/* ── Create / Edit Modal ────────────────────────────────────────────── */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/[0.15] shadow-2xl">
            {/* Header */}
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
                      {modalMode === "create" ? "Ingresa los datos del nuevo colaborador" : `Editando: ${selectedRecord?.fields["Nombre completo"]}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }}
                  className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.12] text-red-300 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {formError}
                </div>
              )}

              {/* Row 1: Nombre + Cédula */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Nombre Completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombreCompleto}
                    onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Cédula / Documento
                  </label>
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    placeholder="Número de documento"
                  />
                </div>
              </div>

              {/* Row 2: Tipo + Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Tipo Personal <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.tipoPersonal}
                    onChange={(e) => setForm({ ...form, tipoPersonal: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm appearance-none"
                  >
                    {TIPOS_PERSONAL.map((t) => (
                      <option key={t} value={t} className="bg-gray-950">{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Estado de Actividad
                  </label>
                  <select
                    value={form.estadoActividad}
                    onChange={(e) => setForm({ ...form, estadoActividad: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm appearance-none"
                  >
                    {ESTADOS_ACTIVIDAD.map((e) => (
                      <option key={e} value={e} className="bg-gray-950">{e}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Cargo + Área */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    placeholder="Cargo del empleado"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Área
                  </label>
                  <input
                    type="text"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    placeholder="Área o departamento"
                  />
                </div>
              </div>

              {/* Row 4: Correo + Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={form.correo}
                    onChange={(e) => setForm({ ...form, correo: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    placeholder="300 123 4567"
                  />
                </div>
              </div>

              {/* Row 5: Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Fecha de Ingreso
                  </label>
                  <input
                    type="date"
                    value={form.fechaIngreso}
                    onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                  />
                </div>
                {modalMode === "edit" && (
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                      Fecha de Retiro
                    </label>
                    <input
                      type="date"
                      value={form.fechaRetiro}
                      onChange={(e) => setForm({ ...form, fechaRetiro: e.target.value })}
                      className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 px-6 py-4 border-t border-white/[0.1] bg-black/30 backdrop-blur-xl flex items-center justify-end gap-3">
              <button
                onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
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

      {/* ── View Detail Modal ──────────────────────────────────────────────── */}
      {modalMode === "view" && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setModalMode(null); setSelectedRecord(null); }} />
          <div className="relative w-full max-w-lg rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/[0.15] shadow-2xl overflow-hidden">
            {/* Header */}
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
                <button
                  onClick={() => { setModalMode(null); setSelectedRecord(null); }}
                  className="p-2 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Detail Fields */}
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
              ].filter(f => f.value).map((field) => (
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

            {/* Footer Actions */}
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
              <button
                onClick={() => {
                  openEdit(selectedRecord);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.12] hover:bg-white/[0.18] backdrop-blur-sm border border-white/[0.15] text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-black/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
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
              <p className="text-sm text-white/40 mb-1">
                Estás a punto de eliminar permanentemente a:
              </p>
              <p className="text-sm text-white font-semibold mb-1">
                {deleteTarget.fields["Nombre completo"]}
              </p>
              <p className="text-xs text-white/30 font-mono mb-6">
                {deleteTarget.fields["ID Empleado"] || deleteTarget.id}
              </p>
              <p className="text-xs text-red-400/70 mb-6">
                Esta acción no se puede deshacer. El registro se eliminará de Airtable.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
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
    </>
  );
}
