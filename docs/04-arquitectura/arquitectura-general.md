# Arquitectura general — Chaski

## 1. Propósito

Este documento describe la arquitectura general propuesta para Chaski.

La arquitectura busca separar las responsabilidades de:

- interfaz móvil;
- autenticación;
- acceso a datos;
- lógica sensible del sistema;
- generación de recorridos;
- persistencia;
- integración con servicios externos.

---

## 2. Visión general

```mermaid
graph TB
    subgraph Mobile["📱 Aplicación móvil"]
        UI["React Native + Expo"]
    end

    subgraph Backend["⚡ Supabase"]
        AUTH["Auth"]
        DB["PostgreSQL + RLS"]
        EDGE["Edge Functions"]
    end

    subgraph External["🌐 Servicios externos"]
        GEO["Servicio geográfico\nRutas / Tiempos / Distancias"]
    end

    UI -->|"HTTPS"| AUTH
    UI -->|"HTTPS"| DB
    UI -->|"HTTPS"| EDGE
    EDGE -->|"API Key"| GEO

    style Mobile fill:#e1f5fe,stroke:#1976d2
    style Backend fill:#f3e5f5,stroke:#7b1fa2
    style External fill:#fff3e0,stroke:#e65100
```

---

## 3. Capas de responsabilidad

```mermaid
graph LR
    subgraph Presentation["PRESENTACIÓN"]
        RN["React Native / Expo"]
        SCREENS["Pantallas"]
        COMPONENTS["Componentes"]
        NAVIGATION["Navegación"]
    end

    subgraph Application["APLICACIÓN"]
        UC["Casos de uso\nGeneratePlans\nSelectPlan\nStartPlan"]
    end

    subgraph Domain["DOMINIO"]
        MODELS["Modelos\nPlan, Place, Route"]
        RULES["Reglas de negocio"]
    end

    subgraph Infrastructure["INFRAESTRUCTURA"]
        SUPABASE["Supabase / PostgreSQL"]
        GEO_API["Geo API"]
        ROUTING["RoutingProvider"]
    end

    RN --> UC
    UC --> MODELS
    MODELS --> RULES
    RULES --> MODELS
    UC --> SUPABASE
    UC --> ROUTING
    ROUTING --> GEO_API

    style Presentation fill:#e1f5fe
    style Application fill:#e8f5e9
    style Domain fill:#fff3e0
    style Infrastructure fill:#f3e5f5
```

---

## 4. Autenticación

```mermaid
flowchart LR
    subgraph Auth["Supabase Auth"]
        AU["auth.users\nRegistro, login, sesiones, tokens"]
    end

    subgraph Domain["Dominio"]
        US["usuarios\nPerfil, rol, estado"]
    end

    AU -->|"id"| US

    style AU fill:#e1f5fe
    style US fill:#e8f5e9
```

> La identidad y autenticación (`auth.users`) se mantiene separada de la información del dominio (`usuarios`).

---

## 5. Acceso a datos

### 5.1. Operaciones simples — Cliente Supabase directo

```mermaid
flowchart LR
    A["📱 App"] -->|Supabase Client| B["PostgreSQL"]
    B -->|RLS| C["Datos del usuario"]

    style A fill:#e1f5fe
    style B fill:#f3e5f5
```

Ejemplos: consultar preferencias propias, categorías, historial.

### 5.2. Operaciones sensibles — Edge Functions

```mermaid
flowchart LR
    A["📱 App"] -->|HTTPS| B["Edge Function"]
    B -->|PostgreSQL| C["Datos"]
    B -->|API Key| D["Geo API"]

    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style D fill:#fff3e0
```

Ejemplos: generar planes, iniciar recorrido, marcar parada.

### 5.3. Principio

```mermaid
flowchart TB
    A["Operación"] --> B{¿Tiene lógica sensible?"}

    B -->|Sí| C["Edge Function"]
    B -->|No| D{¿Requiere validaciones?"}

    D -->|Sí| C
    D -->|No| E["Cliente Supabase directo"]

    style C fill:#f3e5f5
    style E fill:#e8f5e9
```

---

## 6. Row Level Security

```mermaid
graph TB
    subgraph UserA["👤 Usuario A"]
        PA1["Preferencias A"]
        SA1["Solicitudes A"]
        PLA1["Planes A"]
    end

    subgraph UserB["👤 Usuario B"]
        PA2["Preferencias B"]
        SA2["Solicitudes B"]
        PLA2["Planes B"]
    end

    PA1 -.->|"propio"| RLS1["Row Level Security"]
    SA1 -.->|"propio"| RLS1
    PLA1 -.->|"propio"| RLS1

    PA2 -.x|"bloqueado"| RLS2
    SA2 -.x|"bloqueado"| RLS2
    PLA2 -.x|"bloqueado"| RLS2

    LU["Lugares"] -.->|"lectura libre"| RLS_CAT
    CA["Categorías"] -.->|"lectura libre"| RLS_CAT
    ET["Etiquetas"] -.->|"solo admin"| RLS_CAT

    style RLS1 fill:#c8e6c9,stroke:#388e3c
    style RLS2 fill:#ffcdd2,stroke:#d32f2f
    style RLS_CAT fill:#fff9c4,stroke:#f9a825
```

---

## 7. Protección de credenciales

```mermaid
flowchart TB
    subgraph Correct["✅ Flujo correcto"]
        A1["📱 App móvil"]
        B1["Edge Function"]
        C1["Servicio externo"]
        A1 -->|"request"| B1
        B1 -->|"API Key"| C1
    end

    subgraph Incorrect["❌ Flujo incorrecto"]
        A2["📱 App móvil"]
        C2["Servicio externo"]
        A2 -->|"API Key| C2
    end

    style Correct fill:#e8f5e9
    style Incorrect fill:#ffcdd2
```

> Las claves privadas de servicios externos **nunca** deben incorporarse en el código de la aplicación móvil.

---

## 8. Generación de planes

```mermaid
flowchart TB
    subgraph Input["📥 Solicitud"]
        SOL["Solicitud\nde planificación"]
    end

    subgraph Process["⚙️ Edge Function: generate-plans"]
        VAL["Validar"]
        CAND["Obtener candidatos"]
        MATRIZ["Matriz\ndesplazamiento"]
        GEN["Generar\nrecorridos"]
        EVAL["Evaluar"]
        DIV["Aplicar\ndiversidad"]
        SEL["Seleccionar\nhasta 3"]
    end

    subgraph Output["📤 Planes"]
        PLAN["Planes\ngenerados"]
    end

    SOL --> VAL
    VAL --> CAND
    CAND --> MATRIZ
    MATRIZ --> GEN
    GEN --> EVAL
    EVAL --> DIV
    DIV --> SEL
    SEL --> PLAN

    style Input fill:#fff3e0
    style Process fill:#e8f5e9
    style Output fill:#e3f2fd
```

Ver detalle en [`generador-planes.md`](./generador-planes.md) y [`../05-algoritmo/generacion-rutas.md`](../05-algoritmo/generacion-rutas.md).

---

## 9. Abstracción del proveedor geográfico

```mermaid
classDiagram
    class RoutingProvider {
        <<interface>>
        +getTravelMatrix(points, mobility) TravelMatrix
    }

    class GeoapifyRoutingProvider {
        +getTravelMatrix(points, mobility) TravelMatrix
    }

    class GoogleRoutingProvider {
        +getTravelMatrix(points, mobility) TravelMatrix
    }

    class MapboxRoutingProvider {
        +getTravelMatrix(points, mobility) TravelMatrix
    }

    RoutingProvider <|.. GeoapifyRoutingProvider
    RoutingProvider <|.. GoogleRoutingProvider
    RoutingProvider <|.. MapboxRoutingProvider
```

> La lógica del sistema depende de `RoutingProvider`, no del proveedor concreto.

---

## 10. Organización del proyecto móvil

```mermaid
graph TB
    subgraph src["src/"]
        subgraph app["app/"]
            NAV["navigation/"]
            PROV["providers/"]
        end

        subgraph features["features/"]
            AUTH["auth/"]
            PLAN["planning/"]
            PLANS["plans/"]
            ROUTE["active-route/"]
            HIST["history/"]
            ADMIN["admin/"]
        end

        subgraph shared["shared/"]
            COMP["components/"]
            HOOKS["hooks/"]
            TYPES["types/"]
            UTILS["utils/"]
        end

        subgraph services["services/"]
            SUP["supabase/"]
        end
    end

    style app fill:#e1f5fe
    style features fill:#e8f5e9
    style shared fill:#fff3e0
    style services fill:#f3e5f5
```

Organización por `features` permite agrupar código según las funcionalidades del producto.

---

## 11. Estados de un plan — Transiciones

```mermaid
stateDiagram-v2
    [*] --> GENERADO
    GENERADO --> SELECCIONADO : usuario elige
    GENERADO --> [*] : expira

    SELECCIONADO --> EN_CURSO : iniciar
    SELECCIONADO --> CANCELADO : cancelar

    EN_CURSO --> COMPLETADO : completar (con al menos 1 visitada)
    EN_CURSO --> CANCELADO : cancelar

    COMPLETADO --> [*]
    CANCELADO --> [*]

    note right of GENERADO: Esperando selección
    note right of SELECCIONADO: Listo para iniciar
    note right of EN_CURSO: Progreso activo\n(máximo 1 por usuario)
    note right of COMPLETADO: Finalizado correctamente
    note right of CANCELADO: Abortado por el usuario
```

---

## 12. Principios arquitectónicos

| # | Principio | Descripción |
|---|---|---|
| 1 | **Cliente delgado** | La interfaz móvil no contiene lógica crítica de generación |
| 2 | **Validación en servidor** | Las reglas sensibles se validan del lado del servidor |
| 3 | **Secretos protegidos** | Las API keys de servicios externos permanecen fuera del cliente |
| 4 | **Acceso autorizado** | Los usuarios solo acceden a su propia información |
| 5 | **Acoplamiento mínimo** | El proveedor geográfico se mantiene desacoplado del algoritmo |
| 6 | **Abstracción de persistencia** | Los repositorios aíslan el acceso a datos |
| 7 | **Simplicidad inicial** | No se introduce infraestructura innecesaria para la v1 |
| 8 | **Testabilidad** | Los componentes deben poder probarse de manera aislada |

---

## 13. Documentos relacionados

| Documento | Descripción |
|---|---|
| [`modelo-dominio.md`](../03-modelado/modelo-dominio.md) | Conceptos y reglas del dominio |
| [`modelo-datos.md`](../03-modelado/modelo-datos.md) | Esquema relacional completo |
| [`secuencias.md`](../03-modelado/secuencias.md) | Diagramas de secuencia |
| [`generador-planes.md`](./generador-planes.md) | Arquitectura interna del generador |
| [`../05-algoritmo/generacion-rutas.md`](../05-algoritmo/generacion-rutas.md) | Detalle del algoritmo Beam Search |
