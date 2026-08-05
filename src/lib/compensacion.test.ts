import { describe, expect, it } from "vitest";
import {
  HORAS_JORNADA,
  PLAN_HORA_DIARIA,
  PLAN_RETO,
  PLAN_SABADO,
  diasEntre,
  diasPlanHoraDiaria,
  diasPlanReto,
  diasPlanSabado,
  diasValidos,
  esSabado,
  generarDiasCompensacion,
  horasAReponer,
  nombrePlan,
  parseDiasCompensacion,
  planPorNombre,
  sabadosNecesarios,
} from "./compensacion";

describe("horasAReponer", () => {
  it("usa las horas del permiso cuando se pidió por horas", () => {
    expect(horasAReponer("2", 1)).toBe(2);
    expect(horasAReponer(3.5, 1)).toBe(3.5);
  });

  it("acepta la coma decimal que puede llegar del formulario", () => {
    expect(horasAReponer("2,5", 1)).toBe(2.5);
  });

  it("cuenta una jornada por día cuando el permiso se pidió por días", () => {
    expect(horasAReponer("", 3)).toBe(3 * HORAS_JORNADA);
    expect(horasAReponer(null, 1)).toBe(HORAS_JORNADA);
  });
});

describe("diasEntre", () => {
  it("cuenta los extremos", () => {
    expect(diasEntre("2026-08-10", "2026-08-12")).toBe(3);
  });

  it("un solo día cuando no hay fecha fin o es anterior", () => {
    expect(diasEntre("2026-08-10")).toBe(1);
    expect(diasEntre("2026-08-10", "2026-08-01")).toBe(1);
  });

  it("no se desfasa por zona horaria", () => {
    // "2026-08-10" parseado como UTC daría el 9 de agosto en Bogotá (-5).
    expect(diasEntre("2026-08-10", "2026-08-10")).toBe(1);
  });
});

describe("esSabado", () => {
  it("reconoce el sábado sin desfase de zona horaria", () => {
    expect(esSabado("2026-08-08")).toBe(true); // sábado
    expect(esSabado("2026-08-07")).toBe(false); // viernes
    expect(esSabado("no-es-fecha")).toBe(false);
  });
});

describe("plan 1 — sábados de 5 h", () => {
  it("reparte las horas en jornadas de 5 h", () => {
    const dias = diasPlanSabado(["2026-08-08", "2026-08-15"], 8);
    expect(dias.map((d) => d.horas)).toEqual([5, 3]);
  });

  it("deja en 0 h los sábados sobrantes para que se descarten al guardar", () => {
    const dias = diasPlanSabado(["2026-08-08", "2026-08-15"], 4);
    expect(dias.map((d) => d.horas)).toEqual([4, 0]);
    expect(diasValidos(dias)).toHaveLength(1);
  });

  it("ordena y deduplica las fechas elegidas", () => {
    const dias = diasPlanSabado(["2026-08-15", "2026-08-08", "2026-08-08"], 10);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-08-08", "2026-08-15"]);
  });

  it("sabadosNecesarios redondea hacia arriba", () => {
    expect(sabadosNecesarios(4)).toBe(1);
    expect(sabadosNecesarios(5)).toBe(1);
    expect(sabadosNecesarios(6)).toBe(2);
  });
});

describe("plan 2 — una hora diaria", () => {
  it("agenda una hora por día hábil hasta cubrir el permiso", () => {
    const dias = diasPlanHoraDiaria("2026-08-10", 3); // lunes
    expect(dias.map((d) => d.fecha)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
    expect(dias.every((d) => d.horas === 1)).toBe(true);
  });

  it("salta sábados y domingos", () => {
    const dias = diasPlanHoraDiaria("2026-08-07", 3); // viernes
    expect(dias.map((d) => d.fecha)).toEqual(["2026-08-07", "2026-08-10", "2026-08-11"]);
  });

  it("la última jornada cubre solo la fracción que falta", () => {
    const dias = diasPlanHoraDiaria("2026-08-10", 2.5);
    expect(dias.map((d) => d.horas)).toEqual([1, 1, 0.5]);
  });

  it("sin fecha o sin horas no agenda nada", () => {
    expect(diasPlanHoraDiaria("", 4)).toEqual([]);
    expect(diasPlanHoraDiaria("2026-08-10", 0)).toEqual([]);
  });
});

describe("plan 3 — reto", () => {
  it("deja una sola entrada con la fecha límite y el reto", () => {
    const dias = diasPlanReto("2026-09-30", 4, "  Liderar la capacitación  ");
    expect(dias).toEqual([
      { fecha: "2026-09-30", horas: 4, descripcion: "Liderar la capacitación" },
    ]);
  });

  it("sin fecha límite no genera nada", () => {
    expect(diasPlanReto("", 4, "algo")).toEqual([]);
  });
});

describe("generarDiasCompensacion", () => {
  it("un plan desconocido no genera días", () => {
    expect(generarDiasCompensacion("inventado", { horasTotal: 8 })).toEqual([]);
    expect(generarDiasCompensacion("", { horasTotal: 8 })).toEqual([]);
  });

  it("enruta cada plan a su generador", () => {
    expect(
      generarDiasCompensacion(PLAN_SABADO, { horasTotal: 5, fechas: ["2026-08-08"] })
    ).toHaveLength(1);
    expect(
      generarDiasCompensacion(PLAN_HORA_DIARIA, { horasTotal: 2, desde: "2026-08-10" })
    ).toHaveLength(2);
    expect(
      generarDiasCompensacion(PLAN_RETO, {
        horasTotal: 8,
        fechaLimite: "2026-09-30",
        reto: "x",
      })
    ).toHaveLength(1);
  });
});

describe("nombre del plan", () => {
  it("va y vuelve entre id y nombre guardado en Airtable", () => {
    for (const id of [PLAN_SABADO, PLAN_HORA_DIARIA, PLAN_RETO]) {
      expect(planPorNombre(nombrePlan(id))).toBe(id);
    }
  });

  it("rechaza planes que no son de los tres", () => {
    expect(nombrePlan("inventado")).toBe("");
    expect(nombrePlan(undefined)).toBe("");
    expect(planPorNombre("Cualquier cosa")).toBeNull();
    expect(planPorNombre(42)).toBeNull();
  });
});

describe("parseDiasCompensacion", () => {
  it("lee el JSON guardado en el campo de texto largo", () => {
    const json = JSON.stringify([{ fecha: "2026-08-08", horas: 5, descripcion: "x" }]);
    expect(parseDiasCompensacion(json)).toEqual([
      { fecha: "2026-08-08", horas: 5, descripcion: "x" },
    ]);
  });

  it("tolera basura sin reventar", () => {
    expect(parseDiasCompensacion("no es json")).toEqual([]);
    expect(parseDiasCompensacion("")).toEqual([]);
    expect(parseDiasCompensacion(null)).toEqual([]);
    expect(parseDiasCompensacion('{"fecha":"x"}')).toEqual([]);
  });

  it("descarta filas sin fecha o sin horas", () => {
    const json = JSON.stringify([
      { fecha: "", horas: 5 },
      { fecha: "2026-08-08", horas: 0 },
      { fecha: "2026-08-15", horas: 5, descripcion: "ok" },
    ]);
    expect(parseDiasCompensacion(json)).toHaveLength(1);
  });
});
