interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  subtitle?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string; ring: string; glow: string; gradient: string }> = {
    blue:   { bg: "bg-white/[0.06]", text: "text-white/50",    ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
    green:  { bg: "bg-white/[0.06]", text: "text-white/50",  ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
    purple: { bg: "bg-white/[0.06]", text: "text-white/50",   ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
    orange: { bg: "bg-white/[0.06]", text: "text-white/50",   ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
    red:    { bg: "bg-white/[0.06]", text: "text-white/50",      ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
    cyan:   { bg: "bg-white/[0.06]", text: "text-cyan-300",     ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
    indigo: { bg: "bg-white/[0.06]", text: "text-white/50",   ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
    pink:   { bg: "bg-white/[0.06]", text: "text-pink-300",     ring: "ring-white/[0.1]",  glow: "shadow-black/10",    gradient: "from-white/[0.08] to-white/[0.03]" },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`group relative rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] p-6 hover:bg-black/40 hover:border-white/[0.18] transition-all duration-500 shadow-2xl ${c.glow} overflow-hidden`}>
      {/* Decorative glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/[0.04] rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />

      <div className="relative flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-white/50 font-medium mt-0.5">{subtitle}</p>
          )}
        </div>
        <div
          className="w-14 h-14 rounded-2xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 backdrop-blur-sm"
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
