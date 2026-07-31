import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import HistoricoSolicitudes from "@/components/HistoricoSolicitudes";

export const metadata = {
  title: "Histórico de solicitudes — Sirius Gestión del Ser",
};

export default async function HistoricoPage() {
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
  if (!payload) redirect("/login");

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <HistoricoSolicitudes />
    </div>
  );
}
