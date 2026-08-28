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

Los diagramas se encuentran alineados con los casos de uso definidos en:

- [`casos-uso.md`](./casos-uso.md)
- [`modelo-dominio.md`](./modelo-dominio.md)
- [`modelo-datos.md`](./modelo-datos.md)

---

# 2. Componentes utilizados

Los diagramas utilizan los siguientes participantes conceptuales:

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

La implementación concreta podrá agrupar o distribuir estas responsabilidades de manera diferente sin alterar el comportamiento descrito.

---

# 3. CU03 — Generar alternativas

Este es el flujo más importante del sistema, debido a que concentra la lógica principal de Chaski.

## Flujo general

```text
Usuario
   ↓
Solicitud válida
   ↓
Obtener lugares
   ↓
Obtener desplazamientos
   ↓
Generar rutas
   ↓
Validar viabilidad
   ↓
Evaluar
   ↓
Aplicar diversidad
   ↓
Guardar hasta 3
   ↓
Mostrar alternativas
```

## Diagrama de secuencia

```plantuml
@startuml
title CU03 - Generar alternativas

actor Usuario

participant "App móvil" as App
participant "GeneratePlansUseCase" as UC
participant "RequestRepository" as RequestRepo
participant "PlaceRepository" as PlaceRepo
participant "RoutingProvider" as Routing
participant "Geo API" as Geo
participant "RouteGenerator" as Generator
participant "ScoringStrategy" as Scoring
participant "DiversityPolicy" as Diversity
participant "PlanRepository" as PlanRepo
database "PostgreSQL" as DB

Usuario -> App : Solicitar generación
App -> UC : generate(requestId)

UC -> RequestRepo : findById(requestId)
RequestRepo -> DB : Consultar solicitud
DB --> RequestRepo : Datos de solicitud
RequestRepo --> UC : Solicitud

UC -> UC : Validar usuario y solicitud

UC -> PlaceRepo : findCandidates(solicitud)
PlaceRepo -> DB : Consultar lugares,\nhorarios y categorías
DB --> PlaceRepo : Lugares candidatos
PlaceRepo --> UC : Candidatos

alt No existen candidatos
    UC --> App : Sin alternativas
    App --> Usuario : Informar resultado
else Existen candidatos

    UC -> Routing : getMatrix(puntos, movilidad)
    Routing -> Geo : Solicitar tiempos y distancias
    Geo --> Routing : Matriz de desplazamiento

    alt Error del servicio geográfico
        Routing --> UC : Error controlado
        UC --> App : No fue posible generar
        App --> Usuario : Informar error temporal

    else Matriz disponible

        Routing --> UC : TravelMatrix

        UC -> Generator : generate(contexto)

        loop Expansión de rutas
            Generator -> Generator : Evaluar candidato
            Generator -> Generator : Validar horario
            Generator -> Generator : Calcular espera
            Generator -> Generator : Validar tiempo total
            Generator -> Generator : Validar punto final
        end

        Generator --> UC : Rutas viables

        alt No existen rutas viables
            UC --> App : Sin alternativas
            App --> Usuario : Informar resultado

        else Existen rutas viables

            UC -> Scoring : evaluate(routes)
            Scoring --> UC : Rutas puntuadas

            UC -> Diversity : selectDistinct(routes, max=3)
            Diversity --> UC : Alternativas finales

            UC -> PlanRepo : saveAll(alternativas)
            PlanRepo -> DB : Insertar planes,\nparadas y tramos
            DB --> PlanRepo : Confirmación

            PlanRepo --> UC : Planes persistidos
            UC --> App : Alternativas
            App --> Usuario : Mostrar hasta 3 planes
        end
    end
end

@enduml
```

## Consideraciones

- El caso de uso obtiene la solicitud mediante `RequestRepository`.
- El generador no accede directamente a la base de datos.
- El proveedor geográfico se encuentra abstraído mediante `RoutingProvider`.
- No se asume tiempo de desplazamiento igual a cero cuando el servicio geográfico falla.
- Solo las alternativas finales seleccionadas para presentación son almacenadas.
- Las rutas parciales utilizadas durante la búsqueda no se persisten.

---

# 4. CU04 — Consultar y seleccionar plan

## Flujo general

```text
Usuario
   ↓
Consultar alternativas
   ↓
Ver detalle
   ↓
Seleccionar plan
   ↓
GENERADO → SELECCIONADO
```

## Diagrama de secuencia

```plantuml
@startuml
title CU04 - Consultar y seleccionar plan

actor Usuario

participant "App móvil" as App
participant "PlanUseCase" as UC
participant "PlanRepository" as Repo
database "PostgreSQL" as DB

Usuario -> App : Consultar alternativas
App -> UC : getPlansByRequest(requestId)

UC -> Repo : findByRequest(requestId)
Repo -> DB : Consultar planes
DB --> Repo : Planes
Repo --> UC : Alternativas

UC --> App : Lista de planes
App --> Usuario : Mostrar alternativas

Usuario -> App : Ver detalle de plan
App -> UC : getPlanDetail(planId)

UC -> Repo : findDetail(planId)
Repo -> DB : Consultar plan,\nparadas y tramos
DB --> Repo : Detalle
Repo --> UC : Plan

UC --> App : Detalle del plan
App --> Usuario : Mostrar recorrido

Usuario -> App : Seleccionar plan
App -> UC : selectPlan(planId)

UC -> Repo : findById(planId)
Repo -> DB : Consultar plan
DB --> Repo : Plan
Repo --> UC : Plan

UC -> UC : Validar pertenencia
UC -> UC : Validar estado = GENERADO

alt Estado válido
    UC -> Repo : updateStatus(SELECCIONADO)
    Repo -> DB : Actualizar estado
    DB --> Repo : Confirmación

    Repo --> UC : Plan actualizado
    UC --> App : Selección confirmada
    App --> Usuario : Mostrar confirmación
else Estado inválido
    UC --> App : Operación rechazada
    App --> Usuario : Informar estado no válido
end

@enduml
```

## Consideraciones

Seleccionar una alternativa no requiere eliminar ni modificar automáticamente las demás alternativas generadas.

Estas podrán permanecer en estado:

```text
GENERADO
```

---

# 5. CU05 — Gestionar recorrido activo

Este flujo representa el ciclo de vida del plan después de ser seleccionado.

## Estados involucrados

```text
SELECCIONADO
     ↓
EN_CURSO
     ↓
COMPLETADO
```

También:

```text
SELECCIONADO → CANCELADO
EN_CURSO     → CANCELADO
```

## Diagrama de secuencia

```plantuml
@startuml
title CU05 - Gestionar recorrido activo

actor Usuario

participant "App móvil" as App
participant "ActivePlanUseCase" as UC
participant "PlanRepository" as PlanRepo
participant "StopRepository" as StopRepo
database "PostgreSQL" as DB

Usuario -> App : Iniciar recorrido
App -> UC : startPlan(planId)

UC -> PlanRepo : findById(planId)
PlanRepo -> DB : Consultar plan
DB --> PlanRepo : Plan
PlanRepo --> UC : Plan

UC -> UC : Validar estado SELECCIONADO
UC -> PlanRepo : findActiveByUser(userId)
PlanRepo -> DB : Buscar EN_CURSO
DB --> PlanRepo : Resultado
PlanRepo --> UC : Recorrido activo o vacío

alt Ya existe otro EN_CURSO
    UC --> App : Inicio rechazado
    App --> Usuario : Informar conflicto
else Puede iniciar

    UC -> PlanRepo : updateStatus(EN_CURSO)
    PlanRepo -> DB : Actualizar plan
    DB --> PlanRepo : Confirmación

    UC --> App : Recorrido iniciado
    App --> Usuario : Mostrar recorrido
end

== Registrar progreso ==

Usuario -> App : Marcar parada
App -> UC : updateStop(stopId, estado)

UC -> StopRepo : findById(stopId)
StopRepo -> DB : Consultar parada
DB --> StopRepo : Parada
StopRepo --> UC : Parada

UC -> UC : Validar plan EN_CURSO
UC -> UC : Validar parada PENDIENTE

alt VISITADA
    UC -> StopRepo : updateStatus(VISITADA)
else OMITIDA
    UC -> StopRepo : updateStatus(OMITIDA)
end

StopRepo -> DB : Actualizar parada
DB --> StopRepo : Confirmación

UC --> App : Progreso actualizado
App --> Usuario : Mostrar estado

== Finalizar recorrido ==

Usuario -> App : Finalizar recorrido
App -> UC : completePlan(planId)

UC -> StopRepo : findByPlan(planId)
StopRepo -> DB : Consultar paradas
DB --> StopRepo : Paradas
StopRepo --> UC : Paradas

UC -> UC : Verificar sin PENDIENTES
UC -> UC : Verificar al menos una VISITADA

alt Condiciones válidas
    UC -> PlanRepo : updateStatus(COMPLETADO)
    PlanRepo -> DB : Actualizar plan
    DB --> PlanRepo : Confirmación

    UC --> App : Recorrido completado
    App --> Usuario : Mostrar resumen
else No puede completarse
    UC --> App : Finalización rechazada
    App --> Usuario : Informar motivo
end

@enduml
```

---

# 6. Cancelación de recorrido

La cancelación puede ocurrir desde `CU05`, pero se muestra separadamente para visualizar mejor la transición.

```plantuml
@startuml
title Cancelar recorrido

actor Usuario

participant "App móvil" as App
participant "ActivePlanUseCase" as UC
participant "PlanRepository" as Repo
database "PostgreSQL" as DB

Usuario -> App : Cancelar recorrido
App -> UC : cancelPlan(planId)

UC -> Repo : findById(planId)
Repo -> DB : Consultar plan
DB --> Repo : Plan
Repo --> UC : Plan

UC -> UC : Validar pertenencia
UC -> UC : Validar estado

alt SELECCIONADO o EN_CURSO

    UC -> Repo : updateStatus(CANCELADO)
    Repo -> DB : Actualizar estado
    DB --> Repo : Confirmación

    UC --> App : Cancelación confirmada
    App --> Usuario : Mostrar resultado

else Otro estado

    UC --> App : Operación rechazada
    App --> Usuario : Informar estado inválido
end

@enduml
```

La cancelación no elimina las paradas ni el progreso registrado.

---

# 7. CU06 — Consultar historial

## Diagrama de secuencia

```plantuml
@startuml
title CU06 - Consultar historial

actor Usuario

participant "App móvil" as App
participant "HistoryUseCase" as UC
participant "PlanRepository" as Repo
database "PostgreSQL" as DB

Usuario -> App : Abrir historial
App -> UC : getHistory(userId)

UC -> Repo : findHistoryByUser(userId)
Repo -> DB : Consultar planes\nEN_CURSO, COMPLETADO,\nCANCELADO
DB --> Repo : Recorridos
Repo --> UC : Historial

UC --> App : Recorridos
App --> Usuario : Mostrar historial

Usuario -> App : Abrir recorrido
App -> UC : getHistoryDetail(planId)

UC -> Repo : findDetail(planId)
Repo -> DB : Consultar plan,\nparadas y tramos
DB --> Repo : Detalle
Repo --> UC : Plan

UC -> UC : Validar pertenencia

UC --> App : Detalle
App --> Usuario : Mostrar recorrido

@enduml
```

## Consideraciones

Los planes que permanezcan únicamente en estado:

```text
GENERADO
```

no forman parte del historial.

Los planes `SELECCIONADO` todavía no iniciados podrán mostrarse por separado como pendientes.

---

# 8. CU07 — Gestionar lugares

## Diagrama de secuencia

```plantuml
@startuml
title CU07 - Gestionar lugares

actor Administrador

participant "App móvil" as App
participant "PlaceManagementUseCase" as UC
participant "PlaceRepository" as Repo
database "PostgreSQL" as DB

Administrador -> App : Gestionar lugares
App -> UC : getPlaces()

UC -> Repo : findAll()
Repo -> DB : Consultar lugares
DB --> Repo : Lugares
Repo --> UC : Lugares

UC --> App : Lista
App --> Administrador : Mostrar lugares

Administrador -> App : Registrar o modificar lugar
App -> UC : savePlace(datos)

UC -> UC : Validar permisos
UC -> UC : Validar información

alt Información válida
    UC -> Repo : save(datos)
    Repo -> DB : Insertar / actualizar
    DB --> Repo : Confirmación

    Repo --> UC : Lugar
    UC --> App : Operación exitosa
    App --> Administrador : Confirmar
else Información inválida
    UC --> App : Validación fallida
    App --> Administrador : Mostrar errores
end

@enduml
```

### Desactivación

```text
ACTIVO → INACTIVO
```

será preferida frente a eliminar físicamente un lugar utilizado históricamente.

---

# 9. CU09 — Consultar reportes

## Diagrama de secuencia

```plantuml
@startuml
title CU09 - Consultar reportes

actor Administrador

participant "App móvil" as App
participant "ReportUseCase" as UC
participant "ReportRepository" as Repo
database "PostgreSQL" as DB

Administrador -> App : Consultar reportes
App -> UC : getReport(filters)

UC -> UC : Validar permisos

UC -> Repo : getMetrics(filters)

Repo -> DB : Ejecutar consultas\nagregadas
DB --> Repo : Resultados

Repo --> UC : Métricas

UC --> App : Información resumida
App --> Administrador : Mostrar reportes

@enduml
```

## Consideración

`ReportRepository` representa una abstracción de consultas.

No implica la existencia de una tabla:

```text
reportes
```

ni de una entidad de dominio `Reporte`.

---

# 10. Secuencia interna del generador

Además del flujo de `CU03`, es útil representar con mayor detalle el comportamiento interno de la generación.

```plantuml
@startuml
title Flujo interno del generador de recorridos

participant "GeneratePlansUseCase" as UC
participant "RouteGenerator" as Generator
participant "SeedGenerator" as Seeds
participant "BeamSearch" as Beam
participant "RouteExpander" as Expander
participant "RouteRules" as Rules
participant "ScoringStrategy" as Score
participant "DiversityPolicy" as Diversity

UC -> Generator : generate(context)

Generator -> Seeds : createInitialSeeds(context)
Seeds --> Generator : Seeds iniciales

loop Por cada seed

    Generator -> Beam : search(seed, context)

    loop Mientras existan niveles posibles
        Beam -> Expander : expand(route)

        loop Por cada candidato
            Expander -> Rules : validate(candidate, route)
            Rules --> Expander : válido / inválido

            alt Candidato válido
                Expander -> Expander : Crear nueva ruta
            end
        end

        Expander --> Beam : Nuevas rutas
        Beam -> Beam : Ordenar parciales
        Beam -> Beam : Conservar mejores K
    end

    Beam --> Generator : Rutas viables
end

Generator -> Score : evaluate(routes)
Score --> Generator : Rutas puntuadas

Generator -> Diversity : select(routes, maxResults)
Diversity --> Generator : Alternativas distintas

Generator --> UC : Hasta 3 alternativas

@enduml
```

---

# 11. Responsabilidades durante la generación

La separación esperada es:

```text
GeneratePlansUseCase
        │
        ├── coordina operación
        │
        ▼
RouteGenerator
        │
        ├── controla proceso de generación
        │
        ▼
BeamSearch
        │
        ├── mantiene mejores rutas parciales
        │
        ▼
RouteExpander
        │
        ├── intenta agregar lugares
        │
        ▼
RouteRules
        │
        └── determina si una expansión es válida
```

Posteriormente:

```text
Rutas viables
      ↓
ScoringStrategy
      ↓
DiversityPolicy
      ↓
Alternativas finales
```

Esto permite mantener separadas:

- generación;
- validación;
- puntuación;
- diversidad.

---

# 12. Acceso a servicios externos

Los componentes de dominio o algoritmo no deberán depender directamente del proveedor geográfico concreto.

Se utilizará una abstracción similar a:

```text
RoutingProvider
```

con una operación conceptual:

```text
getTravelMatrix(points, mobility)
```

La implementación podrá utilizar el proveedor seleccionado posteriormente.

Esto permite evitar que el algoritmo dependa directamente de una API específica.

---

# 13. Manejo de errores

Los principales errores contemplados durante estos flujos son:

| Situación | Comportamiento |
|---|---|
| Solicitud inexistente | Rechazar operación |
| Solicitud de otro usuario | Rechazar acceso |
| Sin lugares candidatos | Informar ausencia de alternativas |
| Sin recorridos viables | Retornar cero alternativas |
| Servicio geográfico no disponible | Informar fallo temporal |
| Plan en estado inválido | Rechazar transición |
| Otro recorrido activo | No permitir iniciar otro |
| Parada no pendiente | Rechazar cambio de estado |
| Todas las paradas omitidas | No permitir completar |
| Usuario sin permisos administrativos | Rechazar operación |

---

# 14. Diagramas prioritarios para el informe

Si el informe académico no requiere incluir todos los diagramas de este documento, los tres de mayor importancia son:

```text
CU03 — Generar alternativas
CU04 — Consultar y seleccionar plan
CU05 — Gestionar recorrido activo
```

Estos representan:

1. la lógica diferenciadora de Chaski;
2. la elección del recorrido;
3. la ejecución del plan.

Los demás diagramas pueden mantenerse dentro de la documentación técnica del repositorio y utilizarse como anexos cuando sea necesario.

---

# 15. Documentos relacionados

- [Casos de uso](./casos-uso.md)
- [Modelo de dominio](./modelo-dominio.md)
- [Modelo de datos](./modelo-datos.md)
- [Reglas de negocio](../02-requisitos/reglas-negocio.md)
- [Arquitectura general](../04-arquitectura/arquitectura-general.md)
- [Generador de planes](../04-arquitectura/generador-planes.md)
- [Generación de rutas](../05-algoritmo/generacion-rutas.md)