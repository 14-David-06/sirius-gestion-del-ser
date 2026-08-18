// Las novedades de nómina son un registro informativo: no llevan firma ni
// documento, así que este handler no necesita adaptador de almacenamiento.
import { createNovedadesHandlers } from "@sirius/solicitudes/server";
import { resolvePayload } from "@/lib/sesion-solicitudes";

const { GET, POST } = createNovedadesHandlers({ resolvePayload });

export { GET, POST };
