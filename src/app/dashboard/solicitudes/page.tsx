import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { verifyJWT } from "@/lib/auth";
import { SolicitudesOverview } from "@sirius/solicitudes";
import { DiasPactoWidget } from "@/components/DiasPactoWidget";

export default async function SolicitudesPage() {
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
  if (!payload) redirect("/login");

  return (
    <div>
      <div className="px-8 pt-8 pb-4 max-w-5xl mx-auto">
        <Suspense fallback={<div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-24"></div>}>
          <DiasPactoWidget />
        </Suspense>
      </div>
      <SolicitudesOverview idCore={payload.idCore} />
    </div>
  );
}
