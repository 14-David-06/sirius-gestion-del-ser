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
  const colorMap: Record<string, { bg: string; text: string; ring: string; glow: string }> = {
    blue:   { bg: "bg-blue-500/10",    text: "text-blue-400",    ring: "ring-blue-500/20",    glow: "shadow-blue-500/5" },
    green:  { bg: "bg-emerald-500/10",  text: "text-emerald-400",  ring: "ring-emerald-500/20",  glow: "shadow-emerald-500/5" },
    purple: { bg: "bg-purple-500/10",   text: "text-purple-400",   ring: "ring-purple-500/20",   glow: "shadow-purple-500/5" },
    orange: { bg: "bg-orange-500/10",   text: "text-orange-400",   ring: "ring-orange-500/20",   glow: "shadow-orange-500/5" },
    red:    { bg: "bg-red-500/10",      text: "text-red-400",      ring: "ring-red-500/20",      glow: "shadow-red-500/5" },
    cyan:   { bg: "bg-cyan-500/10",     text: "text-cyan-400",     ring: "ring-cyan-500/20",     glow: "shadow-cyan-500/5" },
    indigo: { bg: "bg-indigo-500/10",   text: "text-indigo-400",   ring: "ring-indigo-500/20",   glow: "shadow-indigo-500/5" },
    pink:   { bg: "bg-pink-500/10",     text: "text-pink-400",     ring: "ring-pink-500/20",     glow: "shadow-pink-500/5" },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`group relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 ${c.glow} hover:shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/50 tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-white/30 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center text-xl ${c.text} group-hover:scale-110 transition-transform duration-300`}
        >
          {icon}
        </div>
      </div>
      {/* Subtle bottom accent line */}
      <div className={`absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${c.text.replace("text-", "via-")}/20 to-transparent`} />
    </div>
  );
}
