import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { TABLES, FIELDS } from "@/lib/airtable-schema";

const BASE_CORE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const KEY_CORE = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;

export async function GET() {
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
  if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let cargo = "";
  try {
    // Fetch registro Personal para obtener el nombre del cargo via Rol vinculado
    const rec = await fetch(
      `https://api.airtable.com/v0/${BASE_CORE}/${encodeURIComponent(TABLES.PERSONAL)}/${payload.sub}`,
      { headers: { Authorization: `Bearer ${KEY_CORE}` }, cache: "no-store" }
    ).then((r) => r.json());

    console.log("[/api/me] Personal record:", rec);

    const rolLinks: string[] = rec?.fields?.[FIELDS.PERSONAL.ROL] ?? [];
    console.log("[/api/me] Rol links:", rolLinks);

    if (rolLinks.length > 0) {
      const rol = await fetch(
        `https://api.airtable.com/v0/${BASE_CORE}/${encodeURIComponent(TABLES.ROLES)}/${rolLinks[0]}`,
        { headers: { Authorization: `Bearer ${KEY_CORE}` }, cache: "no-store" }
      ).then((r) => r.json());

      console.log("[/api/me] Rol record:", rol);
      cargo = rol?.fields?.[FIELDS.ROLES.ROL] ?? "";
      console.log("[/api/me] Cargo final:", cargo);
    }
  } catch (error) {
    console.error("[/api/me] Error fetching cargo:", error);
  }

  return NextResponse.json({
    nombre: payload.nombre,
    cedula: payload.cedula,
    idCore: payload.idCore,
    rol: payload.rol,
    cargo,
  });
}
