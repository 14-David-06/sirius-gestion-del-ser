// El saldo lo sirve el paquete: su forma es parte del contrato de PermisoForm.
import { createDiasSirianosHandlers } from "@sirius/solicitudes/server";
import { resolvePayload } from "@/lib/sesion-solicitudes";

export const { GET } = createDiasSirianosHandlers({ resolvePayload });
