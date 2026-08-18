import { NextRequest, NextResponse } from "next/server";
import { escapeAirtableValue } from "../lib/security";
import {
  FIELDS,
  FK_ID_CORE,
  ESTADO_PENDIENTE,
  ESTADO_CONCEDIDO,
  PERIODO_ACTUAL,
  SALDO_ACTIVO,
  SALDO_AGOTADO,
} from "../lib/schema";
import { TIPO_DIA_SIRIANO } from "../lib/constants";
import { fechaHoyBogota } from "../lib/fecha-bogota";
import { base64ABytes } from "../lib/bytes";
import { resolverAirtable } from "../infra";
import type { OpcionesHandlers } from "../types";

/** Texto que queda como autorizador en los permisos de día siriano. */
const AUTORIZACION_AUTOMATICA = "Gestión del Ser — autorización automática (Día Siriano)";

/** Ruta por defecto donde la app sirve los documentos de una solicitud. */
const RUTA_DOCUMENTOS = "/api/documentos";

export function createPermisoHandlers(opciones: OpcionesHandlers) {
  const { resolvePayload, infra, airtable } = opciones;

  async function GET() {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { baseId, apiKey, tablas } = resolverAirtable(airtable);
    const formula = encodeURIComponent(`{${FK_ID_CORE}}='${escapeAirtableValue(payload.idCore)}'`);
    const sort    = encodeURIComponent(FIELDS.PERMISO.FECHA_SOLICITUD);
    const params  = `filterByFormula=${formula}&sort[0][field]=${sort}&sort[0][direction]=desc&maxRecords=20`;
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.permiso)}?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );

    // ⚠️ No basta con leer `records`: la respuesta de error de Airtable no lo trae,
    // y devolverla como lista vacía le dice al colaborador «no tienes solicitudes»
    // cuando lo que pasa es que la credencial no alcanza o la tabla no es esa. Así
    // se escondió una API key sin acceso a la base durante toda una integración.
    if (!res.ok) {
      console.error("[solicitudes/permiso GET]", await res.text());
      return NextResponse.json({ error: "Error al consultar Airtable" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data.records ?? []);
  }

  async function POST(req: NextRequest) {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { baseId, apiKey, tablas } = resolverAirtable(airtable);
    const body  = await req.json();
    const today = new Date().toISOString().split("T")[0];
    const esDiaSiriano = body.tipo === TIPO_DIA_SIRIANO;
    const diaSiriano = infra?.diaSiriano;

    // El día siriano nace autorizado, y su único papel es el documento que emite
    // esta ruta. Sin adaptador que lo genere y lo archive no se registra: quedaría
    // un permiso concedido sin nada que acredite la autorización que declara.
    if (esDiaSiriano && !diaSiriano) {
      return NextResponse.json(
        { error: "Los días sirianos no están habilitados en esta aplicación" },
        { status: 400 }
      );
    }

    // Regla de negocio: un día siriano por solicitud.
    const fechasSirianas: string[] = Array.isArray(body.fechasSirianas)
      ? (body.fechasSirianas as string[]).filter((f) => typeof f === "string" && f)
      : [];

    if (esDiaSiriano && fechasSirianas.length > 1) {
      return NextResponse.json(
        { error: "Solo puedes solicitar un día siriano por solicitud" },
        { status: 400 }
      );
    }

    const fechaSiriana = fechasSirianas[0] ?? (body.fechaInicio as string);

    let sirianoRecordId: string | null = null;
    let sirianoRecord: { id: string; fields: Record<string, unknown> } | null = null;
    let saldoSirianoDisponible = 0;

    // Si es día siriano, validar saldo y obtener recordId
    if (esDiaSiriano) {
      const idCore = escapeAirtableValue(payload.idCore);
      const periodo = escapeAirtableValue(PERIODO_ACTUAL);
      const formulaSiriano = encodeURIComponent(
        `AND({${FIELDS.DIAS_SIRIANOS.ID_COLABORADOR}}='${idCore}', {${FIELDS.DIAS_SIRIANOS.PERIODO}}='${periodo}')`
      );

      const urlSiriano = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.diasSirianos)}?filterByFormula=${formulaSiriano}`;

      const resSiriano = await fetch(urlSiriano, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });

      if (!resSiriano.ok) {
        const error = await resSiriano.text();
        console.error("[permiso POST - fetch siriano]", error);
        return NextResponse.json({ error: "Error al consultar días sirianos" }, { status: 500 });
      }

      const dataSiriano = await resSiriano.json();
      const recordsSiriano = dataSiriano.records ?? [];

      if (recordsSiriano.length === 0) {
        return NextResponse.json(
          { error: "No se encontró registro de días sirianos para este periodo" },
          { status: 404 }
        );
      }

      const record = recordsSiriano[0];
      const saldoDisponible = (record.fields[FIELDS.DIAS_SIRIANOS.SALDO_DISPONIBLE] ?? 0) as number;

      if (saldoDisponible <= 0) {
        return NextResponse.json(
          { error: "No tienes días sirianos disponibles para este periodo" },
          { status: 400 }
        );
      }

      sirianoRecord = record;
      sirianoRecordId = record.id;
      saldoSirianoDisponible = saldoDisponible;
    }

    // Crear permiso en Solicitud_Permiso
    const fields: Record<string, unknown> = {
      [FIELDS.PERMISO.NOMBRE]:          payload.nombre,
      [FIELDS.PERMISO.CEDULA]:          payload.cedula,
      [FIELDS.PERMISO.CARGO]:           body.cargo ?? "",
      [FK_ID_CORE]:                     payload.idCore,
      [FIELDS.PERMISO.FECHA_SOLICITUD]: today,
      [FIELDS.PERMISO.FECHA_INICIO]:    esDiaSiriano ? fechaSiriana : body.fechaInicio,
      [FIELDS.PERMISO.TIPO]:            body.tipo,
      [FIELDS.PERMISO.MOTIVO]:          body.motivo,
      [FIELDS.PERMISO.HORAS]:           body.horas ? String(body.horas) : "",
      [FIELDS.PERMISO.REMUNERADO]:      body.remunerado ?? false,
      [FIELDS.PERMISO.COMPENSADO]:      body.compensado ?? false,
      // Los días sirianos son un beneficio ya concedido: quedan autorizados al radicarse.
      [FIELDS.PERMISO.ESTADO]:          esDiaSiriano ? ESTADO_CONCEDIDO : ESTADO_PENDIENTE,
    };

    if (esDiaSiriano && diaSiriano) {
      fields[FIELDS.PERMISO.FECHA_AUTORIZACION] = today;
      fields[FIELDS.PERMISO.AUTORIZADO_POR_NOM] = AUTORIZACION_AUTOMATICA;
      fields[FIELDS.PERMISO.COMENTARIO_AUTORIZACION] =
        "Día siriano: beneficio ya concedido, no requiere autorización de jefatura. " +
        "Firmado con la firma institucional de Gestión del Ser.";
      fields[FIELDS.PERMISO.FIRMANTE_APROB_NOMBRE] = diaSiriano.firmante.nombre;
      fields[FIELDS.PERMISO.FIRMANTE_APROB_CARGO] = diaSiriano.firmante.cargo;
      // AUTORIZADO_POR_ID se queda vacío a propósito: no hay una persona que
      // haya decidido este permiso, y ese campo es el que abre el documento a
      // quien autorizó (ver autorizarAccesoSolicitud).
    }

    // Un día siriano por solicitud: nunca lleva rango inicio–fin.
    if (body.fechaFin && !esDiaSiriano) fields[FIELDS.PERMISO.FECHA_FIN] = body.fechaFin;
    if (body.fechaCompensatorio) fields[FIELDS.PERMISO.FECHA_COMP] = body.fechaCompensatorio;
    if (esDiaSiriano && sirianoRecordId) {
      fields[FIELDS.PERMISO.DIAS_SIRIANOS_LINK] = [sirianoRecordId];  // Relación: array de record IDs
    }

    // Firma del trabajador — la archiva la app (ver ../infra).
    if (body.firmaBase64) {
      if (!infra?.guardarFirma) {
        console.error("[permiso POST] falta infra.guardarFirma");
        return NextResponse.json(
          { error: "Error al guardar firma digital" },
          { status: 500 }
        );
      }

      try {
        const firma = await infra.guardarFirma({
          base64: body.firmaBase64,
          cedula: payload.cedula,
          idCore: payload.idCore,
          tipo: "permiso",
          metadata: {
            tipoPermiso: body.tipo,
            fechaSolicitud: today,
          },
        });

        // Guardar la referencia, NO el base64.
        // Firma_Trabajador es el gemelo en texto largo del mismo dato: guarda la
        // key, no el PNG. El adjunto se sube aparte, ya con el recordId.
        fields[FIELDS.PERMISO.FIRMA_S3_KEY] = firma.key;
        fields[FIELDS.PERMISO.FIRMA_TRAB_TEXTO] = firma.key;
        fields[FIELDS.PERMISO.FECHA_FIRMA_TRAB] = firma.archivadaEn;
      } catch (error) {
        console.error("[permiso POST - archivar firma]", error);
        return NextResponse.json(
          { error: "Error al guardar firma digital" },
          { status: 500 }
        );
      }
    }

    // Firma institucional de Gestión del Ser. El día siriano nace autorizado, y
    // el registro debe quedar con la misma huella que deja /api/solicitudes/autorizar:
    // firma archivada y datos del firmante. Un fallo aquí no invalida el permiso —
    // la firma que certifica el documento va empotrada en el PDF.
    if (esDiaSiriano && diaSiriano && infra?.guardarFirma) {
      try {
        const firmaGestion = await infra.guardarFirma({
          base64: diaSiriano.firmaInstitucionalBase64(),
          cedula: payload.cedula,
          idCore: payload.idCore,
          tipo: "autorizacion-permiso",
          metadata: {
            tipoPermiso: body.tipo,
            fechaSolicitud: today,
            firmante: diaSiriano.firmante.nombre,
            automatica: "dia-siriano",
          },
        });

        fields[FIELDS.PERMISO.FIRMA_AUTORIZADOR_S3] = firmaGestion.key;
        // Fecha_Firma_Autorizador es `date` en Airtable: rechaza un ISO con hora.
        fields[FIELDS.PERMISO.FECHA_FIRMA_AUTORIZADOR] = fechaHoyBogota();
        // Estos dos sí son dateTime y aceptan el instante completo.
        fields[FIELDS.PERMISO.FECHA_FIRMA_GESTION] = firmaGestion.archivadaEn;
        fields[FIELDS.PERMISO.FECHA_FIRMA_APROBADOR] = firmaGestion.archivadaEn;
      } catch (error) {
        console.error("[permiso POST - firma Gestión del Ser]", error);
      }
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.permiso)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("[solicitudes/permiso POST]", err);
      return NextResponse.json({ error: "Error al guardar en Airtable." }, { status: 500 });
    }

    const permisoCreado = await res.json();

    // Gemelo adjunto de la firma: Firma_Trabajador_Base64 solo se puede llenar
    // con el recordId ya creado. Es comodidad de consulta dentro de Airtable —
    // la referencia canónica es la key del almacenamiento, así que un fallo no bloquea.
    if (body.firmaBase64 && infra?.adjuntar) {
      await infra.adjuntar({
        recordId: permisoCreado.id,
        campo: FIELDS.PERMISO.FIRMA_TRAB_ADJUNTO,
        contenido: base64ABytes(body.firmaBase64),
        filename: `firma_trabajador_${payload.idCore}.png`,
        contentType: "image/png",
      });
    }

    // Gemelos adjuntos de la firma de Gestión del Ser: la tabla arrastra los dos
    // campos desde el sistema anterior y /api/solicitudes/autorizar llena ambos.
    // Son comodidad de consulta dentro de Airtable: la referencia canónica es la
    // key, y el documento que certifica el permiso es el PDF. Por eso un fallo
    // aquí —incluido que falte la firma institucional— se registra y sigue, en
    // vez de tumbar un permiso que ya quedó creado.
    if (esDiaSiriano && diaSiriano && infra?.adjuntar) {
      try {
        const png = base64ABytes(diaSiriano.firmaInstitucionalBase64());
        for (const campo of [FIELDS.PERMISO.FIRMA_GESTION, FIELDS.PERMISO.FIRMA_APROBADOR]) {
          await infra.adjuntar({
            recordId: permisoCreado.id,
            campo,
            contenido: png,
            filename: `firma_gestion_ser_${permisoCreado.id}.png`,
            contentType: "image/png",
          });
        }
      } catch (error) {
        console.error("[permiso POST - adjuntos firma Gestión del Ser]", error);
      }
    }

    // Si es día siriano, actualizar saldo en Dias_Sirianos
    if (esDiaSiriano && sirianoRecord) {
      const saldoDisponible = (sirianoRecord.fields[FIELDS.DIAS_SIRIANOS.SALDO_DISPONIBLE] ?? 0) as number;
      const saldoUsado = (sirianoRecord.fields[FIELDS.DIAS_SIRIANOS.SALDO_USADO] ?? 0) as number;
      const observacionesActuales = (sirianoRecord.fields[FIELDS.DIAS_SIRIANOS.OBSERVACIONES] ?? "") as string;

      const nuevoSaldoDisponible = saldoDisponible - 1;
      const nuevoSaldoUsado = saldoUsado + 1;
      const nuevoEstado = nuevoSaldoDisponible <= 0 ? SALDO_AGOTADO : SALDO_ACTIVO;

      const nuevaObservacion = `${fechaSiriana}: Permiso ${permisoCreado.id} - ${body.motivo || "Día siriano"}`;
      const observacionesActualizadas = observacionesActuales
        ? `${observacionesActuales}\n${nuevaObservacion}`
        : nuevaObservacion;

      const urlPatchSiriano = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.diasSirianos)}/${sirianoRecord.id}`;

      const resPatchSiriano = await fetch(urlPatchSiriano, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            [FIELDS.DIAS_SIRIANOS.SALDO_DISPONIBLE]: nuevoSaldoDisponible,
            [FIELDS.DIAS_SIRIANOS.SALDO_USADO]: nuevoSaldoUsado,
            [FIELDS.DIAS_SIRIANOS.FECHA_ULTIMO_USO]: fechaSiriana,
            [FIELDS.DIAS_SIRIANOS.OBSERVACIONES]: observacionesActualizadas,
            [FIELDS.DIAS_SIRIANOS.ESTADO]: nuevoEstado,
          },
        }),
      });

      if (!resPatchSiriano.ok) {
        const errorSiriano = await resPatchSiriano.text();
        console.error("[permiso POST - update siriano]", errorSiriano);
        // No revertimos el permiso - mejor log del error y notificar a admin
        console.error(`IMPORTANTE: Permiso ${permisoCreado.id} creado pero no se pudo actualizar días sirianos ${sirianoRecord.id}`);
      }
    }

    // Día siriano: el permiso nace autorizado, así que se emite el PDF y se
    // archiva. Un fallo aquí no invalida el permiso ya registrado.
    let pdfUrl: string | null = null;

    if (esDiaSiriano && diaSiriano) {
      try {
        const pdf = await diaSiriano.generarDocumento({
          solicitudId: permisoCreado.id,
          nombre: payload.nombre,
          cedula: payload.cedula,
          cargo: body.cargo ?? "",
          idCore: payload.idCore,
          fechaPermiso: fechaSiriana,
          fechaSolicitud: today,
          motivo: body.motivo ?? "",
          periodo: PERIODO_ACTUAL,
          saldoRestante: Math.max(0, saldoSirianoDisponible - 1),
          firmaBase64: body.firmaBase64,
        });

        const archivado = await diaSiriano.archivarDocumento({
          pdf,
          cedula: payload.cedula,
          idCore: payload.idCore,
          fechaPermiso: fechaSiriana,
          metadata: {
            solicitudId: permisoCreado.id,
            periodo: PERIODO_ACTUAL,
            nombre: payload.nombre,
          },
        });

        pdfUrl = archivado.url;

        // Enlace estable al documento: la ruta de la app resuelve una URL firmada
        // fresca en cada visita, porque el objeto archivado es privado.
        const rutaDocumentos = diaSiriano.rutaDocumentos ?? RUTA_DOCUMENTOS;
        const enlace = `${req.nextUrl.origin}${rutaDocumentos}/permiso/${permisoCreado.id}`;

        const resPdf = await fetch(
          `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.permiso)}/${permisoCreado.id}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: {
                [FIELDS.PERMISO.URL_PDF]: archivado.url,
                [FIELDS.PERMISO.NOMBRE_ARCHIVO]: archivado.filename,
                [FIELDS.PERMISO.HASH_DOCUMENTO]: archivado.sha256,
                // Gemelos que llena /api/solicitudes/autorizar en los permisos
                // normales. PDF_Autorizacion_S3_Key es además el campo que lee
                // /api/documentos para firmar la URL.
                [FIELDS.PERMISO.PDF_AUTORIZACION_URL]: enlace,
                [FIELDS.PERMISO.PDF_AUTORIZACION_S3_KEY]: archivado.key,
                [FIELDS.PERMISO.REVISADO]: true,
              },
            }),
          }
        );

        if (!resPdf.ok) {
          console.error("[permiso POST - patch pdf]", await resPdf.text());
          console.error(
            `IMPORTANTE: PDF ${archivado.key} archivado pero no se pudo referenciar en el permiso ${permisoCreado.id}`
          );
        }

        // Gemelo adjunto del documento, igual que en el flujo de autorización.
        if (infra?.adjuntar) {
          await infra.adjuntar({
            recordId: permisoCreado.id,
            campo: FIELDS.PERMISO.PDF_FIRMADO,
            contenido: pdf,
            filename: archivado.filename,
            contentType: "application/pdf",
          });
        }
      } catch (error) {
        console.error("[permiso POST - pdf dia siriano]", error);
        console.error(
          `IMPORTANTE: Permiso ${permisoCreado.id} autorizado pero sin PDF archivado`
        );
      }
    }

    return NextResponse.json(
      { ok: true, id: permisoCreado.id, autorizado: esDiaSiriano, pdfUrl },
      { status: 201 }
    );
  }

  return { GET, POST };
}
