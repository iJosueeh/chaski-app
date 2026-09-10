# Auditoría de Inconsistencias + Plan de Corrección — Chaski (Fase 4.5)

> **Para Hermes:** plan-mode. NO ejecutar hasta que el usuario dé el «adelante».
> Contexto: tras la Fase 4 verificada e2e (wizard→motor→activo→historial), el usuario
> reporta 4 síntomas y pide análisis a profundidad de TODA la lógica antes de tocar nada.

**Goal:** Corregir las inconsistencias de navegación/datos del ciclo del plan y el
bottom bar, dejando la app consistente con el Figma «Boleto Serie AX».

**Arquitectura:** Expo Router (Stack raíz + NativeTabs en `(tabs)`), estado del plan en
PlansContext (AsyncStorage), motor greedy en `plan-engine.ts` (3 variantes).

---

## 1. AUDITORÍA — catálogo completo de inconsistencias

### 🔴 SERIAS (rompen el flujo o contradicen el diseño aprobado)

| # | Inconsistencia | Causa raíz (archivo:línea) | ¿Qué rompe? |
|---|---|---|---|
| S1 | **«VER TODOS» de PLANES RECIENTES no va al Historial** — manda al wizard P1 («¿Desde dónde empiezas?») | `(tabs)/index.tsx:266-273` → `onPress={goCrearPlan}` (mismo handler que CREAR MI PLAN) | El usuario no puede ver su historial desde Home |
| S2 | **PLANES RECIENTES no muestra nada del historial local** — siempre «Sin exploraciones todavía» aunque el historial tenga boletos | `(tabs)/index.tsx:276-288` — card vacía hardcodeada, ni siquiera importa `usePlans()` para `historial` | La sección del Figma está muerta; el dato real vive en el contexto pero no se renderiza |
| S3 | **Bottom bar con «Explore»** — el usuario lo confirma: debe ser Inicio · Historial · Perfil (según Figma) | `(tabs)/_layout.tsx` registra `index`/`explore`/`historial`; `explore.tsx` es el template del starter kit de Expo (300 líneas de Links de docs) | Tab muerto con contenido placeholder; falta el tab Perfil |

### 🟡 MEDIANAS (experiencia degradada, no bloquean)

| # | Inconsistencia | Causa raíz | ¿Qué pasa? |
|---|---|---|---|
| M1 | **GPS «Usar mi ubicación» nunca navega** en el emulador (probado 2× con `geo fix` inyectado y permiso granted) | `wizard/ubicacion.tsx:34-61` — `watchPositionAsync` con timeout silencioso; si la fix no llega, el usuario queda en `setBusy` sin mensaje claro, sin fallback | El usuario se queda atascado en P1; solo escapa por «Buscar mi ubicación» |
| M2 | **Los 3 planes salieron idénticos (1 parada, mismo lugar, mismo S/7)** en la prueba real | `plan-engine.ts` — `maxStops` por variante (3/4/5) pero el presupuesto S/50 + duración del lugar (120 min del Circuito Mágico) consumió todo; las variantes solo cambian sesgo, no mínimo de paradas ni diversidad | «3 opciones» que son la misma → engañoso. Con 20 lugares del seed mejorará, pero falta garantía de diversidad |
| M3 | **Resultado 0 planes = pantalla sin salida** — «Encontramos 0 planes» con los boletos vacíos y solo el ✕ | `plan/resultados.tsx` no distingue el caso 0 (no hay mensaje del Figma «Sin resultados» ni CTA «Ajustar filtros») | Callejón sin salida visual |

### 🟢 MENORES (ruido/detalle)

| # | Inconsistencia | Causa raíz | Detalle |
|---|---|---|---|
| m1 | **Warning DateTimePicker `onChange` deprecated** (sigue saliendo pese a nuestro fix previo) | `wizard/tiempo.tsx:234` — la v9.1.0 del paquete deprecó el prop entero; la validación interna `sharedPropsValidation` lo avisa al abrir el picker nativo | Solo warning dev, pero el usuario lo ve en LogBox |
| m2 | **Typo visible: «SerIE AX»** en Buscando | `plan/buscando.tsx:74` | Detalle estético |
| m3 | **「1 paradas」** (debería ser «1 parada») en Resultados/Detalle/Historial | plural sin condicional en 4 archivos | Cosmético |

### ⚪ NO-ERRORES (aclaraciones honestas — NO corregir)

| Aviso del usuario | Veredicto |
|---|---|
| **«Cannot connect to Expo CLI»** (2 variantes: URL 192.168.18.3:8081 y 10.0.2.2:8081) | **FALSA ALARMA.** El warning salió cuando Metro estaba caído entre reinicios (hoy está vivo, HTTP 200, y toda la prueba e2e corrió con el bundle servido). 192.168.18.3 = la LAN IPv4 que la app guardó de una sesión previa; 10.0.2.2 = loopback del emulador hacia el host. Solo advertencia de HMR (`hmr.ts:312`), no afecta el código. Si reaparece: reiniciar Metro. **No es error serio.** |
| **DateTimePicker deprecated** | Warning de la librería (m1 arriba), no error. Se silencia con `onValueChange`+`onDismiss` (v9) — tarea incluida. |
| **«Preconfigurados» del motor** | Ya EXISTEN: son las 3 variantes (Íntima/Equilibrada/Exploradora) generadas según lo elegido. No hay que crear planes hardcodeados; el seed de 20 lugares (pendiente de Josué) es lo que los diferenciará. |

---

## 2. PLAN DE CORRECCIÓN (por fases, con archivos exactos)

### Fase 1 — Home conectada al historial (S1 + S2)
- **Files:** `src/app/(tabs)/index.tsx`
  - `VER TODOS` → `router.push('/(tabs)/historial')` (SwitchTab al tab: `router.push('/(tabs)/historial')`).
  - Reemplazar la card vacía hardcodeada por render real: si `historial.length > 0` → los 2-3 últimos boletos (folio, título, fecha, S/); si no → la card vacía actual.
  - Import `usePlans()` (ya existe el hook).
- **Verificación:** completar un plan → Home muestra el boleto en PLANES RECIENTES → «VER TODOS» aterriza en MIS EXPLORACIONES.

### Fase 2 — Bottom bar correcto: Inicio · Historial · Perfil (S3)
- **Files:**
  - `src/app/(tabs)/_layout.tsx` — quitar trigger `explore`, agregar `perfil`.
  - Crear `src/app/(tabs)/perfil.tsx` — **NO duplicar**: `export { default } from ...` reutilizando la pantalla de preferencias existente (`features/preferences/screens`, ya usada por `src/app/preferences.tsx`), con header estilo Historial (PT 52) y `limpiarHistorial()` disponible si el diseño lo pide.
  - Íconos: no existen `perfil.png` → usar el del avatar/menú o `home.png` temporal; NO crear assets nuevos sin consultar.
  - Borrar `src/app/(tabs)/explore.tsx` (template muerto del starter).
- **Verificación:** 3 tabs, tap Perfil muestra configuración; tap Explore ya no existe.

### Fase 3 — P1 GPS a prueba de atascos (M1)
- **Files:** `src/app/wizard/ubicacion.tsx`
  - Si el timeout de la fix vence: mensaje claro + botón «Ir al mapa» (no dejar `busy` eterno).
  - Auto-fallback: tras 8 s sin fix, mostrar sugerencia de usar el mapa.
- **Verificación:** emulador sin fix → mensaje + fallback visible en <10 s.

### Fase 4 — Motor con diversidad mínima (M2)
- **Files:** `src/features/plan-engine/plan-engine.ts`
  - Regla de diversidad: si todas las variantes quedan con 1 sola parada y el mismo lugar, recortar presupuesto/tiempo «virtual» por variante (ej. Íntima usa el 60 % del presupuesto) para forzar paradas distintas, o reordenar el sesgo.
  - Mínimo honesto: si un lugar único domina, el texto de descripción lo dice («recorrido corto por presupuesto»).
- **Verificación:** test manual con la misma entrada de hoy (2h/4h, S/50) → al menos 2 boletos distintos.

### Fase 5 — Resultado vacío con salida (M3) + copy fixes (m2, m3)
- **Files:** `src/app/plan/resultados.tsx` (case 0 → frame «Sin resultados»: mensaje + botón «AJUSTAR BÚSQUEDA» → `router.back()`), `plan/buscando.tsx:74` (SerIE→SERIE), plural «parada/paradas» en `resultados.tsx`, `detalle.tsx`, `historial.tsx`, `index.tsx`.
- **Verificación:** forzar 0 planes → pantalla con CTA; textos correctos.

### Fase 6 — DateTimePicker v9 (m1)
- **Files:** `src/app/wizard/tiempo.tsx` — `onChange` → `onValueChange(date)` + `onDismiss(alCerrar)`; eliminar el chequeo manual de `e.type !== 'dismissed'` (el prop nuevo lo reemplaza).
- **Verificación:** abrir picker en el emulador → LogBox sin warning; elegir hora sigue funcionando.

### Fuera de alcance (ya decididos con el usuario)
- Seed de 20 lugares → **bloqueado por la service_role key de Josué** (no de este plan).
- Frames Figma faltantes → rate limit Starter (renovación mensual).
- GPS real en device físico → APF2/3.

---

## 3. ORDEN EJECUCIÓN Y VALIDACIÓN GLOBAL

1. Fases 1→2→5→3→4→6 (Home/tabs primero = lo que el usuario ve; motor al final).
2. Tras cada fase: `npx tsc --noEmit` (0) + `npm run lint` (0).
3. Al final: prueba e2e con taps reales (uiautomator) del ciclo completo:
   wizard → resultados → detalle → ELEGIR → Home (PLAN ACTIVO + boleto en RECIENTES)
   → VER TODOS → Historial → tab Perfil.
4. Commits por fase (`feat: ...`), nunca mezclar.

## Riesgos
- `perfil.tsx` re-exportando preferences puede chocar con estilos pensados para modal (header PT 52) → revisar visual en emulador.
- Touch del tab en NativeTabs usa `name` de archivo — renombrar explore→perfil mantiene el índice de tabs pero cambia la ruta `/(tabs)/explore` (nada la referencia: verificado, 0 usos).
- Cambiar `onChange`→`onValueChange` depende de la v9.1.0 instalada — confirmar firma con `node_modules/@react-native-community/datetimepicker/src/utils.js` antes.
