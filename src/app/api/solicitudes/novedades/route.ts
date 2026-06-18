import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { createNovedadesHandlers } from "@sirius/solicitudes";

const { GET, POST } = createNovedadesHandlers(async () => {
  const token = (await cookies()).get("sirius-auth")?.value;
  return token ? verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
});

export { GET, POST };
