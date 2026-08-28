# Diagramas de secuencia — Chaski

## 1. Propósito

Este documento representa la interacción entre los principales componentes del sistema durante los casos de uso más relevantes.

Los diagramas no buscan reflejar cada método de implementación, sino mostrar cómo colaboran:

- la aplicación móvil;
- los casos de uso;
- los repositorios;
- la base de datos;
- los servicios externos;
- el módulo de generación de recorridos.

---

## 2. Componentes utilizados

| Componente | Responsabilidad |
|---|---|
| Usuario | Persona que utiliza la aplicación |
| Administrador | Usuario con permisos administrativos |
| App | Aplicación móvil React Native |
| Auth | Servicio de autenticación |
| Caso de uso | Coordina una operación del sistema |
| Repository | Abstrae el acceso a datos |
| PostgreSQL | Persistencia principal |
| Generador | Coordina la generación de recorridos |
| RoutingProvider | Obtiene información de desplazamiento |
| Geo API | Servicio externo de rutas/geolocalización |

---

## 3. CU03 — Generar alternativas

Este es el flujo más importante del sistema, debido a que concentra la lógica principal de Chaski.

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant App as 📱 App móvil
    participant UC as ⚡ GeneratePlansUseCase
    participant ReqRepo as 📦 RequestRepository
    participant PlaceRepo as 📦 PlaceRepository
    participant Routing as 🌐 RoutingProvider
    participant Geo as 🌍 Geo API
    participant Generator as ⚙️ RouteGenerator
    participant Scoring as 📊 ScoringStrategy
    participant Diversity as 🎯 DiversityPolicy
    participant PlanRepo as 📦 PlanRepository
    participant DB as 🗄️ PostgreSQL

    U->>App: Solicitar generación
    App->>UC: generate(requestId)

    UC->>ReqRepo: findById(requestId)
    ReqRepo->>DB: Consultar solicitud
    DB-->>ReqRepo: Datos de solicitud
    ReqRepo-->>UC: Solicitud

    UC->>UC: Validar usuario y solicitud

    UC->>PlaceRepo: findCandidates(solicitud)
    PlaceRepo->>DB: Consultar lugares, horarios y categorías
    DB-->>PlaceRepo: Lugares candidatos
    PlaceRepo-->>UC: Candidatos

    alt No existen candidatos
        UC-->>App: Sin alternativas
        App-->>U: Informar resultado
    else Existen candidatos
        UC->>Routing: getMatrix(puntos, movilidad)
        Routing->>Geo: Solicitar tiempos y distancias
        Geo-->>Routing: Matriz de desplazamiento

        alt Error del servicio geográfico
            Routing-->>UC: Error controlado
            UC-->>App: No fue posible generar
            App-->>U: Informar error temporal
        else Matriz disponible
            Routing-->>UC: TravelMatrix

            UC->>Generator: generate(contexto)

            loop Expansión de rutas
                Generator->>Generator: Evaluar candidato
                Generator->>Generator: Validar horario
                Generator->>Generator: Calcular espera
                Generator->>Generator: Validar tiempo total
                Generator->>Generator: Validar punto final
            end

            Generator-->>UC: Rutas viables

            alt No existen rutas viables
                UC-->>App: Sin alternativas
                App-->>U: Informar resultado
            else Existen rutas viables
                UC->>Scoring: evaluate(routes)
                Scoring-->>UC: Rutas puntuadas

                UC->>Diversity: selectDistinct(routes, max=3)
                Diversity-->>UC: Alternativas finales

                UC->>PlanRepo: saveAll(alternativas)
                PlanRepo->>DB: Insertar planes, paradas y tramos
                DB-->>PlanRepo: Confirmación

                PlanRepo-->>UC: Planes persistidos
                UC-->>App: Alternativas
                App-->>U: Mostrar hasta 3 planes
            end
        end
    end
```

### Consideraciones

- El caso de uso obtiene la solicitud mediante `RequestRepository`.
- El generador no accede directamente a la base de datos.
- El proveedor geográfico se encuentra abstraído mediante `RoutingProvider`.
- No se asume tiempo de desplazamiento igual a cero cuando el servicio geográfico falla.
- Solo las alternativas finales seleccionadas para presentación son almacenadas.
- Las rutas parciales utilizadas durante la búsqueda no se persisten.

---

## 4. CU04 — Consultar y seleccionar plan

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant App as 📱 App móvil
    participant UC as ⚡ PlanUseCase
    participant Repo as 📦 PlanRepository
    participant DB as 🗄️ PostgreSQL

    U->>App: Consultar alternativas
    App->>UC: getPlansByRequest(requestId)

    UC->>Repo: findByRequest(requestId)
    Repo->>DB: Consultar planes
    DB-->>Repo: Planes
    Repo-->>UC: Alternativas

    UC-->>App: Lista de planes
    App-->>U: Mostrar alternativas

    U->>App: Ver detalle de plan
    App->>UC: getPlanDetail(planId)

    UC->>Repo: findDetail(planId)
    Repo->>DB: Consultar plan, paradas y tramos
    DB-->>Repo: Detalle
    Repo-->>UC: Plan

    UC-->>App: Detalle del plan
    App-->>U: Mostrar recorrido

    U->>App: Seleccionar plan
    App->>UC: selectPlan(planId)

    UC->>Repo: findById(planId)
    Repo->>DB: Consultar plan
    DB-->>Repo: Plan
    Repo-->>UC: Plan

    UC->>UC: Validar pertenencia
    UC->>UC: Validar estado = GENERADO

    alt Estado válido
        UC->>Repo: updateStatus(SELECCIONADO)
        Repo->>DB: Actualizar estado
        DB-->>Repo: Confirmación
        Repo-->>UC: Plan actualizado
        UC-->>App: Selección confirmada
        App-->>U: Mostrar confirmación
    else Estado inválido
        UC-->>App: Operación rechazada
        App-->>U: Informar estado no válido
    end
```

> Seleccionar una alternativa no requiere eliminar las demás. Estas podrán permanecer en estado `GENERADO`.

---

## 5. CU05 — Gestionar recorrido activo

Este flujo representa el ciclo de vida del plan después de ser seleccionado.

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant App as 📱 App móvil
    participant UC as ⚡ ActivePlanUseCase
    participant PlanRepo as 📦 PlanRepository
    participant StopRepo as 📦 StopRepository
    participant DB as 🗄️ PostgreSQL

    U->>App: Iniciar recorrido
    App->>UC: startPlan(planId)

    UC->>PlanRepo: findById(planId)
    PlanRepo->>DB: Consultar plan
    DB-->>PlanRepo: Plan
    PlanRepo-->>UC: Plan

    UC->>UC: Validar estado SELECCIONADO
    UC->>PlanRepo: findActiveByUser(userId)
    PlanRepo->>DB: Buscar EN_CURSO
    DB-->>PlanRepo: Resultado
    PlanRepo-->>UC: Recorrido activo o vacío

    alt Ya existe otro EN_CURSO
        UC-->>App: Inicio rechazado
        App-->>U: Informar conflicto
    else Puede iniciar
        UC->>PlanRepo: updateStatus(EN_CURSO)
        PlanRepo->>DB: Actualizar plan
        DB-->>PlanRepo: Confirmación
        UC-->>App: Recorrido iniciado
        App-->>U: Mostrar recorrido
    end

    rect rgb(240, 248, 255)
        Note over U,DB: Registrar progreso
        U->>App: Marcar parada
        App->>UC: updateStop(stopId, estado)

        UC->>StopRepo: findById(stopId)
        StopRepo->>DB: Consultar parada
        DB-->>StopRepo: Parada
        StopRepo-->>UC: Parada

        UC->>UC: Validar plan EN_CURSO
        UC->>UC: Validar parada PENDIENTE

        alt VISITADA
            UC->>StopRepo: updateStatus(VISITADA)
        else OMITIDA
            UC->>StopRepo: updateStatus(OMITIDA)
        end

        StopRepo->>DB: Actualizar parada
        DB-->>StopRepo: Confirmación
        UC-->>App: Progreso actualizado
        App-->>U: Mostrar estado
    end

    rect rgb(255, 250, 240)
        Note over U,DB: Finalizar recorrido
        U->>App: Finalizar recorrido
        App->>UC: completePlan(planId)

        UC->>StopRepo: findByPlan(planId)
        StopRepo->>DB: Consultar paradas
        DB-->>StopRepo: Paradas
        StopRepo-->>UC: Paradas

        UC->>UC: Verificar sin PENDIENTES
        UC->>UC: Verificar al menos una VISITADA

        alt Condiciones válidas
            UC->>PlanRepo: updateStatus(COMPLETADO)
            PlanRepo->>DB: Actualizar plan
            DB-->>PlanRepo: Confirmación
            UC-->>App: Recorrido completado
            App-->>U: Mostrar resumen
        else No puede completarse
            UC-->>App: Finalización rechazada
            App-->>U: Informar motivo
        end
    end
```

---

## 6. Cancelar recorrido

La cancelación puede ocurrir desde `SELECCIONADO` o `EN_CURSO`.

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant App as 📱 App móvil
    participant UC as ⚡ ActivePlanUseCase
    participant Repo as 📦 PlanRepository
    participant DB as 🗄️ PostgreSQL

    U->>App: Cancelar recorrido
    App->>UC: cancelPlan(planId)

    UC->>Repo: findById(planId)
    Repo->>DB: Consultar plan
    DB-->>Repo: Plan
    Repo-->>UC: Plan

    UC->>UC: Validar pertenencia
    UC->>UC: Validar estado

    alt SELECCIONADO o EN_CURSO
        UC->>Repo: updateStatus(CANCELADO)
        Repo->>DB: Actualizar estado
        DB-->>Repo: Confirmación
        UC-->>App: Cancelación confirmada
        App-->>U: Mostrar resultado
    else Otro estado
        UC-->>App: Operación rechazada
        App-->>U: Informar estado inválido
    end
```

> La cancelación no elimina las paradas ni el progreso registrado.

---

## 7. CU06 — Consultar historial

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant App as 📱 App móvil
    participant UC as ⚡ HistoryUseCase
    participant Repo as 📦 PlanRepository
    participant DB as 🗄️ PostgreSQL

    U->>App: Abrir historial
    App->>UC: getHistory(userId)

    UC->>Repo: findHistoryByUser(userId)
    Repo->>DB: Consultar planes EN_CURSO, COMPLETADO, CANCELADO
    DB-->>Repo: Recorridos
    Repo-->>UC: Historial

    UC-->>App: Recorridos
    App-->>U: Mostrar historial

    U->>App: Abrir recorrido
    App->>UC: getHistoryDetail(planId)

    UC->>Repo: findDetail(planId)
    Repo->>DB: Consultar plan, paradas y tramos
    DB-->>Repo: Detalle
    Repo-->>UC: Plan

    UC->>UC: Validar pertenencia

    UC-->>App: Detalle
    App-->>U: Mostrar recorrido
```

> Los planes en estado `GENERADO` no forman parte del historial. Los `SELECCIONADO` pendientes podrán mostrarse por separado.

---

## 8. CU07 — Gestionar lugares (Administrador)

```mermaid
sequenceDiagram
    participant A as 👨‍💼 Administrador
    participant App as 📱 App móvil
    participant UC as ⚡ PlaceManagementUseCase
    participant Repo as 📦 PlaceRepository
    participant DB as 🗄️ PostgreSQL

    A->>App: Acceder a gestión de lugares
    App->>UC: getPlaces()

    UC->>Repo: findAll()
    Repo->>DB: Consultar lugares
    DB-->>Repo: Lista de lugares
    Repo-->>UC: Lugares
    UC-->>App: Lista
    App-->>A: Mostrar catálogo

    A->>App: Registrar/Actualizar lugar
    App->>UC: savePlace(datos)

    UC->>UC: Validar información

    alt Datos válidos
        UC->>Repo: save(lugar)
        Repo->>DB: Insertar/Actualizar
        DB-->>Repo: Confirmación
        Repo-->>UC: Lugar guardado
        UC-->>App: Confirmación
        App-->>A: Mostrar confirmación
    else Datos inválidos
        UC-->>App: Error de validación
        App-->>A: Mostrar errores
    end

    A->>App: Activar/Desactivar lugar
    App->>UC: toggleStatus(lugarId)

    UC->>Repo: findById(lugarId)
    Repo->>DB: Consultar lugar
    DB-->>Repo: Lugar
    Repo-->>UC: Lugar

    alt Lugar puede modificarse
        UC->>Repo: updateStatus(nuevoEstado)
        Repo->>DB: Actualizar estado
        DB-->>Repo: Confirmación
        Repo-->>UC: Estado actualizado
        UC-->>App: Confirmación
        App-->>A: Mostrar cambio
    else Información incompleta
        UC-->>App: No puede modificarse
        App-->>A: Informar motivo
    end
```

---

## 9. Estados del plan — Resumen visual

```mermaid
stateDiagram-v2
    [*] --> GENERADO
    GENERADO --> SELECCIONADO : usuario elige
    GENERADO --> [*] : expira

    SELECCIONADO --> EN_CURSO : usuario inicia
    SELECCIONADO --> CANCELADO : usuario cancela

    EN_CURSO --> COMPLETADO : todas visitadas
    EN_CURSO --> CANCELADO : usuario cancela

    COMPLETADO --> [*]
    CANCELADO --> [*]

    note right of GENERADO: Esperando selección
    note right of SELECCIONADO: Listo para iniciar
    note right of EN_CURSO: Progreso activo
    note right of COMPLETADO: Finalizado
    note right of CANCELADO: Abortado
```
