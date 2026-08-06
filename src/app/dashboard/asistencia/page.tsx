import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import MarcacionAsistencia from "@/components/MarcacionAsistencia";

export const metadata = {
  title: "Asistencia — Sirius Gestión del Ser",
};

export default async function AsistenciaPage() {
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
  if (!payload) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <MarcacionAsistencia />
    </div>
  );
}
