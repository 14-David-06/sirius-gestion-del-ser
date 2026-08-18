/**
 * Los planes de compensación viven en `@sirius/solicitudes/compensacion`: son
 * dominio del módulo de solicitudes, no de esta app, y otra app que monte los
 * formularios los necesita igual.
 *
 * Este archivo se queda como reenvío para que los sitios que ya los importaban
 * por `@/lib/compensacion` sigan funcionando. Hay una sola definición: si se
 * copiara aquí, el PDF y el formulario podrían generar planes distintos.
 */
export * from "@sirius/solicitudes/compensacion";
