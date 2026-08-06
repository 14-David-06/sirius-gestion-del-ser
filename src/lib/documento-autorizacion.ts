/**
 * Emisión del documento oficial de una solicitud a partir de lo que ya está
 * guardado en Airtable.
 *
 * Existe porque el documento puede quedar incompleto: cuando Gestión del Ser
 * concede un permiso compensatorio sin definir el plan de reposición, el PDF
 * sale diciendo "por definir". Si el colaborador lo elige después, el registro
 * cambia pero el documento firmado se queda con el texto viejo — y entonces el
 * único papel firmado por ambas partes certifica un compromiso que ya no es el
 * real. Reemitirlo cierra esa brecha.
 *
 * Nada se borra: la subida a S3 usa una key nueva con marca de tiempo, así que
 * la versión anterior sigue existiendo y el adjunto de Airtable las acumula.
 */

import { FIELDS, FIELDS_AUTORIZACION, FK_ID_CORE, ESTADOS_APROBADOS, TABLES } from "./airtable-schema";
import { descripcionDuracionPermiso, parseDiasCompensacion } from "./compensacion";
import { fechaHoyBogota } from "./fecha-bogota";
import { generarPdfAutorizacion, formatearFechaLarga } from "./pdf";
import { descargarObjetoS3, uploadPdfAutorizacion } from "./s3";
import { subirAdjuntoAirtable } from "./airtable-attachments";

const BASE_ID = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

const texto = (valor: unknown): string =>
  valor === null || valor === undefined || valor === "" ? "" : String(valor).trim();

/** Igual que `texto`, pero con el guion largo que el documento usa para "vacío". */
const campoTexto = (valor: unknown): string => texto(valor) || "—";

const campoFecha = (valor: unknown): string => {
  const iso = texto(valor).slice(0, 10);
  return iso ? formatearFechaLarga(iso) : "—";
};

/**
 * Detalle propio de cada tipo de solicitud, tal como se imprime en el documento.
 *
 * Vive aquí y no en el route porque lo necesitan los dos caminos que emiten el
 * PDF: la autorización y la reemisión posterior. Si divergieran, el mismo
 * permiso saldría con distinto detalle en cada versión del documento.
 */
export function detallesSolicitud(
  tabla: "permiso" | "vacaciones",
  f: Record<string, unknown>,
): { etiqueta: string; valor: string }[] {
  if (tabla === "permiso") {
    return [
      { etiqueta: "Tipo de permiso", valor: campoTexto(f[FIELDS.PERMISO.TIPO]) },
      // Duración en vez de "Horas solicitadas": ese campo viene vacío en los
      // permisos por días y el "—" ocultaba de dónde salen las horas a reponer.
      {
        etiqueta: "Duración",
        valor: descripcionDuracionPermiso(
          f[FIELDS.PERMISO.HORAS],
          texto(f[FIELDS.PERMISO.FECHA_INICIO]).slice(0, 10),
          texto(f[FIELDS.PERMISO.FECHA_FIN]).slice(0, 10) || null,
        ),
      },
      { etiqueta: "Desde", valor: campoFecha(f[FIELDS.PERMISO.FECHA_INICIO]) },
      {
        etiqueta: "Hasta",
        valor: campoFecha(f[FIELDS.PERMISO.FECHA_FIN] ?? f[FIELDS.PERMISO.FECHA_INICIO]),
      },
      { etiqueta: "Fecha de solicitud", valor: campoFecha(f[FIELDS.PERMISO.FECHA_SOLICITUD]) },
    ];
  }

  return [
    { etiqueta: "Fecha de inicio", valor: campoFecha(f[FIELDS.VACACIONES.FECHA_INICIO]) },
    { etiqueta: "Fecha de fin", valor: campoFecha(f[FIELDS.VACACIONES.FECHA_FIN]) },
    { etiqueta: "Fecha de reintegro", valor: campoFecha(f[FIELDS.VACACIONES.FECHA_REINTEGRO]) },
    { etiqueta: "Días de vacaciones", valor: campoTexto(f[FIELDS.VACACIONES.DIAS]) },
    { etiqueta: "Fecha de presentación", valor: campoFecha(f[FIELDS.VACACIONES.FECHA_PRESENTACION]) },
  ];
}

export interface DocumentoEmitido {
  url: string;
  s3Key: string;
  filename: string;
  sha256: string;
}

export interface ReemisionParams {
  recordId: string;
  /** Campos del registro, ya con los valores nuevos aplicados. */
  campos: Record<string, unknown>;
  /** Origen de la petición, para armar el enlace estable a /api/documentos. */
  origen: string;
  /** Detalle del permiso tal como sale en el documento. */
  detalles: { etiqueta: string; valor: string }[];
  /** Aclaración de por qué se reemitió (se imprime bajo el plan de reposición). */
  nota?: string;
}

/**
 * Vuelve a generar el PDF de un **permiso** ya resuelto y lo deja como documento
 * vigente del registro.
 *
 * Solo permisos: son los únicos con plan de reposición, que es lo que puede
 * cambiar después de la autorización. Las vacaciones no tienen nada que se
 * defina más tarde.
 *
 * Lanza si algo falla — quien llama decide si eso debe tumbar su operación. En
 * el flujo del colaborador no debe: el plan ya quedó guardado y perder eso por
 * un fallo de S3 sería peor que tener el documento desactualizado un rato.
 */
export async function reemitirDocumentoPermiso(
  params: ReemisionParams,
): Promise<DocumentoEmitido> {
  const { recordId, campos, origen, detalles, nota } = params;
  const C = FIELDS.PERMISO;

  const estado = texto(campos[C.ESTADO]);
  const decision = (ESTADOS_APROBADOS as readonly string[]).includes(estado)
    ? "aprobar"
    : "rechazar";

  // La fecha de la autorización manda sobre la de hoy: el documento reemitido
  // sigue siendo el de aquella decisión, no una decisión nueva.
  const fechaAutorizacion =
    texto(campos[FIELDS_AUTORIZACION.FECHA]).slice(0, 10) || fechaHoyBogota();

  const firmaTrabajadorKey = texto(campos[C.FIRMA_S3_KEY]);
  const firmaAutorizadorKey = texto(campos[FIELDS_AUTORIZACION.FIRMA_S3_KEY]);

  const [firmaTrabajador, firmaAutorizador] = await Promise.all([
    firmaTrabajadorKey ? descargarObjetoS3(firmaTrabajadorKey) : null,
    firmaAutorizadorKey ? descargarObjetoS3(firmaAutorizadorKey) : null,
  ]);

  const idCore = texto(campos[FK_ID_CORE]);

  const pdf = await generarPdfAutorizacion({
    tipo: "permiso",
    solicitudId: recordId,
    decision,
    estado,
    solicitante: {
      nombre: texto(campos[C.NOMBRE]),
      cedula: texto(campos[C.CEDULA]),
      cargo: texto(campos[C.CARGO]),
      idCore,
    },
    detalles,
    motivo: texto(campos[C.MOTIVO]),
    comentario: texto(campos[FIELDS_AUTORIZACION.COMENTARIO]),
    remunerado: Boolean(campos[C.REMUNERADO]),
    compensado: Boolean(campos[C.COMPENSADO]),
    planCompensacion: texto(campos[C.PLAN_COMPENSACION]),
    diasCompensacion: parseDiasCompensacion(campos[C.DIAS_COMPENSACION]),
    notaCompensacion: nota,
    autorizador: {
      // Los datos del firmante se guardan al autorizar; si faltan se cae al
      // nombre de quien tomó la decisión, que siempre está.
      nombre:
        texto(campos[C.FIRMANTE_APROB_NOMBRE]) ||
        texto(campos[FIELDS_AUTORIZACION.AUTORIZADO_POR_NOM]),
      cedula: texto(campos[C.FIRMANTE_APROB_CEDULA]),
      cargo: texto(campos[C.FIRMANTE_APROB_CARGO]),
    },
    fechaAutorizacion,
    firmaTrabajador,
    firmaAutorizador,
  });

  const documento = await uploadPdfAutorizacion({
    pdf,
    tipo: "permiso",
    idCore,
    recordId,
    fechaAutorizacion,
    metadata: { estado, motivoReemision: nota ?? "reemision" },
  });

  // Enlace estable: /api/documentos exige sesión y firma una URL nueva en cada
  // visita. Nunca se guarda una URL firmada de S3, que expira en 5 minutos.
  const enlace = `${origen}/api/documentos/permiso/${recordId}`;

  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLES.PERMISO)}/${recordId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        [C.PDF_AUTORIZACION_URL]: enlace,
        [C.PDF_AUTORIZACION_S3_KEY]: documento.s3Key,
        [C.HASH_DOCUMENTO]: documento.sha256,
        [C.URL_PDF_FIRMADO]: enlace,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Airtable rechazó la actualización del documento: ${await res.text()}`);
  }

  // El adjunto es comodidad de consulta dentro de Airtable: la referencia
  // canónica es S3, así que un fallo aquí no invalida la reemisión.
  await subirAdjuntoAirtable({
    baseId: BASE_ID,
    apiKey: API_KEY,
    recordId,
    campo: C.PDF_FIRMADO,
    contenido: Buffer.from(pdf),
    filename: documento.filename,
    contentType: "application/pdf",
  });

  return documento;
}

/** Texto que explica en el documento por qué el plan aparece ahora y no antes. */
export function notaPlanDefinidoDespues(fecha: string = fechaHoyBogota()): string {
  return `Plan de reposición elegido por el colaborador el ${formatearFechaLarga(fecha)}, después de la autorización. Documento reemitido con esa información.`;
}
