import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import NavLinks from "@/components/NavLinks";

const ROL_LABEL: Record<string, string> = {
  "Super Admin": "Super Admin",
  "Admin Depto": "Administrador",
  "Avanzado": "Avanzado",
  "Estándar": "Estándar",
  "Lectura": "Lectura",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;

  if (!payload) redirect("/login");

  const iniciales = payload.nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f1f5f9" }}>
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col w-60 flex-shrink-0 h-full"
        style={{ background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="bg-white rounded-xl px-4 py-2">
            <Image src="/Logo-Sirius.png" alt="Sirius" width={110} height={38} priority />
          </div>
        </div>

        {/* Nav */}
        <NavLinks />

        {/* Usuario */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "#1a51a8" }}
            >
              {iniciales}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{payload.nombre.split(" ")[0]} {payload.nombre.split(" ")[2] ?? ""}</p>
              <p className="text-xs truncate" style={{ color: "#29b6e8" }}>
                {ROL_LABEL[payload.rol] ?? payload.rol}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
