export { SolicitudesOverview } from "./components/SolicitudesOverview";
export { PermisoForm }         from "./components/PermisoForm";
export { VacacionesForm }      from "./components/VacacionesForm";
export { NovedadesForm }       from "./components/NovedadesForm";
export { VoiceNoteButton }     from "./components/VoiceNoteButton";
export { FirmaCanvas }         from "./components/FirmaCanvas";
export { FirmaSection }        from "./components/FirmaSection";
export { CalendarioPermiso }   from "./components/CalendarioPermiso";
// Sistema de diseño del módulo — reutilizable por nuevos formularios
export {
  MODULOS,
  Icon,
  Field,
  FormHeader,
  SectionTitle,
  DatosEmpleado,
  ErrorMsg,
  SubmitButton,
  SuccessCard,
  inputCls,
  readonlyCls,
  formatFecha,
} from "./components/ui";
export type { ModuloKey } from "./components/ui";
export { createPermisoHandlers }    from "./handlers/permiso";
export { createVacacionesHandlers } from "./handlers/vacaciones";
export { createNovedadesHandlers }  from "./handlers/novedades";
export type { SiriusEmployee, ResolvePayload } from "./types";
