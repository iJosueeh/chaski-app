# Guía de Sustentación APF1 — Chaski (Semanas 1–5, Unidad 1)

> Fuentes: materiales S01–S05 (175 diapositivas OCR, 0 errores) + Informe APF1 del grupo + código real de `Chaski-oficial`.
> Regla del curso: PF = 10% APF1 + 20% APF2 + 30% APF3 + 40% PROY.
> Objetivo del APF1: **demostrar que aplicamos los 5 temas de clase en Chaski y saber explicarlos**.

---

## MATRIZ: TEMA → CONCEPTO → EVIDENCIA EN CHASKI

### Tema 1 (S01) — Introducción al desarrollo móvil
**Concepto de clase:** qué es una app móvil; evolución (1990 C/Java ME → 2007 iPhone/nativo → 2015+ multiplataforma RN); logro Unidad 1.
**En Chaski:**
- Decisión **nativo vs multiplataforma**: elegimos RN+Expo (1 base de código → Android hoy, iOS después) porque somos 3 estudiantes con 18 semanas; con nativo serían 2 apps paralelas.
- Acceso a capacidades del dispositivo (GPS con expo-location) sin escribir Kotlin/Swift.
**Defensa:** «¿Por qué no nativo?» → equipo pequeño + tiempo + el profesor pidió RN. «¿Qué gano multiplataforma?» → reutilización ~95% del código; solo módulos nativos cambian.

### Tema 2 (S02) — Arquitectura de React Native
**Concepto de clase:** 3 capas (JS Thread ↔ Bridge ↔ Native Thread); evolución: clásica (JSON por bridge, lento) vs Nueva Arquitectura (Fabric + TurboModules + JSI).
**En Chaski:**
- **Lógica en JS thread:** todo el motor de planes (`plan-engine.ts`), el wizard y el estado (contexts) son TypeScript puro.
- **Capa nativa:** GPS, mapa (`react-native-maps`), AsyncStorage, tabs nativos (NativeTabs), teclado, DateTimePicker nativo.
- **Demo del puente JS↔nativo:** tocas «ELEGIR ESTE PLAN» → el tap es evento nativo → sube a JS → `activarPlan()` guarda en AsyncStorage (nativo) → setState → la UI nativa re-renderiza el Home con PLAN ACTIVO. Un solo tap atraviesa las 3 capas.
- **Versión:** Chaski corre RN 0.86 = **Nueva Arquitectura por defecto** (JSI directo, Fabric render, TurboModules lazy). Si preguntan por el bridge clásico: «es el modelo conceptual de la clase; en RN moderno JSI lo reemplaza, pero la separación JS/nativo sigue idéntica».
**Defensa:** «¿Dónde corre el motor?» → JS thread (TypeScript). «¿Y el mapa?» → TurboModule nativo; JS solo envía coordenadas y recibe eventos.

### Tema 3 (S03) — Props, Fragments, Flexbox y Estilos
**Concepto de clase:** props (reutilización + PropTypes), componentes personalizados, Flexbox (dirección/justify/align/gap), unidades (PixelRatio, %), estilos consistentes, responsividad.
**En Chaski (archivos reales):**
- **Props:** `<TicketCard title folio stamp onPress selected>` — un componente, 8 usos (GPS-001, BUSQ-002, chips, opciones P5…). `<WizardButton label onPress disabled>` en 10+ pantallas.
- **Componentes reutilizables:** `wizard-ui.tsx` = TicketCard + WizardButton + StepIndicator + TocapuStrip + WizardHeading, usados en todo el wizard y plan. El patrón «boleto» (borde, perforación, folio) se repite en resultados/detalle/historial con el mismo StyleSheet base.
- **Flexbox:** RN usa Flexbox por defecto (Yoga). Ejemplos: `topBar` (row + space-between), `chipsRow` (row + gap), `planCardHeader` (row + space-between), `paradaRow` (row + center).
- **Estilos:** `StyleSheet.create` + tema central `constants/theme.ts` (paleta Serie AX: crema/dorado/marrón/terracota/carmín) vía `useTheme()` → consistencia (principio de la clase).
- **Densidad/responsividad:** íconos `home.png/home@2x/home@3x` (RN elige por densidad); `useSafeAreaInsets` para notches; fuentes con variantes de peso (@expo-google-fonts).
- **Fragments:** para agrupar sin nodo extra — verificar en el código antes de afirmarlo en clase (si no hay `<>` en el repo, explicar el concepto con el ejemplo de la diapositiva y decir que nuestro patrón usa View contenedores).
**Defensa:** «Muéstrame un prop» → abrir wizard-ui.tsx TicketCard. «¿Dónde Flexbox?» → chipsRow del P2 en vivo.

### Tema 4 (S04) — Manejo de eventos y estados
**Concepto de clase:** eventos de texto (onChangeText/onSubmitEditing/onFocus/onBlur), gestos (onPress), Button vs TouchableOpacity, **useState** (estado → re-render), useEffect, listas.
**En Chaski:**
- **onPress por todas partes:** WizardTopBar (‹ / ✕), TicketCard, chips, toggle de paradas del recorrido, ELEGIR ESTE PLAN (**onPress async**).
- **useState en cadena:** P2 Tiempo maneja inicio/fin/chipActivo/picker/error = 5 estados; la duración se recalcula (useMemo) en vivo.
- **Demo matadora del estado:** arrastrar el slider de presupuesto (P3) → el monto grande «S/ 50» cambia en tiempo real = re-render por estado.
- **Eventos de texto:** login (email/password con onChangeText + estado de error con mensaje).
- **useState + persistencia:** marcar parada → `marcarParada()` actualiza estado **y** AsyncStorage (sobrevive cierres).
- **Estado global entre pantallas:** WizardContext (los 5 pasos comparten la solicitud) y PlansContext (plan activo/historial) — Context + useReducer/useMemo.
**Defensa:** «¿Qué pasa al tocar FINALIZAR?» → async: `completarPlan()` archiva en historial (estado) + AsyncStorage → navega a Completado. «Diferencia Button vs TouchableOpacity» → Button es nativo simple; TouchableOpacity permite estilos custom (nuestros botones Serie AX).

### Tema 5 (S05) — Navegación (Stack / Tab / Drawer)
**Concepto de clase:** React Navigation (native, screens, safe-area, gesture-handler); Stack (pila), Tabs, Drawer (menú lateral); NavigationContainer.
**En Chaski (Expo Router = React Navigation file-based):**
- **Stack raíz** (`app/_layout.tsx`, `headerShown:false`): login + wizard (6) + plan (5) + places. Pila real: P1→…→detalle = 8 pantallas apiladas; atrás hace pop.
- **Tabs nativos:** `(tabs)/` con NativeTabs → Inicio / Historial / Perfil (íconos por densidad, indicatorColor del tema).
- **Params:** resultados→detalle pasa el plan completo por params (`JSON.stringify`). El wizard NO usa params (5 pantallas × N campos) usa **WizardContext** — buen punto para explicar cuándo params y cuándo estado compartido.
- **API de pila:** `push` (avanza), `replace` (sustituye: FINALIZAR→Completado para que atrás no vuelva al recorrido), `dismissAll` (vacía la pila del wizard al ELEGIR ESTE PLAN).
- **Drawer: NO lo usamos** — honesto: «Chaski es flujo guiado (boleto) + 3 tabs; Drawer aplica a apps de muchas secciones (Gmail). Si el proyecto lo pidiera, se agrega con @react-navigation/drawer».
- Expo Router **construye sobre React Navigation**: mismo Stack/Tabs de la clase; el mapeo de rutas es por archivos (`plan/activo.tsx` = `/plan/activo`).
**Defensa:** «¿Stack o Tab? ¿por qué?» → ambos: Stack para el flujo del plan (con pila y params), Tabs para secciones permanentes (Inicio/Historial/Perfil).

---

## GUION DE SUSTENTACIÓN (≈8 min)

1. **Problema (1 min)** — slide AFP p2: 6 condiciones simultáneas; hoy el usuario cruza todo a mano. Chaski centraliza.
2. **Propuesta (1 min)** — AFP p3: tú defines condiciones → Chaski evalúa horarios/desplazamientos/compatibilidad → **hasta 3 alternativas viables**.
3. **Tecnología + arquitectura (1.5 min)** — RN+TS+Expo / Supabase+PostgreSQL; cliente-servidor; Scrum+Kanban (Informe §7, §8, §10).
4. **Los 5 temas aplicados (2 min)** — recorrer la matriz: S01 decisión, S02 capas, S03 props/flexbox, S04 estado, S05 navegación.
5. **Demo en vivo (2.5 min, cronometrada):** login → wizard (mapa→tiempo→presupuesto→intereses→movilidad) → Buscando → Resultados → Detalle → ELEGIR → PLAN ACTIVO (toggle parada) → FINALIZAR → Completado → Historial + tab Perfil. Si hay 0 planes: mostrar frame «Sin resultados» + AJUSTAR BÚSQUEDA (va a Intereses).
6. **Estado real (30 s)** — lo logrado: flujo completo funcional con datos de Supabase. Sin etiquetas «hecho/futuro».

## BANCO DE DEFENSA (preguntas probables)
- ¿Por qué RN y no Flutter? → base del curso + JS/TS + ecosistema Expo.
- ¿Dónde corre la lógica del motor? → JS thread; nativo solo GPS/mapa/storage.
- ¿Qué es el bridge / JSI? → S02; demo del tap→JS→nativo.
- Muéstrame props/flexbox/useState → abrir archivos señalados.
- ¿Cómo genera los planes? → filtro (≤12 km + intereses) → 3 variantes con presupuesto/tiempo fraccionado → greedy cercanía → descarte de variantes vacías → dedup. (Versión simplificada de «búsqueda limitada» del Informe §7.3; si piden Beam Search: mismo principio de poda, menos candidatos.)
- ¿Qué pasa con 0 planes? → frame Sin resultados + AJUSTAR BÚSQUEDA → Intereses (demo).
- ¿Por qué Supabase? → BaaS: auth + Postgres + RLS sin backend propio (Informe §10).
- ¿Drawer? → no aplica al flujo; explicado arriba.

## CHECKLIST PRE-SUSTENTACIÓN
- [ ] Demo cronometrada 2× en el AVD (3 min máx).
- [ ] Verificar en código: ¿usamos `<>` fragments? (Tema 3).
- [ ] Emulador con la app abierta ANTES de empezar; plan B: capturas del flujo.
- [ ] A1+A2 del motor (anti-duplicados) aplicados y probados.
- [ ] Tener abiertos: wizard-ui.tsx, plan-engine.ts, _layout.tsx (para mostrar en pantalla).

## PENDIENTES DE ESTE PLAN
- A1: AJUSTAR BÚSQUEDA → `/wizard/intereses` (1 línea, resultados.tsx).
- A2: motor con anclas por variante + dedup por firma (plan-engine.ts).
- Opcional: completar OCR fino de S03/S04/S05 (diapositivas 15–32) para citar diapositiva exacta si el docente pide fuente.
