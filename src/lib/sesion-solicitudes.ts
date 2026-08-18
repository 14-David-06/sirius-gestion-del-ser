/**
 * Cómo resuelve esta app la sesión que `@sirius/solicitudes` pide inyectar: el
 * JWT de la cookie `sirius-auth`. El paquete no sabe nada del sistema de auth, y
 * por eso lo recibe como función.
 */
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import type { ResolvePayload } from "@sirius/solicitudes/server";

export const resolvePayload: ResolvePayload = async () => {
  const token = (await cookies()).get("sirius-auth")?.value;
  return token ? verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
};
