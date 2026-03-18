import { describe, it, expect } from "vitest";
import { calcularHoras } from "./calcularHoras";
import type { HorarioConfig, RegistroAsistencia } from "./calcularHoras";

const horarioBase: HorarioConfig = {
  horaEntradaSeg: 8 * 3600,  // 08:00
  horaSalidaSeg: 17 * 3600,  // 17:00
  diasLaborales: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
  totalHorasDia: 8,
};

// Martes 2026-03-17 — día hábil diurno
const FECHA_HABIL = "2026-03-17";
// Domingo 2026-03-22
const FECHA_DOMINGO = "2026-03-22";
// Festivo Colombia: 19 de marzo de 2026 (San José — festivo legal colombiano)
const FECHA_FESTIVO = "2026-03-19";

describe("calcularHoras", () => {
  describe("Jornada completa sin anomalías", () => {
    it("devuelve 8h ordinarias, 1h extra diurna y 0 faltantes para una jornada 08:00–17:00", () => {
      // 08:00–17:00 = 9h totales diurnas; totalHorasDia = 8 → ordinarias = 8, extras = 1
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_HABIL, hora: "08:00" },
        { tipo: "Salida",  fecha: FECHA_HABIL, hora: "17:00" },
      ];

      const resultado = calcularHoras(registros, horarioBase, [], FECHA_HABIL, FECHA_HABIL);

      expect(resultado.horas_ordinarias_diurnas).toBe(8);
      expect(resultado.horas_extras_diurnas).toBe(1);
      expect(resultado.horas_extras_nocturnas).toBe(0);
      expect(resultado.horas_nocturnas).toBe(0);
      expect(resultado.horas_faltantes).toBe(0);
      expect(resultado.dias_analizados).toBe(1);
    });
  });

  describe("Jornada con horas extras diurnas", () => {
    it("devuelve 8h ordinarias + 3h extras diurnas para una jornada 08:00–19:00", () => {
      // 08:00–19:00 = 11h totales diurnas; totalHorasDia = 8 → ordinarias = 8, extras = 3
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_HABIL, hora: "08:00" },
        { tipo: "Salida",  fecha: FECHA_HABIL, hora: "19:00" },
      ];

      const resultado = calcularHoras(registros, horarioBase, [], FECHA_HABIL, FECHA_HABIL);

      expect(resultado.horas_ordinarias_diurnas).toBe(8);
      expect(resultado.horas_extras_diurnas).toBe(3);
      expect(resultado.horas_nocturnas).toBe(0);
      expect(resultado.horas_faltantes).toBe(0);
    });
  });

  describe("Marcación en tramo nocturno (21:00–06:00)", () => {
    it("acumula horas_nocturnas cuando la jornada incluye el tramo nocturno (21:00–23:00)", () => {
      // Jornada 19:00–23:00: 2h diurnas (19–21) + 2h nocturnas (21–23)
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_HABIL, hora: "19:00" },
        { tipo: "Salida",  fecha: FECHA_HABIL, hora: "23:00" },
      ];

      const resultado = calcularHoras(registros, horarioBase, [], FECHA_HABIL, FECHA_HABIL);

      expect(resultado.horas_nocturnas).toBeGreaterThan(0);
      expect(resultado.horas_extras_nocturnas).toBeGreaterThan(0);
      // 4h totales: 2h diurnas (no alcanzan el límite de 8h → son ordinarias) + 2h nocturnas
      expect(resultado.horas_nocturnas).toBe(2);
      expect(resultado.horas_ordinarias_diurnas).toBe(2);
    });
  });

  describe("Día domingo", () => {
    it("acumula horas_dominicales para trabajo realizado en domingo", () => {
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_DOMINGO, hora: "08:00" },
        { tipo: "Salida",  fecha: FECHA_DOMINGO, hora: "16:00" },
      ];

      const resultado = calcularHoras(registros, horarioBase, [], FECHA_DOMINGO, FECHA_DOMINGO);

      expect(resultado.horas_dominicales).toBeGreaterThan(0);
      expect(resultado.horas_dominicales).toBe(8);
      // Las horas dominicales no se suman a ordinarias
      expect(resultado.horas_ordinarias_diurnas).toBe(0);
    });
  });

  describe("Día festivo Colombia", () => {
    it("acumula horas_festivos para trabajo realizado en un día festivo", () => {
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_FESTIVO, hora: "08:00" },
        { tipo: "Salida",  fecha: FECHA_FESTIVO, hora: "16:00" },
      ];

      const resultado = calcularHoras(
        registros,
        horarioBase,
        [FECHA_FESTIVO],
        FECHA_FESTIVO,
        FECHA_FESTIVO
      );

      expect(resultado.horas_festivos).toBeGreaterThan(0);
      expect(resultado.horas_festivos).toBe(8);
      // Los festivos no se suman a ordinarias
      expect(resultado.horas_ordinarias_diurnas).toBe(0);
    });
  });

  describe("Día hábil sin marcación", () => {
    it("incrementa horas_faltantes cuando un día laboral no tiene registros", () => {
      // Periodo de lunes a viernes sin ningún registro
      const resultado = calcularHoras([], horarioBase, [], FECHA_HABIL, FECHA_HABIL);

      expect(resultado.horas_faltantes).toBeGreaterThan(0);
      // La unidad es días (no horas): 1 día sin marcación = 1
      expect(resultado.horas_faltantes).toBe(1);
      expect(resultado.horas_ordinarias_diurnas).toBe(0);
    });

    it("acumula un faltante por cada día hábil sin registros en un periodo de 5 días", () => {
      // Lunes a viernes 2026-03-16 al 2026-03-20, sin ningún registro
      const resultado = calcularHoras([], horarioBase, [], "2026-03-16", "2026-03-20");

      expect(resultado.horas_faltantes).toBe(5);
      expect(resultado.dias_analizados).toBe(5);
    });
  });

  describe("Entrada sin salida (par incompleto)", () => {
    it("Entrada sin salida en día pasado → debe calcular horas hasta hora_fin del horario", () => {
      // FECHA_HABIL = "2026-03-17"; se pasa _fechaHoy = "2026-03-18" para simular que es un día pasado.
      // Entrada a las 08:00, sin salida → se estima hasta hora_fin del horario (17:00) = 9h trabajadas.
      // Ordinarias = min(9, 8) = 8h; extras diurnas = max(0, 9-8) = 1h.
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_HABIL, hora: "08:00" },
        // Sin Salida
      ];

      const resultado = calcularHoras(
        registros,
        horarioBase,
        [],
        FECHA_HABIL,
        FECHA_HABIL,
        "2026-03-18" // _fechaHoy: el día analizado es pasado
      );

      // 08:00–17:00 = 9h; ordinarias cap en 8h, extras 1h
      expect(resultado.horas_ordinarias_diurnas).toBe(8);
      expect(resultado.horas_extras_diurnas).toBe(1);
      expect(resultado.horas_nocturnas).toBe(0);
      // No debe contar como faltante porque sí hubo entrada
      expect(resultado.horas_faltantes).toBe(0);
    });

    it("Entrada sin salida hoy → debe ignorar ese día (jornada en curso)", () => {
      // Se pasa _fechaHoy = FECHA_HABIL para simular que HOY es ese día → jornada en curso.
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_HABIL, hora: "08:00" },
        // Sin Salida — jornada en curso
      ];

      const resultado = calcularHoras(
        registros,
        horarioBase,
        [],
        FECHA_HABIL,
        FECHA_HABIL,
        FECHA_HABIL // _fechaHoy: hoy mismo es el día analizado → jornada no ha terminado
      );

      // Jornada en curso: no se cuentan horas ni faltantes
      expect(resultado.horas_ordinarias_diurnas).toBe(0);
      expect(resultado.horas_extras_diurnas).toBe(0);
      expect(resultado.horas_nocturnas).toBe(0);
      expect(resultado.horas_faltantes).toBe(0);
    });
  });

  describe("Casos límite del tramo nocturno", () => {
    it("no genera horas nocturnas en una jornada 08:00–21:00 (el límite es exclusivo a las 21h)", () => {
      // 08:00–21:00 = 13h completamente diurnas (21:00 es el inicio del tramo nocturno, no incluido)
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_HABIL, hora: "08:00" },
        { tipo: "Salida",  fecha: FECHA_HABIL, hora: "21:00" },
      ];

      const resultado = calcularHoras(registros, horarioBase, [], FECHA_HABIL, FECHA_HABIL);

      expect(resultado.horas_nocturnas).toBe(0);
      expect(resultado.horas_ordinarias_diurnas).toBe(8);
      expect(resultado.horas_extras_diurnas).toBe(5);
    });

    it("genera 1h nocturna para jornada 21:00–22:00", () => {
      const registros: RegistroAsistencia[] = [
        { tipo: "Entrada", fecha: FECHA_HABIL, hora: "21:00" },
        { tipo: "Salida",  fecha: FECHA_HABIL, hora: "22:00" },
      ];

      const resultado = calcularHoras(registros, horarioBase, [], FECHA_HABIL, FECHA_HABIL);

      expect(resultado.horas_nocturnas).toBe(1);
      expect(resultado.horas_extras_nocturnas).toBe(1);
      expect(resultado.horas_ordinarias_diurnas).toBe(0);
    });
  });

  describe("dias_analizados", () => {
    it("cuenta correctamente el número de días en el periodo", () => {
      // Lunes 16 a viernes 20 = 5 días
      const resultado = calcularHoras([], horarioBase, [], "2026-03-16", "2026-03-20");

      expect(resultado.dias_analizados).toBe(5);
    });

    it("devuelve 1 para un periodo de un solo día", () => {
      const resultado = calcularHoras([], horarioBase, [], FECHA_HABIL, FECHA_HABIL);

      expect(resultado.dias_analizados).toBe(1);
    });
  });
});
