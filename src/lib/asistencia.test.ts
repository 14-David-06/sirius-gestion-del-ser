import { describe, it, expect } from "vitest";
import {
  agruparPorDia,
  fechaBogota,
  formatearDuracion,
  horaBogota,
  resumirDia,
  siguienteTipo,
  type Marcacion,
} from "./asistencia";
import { TIPOS_ASISTENCIA } from "./constants";

function marcacion(hora: string, tipo: Marcacion["tipo"], fecha = "2026-08-06"): Marcacion {
  // Colombia es UTC-5: la hora local + 5 h da el instante UTC.
  const utc = String(Number(hora.slice(0, 2)) + 5).padStart(2, "0");
  return {
    id: `rec_${fecha}_${hora}`,
    tipo,
    fecha,
    hora,
    fechaHora: `${fecha}T${utc}:${hora.slice(3)}:00.000Z`,
  };
}

describe("fechaBogota / horaBogota", () => {
  it("no adelanta el día después de las 19:00 en Bogotá", () => {
    // 2026-08-07T02:30Z son las 21:30 del 6 de agosto en Colombia.
    const momento = new Date("2026-08-07T02:30:00.000Z");
    expect(fechaBogota(momento)).toBe("2026-08-06");
    expect(horaBogota(momento)).toBe("21:30");
  });

  it("usa formato de 24 horas", () => {
    expect(horaBogota(new Date("2026-08-06T13:14:00.000Z"))).toBe("08:14");
  });
});

describe("siguienteTipo", () => {
  it("propone entrada cuando no hay marcaciones", () => {
    expect(siguienteTipo([])).toBe(TIPOS_ASISTENCIA.ENTRADA);
  });

  it("propone salida después de una entrada", () => {
    expect(siguienteTipo([marcacion("08:00", "Entrada")])).toBe(TIPOS_ASISTENCIA.SALIDA);
  });

  it("propone entrada después de una salida", () => {
    expect(
      siguienteTipo([marcacion("08:00", "Entrada"), marcacion("12:00", "Salida")]),
    ).toBe(TIPOS_ASISTENCIA.ENTRADA);
  });

  it("se guía por el instante real, no por el orden de llegada", () => {
    expect(
      siguienteTipo([marcacion("12:00", "Salida"), marcacion("13:00", "Entrada")]),
    ).toBe(TIPOS_ASISTENCIA.SALIDA);
  });
});

describe("resumirDia", () => {
  it("suma un tramo simple de entrada a salida", () => {
    const dia = resumirDia("2026-08-06", [
      marcacion("08:00", "Entrada"),
      marcacion("17:30", "Salida"),
    ]);
    expect(dia.minutosTrabajados).toBe(570); // 9 h 30 min
    expect(dia.primeraEntrada).toBe("08:00");
    expect(dia.ultimaSalida).toBe("17:30");
    expect(dia.jornadaAbierta).toBe(false);
  });

  it("suma varios tramos del mismo día", () => {
    const dia = resumirDia("2026-08-06", [
      marcacion("08:00", "Entrada"),
      marcacion("12:00", "Salida"),
      marcacion("13:00", "Entrada"),
      marcacion("17:00", "Salida"),
    ]);
    expect(dia.minutosTrabajados).toBe(480); // 4 h + 4 h
  });

  it("marca la jornada como abierta si falta la salida", () => {
    const dia = resumirDia("2026-08-06", [marcacion("08:00", "Entrada")]);
    expect(dia.jornadaAbierta).toBe(true);
    expect(dia.minutosTrabajados).toBe(0);
    expect(dia.ultimaSalida).toBeNull();
  });

  it("una entrada repetida no reinicia el conteo", () => {
    const dia = resumirDia("2026-08-06", [
      marcacion("08:00", "Entrada"),
      marcacion("08:05", "Entrada"),
      marcacion("17:00", "Salida"),
    ]);
    expect(dia.minutosTrabajados).toBe(540); // cuenta desde las 08:00
    expect(dia.jornadaAbierta).toBe(false);
  });

  it("ignora una salida sin entrada previa", () => {
    const dia = resumirDia("2026-08-06", [
      marcacion("12:00", "Salida"),
      marcacion("13:00", "Entrada"),
      marcacion("17:00", "Salida"),
    ]);
    expect(dia.minutosTrabajados).toBe(240);
  });
});

describe("agruparPorDia", () => {
  it("separa por fecha y ordena del día más reciente al más antiguo", () => {
    const dias = agruparPorDia([
      marcacion("08:00", "Entrada", "2026-08-04"),
      marcacion("17:00", "Salida", "2026-08-04"),
      marcacion("09:00", "Entrada", "2026-08-05"),
      marcacion("18:00", "Salida", "2026-08-05"),
    ]);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-08-05", "2026-08-04"]);
    expect(dias[0].minutosTrabajados).toBe(540);
    expect(dias[1].minutosTrabajados).toBe(540);
  });
});

describe("formatearDuracion", () => {
  it("formatea horas y minutos", () => {
    expect(formatearDuracion(0)).toBe("0 min");
    expect(formatearDuracion(45)).toBe("45 min");
    expect(formatearDuracion(120)).toBe("2 h");
    expect(formatearDuracion(465)).toBe("7 h 45 min");
  });
});
