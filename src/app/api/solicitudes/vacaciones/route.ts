import { createVacacionesHandlers } from "@sirius/solicitudes/server";
import { resolvePayload } from "@/lib/sesion-solicitudes";
import { solicitudesInfra } from "@/lib/solicitudes-infra";

const { GET, POST } = createVacacionesHandlers({
  resolvePayload,
  infra: solicitudesInfra,
});

export { GET, POST };
