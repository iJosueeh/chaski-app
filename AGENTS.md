# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Convenciones del proyecto (Chaski · Serie AX)

## Nomenclatura de identificadores

- **Idioma**: identificadores internos en **inglés** (funciones, variables, props, constantes, rutas de módulos). El español se reserva para textos visibles, comentarios, y para los identificadores que reflejan el esquema de Supabase en la frontera de datos (interfaces y servicios).
- **Componentes y tipos**: `PascalCase` (p. ej. `PlaceTicketCard`, `AdminUser`, `WizardPlanRequest`).
- **Funciones y variables**: `camelCase` (p. ej. `formatPlaceBudget`, `duracionMin`).
- **Hooks**: `camelCase` con prefijo `use` (p. ej. `useAdminUsers`, `usePlace`), definidos en `hooks/` de su feature.
- **Constantes globales**: `SCREAMING_SNAKE_CASE` (p. ej. `MINUTOS_POR_DIA`, `PLACES_BUCKET`).
- **Archivos**: `kebab-case` (p. ej. `place-ticket-card.tsx`, `wizard-time.ts`). Los componentes usan `.tsx` y el resto `.ts`.
- **Carpetas de interfaces dentro de features**: `interfaces/` (plural).

## Rutas Expo Router

- Los nombres actuales de ruta se **conservan tal cual** (en español o inglés): `src/app/**` define la navegación pública y hay >120 referencias por literal en código y pruebas.
- Al mover una pantalla fuera de `src/app`, dejar en la ruta un re-export de una línea (`export { XScreen as default } from '@/features/…'`) y actualizar `Stack.Screen name` en `src/app/_layout.tsx` si el nombre del archivo de ruta cambia.
- Toda ruta requiere `export default`.

## Estructura y exports

- Organización por feature: `src/features/<feature>/{screens,components,services,context,hooks,utils,interfaces,__tests__}`.
- Los barrels (`index.ts`) usan **exports explícitos**, nunca `export *`, para evitar colisiones silenciosas y no arrastrar pantallas/servicios internos a los consumidores.
- El cliente de Supabase vive únicamente en `src/lib/supabase.ts`; fuera de `services/` y contextos de sesión no se importa directamente.
- Assets: usar el alias `require('@/assets/…')`, no rutas relativas.
