interface StatusBadgeProps {
  status: string | null | undefined;
}

const statusStyles: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  Cumplido:      { dot: "bg-white/50", bg: "bg-white/[0.06]", text: "text-white/70", border: "border-white/[0.12]" },
  Completado:    { dot: "bg-white/50", bg: "bg-white/[0.06]", text: "text-white/70", border: "border-white/[0.12]" },
  Vigente:       { dot: "bg-white/50", bg: "bg-white/[0.06]", text: "text-white/70", border: "border-white/[0.12]" },
  Activo:        { dot: "bg-white/50", bg: "bg-white/[0.06]", text: "text-white/70", border: "border-white/[0.12]" },
  Pendiente:     { dot: "bg-white/30", bg: "bg-white/[0.04]", text: "text-white/50", border: "border-white/[0.08]" },
  "En proceso":  { dot: "bg-white/40", bg: "bg-white/[0.05]", text: "text-white/60", border: "border-white/[0.1]" },
  "En revisión": { dot: "bg-white/40", bg: "bg-white/[0.05]", text: "text-white/60", border: "border-white/[0.1]" },
  Vencido:       { dot: "bg-white/25", bg: "bg-white/[0.03]", text: "text-white/45", border: "border-white/[0.07]" },
  Terminado:     { dot: "bg-white/20", bg: "bg-white/[0.03]", text: "text-white/40", border: "border-white/[0.06]" },
  "No aplica":   { dot: "bg-white/15", bg: "bg-white/[0.02]", text: "text-white/30", border: "border-white/[0.05]" },
  Prórroga:      { dot: "bg-white/35", bg: "bg-white/[0.05]", text: "text-white/55", border: "border-white/[0.09]" },
};

const defaultStyle = { dot: "bg-white/20", bg: "bg-white/[0.03]", text: "text-white/40", border: "border-white/[0.06]" };

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
