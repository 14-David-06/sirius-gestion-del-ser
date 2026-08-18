/**
 * Implementación de los puertos de `@sirius/solicitudes` para esta app: S3 para
 * archivar, `pdf-lib` para emitir y Airtable para los adjuntos de consulta.
 *
 * El paquete no conoce nada de esto. Aquí se traduce su vocabulario (`key`,
 * `archivadaEn`) al de los módulos de la app (`s3Key`, `uploadedAt`), que es la
 * única frontera donde aparece «S3»: otra app puede montar el mismo módulo sobre
 * otro almacenamiento sin tocar el paquete.
 */
import type { SolicitudesInfra } from "@sirius/solicitudes/infra";
import { crearDiaSirianoInfra } from "@sirius/solicitudes/dia-siriano";
import { uploadFirmaTrabajador, uploadPdfPermisoSiriano } from "@/lib/s3";
import { subirAdjuntoAirtable } from "@/lib/airtable-attachments";

const base = () => process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const key  = () => process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

export const solicitudesInfra: SolicitudesInfra = {
  async guardarFirma({ base64, cedula, idCore, tipo, metadata }) {
    const subida = await uploadFirmaTrabajador({ base64, cedula, idCore, tipo, metadata });
    return { key: subida.s3Key, archivadaEn: subida.uploadedAt };
  },

  async adjuntar({ recordId, campo, contenido, filename, contentType }) {
    return subirAdjuntoAirtable({
      baseId: base(),
      apiKey: key(),
      recordId,
      campo,
      // El paquete trabaja con bytes para poder correr donde no hay Node; el
      // endpoint de Airtable de esta app espera un Buffer.
      contenido: Buffer.from(contenido),
      filename,
      contentType,
    });
  },

  // El documento del día siriano lo emite el paquete (maqueta institucional,
  // logo, QR y firma de Gestión del Ser); aquí solo se dice dónde archivarlo.
  diaSiriano: crearDiaSirianoInfra({
    async archivarDocumento({ pdf, cedula, idCore, fechaPermiso, metadata }) {
      const subida = await uploadPdfPermisoSiriano({ pdf, cedula, idCore, fechaPermiso, metadata });
      return {
        key: subida.s3Key,
        url: subida.url,
        filename: subida.filename,
        sha256: subida.sha256,
      };
    },
  }),
};
