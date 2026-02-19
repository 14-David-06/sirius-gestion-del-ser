interface StatusBadgeProps {
  status: string | null | undefined;
}

const statusStyles: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  Cumplido:      { dot: "bg-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-300", border: "border-emerald-400/20" },
  Completado:    { dot: "bg-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-300", border: "border-emerald-400/20" },
  Vigente:       { dot: "bg-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-300", border: "border-emerald-400/20" },
  Activo:        { dot: "bg-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-300", border: "border-emerald-400/20" },
  Pendiente:     { dot: "bg-red-400",     bg: "bg-red-400/10",     text: "text-red-300",     border: "border-red-400/20" },
  "En proceso":  { dot: "bg-amber-400",   bg: "bg-amber-400/10",   text: "text-amber-300",   border: "border-amber-400/20" },
  "En revisión": { dot: "bg-amber-400",   bg: "bg-amber-400/10",   text: "text-amber-300",   border: "border-amber-400/20" },
  Vencido:       { dot: "bg-orange-400",   bg: "bg-orange-400/10",  text: "text-orange-300",  border: "border-orange-400/20" },
  Terminado:     { dot: "bg-gray-400",     bg: "bg-gray-400/10",    text: "text-gray-400",    border: "border-gray-400/20" },
  "No aplica":   { dot: "bg-gray-500",     bg: "bg-gray-500/10",    text: "text-gray-500",    border: "border-gray-500/20" },
  Prórroga:      { dot: "bg-blue-400",     bg: "bg-blue-400/10",    text: "text-blue-300",    border: "border-blue-400/20" },
};

const defaultStyle = { dot: "bg-gray-400", bg: "bg-gray-400/10", text: "text-gray-400", border: "border-gray-400/20" };

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-white/20 text-xs">—</span>;

  const s = statusStyles[status] || defaultStyle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
