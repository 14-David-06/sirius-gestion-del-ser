---
description: "Use when creating or modifying UI components, dashboard pages, cards, tables, or any visual element in the frontend. Covers the glass-morphism design system with Tailwind 4."
applyTo: src/components/**, src/app/dashboard/**
---
# Patrón UI: Glass-morphism

## Contenedores (cards, paneles, tablas)

```
rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] shadow-2xl shadow-black/20
```

Hover: `hover:bg-black/40 hover:border-white/[0.18] transition-all duration-500`

## Iconos y badges

```
rounded-2xl bg-white/[0.08] ring-1 ring-white/[0.12] backdrop-blur-sm
```

## Tipografía

- Títulos y labels: `text-white/40 uppercase tracking-wider text-[11px] font-semibold`
- Valores principales: `text-white text-3xl font-extrabold tracking-tight`
- Subtítulos: `text-white/50 text-xs font-medium`

## Decoración glow

Efecto de brillo sutil en hover:

```html
<div class="absolute -top-12 -right-12 w-32 h-32 bg-white/[0.04] rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
```

## Componentes existentes — usar siempre antes de crear nuevos

| Componente | Uso |
|---|---|
| `<StatCard />` | Tarjetas KPI con icono, valor, subtítulo y color |
| `<DataTable />` | Tablas con header, icono y subtítulo |
| `<StatusBadge />` | Pills de estado (Vigente, Vencido, Pendiente, etc.) |
| `<CumplimientoChart />` | Barras de progreso de cumplimiento |

## Reglas

1. **No usar colores sólidos hex** — usar opacidades (`bg-white/[0.06]`, `bg-black/30`)
2. **No CSS modules** ni styled-components — solo clases de Tailwind 4
3. **No crear componentes duplicados** — extender los existentes en `src/components/`
4. **Tema oscuro siempre** — el dashboard no tiene modo claro
