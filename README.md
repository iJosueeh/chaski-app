<div align="center">

# 🚌 Chaski

**Planificación inteligente y optimizada de salidas urbanas en Lima Metropolitana**

Transforma tus preferencias, tiempo disponible y presupuesto en hasta **3 alternativas de recorrido viables**, evaluadas algorítmicamente y listas para disfrutar.

[![React Native](https://img.shields.io/badge/React_Native-0.74+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_51-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Explorar Documentación](./docs/README.md) · [Casos de Uso](./docs/03-modelado/casos-uso.md) · [Arquitectura](./docs/04-arquitectura/arquitectura-general.md) · [Algoritmo](./docs/05-algoritmo/generacion-rutas.md)

</div>

---

## 🧭 ¿Qué es Chaski?

> **El problema:** Planificar una salida en Lima suele implicar abrir mapas, redes sociales, calcular tiempos de tráfico, consultar horarios de atención y adivinar gastos, todo por separado.
>
> **La solución Chaski:** Centraliza tus restricciones (inicio/fin, tiempo, dinero, movilidad e intereses) y genera automáticamente hasta **3 itinerarios optimizados y realistas**, sin saturación y con control total del usuario.

```mermaid
mindmap
  root((🚌 Chaski))
    Entradas del Usuario
      📍 Ubicación inicial y retorno
      ⏰ Ventana horaria disponible
      💰 Rango de gasto estimado
      🚶 Modalidad: A pie, Bici, Auto, Bus
      🎯 1 a 3 Categorías de interés
    Motor de Planificación
      🔍 Filtro geoespacial de candidatos
      🗺️ Matriz de desplazamiento O/D
      ⚡ Beam Search determinístico
      ⚖️ Puntuación multicriterio
      🎨 Diversidad de alternativas
    Experiencia de Recorrido
      📱 Comparación visual de 3 planes
      🚀 Seguimiento de ruta paso a paso
      ✅ Check-in y descarte de paradas
      📜 Historial de salidas realizadas
```

---

## 🏛️ Arquitectura del Sistema

Chaski adopta una arquitectura de **cliente móvil desacoplado** con procesamiento backend serverless mediante **Supabase Edge Functions**, garantizando seguridad en el acceso a datos (RLS) y aislamiento de claves de API externas.

```mermaid
graph TB
    subgraph Client["📱 Capa Cliente (Frontend)"]
        UI["React Native + Expo App"]
        STORE["Estado local & Sesión"]
    end

    subgraph Backend["⚡ Backend Cloud (Supabase)"]
        AUTH["Supabase Auth\n(Tokens & Roles)"]
        EDGE["Edge Functions (Deno)\n⚡ generate-plans\n⚡ route-operations"]
        DB[("PostgreSQL 15+\nRLS Activado")]
    end

    subgraph External["🌐 Servicios Externos"]
        GEO["Geo Routing API\n(Geoapify / Mapbox / Google)"]
    end

    UI -->|"1. Autenticación"| AUTH
    UI -->|"2. Lecturas simples (RLS)"| DB
    UI -->|"3. Solicitar generación / acciones"| EDGE
    EDGE -->|"4. Consulta de catálogo & historial"| DB
    EDGE -->|"5. Matriz de matrices / distancias"| GEO

    classDef client fill:#E1F5FE,stroke:#0288D1,stroke-width:2px;
    classDef backend fill:#E8F5E9,stroke:#2E7D32,stroke:#2E7D32,stroke-width:2px;
    classDef external fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px;

    class UI,STORE client;
    class AUTH,EDGE,DB backend;
    class GEO external;
```

### Principios de Diseño Clave
* **Seguridad Row-Level (RLS):** Los usuarios solo pueden leer y modificar sus propios datos (`solicitudes`, `planes`, `preferencias`).
* **Protección de Credenciales:** La app cliente nunca expone API keys de mapas; todo cálculo geoespacial se orquesta en Edge Functions.
* **Proveedor Geográfico Intercambiable:** Implementación basada en interfaz `RoutingProvider` desacoplada del proveedor final.

---

## 🔄 Flujo de Experiencia del Usuario

```mermaid
flowchart LR
    A["⚙️ 1. Configurar\nInicio, fin, tiempo,\ngasto y categorías"] --> B["⚡ 2. Generar\nAlgoritmo Beam Search\nen Edge Function"]
    B --> C["⚖️ 3. Comparar\nHasta 3 planes con\nscore y métricas"]
    C --> D["🎯 4. Elegir\nSeleccionar itinerario\npreferido"]
    D --> E["🚶 5. Recorrer\nCheck-in de paradas\ny navegación"]
    E --> F["📜 6. Registrar\nGuardado en historial\ny evaluación"]

    style A fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style B fill:#EDE7F6,stroke:#512DA8,stroke-width:2px
    style C fill:#FFF8E1,stroke:#F57F17,stroke-width:2px
    style D fill:#E0F2F1,stroke:#00695C,stroke-width:2px
    style E fill:#FBE9E7,stroke:#D84315,stroke-width:2px
    style F fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
```

### Ciclo de Vida de un Plan

```mermaid
stateDiagram-v2
    [*] --> GENERADO: Solicitud procesada
    GENERADO --> SELECCIONADO: Usuario elige el plan
    GENERADO --> [*]: Expira o descarta

    SELECCIONADO --> EN_CURSO: Iniciar recorrido
    SELECCIONADO --> CANCELADO: Cancelar antes de iniciar

    state EN_CURSO {
        [*] --> ParadaPendiente
        ParadaPendiente --> ParadaVisitada: Marcar visitada
        ParadaPendiente --> ParadaOmitida: Marcar omitida
        ParadaVisitada --> ParadaPendiente: Siguiente parada
        ParadaOmitida --> ParadaPendiente: Siguiente parada
    }

    EN_CURSO --> COMPLETADO: Finalizar (≥1 parada visitada)
    EN_CURSO --> CANCELADO: Cancelar salida

    COMPLETADO --> [*]
    CANCELADO --> [*]
```

---

## 🧠 Algoritmo de Generación (Beam Search)

Chaski no utiliza cajas negras de IA no determinísticas; utiliza un pipeline algorítmico estructurado basado en **Beam Search (ancho 3)** y puntuación multicriterio:

```mermaid
flowchart TD
    IN(["📥 Solicitud del Usuario"]) --> F1["1. Filtrado de Lugares Candidatos\n(Ubicación, horarios, categorías, presupuesto)"]
    F1 --> F2["2. Matriz de Desplazamiento (OD Matrix)\n(Cálculo de tiempos y distancias según movilidad)"]
    F2 --> F3["3. Selección de Seeds Iniciales (Máx 5)\n(Puntos de inicio con mayor compatibilidad)"]
    F3 --> F4["4. Exploración Beam Search (Ancho = 3)\n(Construcción incremental de secuencias viables)"]
    F4 --> F5["5. Evaluación & Scoring Multicriterio\n(Afinidad 35% · Tiempo 25% · Gasto 20% · Desplazamiento 20%)"]
    F5 --> F6["6. Filtro de Diversidad Jaccard\n(Evita recomendar rutas casi idénticas)"]
    F6 --> OUT(["📤 Hasta 3 Alternativas Óptimas"])

    style IN fill:#E1F5FE,stroke:#0288D1
    style OUT fill:#C8E6C9,stroke:#2E7D32
    style F4 fill:#FFF9C4,stroke:#FBC02D
    style F5 fill:#F3E5F5,stroke:#7B1FA2
```

---

## 🗄️ Modelo de Datos Esencial

Esquema relacional en PostgreSQL optimizado para consultas geoespaciales y control de estado:

```mermaid
erDiagram
    USUARIOS ||--o{ SOLICITUDES_PLAN : "crea"
    USUARIOS ||--o{ PREFERENCIAS_USUARIO : "configura"
    SOLICITUDES_PLAN ||--o{ PLANES : "genera (hasta 3)"
    PLANES ||--o{ PARADAS_PLAN : "contiene (1..4)"
    PLANES ||--o{ TRAMOS_PLAN : "conecta"
    LUGARES ||--o{ PARADAS_PLAN : "referenciado en"
    LUGARES ||--o{ HORARIOS_LUGAR : "posee"
    LUGARES }o--o{ CATEGORIAS : "clasificado en"
    LUGARES }o--o{ ETIQUETAS : "etiquetado con"

    USUARIOS {
        uuid id PK
        string email
        string rol "USUARIO | ADMIN"
        string estado "ACTIVO | INACTIVO"
    }

    SOLICITUDES_PLAN {
        uuid id PK
        uuid usuario_id FK
        geopoint punto_inicio
        geopoint punto_fin
        datetime fecha_inicio
        datetime fecha_fin
        decimal gasto_maximo
        enum movilidad
    }

    PLANES {
        uuid id PK
        uuid solicitud_id FK
        enum estado "GENERADO | SELECCIONADO | EN_CURSO | COMPLETADO | CANCELADO"
        int duracion_total_min
        decimal gasto_estimado
        decimal score_compatibilidad
    }

    LUGARES {
        uuid id PK
        string nombre
        geopoint ubicacion
        decimal costo_estimado
        int duracion_sugerida_min
        boolean activo
    }
```

---

## 📂 Estructura del Código

Organización modular orientada a **Features** en el cliente móvil:

```text
chaski-app/
├── docs/                        # 📚 Documentación técnica completa
│   ├── 01-producto/             # Visión, problema, objetivos y alcance
│   ├── 02-requisitos/           # Requisitos funcionales/no funcionales y reglas
│   ├── 03-modelado/             # Casos de uso, dominio, ERD y secuencias
│   ├── 04-arquitectura/         # Arquitectura general y generador
│   └── 05-algoritmo/            # Detalle matemático de Beam Search
├── src/                         # 📱 Código fuente (React Native + Expo)
│   ├── app/                     # Providers globales y navegación raíz
│   ├── features/                # Módulos desacoplados por dominio
│   │   ├── auth/                # Registro, login y perfil
│   │   ├── planning/            # Formulario de configuración de salidas
│   │   ├── plans/               # Comparativa y detalle de planes generados
│   │   ├── active-route/        # Seguimiento y check-in del recorrido activo
│   │   ├── history/             # Historial de salidas completadas
│   │   └── admin/               # Catálogo de lugares y taxonomía (Admin)
│   ├── shared/                  # Componentes UI, hooks, utilidades y tipos
│   └── services/                # Clientes Supabase y API de rutas
└── supabase/                    # ⚡ Backend (Edge Functions & Migraciones SQL)
    ├── functions/               # Edge Functions (generate-plans, etc.)
    └── migrations/              # Esquema DDL, funciones y políticas RLS
```

---

## 📚 Mapa de la Documentación

Toda la documentación está organizada en 5 módulos técnicos visualmente documentados:

| Módulo | Contenido Principal | Diagramas incluidos |
|---|---|---|
| [**01. Producto**](./docs/01-producto/vision.md) | Visión, Problemas ([PE01–PE04](./docs/01-producto/problema-y-objetivos.md)), Objetivos y Alcance ([In/Out Scope](./docs/01-producto/alcance.md)) | Flujo macro, matriz de objetivos |
| [**02. Requisitos**](./docs/02-requisitos/requisitos-funcionales.md) | [29 Requisitos Funcionales](./docs/02-requisitos/requisitos-funcionales.md), [RNF](./docs/02-requisitos/requisitos-no-funcionales.md), [40+ Reglas de Negocio](./docs/02-requisitos/reglas-negocio.md) y [Matriz de Trazabilidad](./docs/02-requisitos/trazabilidad.md) | Tablas de trazabilidad y validación |
| [**03. Modelado**](./docs/03-modelado/casos-uso.md) | [Casos de Uso (CU01–CU09)](./docs/03-modelado/casos-uso.md), [Modelo de Dominio](./docs/03-modelado/modelo-dominio.md), [Modelo de Datos ERD](./docs/03-modelado/modelo-datos.md) y [Secuencias](./docs/03-modelado/secuencias.md) | Diagramas de secuencia, estado y casos de uso |
| [**04. Arquitectura**](./docs/04-arquitectura/arquitectura-general.md) | [Arquitectura General](./docs/04-arquitectura/arquitectura-general.md), Políticas RLS, Seguridad y [Generador de Planes](./docs/04-arquitectura/generador-planes.md) | Capas, flujo de credenciales, árbol de módulos |
| [**05. Algoritmo**](./docs/05-algoritmo/generacion-rutas.md) | [Generación de Rutas con Beam Search](./docs/05-algoritmo/generacion-rutas.md), matrices OD y scoring | Pipeline paso a paso, fórmulas y control de diversidad |

---

<div align="center">

**Chaski** · *Planifica tu salida, no tu estrés.*

</div>
