# Arquitectura del generador de planes — Chaski

## 1. Propósito

Este documento describe la arquitectura interna del módulo encargado de generar alternativas de recorrido en Chaski.

El generador recibe una solicitud válida y produce hasta tres alternativas de recorrido compatibles con las condiciones indicadas por el usuario.

La primera versión utilizará un enfoque determinístico basado en reglas y búsqueda limitada.

---

## 2. Flujo general

```mermaid
flowchart TB
    subgraph Input["📥 Entrada"]
        SOL["Solicitud\nde planificación"]
    end

    subgraph Process["⚙️ Proceso de generación"]
        VAL["Validar\nsolicitud"]
        CAND["Obtener\ncandidatos"]
        MAT["Matriz de\ndesplazamiento"]
        CTX["Crear contexto\nde generación"]
        GEN["Generar\nrutas"]
        EVAL["Evaluar\nrutas"]
        DIV["Aplicar\ndiversidad"]
        SEL["Seleccionar\nhasta 3"]
        PERS["Persistir\nresultados"]
    end

    subgraph Output["📤 Salida"]
        PLANS["Planes\ngenerados"]
    end

    SOL --> VAL
    VAL --> CAND
    CAND --> MAT
    MAT --> CTX
    CTX --> GEN
    GEN --> EVAL
    EVAL --> DIV
    DIV --> SEL
    SEL --> PERS
    PERS --> PLANS

    style Input fill:#fff3e0,stroke:#e65100
    style Process fill:#e8f5e9,stroke:#388e3c
    style Output fill:#e3f2fd,stroke:#1976d2
```

---

## 3. Componentes principales

```mermaid
graph TB
    subgraph UseCase["GeneratePlansUseCase\nPunto de entrada"]
        GPC["generatePlans()"]
    end

    subgraph Repos["Repositorios"]
        RR["RequestRepository"]
        PR["PlaceRepository"]
        PLR["PlanRepository"]
    end

    subgraph Core["Núcleo de generación"]
        RG["RouteGenerator"]
        SG["SeedGenerator"]
        BS["BeamSearch"]
        RE["RouteExpander"]
        RRULES["RouteRules"]
        SS["ScoringStrategy"]
        DP["DiversityPolicy"]
    end

    subgraph External["Externos"]
        RP["RoutingProvider"]
        GEO["Geo API"]
    end

    GPC --> RR
    GPC --> PR
    GPC --> PLR
    GPC --> RG
    GPC --> RP

    RG --> SG
    RG --> BS
    RG --> SS
    RG --> DP

    BS --> RE
    RE --> RRULES

    RP --> GEO

    style UseCase fill:#f3e5f5
    style Core fill:#e8f5e9
    style Repos fill:#e1f5fe
    style External fill:#fff3e0
```

| Componente | Responsabilidad |
|---|---|
| `GeneratePlansUseCase` | Coordina el proceso completo |
| `RequestRepository` | Obtener solicitudes |
| `PlaceRepository` | Obtener lugares candidatos |
| `PlanRepository` | Persistir planes finales |
| `RoutingProvider` | Obtener tiempos y distancias |
| `RouteGenerator` | Coordina la generación de recorridos |
| `SeedGenerator` | Crear puntos iniciales de búsqueda |
| `BeamSearch` | Explorar rutas manteniendo las mejores opciones |
| `RouteExpander` | Intentar agregar lugares a una ruta |
| `RouteRules` | Validar restricciones |
| `ScoringStrategy` | Evaluar alternativas |
| `DiversityPolicy` | Evitar resultados demasiado similares |

---

## 4. Dependencias explícitas

```mermaid
classDiagram
    class GeneratePlansUseCase {
        +requestRepository: RequestRepository
        +placeRepository: PlaceRepository
        +planRepository: PlanRepository
        +routingProvider: RoutingProvider
        +routeGenerator: RouteGenerator
        +generate(input): Result
    }

    class RequestRepository {
        <<interface>>
        +findById(id): PlanningRequest
    }

    class PlaceRepository {
        <<interface>>
        +findCandidates(request): Place[]
    }

    class PlanRepository {
        <<interface>>
        +saveAll(requestId, plans): Plan[]
    }

    class RoutingProvider {
        <<interface>>
        +getTravelMatrix(points, mobility): TravelMatrix
    }

    class RouteGenerator {
        +generate(context): GeneratedRoute[]
    }

    GeneratePlansUseCase --> RequestRepository
    GeneratePlansUseCase --> PlaceRepository
    GeneratePlansUseCase --> PlanRepository
    GeneratePlansUseCase --> RoutingProvider
    GeneratePlansUseCase --> RouteGenerator
```

> Las dependencias se proporcionan explícitamente, permitiendo sustituir implementaciones durante pruebas.

---

## 5. RoutingProvider — Abstracción

```mermaid
graph LR
    subgraph Domain["Dominio"]
        RP["RoutingProvider\n<<interface>>"]
    end

    subgraph Implementations["Implementaciones"]
        GEOAPIFY["GeoapifyRoutingProvider"]
        GOOGLE["GoogleRoutingProvider"]
        MAPBOX["MapboxRoutingProvider"]
    end

    RP <|.. GEOAPIFY
    RP <|.. GOOGLE
    RP <|.. MAPBOX

    style RP fill:#f3e5f5
```

```typescript
interface RoutingProvider {
  getTravelMatrix(
    points: GeoPoint[],
    mobility: MobilityMode
  ): Promise<TravelMatrix>;
}
```

---

## 6. TravelMatrix — Representación

```mermaid
flowchart LR
    subgraph Matrix["Matriz de desplazamiento"]
        direction TB
        A["P0 Inicio"]
        B["A"]
        C["B"]
        D["C"]
        E["PF Final"]
    end

    subgraph Values["Ejemplo de tiempos (min)"]
        direction TB
        A1["A → B: 12"]
        B1["B → A: 8"]
        C1["A → C: 18"]
        D1["C → B: 5"]
    end

    A1 -.->|"origen → destino"| B1
```

> La matriz es **dirigida**: `A → B` puede tener diferente costo que `B → A`.

---

## 7. Contexto de generación

```mermaid
flowchart TB
    subgraph Context["GenerationContext"]
        REQ["request: PlanningRequest"]
        CAN["candidates: Place[]"]
        MAT["travelMatrix: TravelMatrix"]
        CONF["config: GenerationConfig"]
    end

    style Context fill:#e8f5e9,stroke:#388e3c
```

```typescript
type GenerationContext = {
  request: PlanningRequest;
  candidates: Place[];
  travelMatrix: TravelMatrix;
  config: GenerationConfig;
};
```

---

## 8. Configuración

| Parámetro | Valor inicial | Descripción |
|---|---|---|
| `MAX_INITIAL_SEEDS` | 5 | Seeds iniciales como puntos de partida |
| `BEAM_WIDTH` | 3 | Rutas parciales conservadas por nivel |
| `MIN_STOPS` | 1 | Paradas mínimas en un plan |
| `MAX_STOPS` | 4 | Paradas máximas en un plan |
| `MAX_RESULTS` | 3 | Resultados finales máximo |

```mermaid
flowchart TB
    A["Configuración"] --> B["MAX_INITIAL_SEEDS = 5"]
    A --> C["BEAM_WIDTH = 3"]
    A --> D["MIN_STOPS = 1"]
    A --> E["MAX_STOPS = 4"]
    A --> F["MAX_RESULTS = 3"]

    style A fill:#f3e5f5
```

> Estos valores corresponden a decisiones de implementación y podrán ajustarse durante las pruebas.

---

## 9. SeedGenerator — Selección inicial

```mermaid
flowchart LR
    subgraph Candidates["20 lugares candidatos"]
        A["A"] --> B["B"]
        B --> C["C"]
        C --> D["D"]
        D --> E["E"]
        E --> F["F"]
        F --> G["..."]
    end

    subgraph Seeds["5 seeds seleccionados"]
        S1["A"]
        S2["C"]
        S3["D"]
        S4["F"]
        S5["H"]
    end

    Candidates -.->|"valoración\npreliminar"| Seeds

    style Candidates fill:#fff3e0
    style Seeds fill:#e3f2fd
```

La selección puede basarse en:

- Coincidencia con intereses
- Cercanía al punto inicial
- Compatibilidad temporal
- Compatibilidad con rango de gasto

---

## 10. Beam Search — Concepto

```mermaid
flowchart TB
    subgraph Level1["Nivel 1 — Seeds"]
        A1["A"]
        A2["C"]
        A3["D"]
        A4["F"]
        A5["H"]
    end

    subgraph Level2["Nivel 2 — Expansión"]
        B1["A-B"]:::good
        B2["A-C"]:::good
        B3["A-D"]:::good
        B4["A-E"]:::bad
        B5["A-G"]:::bad
    end

    subgraph Level3["Nivel 3 — Selección"]
        C1["A-C-B"]:::good
        C2["A-C-D"]:::good
        C3["A-D-B"]:::good
    end

    A1 --> B1
    A1 --> B2
    A1 --> B3
    A1 --> B4
    A1 --> B5

    B1 --> C1
    B2 --> C1
    B2 --> C2
    B3 --> C3

    classDef good fill:#c8e6c9,stroke:#388e3c
    classDef bad fill:#ffcdd2,stroke:#d32f2f

    style Level1 fill:#e1f5fe
    style Level2 fill:#fff3e0
    style Level3 fill:#e8f5e9
```

> **BEAM_WIDTH = 3**: Solo las 3 mejores rutas parciales avanzan al siguiente nivel.

---

## 11. RouteExpander — Expansión de rutas

```mermaid
flowchart TB
    subgraph Current["Ruta actual"]
        RT["Inicio → A → B"]
    end

    subgraph Candidates["Candidatos"]
        C1["C"]
        C2["D"]
        C3["E"]
    end

    subgraph Validation["Validación por candidato"]
        V1["¿Horario válido?"]
        V2["¿Tiempo suficiente?"]
        V3["¿Punto final ok?"]
        V4["¿Gasto compatible?"]
    end

    subgraph Result["Resultado"]
        OK["Agregar a ruta"]:::good
        FAIL["Descartar"]:::bad
    end

    RT --> V1
    V1 -->|Sí| V2
    V1 -->|No| FAIL
    V2 -->|Sí| V3
    V2 -->|No| FAIL
    V3 -->|Sí| V4
    V3 -->|No| FAIL
    V4 -->|Sí| OK
    V4 -->|No| FAIL

    C1 --> V1
    C2 --> V1
    C3 --> V1

    classDef good fill:#c8e6c9,stroke:#388e3c
    classDef bad fill:#ffcdd2,stroke:#d32f2f
```

---

## 12. ScoringStrategy — Evaluación

```mermaid
flowchart TB
    subgraph Metrics["Métricas evaluadas"]
        M1["Cobertura de intereses"]
        M2["Aprovechamiento del tiempo"]
        M3["Compatibilidad de gasto"]
        M4["Proporción de desplazamiento"]
    end

    subgraph Score["Puntuación final"]
        S["0 - 100"]
    end

    M1 --> S
    M2 --> S
    M3 --> S
    M4 --> S

    style Metrics fill:#e1f5fe
    style Score fill:#f3e5f5
```

> La puntuación representa una medida interna de compatibilidad, **no** una probabilidad ni garantía de satisfacción.

---

## 13. DiversityPolicy — Control de similitud

```mermaid
flowchart LR
    subgraph Plans["Planes candidatos"]
        P1["Plan A: Museo → Parque → Café"]
        P2["Plan B: Museo → Parque → Restaurante"]
        P3["Plan C: Galería → Mirador"]
        P4["Plan D: Museo → Parque → Café"]
    end

    subgraph Diversity["Selección diversa"]
        P1 -->|"similar a P4"| DROP["Descartar P4"]
        P2 -->|"similar a P1"| DROP2["Descartar P1"]
        P3 -->|"diferente"| KEEP["Conservar"]
    end

    style DROP fill:#ffcdd2
    style DROP2 fill:#ffcdd2
    style KEEP fill:#c8e6c9
```

> Se procura evitar que los resultados finales sean excesivamente similares entre sí.

---

## 14. Flujo de datos completo

```mermaid
sequenceDiagram
    participant App as 📱 App
    participant UC as ⚡ GeneratePlansUseCase
    participant ReqRepo as 📦 RequestRepository
    participant PlaceRepo as 📦 PlaceRepository
    participant Routing as 🌐 RoutingProvider
    participant Geo as 🌍 Geo API
    participant Gen as ⚙️ RouteGenerator
    participant Scoring as 📊 ScoringStrategy
    participant Diversity as 🎯 DiversityPolicy
    participant PlanRepo as 📦 PlanRepository
    participant DB as 🗄️ PostgreSQL

    App->>UC: generatePlans(requestId)
    UC->>ReqRepo: findById(requestId)
    ReqRepo->>DB: SELECT solicitud
    DB-->>ReqRepo: datos
    ReqRepo-->>UC: solicitud

    UC->>PlaceRepo: findCandidates(solicitud)
    PlaceRepo->>DB: SELECT lugares
    DB-->>PlaceRepo: candidatos
    PlaceRepo-->>UC: candidatos

    UC->>Routing: getMatrix(puntos, movilidad)
    Routing->>Geo: tiempos y distancias
    Geo-->>Routing: TravelMatrix
    Routing-->>UC: matriz

    UC->>Gen: generate(contexto)
    Gen->>Scoring: evaluate(routes)
    Scoring-->>Gen: rutas puntuadas
    Gen->>Diversity: selectDistinct(routes, max=3)
    Diversity-->>Gen: alternativas finales
    Gen-->>UC: planes

    UC->>PlanRepo: saveAll(solicitudId, planes)
    PlanRepo->>DB: INSERT planes, paradas, tramos
    DB-->>PlanRepo: confirmación
    PlanRepo-->>UC: planes guardados
    UC-->>App: hasta 3 planes
```

---

## 15. Qué NO hace el generador

```mermaid
flowchart TB
    subgraph NoResponsibility["No es responsable de"]
        NR1["Autenticación"]
        NR2["Interfaz gráfica"]
        NR3["Navegación móvil"]
        NR4["Gestión administrativa de lugares"]
        NR5["Renderizado de mapas"]
        NR6["Seguimiento GPS en tiempo real"]
    end

    style NoResponsibility fill:#ffcdd2,stroke:#d32f2f
```

---

## 16. Documentos relacionados

| Documento | Descripción |
|---|---|
| [`arquitectura-general.md`](./arquitectura-general.md) | Visión de componentes y capas |
| [`../05-algoritmo/generacion-rutas.md`](../05-algoritmo/generacion-rutas.md) | Detalle del algoritmo |
| [`../03-modelado/secuencias.md`](../03-modelado/secuencias.md) | Diagramas de secuencia |
