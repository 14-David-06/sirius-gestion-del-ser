import { describe, it, expect } from "vitest";
import { esFestivo, festivosColombia } from "./festivos";

/**
 * Fechas verificadas contra el calendario oficial de festivos de Colombia.
 * 2025 tiene 17 y no 18 porque San Pedro y San Pablo (trasladado del domingo
 * 29 de junio) coincide con el Sagrado Corazón el lunes 30 de junio.
 */
describe("festivosColombia", () => {
  it("2026 tiene los 18 festivos oficiales", () => {
    expect([...festivosColombia(2026)].sort()).toEqual([
      "2026-01-01", // Año Nuevo
      "2026-01-12", // Reyes Magos (trasladado del 6)
      "2026-03-23", // San José (trasladado del 19)
      "2026-04-02", // Jueves Santo
      "2026-04-03", // Viernes Santo
      "2026-05-01", // Día del Trabajo
      "2026-05-18", // Ascensión
      "2026-06-08", // Corpus Christi
      "2026-06-15", // Sagrado Corazón
      "2026-06-29", // San Pedro y San Pablo
      "2026-07-20", // Independencia
      "2026-08-07", // Batalla de Boyacá
      "2026-08-17", // Asunción (trasladado del 15)
      "2026-10-12", // Día de la Raza
      "2026-11-02", // Todos los Santos (trasladado del 1)
      "2026-11-16", // Independencia de Cartagena (trasladado del 11)
      "2026-12-08", // Inmaculada Concepción
      "2026-12-25", // Navidad
    ]);
  });

  it("2025 colapsa San Pedro y Sagrado Corazón en el mismo lunes", () => {
    const f = festivosColombia(2025);
    expect(f.size).toBe(17);
    expect(f.has("2025-06-30")).toBe(true);
  });

  it("no traslada los festivos de fecha fija aunque caigan en domingo", () => {
    // 20 de julio de 2025 fue domingo y siguió siendo el festivo.
    expect(esFestivo("2025-07-20")).toBe(true);
    expect(esFestivo("2025-07-21")).toBe(false);
  });

  it("traslada al lunes siguiente los festivos de la Ley Emiliani", () => {
    // Día de la Raza: domingo 12 oct 2025 → lunes 13.
    expect(esFestivo("2025-10-12")).toBe(false);
    expect(esFestivo("2025-10-13")).toBe(true);
  });

  it("mantiene en lunes los trasladables que ya caen en lunes", () => {
    // Reyes Magos: 6 ene 2025 fue lunes.
    expect(esFestivo("2025-01-06")).toBe(true);
  });

  it("calcula la Semana Santa a partir de la Pascua", () => {
    // Pascua 2027 = 28 de marzo.
    expect(esFestivo("2027-03-25")).toBe(true); // Jueves Santo
    expect(esFestivo("2027-03-26")).toBe(true); // Viernes Santo
    expect(esFestivo("2027-03-28")).toBe(false); // Domingo de Pascua no es festivo de ley
  });

  it("todos los festivos trasladables caen en lunes", () => {
    const noTrasladables = new Set(["01-01", "05-01", "07-20", "08-07", "12-08", "12-25"]);
    for (const anio of [2025, 2026, 2027, 2028, 2030]) {
      for (const iso of festivosColombia(anio)) {
        const md = iso.slice(5);
        const diaSemana = new Date(iso + "T12:00:00").getDay();
        // Jueves y Viernes Santo tampoco se trasladan.
        const esSemanaSanta = diaSemana === 4 || diaSemana === 5;
        if (!noTrasladables.has(md) && !esSemanaSanta) {
          expect(diaSemana, `${iso} debería ser lunes`).toBe(1);
        }
      }
    }
  });

  it("ignora fechas malformadas", () => {
    expect(esFestivo("")).toBe(false);
    expect(esFestivo("no-es-fecha")).toBe(false);
  });
});
