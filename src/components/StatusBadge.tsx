interface StatusBadgeProps {
  status: string | null | undefined;
}

const statusStyles: Record<string, string> = {
  Cumplido: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Completado: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Vigente: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Activo: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Pendiente: "bg-red-50 text-red-700 ring-red-600/20",
  "En proceso": "bg-amber-50 text-amber-700 ring-amber-600/20",
  "En revisión": "bg-amber-50 text-amber-700 ring-amber-600/20",
  Vencido: "bg-orange-50 text-orange-700 ring-orange-600/20",
  Terminado: "bg-gray-50 text-gray-600 ring-gray-500/20",
  "No aplica": "bg-gray-50 text-gray-500 ring-gray-400/20",
  Prórroga: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;

  const style =
    statusStyles[status] || "bg-gray-50 text-gray-600 ring-gray-500/20";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}
