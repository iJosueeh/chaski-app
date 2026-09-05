 # Casos de uso — Chaski

## 1. Propósito

Este documento describe los principales casos de uso de Chaski para su primera versión.

Los casos de uso representan las interacciones principales entre los actores y el sistema y se encuentran relacionados con los requisitos funcionales definidos en [`requisitos-funcionales.md`](../02-requisitos/requisitos-funcionales.md).

---

## 2. Actores

| Actor | Descripción |
|---|---|
| **Usuario** | Persona registrada que configura salidas, genera alternativas, selecciona planes, registra progreso y consulta historial |
| **Administrador** | Usuario con permisos para gestionar lugares, categorías, horarios y consultar reportes |

---

## 3. Resumen de casos de uso

```mermaid
graph TB
    subgraph Actores["Actores"]
        USUARIO["👤 Usuario"]
        ADMIN["👨‍💼 Administrador"]
    end

    subgraph CU_Usuario["Casos de uso — Usuario"]
        CU01["CU01: Gestionar cuenta y preferencias"]
        CU02["CU02: Crear solicitud de plan"]
        CU03["CU03: Generar alternativas"]
        CU04["CU04: Consultar y seleccionar plan"]
        CU05["CU05: Gestionar recorrido activo"]
        CU06["CU06: Consultar historial"]
    end

    subgraph CU_Admin["Casos de uso — Administrador"]
        CU07["CU07: Gestionar lugares"]
        CU08["CU08: Gestionar categorías y etiquetas"]
        CU09["CU09: Consultar reportes"]
    end

    USUARIO --> CU01
    USUARIO --> CU02
    USUARIO --> CU03
    USUARIO --> CU04
    USUARIO --> CU05
    USUARIO --> CU06

    ADMIN --> CU07
    ADMIN --> CU08
    ADMIN --> CU09

    style USUARIO fill:#bbdefb,stroke:#1976d2
    style ADMIN fill:#c8e6c9,stroke:#388e3c
    style CU_Usuario fill:#e3f2fd,stroke:#1976d2
    style CU_Admin fill:#e8f5e9,stroke:#388e3c
```

| ID | Caso de uso | Actor | Descripción |
|---|---|---|---|
| CU01 | Gestionar cuenta y preferencias | Usuario | Registro, login, perfil, preferencias |
| CU02 | Crear solicitud de plan | Usuario | Configurar condiciones de una salida |
| CU03 | Generar alternativas | Usuario | Obtener hasta 3 planes compatibles |
| CU04 | Consultar y seleccionar plan | Usuario | Ver alternativas y elegir una |
| CU05 | Gestionar recorrido activo | Usuario | Iniciar, marcar paradas, completar, cancelar |
| CU06 | Consultar historial | Usuario | Ver recorridos realizados |
| CU07 | Gestionar lugares | Administrador | CRUD de lugares del catálogo |
| CU08 | Gestionar categorías y etiquetas | Administrador | Administrartaxonomía del catálogo |
| CU09 | Consultar reportes | Administrador | Ver estadísticas del sistema |

---

## 4. CU01 — Gestionar cuenta y preferencias

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant App as 📱 App
    participant Auth as 🔐 Supabase Auth
    participant DB as 🗄️ PostgreSQL

    alt Registro
        U->>App: Registrarse
        App->>Auth: Crear cuenta
        Auth-->>App: Usuario creado
        App->>DB: Crear perfil
        DB-->>App: Perfil creado
        App-->>U: Registro exitoso
    else Iniciar sesión
        U->>App: Iniciar sesión
        App->>Auth: Autenticar
        Auth-->>App: Token de sesión
        App-->>U: Sesión iniciada
    end

    U->>App: Consultar/Modificar preferencias
    App->>DB: Obtener preferencias
    DB-->>App: Preferencias actuales
    App-->>U: Mostrar preferencias

    U->>App: Guardar cambios
    App->>DB: Actualizar preferencias
    DB-->>App: Cambios guardados
    App-->>U: Confirmación
```

### Precondiciones

- Para consultar o modificar preferencias, el usuario deberá encontrarse autenticado.

### Flujos alternativos

- **Registro con correo existente**: el sistema rechaza el registro e informa al usuario.
- **Datos inválidos**: el sistema no guarda los cambios y solicita corrección.

---

## 5. CU02 — Crear solicitud de plan

```mermaid
flowchart TB
    subgraph Input["Configurar salida"]
        A[📍 Ubicación inicial] --> B[⏰ Intervalo de tiempo]
        B --> C[🎯 1-3 categorías]
        C --> D[💰 Rango de gasto]
        D --> E[🚶 Forma de movilidad]
        E --> F[📍 Punto final]
    end

    subgraph Validate["Validaciones"]
        G{¿Hora final > inicial?}
        H{¿1-3 categorías?}
        I{¿Gasto válido?}
        J{¿Punto final existe?}
    end

    subgraph Result["Resultado"]
        K[✅ Solicitud creada]
        L[❌ Solicitud rechazada]
    end

    A --> G
    G -->|No| L
    G -->|Sí| H
    H -->|No| L
    H -->|Sí| I
    I -->|No| L
    I -->|Sí| J
    J -->|No| L
    J -->|Sí| K

    style K fill:#c8e6c9
    style L fill:#ffcdd2
```

### Campos requeridos

| Campo | Tipo | Validación |
|---|---|---|
| Ubicación inicial | GeoPoint | Requerido |
| Fecha/hora inicio | Timestamp | Requerido |
| Fecha/hora fin | Timestamp | > fecha inicio |
| Categorías | Array | 1 a 3 elementos |
| Gasto min/max | Decimal | ≥ 0, min ≤ max |
| Movilidad | Enum | CAMINAR, BICICLETA, AUTO, TRANSPORTE_PUBLICO |
| Tipo punto final | Enum | REGRESAR_INICIO, ULTIMA_PARADA, OTRA_UBICACION |

---

## 6. CU03 — Generar alternativas

```mermaid
flowchart TB
    subgraph Start["Inicio"]
        A[Solicitud válida]
    end

    subgraph Fetch["Obtención de datos"]
        B[Recuperar lugares candidatos]
        C[Obtener matriz de desplazamiento]
    end

    subgraph Generate["Generación"]
        D[Crear seeds iniciales]
        E[Beam Search: explorar rutas]
        F[Validar restricciones]
        G[Evaluar alternativas]
    end

    subgraph Filter["Filtrado"]
        H[¿Sin candidatos?]
        I[¿Sin rutas viables?]
        J[Aplicar diversidad]
        K[Seleccionar hasta 3]
    end

    subgraph End["Resultado"]
        L[Mostrar alternativas]
        M[Informar sin resultados]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H -->|Sí| M
    H -->|No| I
    I -->|Sí| M
    I -->|No| J
    J --> K
    K --> L

    style L fill:#c8e6c9
    style M fill:#fff9c4
```

### Parámetros del algoritmo

| Parámetro | Valor | Descripción |
|---|---|---|
| `MAX_INITIAL_SEEDS` | 5 | Seeds iniciales como puntos de partida |
| `BEAM_WIDTH` | 3 | Rutas parciales conservadas por nivel |
| `MIN_STOPS` | 1 | Paradas mínimas en un plan |
| `MAX_STOPS` | 4 | Paradas máximas en un plan |
| `MAX_RESULTS` | 3 | Resultados finales máximo |

---

## 7. CU04 — Consultar y seleccionar plan

```mermaid
flowchart LR
    subgraph Consultar["Consultar alternativas"]
        A[Ver lista] --> B[Ver detalle de plan]
        B --> C[Ver paradas]
        B --> D[Ver duración y gasto]
        B --> E[Ver mapa]
    end

    subgraph Seleccionar["Seleccionar"]
        F{Seleccionar plan}
        G[¿Estado = GENERADO?]
        H[Actualizar → SELECCIONADO]
        I[Confirmación]
        J[Error: estado inválido]
    end

    A --> F
    F --> G
    G -->|Sí| H
    G -->|No| J
    H --> I

    style I fill:#c8e6c9
    style J fill:#ffcdd2
```

---

## 8. CU05 — Gestionar recorrido activo

```mermaid
stateDiagram-v2
    [*] --> SELECCIONADO

    state SELECCIONADO {
        [*] --> ListoParaIniciar
        ListoParaIniciar --> [*]
    }

    SELECCIONADO --> EN_CURSO : iniciar
    SELECCIONADO --> CANCELADO : cancelar

    state EN_CURSO {
        [*] --> EnProgreso
        EnProgreso --> MarcarParada : registrar
        MarcarParada --> HayPendientes : sí
        MarcarParada --> ReadyComplete : no
        HayPendientes --> EnProgreso
        EnProgreso --> ReadyComplete : forzar
    }

    state ReadyComplete {
        [*] --> PuedeCompletar
        PuedeCompletar --> [*] : completar
    }

    EN_CURSO --> COMPLETADO : completar
    EN_CURSO --> CANCELADO : cancelar
    COMPLETADO --> [*]
    CANCELADO --> [*]

    note right of SELECCIONADO: Esperando inicio
    note right of EN_CURSO: Registro de progreso manual
    note right of COMPLETADO: Al menos una parada visitada
    note right of CANCELADO: Progreso conservado en historial
```

### Restricciones

- Solo un recorrido activo por usuario a la vez.
- Para completar: al menos una parada `VISITADA`, sin `PENDIENTE`.
- Cancelar está permitido desde `SELECCIONADO` o `EN_CURSO`.

---

## 9. CU06 — Consultar historial

```mermaid
flowchart TB
    A[Consultar historial] --> B{¿Tiene recorridos?}
    B -->|No| C[Mostrar estado vacío]
    B -->|Sí| D[Lista de recorridos]
    D --> E[Ordenar por fecha]
    E --> F[Mostrar resumen]
    F --> G{Ver detalle?}
    G -->|Sí| H[Paradas, tramos, lugares]
    G -->|No| I[Fin]

    style C fill:#fff9c4
    style I fill:#c8e6c9
```

> Los planes `GENERADO` sin seleccionar **no** forman parte del historial.

---

## 10. CU07 — CU09 — Casos del administrador

```mermaid
flowchart TB
    subgraph CU07["CU07: Gestionar lugares"]
        A1[Registrar lugar] --> A2[¿Datos válidos?]
        A2 -->|Sí| A3[Guardar lugar]
        A2 -->|No| A4[Mostrar errores]
        A3 --> A5[Gestionar horarios]
        A5 --> A6[Activar/Desactivar]
    end

    subgraph CU08["CU08: Gestionar categorías"]
        B1[Crear categoría] --> B2[¿Nombre único?]
        B2 -->|Sí| B3[Guardar]
        B2 -->|No| B4[Error]
        B3 --> B5[Crear etiqueta]
        B5 --> B6[Asociar a lugares]
    end

    subgraph CU09["Consultar reportes"]
        C1[Seleccionar tipo] --> C2{Lugares más visitados}
        C2 --> C3[Planes por período]
        C3 --> C4[Duración promedio]
        C4 --> C5[Reporte consolidado]
    end

    style A3 fill:#c8e6c9
    style B3 fill:#c8e6c9
    style C5 fill:#c8e6c9
```

---

## 11. Tabla resumen de estados

| Entidad | Estados posibles |
|---|---|
| **Plan** | GENERADO → SELECCIONADO → EN_CURSO → COMPLETADO / CANCELADO |
| **Parada** | PENDIENTE → VISITADA / OMITIDA |
| **Lugar** | ACTIVO / INACTIVO |
| **Usuario** | ACTIVO / INACTIVO |

---

## 12. Requisitos y reglas relacionados

| CU | Requisitos | Reglas de negocio |
|---|---|---|
| CU01 | RF01, RF02, RF03 | USR-01 a USR-04 |
| CU02 | RF04, RF05 | SOL-01 a SOL-08 |
| CU03 | RF06, RF07, RF08 | LUG-01 a LUG-05, GEN-01 a GEN-10 |
| CU04 | RF09, RF10, RF11, RF12 | PLA-01, PLA-02, EVA-01 a EVA-13 |
| CU05 | RF13, RF14, RF15, RF16 | PLA-03 a PLA-08, PAR-01 a PAR-06 |
| CU06 | RF17 | HIS-01 a HIS-04 |
| CU07 | RF18 a RF25 | LUG-01 a LUG-05 |
| CU08 | RF26 a RF28 | CAT-01, ETI-01 |
| CU09 | RF29 | — |
