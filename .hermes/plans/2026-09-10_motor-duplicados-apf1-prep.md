# Plan: Motor sin duplicados + AJUSTAR BÚSQUEDA + Preparación sustentación APF1 (Semanas 1–5)

> **Modo plan.** No ejecutar hasta el «adelante». 2 pistas: (A) correcciones de código
> del motor del plan, (B) preparación completa para sustentar los 5 temas del Avance 1.

**Contexto del usuario (verbatim clave):** «AJUSTAR BÚSQUEDA debería llevarme a
¿Qué te provoca hacer?, no a ¿Cómo te mueves?» · «¿por qué hay planes duplicados
(Íntima 1 parada Circuito Mágico y Equilibrado 1 parada Circuito Mágico, misma
duración)?» · «quiero entender esto a fondo cómo estamos definiendo» · «solo esos
5 puntos tenemos que sustentar, aún no nos adelantemos».

---

## 0. EXPLICACIÓN A FONDO DEL MOTOR (estado actual, sin humo)

Cómo funciona hoy (`src/features/plan-engine/plan-engine.ts`):

1. **Filtro de candidatos**: lugares a ≤12 km del punto de origen + filtro por
   intereses (si eligió) → lista de candidatos.
2. **3 variantes** (cada una construye su propio plan con greedy nearest-neighbor):
   | Variante | maxStops | usa del presupuesto | usa del tiempo | sesgo |
   |---|---|---|---|---|
   | Ruta Íntima | 3 | 60 % | 55 % | prioriza lugares de 60 min (museos) |
   | Plan Equilibrado | 4 | 85 % | 80 % | prioriza lugares de 40 min |
   | Ruta Exploradora | 5 | 100 % | 100 % | prioriza lugares ≤30 min |
3. **Greedy**: desde tu origen, siempre elige el candidato más cercano (con bonus
   de sesgo), suma traslado (4.5 km/h caminando; 12 público; 20 aplicativo) +
   duración del lugar; repite hasta que presupuesto/tiempo/maxStops se acaban.
4. Las variantes con 0 paradas que quepan se **excluyen** del resultado.

**Por qué salieron duplicados** (el caso Circuito Mágico): el greedy SIEMPRE arranca
por el lugar más cercano a tu pin. Con pocos lugares cerca (hoy la tabla `lugares`
tiene pocos registros), Íntima (55 % de 240 min = 132) cabe Circuito Mágico (120 min)
y ya no cabe nada más → 1 parada. Equilibrada (80 % = 192) cabe Circuito (120) +
traslado, pero el siguiente (MALI ~60 min) sumaría ~195 > 192 → también 1 parada.
**Resultado: 2 planes idénticos con nombres distintos.** Exploradora (100 % = 240)
sí cupo la 2.ª parada → por eso esa sí muestra "4.6h con MALI". La causa raíz no es
la fracción de presupuesto: es que **las 3 variantes eligen el MISMO primer lugar**
(ancla idéntica) y con recursos escasos convergen al mismo plan.

**Definición correcta a proponer** (lo que implementaremos):
- **Ancla distinta por variante**: Íntima arranca por el lugar de mayor calidad
  (sesgo point), Equilibrada por el más cercano, Exploradora por el más lejano que
  quepa → garantiza que la 1.ª parada de cada boleto sea diferente.
- **Dedup por firma**: si 2 planes quedan con la misma secuencia de lugares, se
  conserva solo el más completo. «Encontramos N planes» mostrará el N real.
- Con 1 solo lugar en la BD, la app mostrará 1 plan (honesto) — no 3 clones.
  Con los 20 lugares del seed, las 3 variantes divergen naturalmente.

**¿Es error serio?** No bloquea datos, pero es **el punto más visible para el jurado
en la demo** (3 boletos idénticos = motor que no diferencia). Prioridad alta antes
de APF2; corrección contenida (1 archivo + pantalla resultados).

---

## PARTE A — CÓDIGO (tareas concretas)

### A1. AJUSTAR BÚSQUEDA → P4 Intereses (30 s)
- **File:** `src/app/plan/resultados.tsx` (CTA del frame «Sin resultados»).
- Cambiar `router.back()` (vuelve a P5 movilidad) por
  `router.push('/wizard/intereses')` — el WizardContext conserva minutos/presupuesto,
  así el usuario solo re-elige intereses y vuelve a encontrar planes.
- **Verificación e2e:** forzar 0 planes → AJUSTAR BÚSQUEDA → aterriza en
  «¿Qué te provoca hacer?» con selección anterior marcada.

### A2. Anti-duplicados + anclas (motor)
- **File:** `src/features/plan-engine/plan-engine.ts`
  1. Ancla inicial por variante (ver definición arriba).
  2. Dedup final por firma `paradas.map(p => p.place.id).join('|')`.
  3. Descripción del plan menciona el criterio de su variante («recorrido corto y
     profundo», «balanceado», «el que más explora») para que el boleto se autoexplique.
- **File:** `src/app/plan/resultados.tsx` — título «Encontramos N planes» ya funciona.
- **Verificación:** mismo input de hoy → ≥2 boletos con 1.ª parada distinta;
  si la BD solo tiene 1 lugar → 1 solo boleto.

### A3. Calidad
- `npx tsc --noEmit` = 0, `npm run lint` = 0, commit único `fix: motor sin planes duplicados + ajustar busqueda a intereses`.

---

## PARTE B — PREPARACIÓN SUSTENTACIÓN APF1 (5 temas, semanas 1–5)

### B0. Desbloquear lectura de los materiales (REQUIERE tu aprobación de scripts)
Los 5 PDFs de la carpeta `avance_1_temas_hasta_sem5/` son **escaneados** (sin capa
de texto). Estado real: **S03 extraído** (Props/Fragments/Flexbox/Estilos).
Pendientes de OCR: S01 (73 pág), S02 (33), S04 (36), S05 (33) + `AFP_Chaski.pdf`
(rúbrica, 5 pág escaneadas). Solo lectura, sin tocar nada del proyecto.
- Opción rápida (páginas clave): `pdftoppm` + visión por página.
- Opción completa: `marker-pdf` (~5 GB) solo si hay disco.

### B1. Matriz tema → aplicación real en Chaski (el «qué mostraré en código»)
Cada tema de clase → evidencia concreta del repo para demostrar que lo aplicamos:
- **S01 (intro desarrollo móvil)** → decisión nativo vs multiplataforma; arquitectura
  del informe (RN+Expo+Supabase) y por qué (Objetivo/Alcance del Informe §4, §6).
- **S02 (arquitectura RN, View/Text/Image, estilos)** → hilo JS + bridge explicado
  con nuestra app; componentes base en login.tsx/Home; StyleSheet central.
- **S03 (Props, Fragments, Flexbox, Estilos)** — ya extraído:
  - Props → `<TicketCard title folio stamp onPress selected>` (wizard-ui.tsx).
  - Componentes personalizados + reutilización → WizardButton/StepIndicator.
  - Flexbox → `flexDirection/justifyContent/gap` en planCard, chips, bottom bar.
  - Unidades/PixelRatio → íconos @2x/@3x; estilos responsive con insets.
- **S04/S05** → se completan tras B0 (OCR): mapear al código con la misma matriz.

### B2. Qué presentaremos en el Avance 1 (guion, no improvisar)
1. **Problema y solución** (Informe §3–4): planificar salidas en Lima considerando
   ubicación, tiempo, presupuesto, intereses y movilidad → hasta 3 alternativas.
2. **Tecnologías** (§7 + §11): React Native + TypeScript + Expo + Supabase/PostgreSQL;
   justificar cada una (multiplataforma, tipado, ecosistema, BaaS).
3. **Arquitectura y metodología** (§8, §10): cliente-servidor, Scrum/Kanban, sprints.
4. **Análisis** (§9): RF/RNF clave + UML (casos de uso, clases, secuencia).
5. **Demo en vivo** (lo que ya corre): login → wizard 5 pasos → Buscando →
   Resultados → Detalle → ELEGIR → PLAN ACTIVO → Finalizar → Historial.
6. **Estado honesto**: qué falta (seed 20 lugares, GPS real, Figma pendiente) —
   presentar lo logrado (regla del equipo: no etiquetar «hecho vs futuro»).

### B3. Banco de defensa (preguntas probables del docente + respuesta con demo)
- «¿Por qué RN y no Flutter?» · «¿Dónde está el bridge?» · «Muéstrame un prop» ·
  «¿Flexbox dónde?» · «¿Cómo genera los planes? (TTDP/greedy/heurística, §7.3)» ·
  «¿Por qué Supabase?» · «¿Qué pasa si hay 0 planes?» → demostrar el frame Sin
  resultados + AJUSTAR BÚSQUEDA (justo la corrección A1).
- Cada respuesta con: concepto de clase (material) + archivo del repo + demo en emulador.

### B4. Ensayo final
- Checklist de demo en el AVD (el flujo de arriba, 3 min cronometrados).
- Plan B sin internet: capturas del flujo ya tomadas + explicación por imagen.

---

## Orden de ejecución
1. **A1** (1 línea) → 2. **A2** (motor) → verificación e2e de ambas en emulador → commit.
3. **B0** (con tu permiso de scripts: OCR) → 4. **B1–B4** (documento de preparación
   + ensayo de demo).

## Riesgos / abiertos
- OCR bloqueado por permisos de scripts → alternativa: me apruebas los comandos
  `pdftoppm`/python y avanzo, o pasas páginas clave como imagen.
- Si el docente espera Beam Search textual (Informe §7.3.3) y vemos greedy:
  explicar honestamente que greedy + anclas + dedup es nuestra versión simplificada
  del «búsqueda limitada» del informe (mismo principio, menos candidatos).
