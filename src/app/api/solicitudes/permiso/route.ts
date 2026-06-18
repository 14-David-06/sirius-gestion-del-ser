import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { createPermisoHandlers } from "@sirius/solicitudes";

const { GET, POST } = createPermisoHandlers(async () => {
  const token = (await cookies()).get("sirius-auth")?.value;
  return token ? verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
});

export { GET, POST };
