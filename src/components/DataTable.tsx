interface DataTableProps {
  headers: string[];
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: string;
}

export default function DataTable({
  headers,
  children,
  title,
  subtitle,
  icon,
}: DataTableProps) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
      <div className="px-6 py-5 border-b border-white/[0.08] bg-black/20">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg backdrop-blur-sm">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            {subtitle && (
              <p className="text-sm text-white/40 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-6 py-3.5 text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
