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

**No se utiliza inteligencia artificial ni aprendizaje automático.**

---

## 2. Entrada y salida

```mermaid
flowchart LR
    subgraph Input["📥 Entrada"]
        REQ["PlanningRequest\n- startDateTime\n- endDateTime\n- startPoint\n- finalType\n- categoryIds\n- spendingMin/Max\n- mobility"]
    end

    subgraph Output["📤 Salida"]
        PLANS["0-3 GeneratedPlan\n- stops\n- segments\n- totalDurationMinutes\n- estimatedCostMin/Max\n- compatibilityScore"]
    end

    REQ -->|Algoritmo| PLANS

    style Input fill:#fff3e0
    style Output fill:#e3f2fd
```

---

## 3. Flujo del algoritmo

```mermaid
flowchart TB
    A[1. Recibir solicitud] --> B[2. Obtener candidatos]
    B --> C[3. Filtrar candidatos iniciales]
    C --> D[4. Construir matriz de desplazamiento]
    D --> E[5. Crear seeds]
    E --> F[6. Ejecutar Beam Search]
    F --> G[7. Obtener rutas viables]
    G --> H[8. Puntuar rutas completas]
    H --> I[9. Eliminar equivalencias]
    I --> J[10. Aplicar diversidad]
    J --> K[11. Seleccionar hasta 3]
    K --> L[12. Persistir resultados]

    style A fill:#fff3e0
    style L fill:#c8e6c9
```

---

## 4. Parámetros iniciales

| Parámetro | Valor | Descripción |
|---|---|---|
| `MAX_INITIAL_SEEDS` | 5 | Seeds iniciales como puntos de partida |
| `BEAM_WIDTH` | 3 | Rutas parciales conservadas por nivel |
| `MIN_STOPS` | 1 | Paradas mínimas en un plan |
| `MAX_STOPS` | 4 | Paradas máximas en un plan |
| `MAX_RESULTS` | 3 | Resultados finales máximo |

---

## 5. Obtención de candidatos

```mermaid
flowchart TB
    A["100 lugares registrados"] --> B["Solo activos"]
    B --> C["Categorías solicitadas"]
    C --> D["Zona razonable"]
    D --> E["Información mínima"]
    E --> F["20 candidatos"]

    style A fill:#fff3e0
    style F fill:#c8e6c9
```

> El objetivo no es determinar todavía si cada lugar puede visitarse. La validación temporal se realiza durante la expansión de cada ruta.

---

## 6. Construcción de puntos

```mermaid
flowchart LR
    subgraph Points["Conjunto de puntos"]
        P0["P0 = Inicio"]
        P1["P1 = Lugar A"]
        P2["P2 = Lugar B"]
        P3["P3 = Lugar C"]
        PF["PF = Punto final"]
    end

    P0 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> PF

    style P0 fill:#e1f5fe
    style PF fill:#f3e5f5
```

### Tipos de punto final

```mermaid
flowchart LR
    A["REGRESAR_INICIO"] --> B["Inicio → Lugares → Inicio"]
    C["ULTIMA_PARADA"] --> D["Inicio → Lugares → Última"]
    E["OTRA_UBICACION"] --> F["Inicio → Lugares → Ubicación"]

    style A fill:#e3f2fd
    style C fill:#e8f5e9
    style E fill:#fff3e0
```

---

## 7. Matriz de desplazamiento

```mermaid
flowchart LR
    subgraph Matrix["Ejemplo de matriz de tiempos (min)"]
        direction TB
        H1[""] 
        H2["A"]
        H3["B"]
        H4["C"]

        R1["Inicio"] -->|"10"| A1["A"]
        R1["Inicio"] -->|"15"| B1["B"]
        R1["Inicio"] -->|"8"| C1["C"]
        A1 -->|"7"| A2["B"]
        A1 -->|"11"| B2["C"]
        B1 -->|"6"| A3["A"]
        B1 -->|"5"| C2["C"]
        C1 -->|"12"| A4["A"]
        C1 -->|"8"| B3["B"]
    end

    style H1 fill:#f3e5f5
    style H2 fill:#f3e5f5
    style H3 fill:#f3e5f5
    style H4 fill:#f3e5f5
```

> La matriz es **dirigida**: `A → B` puede tener diferente costo que `B → A`.

---

## 8. Representación como grafo

```mermaid
flowchart LR
    subgraph Graph["Grafo dirigido y ponderado"]
        I["Inicio"] -->|"10m"| M["Museo"]
        I -->|"8m"| C["Café"]
        I -->|"15m"| P["Parque"]
        M -->|"7m"| P
        M -->|"11m"| C
        C -->|"12m"| M
        C -->|"5m"| P
        P -->|"6m"| M
        P -->|"8m"| C
    end

    style I fill:#e1f5fe
```

---

## 9. Problema combinatorio

```mermaid
flowchart LR
    A["20 candidatos"] --> B["Rutas de hasta 4 lugares"]
    B --> C["Combinaciones posibles: 4,845"]
    C --> D["Búsqueda exhaustiva: inviable"]

    style A fill:#fff3e0
    style D fill:#ffcdd2
```

> Por esta razón se utiliza búsqueda limitada con Beam Search.

---

## 10. Estrategia de búsqueda

```mermaid
flowchart TB
    A["Multiple Seeds + Beam Search"] --> B["Explorar diferentes puntos iniciales"]
    B --> C["Sin conservar todas las combinaciones"]

    style A fill:#e8f5e9
```

---

## 11. Seeds iniciales

```mermaid
flowchart LR
    subgraph Candidates["Candidatos"]
        A["A"] 
        B["B"] 
        C["C"] 
        D["D"] 
        E["E"] 
        F["F"] 
        G["G"] 
        H["H"]
    end

    subgraph Seeds["5 seeds elegidos"]
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

### Valoración de seeds

Los seeds se ordenan mediante una valoración preliminar que considera:

```mermaid
flowchart TB
    A["Valoración de seed"] --> B["Cercanía al inicio"]
    A --> C["Coincidencia con intereses"]
    A --> D["Compatibilidad temporal"]
    A --> E["Rango de gasto"]

    style A fill:#f3e5f5
```

---

## 12. Beam Search — Proceso

```mermaid
flowchart TB
    subgraph Level1["Nivel 1 — Seeds"]
        A1["A"]
        A2["C"]
        A3["D"]
    end

    subgraph Level2["Nivel 2 — Primeras expansiones"]
        B1["A-B"]:::good
        B2["A-C"]:::good
        B3["A-D"]:::good
        B4["A-E"]:::bad
        B5["A-F"]:::bad
    end

    subgraph Level3["Nivel 3 — Selección (beam=3)"]
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

> **BEAM_WIDTH = 3**: Solo las 3 mejores rutas parciales avanzan.

---

## 13. Beam Search — Iteraciones

```mermaid
flowchart TB
    subgraph Iteration1["Iteración 1 — Seed A-C"]
        I1A["A-C"]
        I1A --> I1B["A-C-B"]
        I1A --> I1C["A-C-D"]
        I1A --> I1D["A-C-E"]
    end

    subgraph Iteration2["Iteración 2 — Selección"]
        I2A["A-C-B"]:::good
        I2B["A-C-D"]:::good
        I2C["A-D-B"]:::good
        I2D["A-E-C"]:::bad
        I2E["A-F-B"]:::bad
    end

    subgraph Iteration3["Iteración 3 — Expansión"]
        I3A["A-C-B-D"]
        I3B["A-C-D-B"]
        I3C["A-D-B-C"]
    end

    I1A --> I2A
    I1A --> I2B
    I1A --> I2C
    I1A --> I2D
    I1A --> I2E

    I2A --> I3A
    I2B --> I3B
    I2C --> I3C

    classDef good fill:#c8e6c9,stroke:#388e3c
    classDef bad fill:#ffcdd2,stroke:#d32f2f
```

---

## 14. Validación de restricciones

```mermaid
flowchart TB
    subgraph Validations["Validaciones por candidato"]
        V1["¿Lugar activo?"]
        V2["¿Horario compatible?"]
        V3["¿Tiempo suficiente?"]
        V4["¿Gasto en rango?"]
        V5["¿No visitado?"]
    end

    subgraph Result["Resultado"]
        OK["✅ Agregar"]:::good
        NO["❌ Descartar"]:::bad
    end

    V1 -->|Sí| V2
    V1 -->|No| NO
    V2 -->|Sí| V3
    V2 -->|No| NO
    V3 -->|Sí| V4
    V3 -->|No| NO
    V4 -->|Sí| V5
    V4 -->|No| NO
    V5 -->|Sí| OK
    V5 -->|No| NO

    classDef good fill:#c8e6c9,stroke:#388e3c
    classDef bad fill:#ffcdd2,stroke:#d32f2f
```

---

## 15. Evaluación — ScoringStrategy

```mermaid
flowchart TB
    subgraph Metrics["Métricas"]
        M1["Cobertura de intereses"] --> S["Puntuación\n0-100"]
        M2["Aprovechamiento del tiempo"] --> S
        M3["Compatibilidad de gasto"] --> S
        M4["Proporción de desplazamiento"] --> S
    end

    subgraph Range["Rango"]
        R1["0-40"] -->|bajo| TAG1["⚠️ Menor compatibilidad"]
        R2["41-70"] -->|medio| TAG2["✓ Compatibilidad media"]
        R3["71-100"] -->|alto| TAG3["✓✓ Alta compatibilidad"]
    end

    S --> Range

    style M1 fill:#e1f5fe
    style M2 fill:#e1f5fe
    style M3 fill:#e1f5fe
    style M4 fill:#e1f5fe
    style R1 fill:#ffcdd2
    style R2 fill:#fff9c4
    style R3 fill:#c8e6c9
```

> La puntuación **no** es una probabilidad ni garantía de satisfacción.

---

## 16. Control de diversidad

```mermaid
flowchart LR
    subgraph Input["Planes candidatos"]
        P1["Plan A\nMuseo → Parque → Café"]
        P2["Plan B\nMuseo → Parque → Restaurante"]
        P3["Plan C\nGalería → Mirador"]
        P4["Plan D\nMuseo → Parque → Café"]
    end

    subgraph Process["Proceso de diversidad"]
        D["Calcular similitud\nentre planes"]
    end

    subgraph Output["Resultado"]
        R1["Conservar: Plan A"]:::good
        R2["Conservar: Plan B"]:::good
        R3["Conservar: Plan C"]:::good
        R4["Descartar: Plan D\n(similar a Plan A)"]:::bad
    end

    P1 --> D
    P2 --> D
    P3 --> D
    P4 --> D

    D --> R1
    D --> R2
    D --> R3
    D --> R4

    classDef good fill:#c8e6c9,stroke:#388e3c
    classDef bad fill:#ffcdd2,stroke:#d32f2f
```

---

## 17. Manejo de errores del servicio geográfico

```mermaid
flowchart TB
    A["Solicitar matriz\nde desplazamiento"] --> B{"¿Disponible?"}

    B -->|Sí| C["Usar matriz\nnormalmente"]
    B -->|No| D["Detener generación"]
    D --> E["Informar error temporal"]
    E --> F["No inventar tiempos\nni distancias"]

    style C fill:#c8e6c9
    style D fill:#ffcdd2
```

> **Nunca** utilizar `0 minutos` o `0 metros` como sustituto de información faltante.

---

## 18. Resultado final

```mermaid
flowchart TB
    subgraph Results["Alternativas generadas"]
        R1["Plan 1\nPuntuación: 85\n3 paradas\nS/ 50-80"]
        R2["Plan 2\nPuntuación: 72\n2 paradas\nS/ 30-60"]
        R3["Plan 3\nPuntuación: 68\n4 paradas\nS/ 40-70"]
    end

    subgraph FinalState["Estado: GENERADO"]
        F["Esperando selección\ndel usuario"]
    end

    R1 --> F
    R2 --> F
    R3 --> F

    style Results fill:#e3f2fd
    style F fill:#f3e5f5
```

---

## 19. Documentos relacionados

| Documento | Descripción |
|---|---|
| [`generador-planes.md`](../04-arquitectura/generador-planes.md) | Arquitectura interna del generador |
| [`../04-arquitectura/arquitectura-general.md`](../04-arquitectura/arquitectura-general.md) | Visión de componentes |
| [`../03-modelado/secuencias.md`](../03-modelado/secuencias.md) | Diagramas de secuencia |
