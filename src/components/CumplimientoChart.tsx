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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📊 Estado de Cumplimiento
      </h3>

      {/* Bar */}
      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex mb-6">
        {cumplidos > 0 && (
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${pctCumplido}%` }}
          />
        )}
        {enProceso > 0 && (
          <div
            className="bg-amber-400 h-full transition-all duration-500"
            style={{ width: `${pctEnProceso}%` }}
          />
        )}
        {pendientes > 0 && (
          <div
            className="bg-red-400 h-full transition-all duration-500"
            style={{ width: `${pctPendiente}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <div>
            <p className="text-sm font-medium text-gray-700">Cumplido</p>
            <p className="text-lg font-bold text-gray-900">
              {cumplidos}{" "}
              <span className="text-xs text-gray-400">({pctCumplido}%)</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">En proceso</p>
            <p className="text-lg font-bold text-gray-900">
              {enProceso}{" "}
              <span className="text-xs text-gray-400">({pctEnProceso}%)</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">Pendiente</p>
            <p className="text-lg font-bold text-gray-900">
              {pendientes}{" "}
              <span className="text-xs text-gray-400">({pctPendiente}%)</span>
            </p>
          </div>
        </div>
        {noAplica > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-700">No aplica</p>
              <p className="text-lg font-bold text-gray-900">{noAplica}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
