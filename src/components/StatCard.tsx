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
    blue:   { bg: "bg-blue-500/10",    text: "text-blue-400",    ring: "ring-blue-500/20",    glow: "shadow-blue-500/10",    gradient: "from-blue-500/20 to-blue-600/5" },
    green:  { bg: "bg-emerald-500/10",  text: "text-emerald-400",  ring: "ring-emerald-500/20",  glow: "shadow-emerald-500/10",  gradient: "from-emerald-500/20 to-emerald-600/5" },
    purple: { bg: "bg-purple-500/10",   text: "text-purple-400",   ring: "ring-purple-500/20",   glow: "shadow-purple-500/10",   gradient: "from-purple-500/20 to-purple-600/5" },
    orange: { bg: "bg-orange-500/10",   text: "text-orange-400",   ring: "ring-orange-500/20",   glow: "shadow-orange-500/10",   gradient: "from-orange-500/20 to-orange-600/5" },
    red:    { bg: "bg-red-500/10",      text: "text-red-400",      ring: "ring-red-500/20",      glow: "shadow-red-500/10",      gradient: "from-red-500/20 to-red-600/5" },
    cyan:   { bg: "bg-cyan-500/10",     text: "text-cyan-400",     ring: "ring-cyan-500/20",     glow: "shadow-cyan-500/10",     gradient: "from-cyan-500/20 to-cyan-600/5" },
    indigo: { bg: "bg-indigo-500/10",   text: "text-indigo-400",   ring: "ring-indigo-500/20",   glow: "shadow-indigo-500/10",   gradient: "from-indigo-500/20 to-indigo-600/5" },
    pink:   { bg: "bg-pink-500/10",     text: "text-pink-400",     ring: "ring-pink-500/20",     glow: "shadow-pink-500/10",     gradient: "from-pink-500/20 to-pink-600/5" },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`group relative rounded-2xl bg-gradient-to-br ${c.gradient} backdrop-blur-sm border border-white/[0.08] p-6 hover:border-white/[0.15] transition-all duration-500 ${c.glow} hover:shadow-xl overflow-hidden`}>
      {/* Decorative glow */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 ${c.bg} rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500`} />

      <div className="relative flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className={`text-xs ${c.text} font-medium mt-0.5`}>{subtitle}</p>
          )}
        </div>
        <div
          className={`w-14 h-14 rounded-2xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center text-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
