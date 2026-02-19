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
    { label: "Cumplido", count: cumplidos, pct: pctCumplido, color: "bg-emerald-400", text: "text-emerald-400" },
    { label: "En proceso", count: enProceso, pct: pctEnProceso, color: "bg-amber-400", text: "text-amber-400" },
    { label: "Pendiente", count: pendientes, pct: pctPendiente, color: "bg-red-400", text: "text-red-400" },
  ];

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Estado de Cumplimiento</h3>
          <p className="text-sm text-white/40">{total} registros totales</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden flex mb-8">
        {cumplidos > 0 && (
          <div
            className="bg-emerald-400 h-full transition-all duration-700 ease-out first:rounded-l-full"
            style={{ width: `${pctCumplido}%` }}
          />
        )}
        {enProceso > 0 && (
          <div
            className="bg-amber-400 h-full transition-all duration-700 ease-out"
            style={{ width: `${pctEnProceso}%` }}
          />
        )}
        {pendientes > 0 && (
          <div
            className="bg-red-400 h-full transition-all duration-700 ease-out last:rounded-r-full"
            style={{ width: `${pctPendiente}%` }}
          />
        )}
      </div>

      {/* Legend cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
          >
            <div className={`w-2.5 h-8 rounded-full ${seg.color}`} />
            <div>
              <p className="text-xs text-white/40 font-medium">{seg.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-white">{seg.count}</span>
                <span className={`text-xs font-medium ${seg.text}`}>{seg.pct}%</span>
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
