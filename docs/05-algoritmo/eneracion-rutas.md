# Generación de rutas — Chaski

## 1. Propósito

Este documento describe el algoritmo utilizado para generar alternativas de recorrido en Chaski.

El algoritmo recibe una solicitud válida y produce hasta tres planes compatibles con las condiciones indicadas por el usuario.

La primera versión utiliza un enfoque determinístico basado en:

- filtrado de candidatos;
- matriz de desplazamiento;
- búsqueda limitada;
- validación de restricciones;
- puntuación multicriterio;
- control de diversidad.

No se utiliza inteligencia artificial ni aprendizaje automático.

---

# 2. Entrada del algoritmo

El algoritmo recibe una solicitud de planificación.

Conceptualmente:

```typescript
type PlanningRequest = {
  id: string;

  startDateTime: Date;
  endDateTime: Date;

  startPoint: GeoPoint;
  finalType: FinalPointType;
  finalPoint?: GeoPoint;

  categoryIds: string[];

  spendingMin: number;
  spendingMax: number;

  mobility: MobilityMode;
};
```

Las condiciones ya deben haber sido validadas antes de iniciar la generación.

---

# 3. Salida

El algoritmo devuelve:

```text
0 a 3 alternativas
```

Cada alternativa contiene:

- paradas;
- tramos;
- horarios estimados;
- duración total;
- rango de gasto estimado;
- puntuación de compatibilidad.

Conceptualmente:

```typescript
type GeneratedPlan = {
  stops: GeneratedStop[];
  segments: GeneratedSegment[];

  totalDurationMinutes: number;

  estimatedCostMin: number;
  estimatedCostMax: number;
  hasUnknownCost: boolean;

  compatibilityScore: number;
};
```

---

# 4. Flujo general

La generación sigue las siguientes etapas:

```text
1. Recibir solicitud
        ↓
2. Obtener candidatos
        ↓
3. Filtrar candidatos iniciales
        ↓
4. Construir matriz de desplazamiento
        ↓
5. Crear seeds
        ↓
6. Ejecutar Beam Search
        ↓
7. Obtener rutas viables
        ↓
8. Puntuar rutas completas
        ↓
9. Eliminar equivalencias
        ↓
10. Aplicar diversidad
        ↓
11. Seleccionar hasta 3
        ↓
12. Persistir resultados
```

---

# 5. Parámetros iniciales

La primera versión utilizará los siguientes parámetros configurables:

| Parámetro | Valor inicial |
|---|---:|
| `MAX_INITIAL_SEEDS` | 5 |
| `BEAM_WIDTH` | 3 |
| `MIN_STOPS` | 1 |
| `MAX_STOPS` | 4 |
| `MAX_RESULTS` | 3 |

Estos valores no representan restricciones permanentes del dominio.

Podrán modificarse después de realizar pruebas.

---

# 6. Obtención de candidatos

El primer paso consiste en recuperar lugares que puedan ser considerados durante la generación.

Se utilizarán principalmente:

- categorías seleccionadas;
- estado del lugar;
- ubicación;
- disponibilidad de información mínima.

Un lugar debe encontrarse:

```text
ACTIVO
```

para participar en nuevas generaciones.

---

# 7. Filtrado inicial

El filtrado inicial busca reducir el espacio de búsqueda antes de ejecutar el algoritmo principal.

Por ejemplo:

```text
100 lugares registrados
        ↓
solo activos
        ↓
categorías solicitadas
        ↓
zona razonable
        ↓
información mínima
        ↓
20 candidatos
```

El objetivo no es determinar todavía si cada lugar puede visitarse.

La validación temporal se realizará posteriormente utilizando la hora estimada de llegada.

---

# 8. Información mínima de un lugar

Para participar en la generación, un lugar necesita como mínimo:

- ubicación;
- categoría;
- duración sugerida;
- estado;
- horario cuando corresponda.

La información económica puede ser desconocida.

Por ello:

```text
gasto = NULL
```

no implica que el lugar deba ser eliminado.

---

# 9. Horarios

Un lugar no debe descartarse únicamente porque se encuentre cerrado al momento inicial de la salida.

Ejemplo:

```text
Salida inicia: 15:00
Lugar abre:    16:00
Llegada estimada: 16:20
```

El lugar puede ser completamente válido.

La disponibilidad debe evaluarse durante la expansión de cada ruta.

---

# 10. Construcción de puntos

Antes de solicitar desplazamientos se construye el conjunto de puntos relevantes.

Puede contener:

```text
P0 = inicio
P1 = lugar A
P2 = lugar B
P3 = lugar C
...
PF = punto final
```

El punto final depende del tipo seleccionado por el usuario.

---

# 11. Tipos de punto final

## REGRESAR_INICIO

El punto final es igual al punto inicial.

```text
Inicio → lugares → Inicio
```

## OTRA_UBICACION

Se utiliza el punto indicado por el usuario.

```text
Inicio → lugares → PuntoFinal
```

## ULTIMA_PARADA

No se necesita un punto geográfico externo adicional.

La ruta termina en la última parada seleccionada.

---

# 12. Matriz de desplazamiento

Se obtiene una matriz dirigida con los desplazamientos necesarios.

Ejemplo:

```text
          A       B       C
Inicio   10m     15m      8m
A         -       7m     11m
B         6m      -       5m
C        12m      8m      -
```

Cada relación puede contener:

```typescript
type TravelEdge = {
  durationMinutes: number;
  distanceMeters: number;
  estimatedCost?: number | null;
};
```

---

# 13. Matriz dirigida

La matriz se considera dirigida.

Esto significa que:

```text
A → B
```

y:

```text
B → A
```

pueden tener valores diferentes.

No deben intercambiarse automáticamente.

---

# 14. Reutilización de la matriz

Durante una generación:

```text
A → B
```

se obtiene una vez y posteriormente se reutiliza.

Esto evita consultar al proveedor geográfico cada vez que una rama del algoritmo analiza el mismo desplazamiento.

---

# 15. Fallo en desplazamientos

Si una conexión necesaria no se encuentra disponible, no se utilizará:

```text
0 minutos
0 metros
```

como sustituto.

La conexión deberá considerarse no disponible.

Si el fallo afecta a toda la matriz, la generación podrá detenerse con un error controlado.

---

# 16. Representación como grafo

Conceptualmente, el problema puede representarse mediante un grafo dirigido y ponderado.

```text
        Museo
       ↗     ↘
Inicio         Parque
       ↘     ↗
       Café
```

Los vértices representan:

- punto inicial;
- lugares;
- punto final.

Las aristas contienen principalmente:

- duración;
- distancia;
- costo de desplazamiento cuando exista.

---

# 17. Problema combinatorio

Si existen muchos candidatos, probar todas las combinaciones posibles puede crecer rápidamente.

Por ejemplo:

```text
20 candidatos
```

y rutas de hasta cuatro lugares producen una gran cantidad de posibles ordenamientos.

Por esta razón no se utilizará búsqueda exhaustiva.

---

# 18. Estrategia de búsqueda

Se utilizará una búsqueda limitada basada en:

```text
Multiple Seeds + Beam Search
```

El objetivo es explorar diferentes puntos iniciales sin conservar todas las combinaciones.

---

# 19. Seeds iniciales

Un `seed` representa el primer lugar de una búsqueda parcial.

En vez de comenzar únicamente por el lugar con mayor valoración preliminar, se seleccionan varios.

Ejemplo:

```text
Candidatos:
A B C D E F G H

Seeds elegidos:
A
C
D
F
H
```

Máximo inicial:

```text
MAX_INITIAL_SEEDS = 5
```

---

# 20. Valoración de seeds

Los seeds pueden ordenarse mediante una valoración preliminar que considere:

- coincidencia con intereses;
- cercanía al punto inicial;
- compatibilidad temporal;
- rango de gasto.

No necesita utilizar exactamente el mismo cálculo de la puntuación final.

---

# 21. Beam Search

Para cada seed se construyen rutas progresivamente.

Ejemplo:

```text
Seed A
 │
 ├── A-B
 ├── A-C
 ├── A-D
 ├── A-E
 └── A-F
```

Después se ordenan y únicamente se conservan las mejores rutas parciales.

Con:

```text
BEAM_WIDTH = 3
```

podría conservarse:

```text
A-C
A-D
A-B
```

y descartar:

```text
A-E
A-F
```

---

# 22. Iteraciones

En la siguiente iteración:

```text
A-C
 │
 ├── A-C-B
 ├── A-C-D
 └── A-C-E
```

y lo mismo ocurre con las otras rutas parciales conservadas.

Después:

```text
todas las nuevas rutas
        ↓
puntuación parcial
        ↓
ordenar
        ↓
conservar mejores K
```

El proceso continúa hasta alcanzar alguna condición de parada.

---

# 23. Condiciones de parada

Una rama deja de expandirse cuando:

- alcanza `MAX_STOPS`;
- no existen candidatos válidos;
- no existe suficiente tiempo;
- ninguna expansión conserva la viabilidad del punto final.

Una ruta con al menos:

```text
MIN_STOPS = 1
```

puede ser considerada como candidata final si cumple las restricciones.

---

# 24. Expansión de una ruta

Para agregar un nuevo lugar se sigue aproximadamente:

```text
Ruta parcial
     ↓
Seleccionar candidato
     ↓
Obtener desplazamiento
     ↓
Calcular llegada
     ↓
Verificar horario
     ↓
Calcular espera
     ↓
Calcular salida
     ↓
Actualizar gasto
     ↓
Comprobar punto final
     ↓
Comprobar tiempo total
     ↓
Crear nueva ruta
```

---

# 25. Lugar repetido

Un lugar ya incluido en la ruta no puede agregarse nuevamente.

Si:

```text
visitedPlaceIds.has(candidate.id)
```

entonces:

```text
descartar candidato
```

---

# 26. Cálculo de llegada

Sea:

```text
currentTime
```

la hora actual de la ruta parcial.

Y:

```text
travelTime
```

la duración del desplazamiento.

Entonces:

```text
arrivalTime =
currentTime + travelTime
```

---

# 27. Apertura y espera

Si:

```text
arrivalTime < openingTime
```

entonces:

```text
waitingTime =
openingTime - arrivalTime
```

y:

```text
activityStart =
openingTime
```

Siempre que la ruta continúe siendo viable.

---

# 28. Llegada durante horario

Si:

```text
openingTime <= arrivalTime < closingTime
```

entonces:

```text
activityStart =
arrivalTime
waitingTime = 0
```

---

# 29. Validación de cierre

Sea:

```text
activityDuration
```

la duración estimada de la actividad.

Entonces:

```text
departureTime =
activityStart + activityDuration
```

Debe cumplirse:

```text
departureTime <= closingTime
```

Si no se cumple, el candidato se descarta.

---

# 30. Reserva de tiempo para el punto final

Después de calcular la salida del candidato se debe estimar cuánto tiempo se necesita para completar el recorrido.

Ejemplo:

```text
departureTime
     +
travel(candidate → final)
     <=
request.endDateTime
```

Si no se cumple:

```text
descartar candidato
```

Esto evita construir recorridos que solo parecen viables porque ignoran el trayecto final.

---

# 31. Caso ULTIMA_PARADA

Cuando:

```text
finalType = ULTIMA_PARADA
```

no existe un trayecto obligatorio posterior hacia otro punto.

La validación se reduce a:

```text
departureTime <= endDateTime
```

---

# 32. Cálculo de tiempo total

La duración de un plan puede expresarse como:

```text
Tiempo total =
desplazamientos
+ actividades
+ esperas
```

Cuando existe punto final externo también se incluye el último desplazamiento.

---

# 33. Gasto parcial

La ruta mantiene acumulados:

```text
estimatedCostMin
estimatedCostMax
hasUnknownCost
```

Si un lugar tiene:

```text
gasto_min = NULL
```

o:

```text
gasto_max = NULL
```

se establece:

```text
hasUnknownCost = true
```

sin asumir que el costo es cero.

---

# 34. Puntuación parcial

Beam Search necesita determinar qué rutas parciales vale la pena conservar.

Se utilizará inicialmente:

```text
Intereses             40 %
Viabilidad temporal   30 %
Proximidad             20 %
Compatibilidad gasto   10 %
```

Entonces:

```text
PartialScore =
    InterestPartial * 0.40
  + TimePartial     * 0.30
  + Proximity       * 0.20
  + SpendingPartial * 0.10
```

---

# 35. Intereses en puntuación parcial

Puede considerarse cuántos intereses diferentes ha cubierto ya la ruta.

Ejemplo:

```text
Solicitados:
Cultura
Gastronomía
Naturaleza

Ruta parcial:
Museo
Restaurante
```

Cubre:

```text
2 de 3
```

---

# 36. Viabilidad temporal parcial

Este criterio busca favorecer rutas que:

- aprovechen razonablemente el tiempo;
- mantengan margen para continuar;
- no acumulen demasiada espera.

No representa todavía la puntuación temporal final.

---

# 37. Proximidad parcial

Puede utilizarse el desplazamiento necesario para alcanzar el siguiente candidato y el desplazamiento acumulado.

Rutas con grandes desplazamientos innecesarios recibirán menor valoración preliminar.

---

# 38. Compatibilidad económica parcial

El rango acumulado de gastos puede compararse provisionalmente con el indicado por el usuario.

No se utiliza como restricción obligatoria.

---

# 39. Selección del Beam

Después de generar todas las expansiones válidas de un nivel:

```text
routes.sort(descending partialScore)
```

y:

```text
routes.slice(0, BEAM_WIDTH)
```

Con un ancho pequeño no se requiere inicialmente una estructura más compleja como un heap.

---

# 40. Recolección de rutas viables

Durante la búsqueda pueden almacenarse rutas que ya tengan al menos una parada y sean viables como posibles resultados.

Por ejemplo:

```text
A
A-B
A-B-C
A-C-D
```

Después deberán compararse y puntuarse como rutas completas.

---

# 41. Puntuación final

Solo las rutas completamente viables pasan a la evaluación final.

Se utilizarán cuatro componentes:

```text
I = intereses
T = tiempo
G = gasto
D = desplazamiento
```

Configuración inicial:

```text
I = 35 %
T = 25 %
G = 25 %
D = 15 %
```

---

# 42. Fórmula general

```text
ScoreBase =
    I * 0.35
  + T * 0.25
  + G * 0.25
  + D * 0.15
```

Luego:

```text
ScoreFinal =
ScoreBase - WaitingPenalty
```

Finalmente:

```text
0 <= ScoreFinal <= 100
```

---

# 43. Score de intereses

Una fórmula inicial es:

```text
InterestScore =
categorías solicitadas cubiertas
────────────────────────────── × 100
total de categorías solicitadas
```

Ejemplo:

```text
3 categorías solicitadas
2 cubiertas

InterestScore =
2 / 3 × 100
= 66.67
```

---

# 44. Score temporal

Se define:

```text
availableMinutes =
endDateTime - startDateTime
```

y:

```text
utilization =
routeDuration / availableMinutes
```

Como referencia inicial:

```text
ideal utilization = 0.85
```

Entonces:

```text
TimeScore =
max(
    0,
    100 - abs(utilization - 0.85) * 200
)
```

---

# 45. Ejemplo de score temporal

Supongamos:

```text
Tiempo disponible = 300 min
Ruta = 255 min
```

Entonces:

```text
utilization =
255 / 300
= 0.85
```

y:

```text
TimeScore = 100
```

Si la ruta utiliza solo:

```text
150 / 300 = 0.50
```

entonces:

```text
TimeScore =
100 - |0.50 - 0.85| × 200
= 30
```

---

# 46. Score de gasto

Se compara:

```text
rango del usuario
```

con:

```text
rango estimado del plan
```

Ejemplo:

```text
Usuario:
S/ 20 – S/ 40

Plan:
S/ 25 – S/ 35
```

Existe compatibilidad completa.

---

# 47. Superposición de rangos

Conceptualmente:

```text
overlap =
max(
  0,
  min(planMax, userMax)
  -
  max(planMin, userMin)
)
```

Después puede utilizarse:

```text
SpendingScore =
overlap
──────────── × 100
planWidth
```

donde:

```text
planWidth =
planMax - planMin
```

---

# 48. Casos especiales del gasto

La fórmula anterior requiere tratamiento especial cuando:

```text
planMin = planMax
```

por ejemplo:

```text
S/ 0 – S/ 0
```

Una actividad completamente gratuita no debe provocar división entre cero.

También deben tratarse:

- costos desconocidos;
- rangos incompletos;
- actividades gratuitas;
- estimaciones exactas.

---

# 49. Score de desplazamiento

Se calcula la proporción del recorrido utilizada únicamente en desplazamientos.

```text
travelProportion =
travelMinutes / totalRouteMinutes
```

Luego:

```text
TravelScore =
100 - travelProportion * 100
```

Ejemplo:

```text
Ruta total = 240 min
Traslado = 60 min
```

Entonces:

```text
travelProportion =
60 / 240
= 0.25
```

y:

```text
TravelScore = 75
```

---

# 50. Penalización por espera

Una ruta puede ser viable aunque exista espera.

Sin embargo, tiempos de espera elevados reducen su conveniencia.

Configuración inicial:

```text
WaitingPenalty =
min(
    20,
    waitingMinutes * 0.5
)
```

Ejemplo:

```text
20 min de espera
```

produce:

```text
10 puntos de penalización
```

---

# 51. Ejemplo completo de puntuación

Supongamos:

```text
InterestScore = 100
TimeScore     = 90
SpendingScore = 80
TravelScore   = 75
Waiting       = 10 min
```

Entonces:

```text
ScoreBase =
100 * 0.35
+ 90 * 0.25
+ 80 * 0.25
+ 75 * 0.15
```

```text
ScoreBase =
35
+ 22.5
+ 20
+ 11.25
```

```text
ScoreBase = 88.75
```

Penalización:

```text
WaitingPenalty =
10 * 0.5
= 5
```

Resultado:

```text
ScoreFinal =
88.75 - 5
= 83.75
```

La alternativa obtiene aproximadamente:

```text
83.75 / 100
```

de compatibilidad.

---

# 52. Ordenamiento final

Las rutas viables se ordenarán por:

```text
ScoreFinal DESC
```

Esto todavía no significa que las tres primeras se mostrarán automáticamente.

Antes se aplicará el control de equivalencia y diversidad.

---

# 53. Detección de rutas equivalentes

Una primera comparación utilizará el conjunto de lugares.

Ejemplo:

```text
Ruta A:
Museo → Parque → Café

Ruta B:
Parque → Museo → Café
```

Los conjuntos de lugares son iguales.

Por tanto, inicialmente pueden considerarse equivalentes.

---

# 54. Casos donde el orden sí puede importar

Dos rutas con los mismos lugares podrían mantenerse si presentan una diferencia relevante.

Por ejemplo:

```text
Ruta A:
duración = 210 min

Ruta B:
duración = 165 min
```

o si una secuencia permite horarios considerablemente mejores.

La decisión podrá ajustarse durante pruebas.

---

# 55. Diversidad mediante Jaccard

Para comparar rutas:

```text
A = conjunto de lugares de la ruta 1
B = conjunto de lugares de la ruta 2
```

Se utiliza:

```text
J(A,B) =
|A ∩ B|
───────
|A ∪ B|
```

---

# 56. Ejemplo Jaccard

Ruta 1:

```text
Museo
Parque
Café
```

Ruta 2:

```text
Museo
Parque
Mirador
```

Entonces:

```text
Intersección:
Museo, Parque
= 2
```

```text
Unión:
Museo, Parque, Café, Mirador
= 4
```

Por tanto:

```text
J = 2 / 4
J = 0.50
```

---

# 57. Umbral de similitud

El umbral no se considera definitivo.

Como punto de partida podrá evaluarse un valor aproximado entre:

```text
0.50 y 0.60
```

durante las pruebas.

La configuración deberá permanecer ajustable.

---

# 58. Selección diversa

El algoritmo de selección final será aproximadamente:

```text
1. Ordenar por puntuación.
2. Seleccionar la mejor ruta.
3. Tomar la siguiente.
4. Compararla con todas las seleccionadas.
5. Si es suficientemente diferente, aceptarla.
6. Continuar hasta obtener 3 o agotar las rutas.
```

---

# 59. Menos de tres resultados

El sistema no está obligado a mostrar exactamente tres planes.

Puede devolver:

```text
0
1
2
3
```

según las alternativas viables y suficientemente distintas encontradas.

No se deben crear rutas inválidas únicamente para completar tres resultados.

---

# 60. Pseudocódigo general

```text
FUNCTION generatePlans(request):

    validate(request)

    candidates =
        findCandidatePlaces(request)

    IF candidates is empty:
        RETURN []

    points =
        buildRoutingPoints(
            request,
            candidates
        )

    matrix =
        routingProvider.getTravelMatrix(
            points,
            request.mobility
        )

    context =
        createGenerationContext(
            request,
            candidates,
            matrix,
            config
        )

    seeds =
        selectInitialSeeds(
            candidates,
            context,
            MAX_INITIAL_SEEDS
        )

    viableRoutes = []

    FOR seed IN seeds:

        routes =
            beamSearch(
                seed,
                context
            )

        viableRoutes.addAll(routes)

    IF viableRoutes is empty:
        RETURN []

    scoredRoutes =
        scoreFinalRoutes(
            viableRoutes,
            context
        )

    uniqueRoutes =
        removeEquivalentRoutes(
            scoredRoutes
        )

    finalRoutes =
        selectDiverseRoutes(
            uniqueRoutes,
            MAX_RESULTS
        )

    persistedPlans =
        saveFinalPlans(
            request.id,
            finalRoutes
        )

    RETURN persistedPlans
```

---

# 61. Pseudocódigo de Beam Search

```text
FUNCTION beamSearch(seed, context):

    initialRoute =
        createRoute(seed)

    beam = [initialRoute]

    viableRoutes = []

    FOR level FROM 1 TO MAX_STOPS:

        nextRoutes = []

        FOR route IN beam:

            IF route.stopCount >= MIN_STOPS
               AND routeIsViable(route):

                viableRoutes.add(route)

            expansions =
                expand(route, context)

            nextRoutes.addAll(expansions)

        IF nextRoutes is empty:
            BREAK

        sortDescending(
            nextRoutes,
            by partialScore
        )

        beam =
            first(
                nextRoutes,
                BEAM_WIDTH
            )

    RETURN viableRoutes
```

---

# 62. Pseudocódigo de expansión

```text
FUNCTION expand(route, context):

    results = []

    FOR candidate IN context.candidates:

        IF candidate already exists in route:
            CONTINUE

        edge =
            matrix[
                route.currentPoint
            ][candidate.id]

        IF edge does not exist:
            CONTINUE

        arrival =
            route.currentTime
            + edge.duration

        scheduleResult =
            evaluateSchedule(
                candidate,
                arrival
            )

        IF scheduleResult invalid:
            CONTINUE

        departure =
            scheduleResult.activityStart
            + candidate.activityDuration

        IF finalPointCannotBeReached(
            candidate,
            departure,
            context
        ):
            CONTINUE

        newRoute =
            appendCandidate(
                route,
                candidate,
                edge,
                scheduleResult
            )

        newRoute.partialScore =
            evaluatePartial(
                newRoute,
                context
            )

        results.add(newRoute)

    RETURN results
```

---

# 63. Ejemplo simplificado

Supongamos la siguiente solicitud:

```text
Inicio:          14:00
Fin:             19:00
Tiempo:          5 horas

Intereses:
- Cultura
- Gastronomía

Gasto:
S/ 20 – S/ 60

Movilidad:
A pie

Punto final:
Regresar al inicio
```

Candidatos:

```text
Museo
Parque
Café
Galería
Restaurante
```

---

# 64. Matriz parcial del ejemplo

```text
Inicio → Museo        10 min
Inicio → Parque       15 min
Inicio → Café          8 min

Museo → Parque        10 min
Museo → Café           6 min

Parque → Café         12 min
Parque → Galería      10 min

Café → Galería         8 min
```

---

# 65. Seeds

La valoración preliminar puede producir:

```text
1. Museo
2. Café
3. Parque
4. Galería
5. Restaurante
```

Con:

```text
MAX_INITIAL_SEEDS = 5
```

todos podrían comenzar una búsqueda.

---

# 66. Expansión desde Museo

Primera ruta:

```text
Inicio
  ↓ 10 min
Museo
```

Supongamos:

```text
Museo:
14:10 – 15:40
```

Después se prueban:

```text
Museo → Parque
Museo → Café
Museo → Galería
Museo → Restaurante
```

Cada alternativa debe validar horarios, tiempo restante y retorno al inicio.

---

# 67. Beam

Supongamos que después de evaluar:

```text
Museo → Café       82
Museo → Parque     78
Museo → Galería    74
Museo → Restaurante 61
```

Con:

```text
BEAM_WIDTH = 3
```

continúan:

```text
Museo → Café
Museo → Parque
Museo → Galería
```

y se descarta temporalmente:

```text
Museo → Restaurante
```

---

# 68. Continuación

El proceso sigue:

```text
Museo → Café → Galería

Museo → Parque → Café

Museo → Galería → Parque
```

hasta:

- alcanzar cuatro paradas;
- quedarse sin candidatos;
- exceder el tiempo;
- perder viabilidad del retorno.

---

# 69. Posibles resultados

Después de todas las búsquedas podrían existir:

```text
R1 Museo → Café → Galería
R2 Parque → Restaurante
R3 Museo → Parque → Café
R4 Café → Galería → Restaurante
R5 Galería → Museo → Café
```

Todos deben ser viables antes de la puntuación final.

---

# 70. Evaluación final

Supongamos:

```text
R1 = 87
R2 = 75
R3 = 85
R4 = 80
R5 = 84
```

Orden:

```text
R1 87
R3 85
R5 84
R4 80
R2 75
```

---

# 71. Diversidad del ejemplo

Si:

```text
R1:
Museo, Café, Galería

R5:
Galería, Museo, Café
```

contienen exactamente los mismos lugares, puede conservarse únicamente:

```text
R1
```

porque posee mejor puntuación.

Después se evalúa:

```text
R3
R4
R2
```

hasta encontrar alternativas suficientemente distintas.

---

# 72. Resultado

La aplicación podría terminar mostrando:

```text
Plan 1
Museo → Café → Galería
87 puntos

Plan 2
Museo → Parque → Café
85 puntos

Plan 3
Parque → Restaurante
75 puntos
```

O solamente dos si la tercera alternativa restante es demasiado similar.

---

# 73. Complejidad aproximada

Sin límites, explorar todas las permutaciones de lugares produce crecimiento combinatorio.

Con:

```text
N = número de candidatos
S = número de seeds
B = beam width
M = máximo de paradas
```

la búsqueda se limita aproximadamente a explorar una cantidad relacionada con:

```text
S × B × N × M
```

en lugar de conservar todas las permutaciones posibles.

Esta expresión es una aproximación práctica y no una cota matemática exacta del algoritmo completo, debido a que el número de candidatos disponibles disminuye durante cada expansión.

---

# 74. Impacto de la matriz

La creación de la matriz puede ser una de las operaciones externas más costosas.

Para:

```text
N puntos
```

una matriz completa dirigida puede contener del orden de:

```text
N²
```

relaciones.

Por ello será importante:

- reducir candidatos antes de solicitar desplazamientos;
- aprovechar operaciones matriciales del proveedor cuando existan;
- reutilizar resultados;
- evitar solicitudes repetidas.

---

# 75. Pruebas mínimas

El algoritmo deberá probar los siguientes escenarios:

| Caso | Resultado esperado |
|---|---|
| Sin candidatos | 0 planes |
| Un candidato viable | 1 plan posible |
| Varios candidatos | Hasta 3 planes |
| Lugar cerrado al llegar | Lugar descartado |
| Llegada antes de apertura | Espera si sigue siendo viable |
| Actividad termina después del cierre | Lugar descartado |
| Exceso de tiempo | Ruta descartada |
| No alcanza punto final | Ruta descartada |
| Lugar repetido | Expansión descartada |
| Costo 0 | Tratado como gratuito |
| Costo NULL | Tratado como desconocido |
| Rutas idénticas | Conservar mejor |
| Rutas muy similares | Aplicar diversidad |
| Geo API falla | Error controlado |

---

# 76. Pruebas con dataset controlado

Para las primeras pruebas se recomienda trabajar con un conjunto reducido de lugares.

Por ejemplo:

```text
15 – 25 lugares
```

distribuidos entre:

```text
4 – 6 categorías
```

con variaciones en:

- distritos;
- horarios;
- duración;
- gasto;
- ubicación.

Esto facilita entender por qué una ruta fue aceptada o descartada.

---

# 77. Desarrollo con proveedor simulado

Antes de conectar una API real podrá utilizarse:

```text
MockRoutingProvider
```

con una matriz fija.

Ejemplo:

```typescript
const mockMatrix = {
  START: {
    A: {
      durationMinutes: 10,
      distanceMeters: 800
    }
  }
};
```

Esto permite probar el algoritmo independientemente de:

- internet;
- límites de API;
- credenciales;
- disponibilidad del proveedor.

---

# 78. Integración posterior

Una vez estabilizada la lógica:

```text
MockRoutingProvider
        ↓
interfaz RoutingProvider
        ↓
Proveedor real
```

El algoritmo no debería necesitar modificaciones importantes para realizar este cambio.

---

# 79. Parámetros pendientes de validación

Los siguientes valores son iniciales y deberán ajustarse mediante pruebas:

```text
MAX_INITIAL_SEEDS = 5
BEAM_WIDTH = 3
MAX_STOPS = 4

pesos de puntuación
utilización ideal = 85 %

penalización por espera

umbral de similitud Jaccard
```

No deben considerarse valores científicamente óptimos.

Son parámetros de diseño de la primera versión.

---

# 80. Criterio de cierre

La generación se considera correcta cuando:

1. ninguna alternativa incumple restricciones obligatorias;
2. los tiempos de desplazamiento son considerados;
3. los horarios son evaluados según la llegada estimada;
4. se reserva tiempo para el punto final;
5. no se repiten lugares;
6. los costos desconocidos no se interpretan como gratuitos;
7. las alternativas son puntuadas consistentemente;
8. se reduce la repetición entre resultados;
9. se devuelven como máximo tres alternativas;
10. solo los resultados finales son persistidos.

---

# 81. Documentos relacionados

- [Reglas de negocio](../02-requisitos/reglas-negocio.md)
- [Casos de uso](../03-modelado/casos-uso.md)
- [Diagramas de secuencia](../03-modelado/secuencias.md)
- [Arquitectura general](../04-arquitectura/arquitectura-general.md)
- [Arquitectura del generador](../04-arquitectura/generador-planes.md)