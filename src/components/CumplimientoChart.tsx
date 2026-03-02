interface CumplimientoChartProps {
  cumplidos: number;
  pendientes: number;
  enProceso: number;
  noAplica?: number;
}

export default function CumplimientoChart({
  cumplidos,
  pendientes,
  enProceso,
  noAplica = 0,
}: CumplimientoChartProps) {
  const total = cumplidos + pendientes + enProceso + noAplica;
  if (total === 0) return null;

  const pctCumplido = Math.round((cumplidos / total) * 100);
  const pctPendiente = Math.round((pendientes / total) * 100);
  const pctEnProceso = Math.round((enProceso / total) * 100);

  const segments = [
    { label: "Cumplido", count: cumplidos, pct: pctCumplido, color: "bg-emerald-400", text: "text-emerald-400", ring: "ring-emerald-400/20", glow: "from-emerald-500/15" },
    { label: "En proceso", count: enProceso, pct: pctEnProceso, color: "bg-amber-400", text: "text-amber-400", ring: "ring-amber-400/20", glow: "from-amber-500/15" },
    { label: "Pendiente", count: pendientes, pct: pctPendiente, color: "bg-red-400", text: "text-red-400", ring: "ring-red-400/20", glow: "from-red-500/15" },
  ];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 backdrop-blur-sm shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/5">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Estado de Cumplimiento</h3>
          <p className="text-sm text-white/40">{total} registros totales</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-4 bg-white/[0.06] rounded-full overflow-hidden flex mb-8 ring-1 ring-white/[0.04]">
        {cumplidos > 0 && (
          <div
            className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-700 ease-out first:rounded-l-full shadow-lg shadow-emerald-500/20"
            style={{ width: `${pctCumplido}%` }}
          />
        )}
        {enProceso > 0 && (
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-700 ease-out shadow-lg shadow-amber-500/20"
            style={{ width: `${pctEnProceso}%` }}
          />
        )}
        {pendientes > 0 && (
          <div
            className="bg-gradient-to-r from-red-500 to-red-400 h-full transition-all duration-700 ease-out last:rounded-r-full shadow-lg shadow-red-500/20"
            style={{ width: `${pctPendiente}%` }}
          />
        )}
      </div>

      {/* Legend cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br ${seg.glow} to-transparent border border-white/[0.06] ring-1 ${seg.ring}`}
          >
            <div className={`w-2.5 h-10 rounded-full ${seg.color} shadow-lg`} />
            <div>
              <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{seg.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-white">{seg.count}</span>
                <span className={`text-xs font-semibold ${seg.text}`}>{seg.pct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {noAplica > 0 && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02]">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs text-white/30">
            No aplica: <strong className="text-white/50">{noAplica}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
