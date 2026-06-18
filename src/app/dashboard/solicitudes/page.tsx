import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { SolicitudesOverview } from "@sirius/solicitudes";

export default async function SolicitudesPage() {
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
  if (!payload) redirect("/login");

  return <SolicitudesOverview idCore={payload.idCore} />;
}
