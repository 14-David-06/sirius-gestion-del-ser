/**
 * Helpers de email para el módulo de contratos.
 * Usa SendGrid para enviar alertas de vencimiento de contratos.
 * Si SendGrid no está configurado, las funciones son no-op con warning.
 */

export function sendgridConfigurado(): boolean {
  return !!(
    process.env.SENDGRID_API_KEY &&
    process.env.ALERT_EMAIL_FROM &&
    process.env.ALERT_EMAIL_TO
  );
}

interface AlertaVencimientoParams {
  nombreEmpleado: string;
  idContrato: string;
  tipoContrato: string;
  fechaVencimiento: string;
  diasRestantes: number;
  tipoAlerta: string;
}

const LABELS_TIPO_ALERTA: Record<string, string> = {
  "30_dias": "30 días",
  "15_dias": "15 días",
  "7_dias": "7 días",
};

const LABELS_TIPO_CONTRATO: Record<string, string> = {
  fijo: "A término fijo",
  indefinido: "Indefinido",
  obra_labor: "Obra o labor",
  aprendizaje: "Aprendizaje",
  prestacion_servicios: "Prestación de servicios",
};

function htmlAlertaVencimiento(p: AlertaVencimientoParams): string {
  const diasLabel = LABELS_TIPO_ALERTA[p.tipoAlerta] || p.tipoAlerta;
  const tipoLabel = LABELS_TIPO_CONTRATO[p.tipoContrato] || p.tipoContrato;
  const colorDias = p.diasRestantes <= 7 ? "#e53e3e" : p.diasRestantes <= 15 ? "#dd6b20" : "#d69e2e";

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Alerta contrato</title></head>
<body style="font-family:sans-serif;background:#f7fafc;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#c53030;padding:20px 24px">
      <h2 style="color:#fff;margin:0;font-size:18px">⚠️ Alerta de vencimiento de contrato</h2>
      <p style="color:#fed7d7;margin:4px 0 0;font-size:14px">Vence en ${diasLabel}</p>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#718096;width:40%">Empleado</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">${p.nombreEmpleado}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#718096">Contrato</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:monospace">${p.idContrato}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#718096">Tipo</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0">${tipoLabel}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#718096">Fecha fin</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0">${p.fechaVencimiento}</td></tr>
        <tr><td style="padding:10px;color:#718096">Días restantes</td>
            <td style="padding:10px;font-weight:700;color:${colorDias};font-size:18px">${p.diasRestantes}</td></tr>
      </table>
      <p style="margin-top:20px;padding:12px;background:#fff5f5;border-radius:6px;border-left:4px solid #fc8181;color:#742a2a;font-size:13px">
        Por favor revisa este contrato en el panel de Sirius Gestión del Ser antes del ${p.fechaVencimiento}.
      </p>
    </div>
    <div style="padding:16px 24px;background:#f7fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#a0aec0;font-size:11px">
        Mensaje automático · Sirius Gestión del Ser · No responder este email
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Envía un email de alerta de vencimiento.
 * Si SendGrid no está configurado, solo muestra un warning en consola.
 * Nunca lanza — los errores se loguean y se retorna sin bloquear el cron.
 */
export async function enviarAlertaVencimiento(
  params: AlertaVencimientoParams
): Promise<void> {
  if (!sendgridConfigurado()) {
    console.warn(
      `[Email] SendGrid no configurado — alerta ${params.idContrato}/${params.tipoAlerta} no enviada`
    );
    return;
  }

  try {
    const sgMail = (await import("@sendgrid/mail")).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const diasLabel = LABELS_TIPO_ALERTA[params.tipoAlerta] || params.tipoAlerta;
    await sgMail.send({
      to: process.env.ALERT_EMAIL_TO!,
      from: process.env.ALERT_EMAIL_FROM!,
      subject: `⚠️ Alerta: Contrato de ${params.nombreEmpleado} vence en ${diasLabel} (${params.idContrato})`,
      html: htmlAlertaVencimiento(params),
    });
  } catch (err) {
    console.error("[Email] Error enviando alerta:", params.idContrato, err);
  }
}
