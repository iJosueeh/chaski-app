# Matriz de trazabilidad — Chaski

## 1. Propósito

Este documento relaciona los principales elementos de análisis del proyecto Chaski.

La trazabilidad permite verificar que los requisitos funcionales se encuentren alineados con:

- los problemas identificados;
- los objetivos del proyecto;
- los casos de uso;
- las reglas de negocio.

La relación general utilizada es:

```text
PROBLEMA
   ↓
OBJETIVO
   ↓
REQUISITO FUNCIONAL
   ↓
CASO DE USO
   ↓
REGLAS DE NEGOCIO
```

---

# 2. Problemas y objetivos

| Problema específico | Objetivo específico |
|---|---|
| PE01 — ¿Cómo centralizar las principales condiciones y preferencias que una persona considera al momento de planificar una salida? | OE01 — Implementar un mecanismo que permita registrar las principales condiciones y preferencias de una salida. |
| PE02 — ¿Cómo generar alternativas de recorrido que combinen lugares de interés considerando horarios, duración de actividades y tiempos de desplazamiento? | OE02 — Desarrollar un mecanismo de generación de recorridos considerando lugares, horarios, duración de actividades y desplazamientos. |
| PE03 — ¿Cómo facilitar la comparación de alternativas considerando intereses, tiempo disponible, rango de gasto y desplazamiento? | OE03 — Implementar un mecanismo de evaluación y presentación de alternativas que facilite su comparación. |
| PE04 — ¿Cómo permitir que el usuario seleccione y registre el progreso del recorrido elegido desde una aplicación móvil? | OE04 — Desarrollar funcionalidades para seleccionar un recorrido, registrar su progreso y consultar posteriormente su información. |

---

# 3. Casos de uso

Los casos de uso principales definidos para Chaski son:

| ID | Caso de uso | Actor principal |
|---|---|---|
| CU01 | Gestionar cuenta y preferencias | Usuario |
| CU02 | Crear solicitud de plan | Usuario |
| CU03 | Generar alternativas | Usuario |
| CU04 | Consultar y seleccionar plan | Usuario |
| CU05 | Gestionar recorrido activo | Usuario |
| CU06 | Consultar historial | Usuario |
| CU07 | Gestionar lugares | Administrador |
| CU08 | Gestionar categorías y etiquetas | Administrador |
| CU09 | Consultar reportes | Administrador |

---

# 4. Trazabilidad de requisitos funcionales

## 4.1. Gestión de usuarios y preferencias

| RF | Objetivo relacionado | Caso de uso | Reglas de negocio |
|---|---|---|---|
| RF01 — Registrar usuario | OE01 | CU01 | USR-01 |
| RF02 — Autenticar usuario | OE01 | CU01 | USR-01, USR-02 |
| RF03 — Gestionar perfil y preferencias | OE01 | CU01 | USR-02, USR-03, USR-04 |

---

## 4.2. Configuración de la salida

| RF | Objetivo relacionado | Caso de uso | Reglas de negocio |
|---|---|---|---|
| RF04 — Crear solicitud de planificación | OE01 | CU02 | SOL-01, SOL-02, SOL-03, SOL-04, SOL-05 |
| RF05 — Configurar punto final | OE01 | CU02 | SOL-06, SOL-07, SOL-08 |

---

## 4.3. Generación de alternativas

| RF | Objetivo relacionado | Caso de uso | Reglas de negocio |
|---|---|---|---|
| RF06 — Generar alternativas de recorrido | OE02 | CU03 | LUG-01 a LUG-05, GEN-01 a GEN-10 |
| RF07 — Evaluar y priorizar alternativas | OE03 | CU03 | EVA-01 a EVA-10 |
| RF08 — Controlar diversidad de alternativas | OE03 | CU03 | EVA-11, EVA-12, EVA-13 |

---

## 4.4. Consulta y selección de planes

| RF | Objetivo relacionado | Caso de uso | Reglas de negocio |
|---|---|---|---|
| RF09 — Consultar alternativas generadas | OE03 | CU04 | GEN-07, GEN-08, GEN-09 |
| RF10 — Consultar detalle de un plan | OE03 | CU04 | EVA-04, EVA-05, EVA-09 |
| RF11 — Visualizar recorrido geográficamente | OE03 | CU04 | GEN-02, GEN-03, GEN-04 |
| RF12 — Seleccionar plan | OE04 | CU04 | PLA-01, PLA-02 |

---

## 4.5. Ejecución del recorrido

| RF | Objetivo relacionado | Caso de uso | Reglas de negocio |
|---|---|---|---|
| RF13 — Iniciar recorrido | OE04 | CU05 | PLA-03, PLA-04 |
| RF14 — Consultar recorrido activo | OE04 | CU05 | PLA-03, PLA-04, HIS-04 |
| RF15 — Registrar progreso de las paradas | OE04 | CU05 | PAR-01 a PAR-06 |
| RF16 — Finalizar o cancelar recorrido | OE04 | CU05 | PLA-05, PLA-06, PLA-07, PLA-08 |

---

## 4.6. Historial

| RF | Objetivo relacionado | Caso de uso | Reglas de negocio |
|---|---|---|---|
| RF17 — Consultar historial de recorridos | OE04 | CU06 | HIS-01, HIS-02, HIS-03, HIS-04 |

---

## 4.7. Administración

| RF | Objetivo relacionado | Caso de uso | Reglas de negocio |
|---|---|---|---|
| RF18 — Gestionar lugares | Soporte al funcionamiento del sistema | CU07 | LUG-01, LUG-02, LUG-06, ADM-01, ADM-02 |
| RF19 — Gestionar categorías y etiquetas | Soporte al funcionamiento del sistema | CU08 | ADM-03, ADM-04, ADM-05 |
| RF20 — Consultar reportes | Soporte administrativo | CU09 | ADM-06 |

---

# 5. Trazabilidad por objetivo

## OE01 — Registrar condiciones y preferencias

Requisitos relacionados:

```text
RF01
RF02
RF03
RF04
RF05
```

Casos de uso:

```text
CU01
CU02
```

Principales reglas:

```text
USR-01 a USR-04
SOL-01 a SOL-08
```

---

## OE02 — Generar recorridos viables

Requisitos relacionados:

```text
RF06
```

Caso de uso principal:

```text
CU03
```

Principales reglas:

```text
LUG-01 a LUG-05
GEN-01 a GEN-10
```

---

## OE03 — Evaluar y comparar alternativas

Requisitos relacionados:

```text
RF07
RF08
RF09
RF10
RF11
```

Casos de uso:

```text
CU03
CU04
```

Principales reglas:

```text
EVA-01 a EVA-13
GEN-07 a GEN-09
```

---

## OE04 — Seleccionar y ejecutar recorridos

Requisitos relacionados:

```text
RF12
RF13
RF14
RF15
RF16
RF17
```

Casos de uso:

```text
CU04
CU05
CU06
```

Principales reglas:

```text
PLA-01 a PLA-08
PAR-01 a PAR-06
HIS-01 a HIS-04
```

---

# 6. Elementos administrativos

Los requisitos administrativos no derivan directamente de una necesidad expresada por el usuario final, sino de la necesidad de mantener la información necesaria para el funcionamiento de Chaski.

Incluyen:

```text
RF18 — Gestionar lugares
RF19 — Gestionar categorías y etiquetas
RF20 — Consultar reportes
```

Estos requisitos se relacionan con:

```text
CU07
CU08
CU09
```

y con las reglas:

```text
LUG-01
LUG-02
LUG-06
ADM-01 a ADM-06
```

---

# 7. Resumen general

La trazabilidad principal de Chaski puede representarse de la siguiente manera:

```text
PE01
 ↓
OE01
 ↓
RF01–RF05
 ↓
CU01–CU02
 ↓
USR / SOL


PE02
 ↓
OE02
 ↓
RF06
 ↓
CU03
 ↓
LUG / GEN


PE03
 ↓
OE03
 ↓
RF07–RF11
 ↓
CU03–CU04
 ↓
EVA / GEN


PE04
 ↓
OE04
 ↓
RF12–RF17
 ↓
CU04–CU06
 ↓
PLA / PAR / HIS


SOPORTE DEL SISTEMA
 ↓
RF18–RF20
 ↓
CU07–CU09
 ↓
ADM
```

---

# 8. Cobertura

Con la definición actual:

- todos los requisitos funcionales cuentan con al menos un caso de uso asociado;
- todos los objetivos específicos cuentan con requisitos funcionales que permiten abordarlos;
- las principales reglas de negocio se encuentran asociadas a requisitos y casos de uso;
- las funcionalidades administrativas se identifican explícitamente como soporte del funcionamiento del sistema.

La matriz deberá actualizarse cuando se agregue, modifique o elimine un requisito, caso de uso o regla de negocio.

---

# 9. Documentos relacionados

- [Problema y objetivos](../01-producto/problema-y-objetivos.md)
- [Alcance del producto](../01-producto/alcance.md)
- [Requisitos funcionales](./requisitos-funcionales.md)
- [Requisitos no funcionales](./requisitos-no-funcionales.md)
- [Reglas de negocio](./reglas-negocio.md)
- [Casos de uso](../03-modelado/casos-uso.md)