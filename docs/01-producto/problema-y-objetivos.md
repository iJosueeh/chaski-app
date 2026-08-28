# Problema y objetivos — Chaski

## 1. Situación problemática

La planificación de una salida dentro de Lima Metropolitana puede requerir consultar diferentes fuentes de información para identificar lugares de interés, conocer sus horarios, revisar su ubicación, estimar desplazamientos y determinar si las actividades pueden realizarse dentro del tiempo y rango de gasto disponibles.

Aplicaciones de mapas, redes sociales, páginas web y recomendaciones permiten descubrir lugares o consultar información individual sobre ellos. Sin embargo, el usuario todavía debe relacionar manualmente esta información para decidir qué lugares visitar, en qué orden hacerlo y si el recorrido completo es compatible con las condiciones particulares de su salida.

Esta situación adquiere mayor importancia cuando existen restricciones como una hora específica de inicio y finalización, un punto al cual se necesita llegar al terminar, determinados intereses, una forma de movilidad o un rango aproximado de gasto.

Por ello, se identifica la necesidad de una herramienta móvil que apoye la planificación de salidas considerando conjuntamente estas condiciones y permita generar alternativas de recorrido que puedan ser comparadas por el usuario.

---

## 2. Problema general

**¿Cómo facilitar la planificación de salidas dentro de Lima Metropolitana considerando las condiciones y preferencias del usuario, como su ubicación de inicio y finalización, tiempo disponible, intereses, rango de gasto y forma de movilidad?**

---

## 3. Problemas específicos

### PE01

¿Cómo centralizar las principales condiciones y preferencias que una persona considera al momento de planificar una salida?

### PE02

¿Cómo generar alternativas de recorrido que combinen lugares de interés considerando horarios, duración de actividades y tiempos de desplazamiento?

### PE03

¿Cómo facilitar la comparación de alternativas considerando los intereses, tiempo disponible, rango de gasto y desplazamiento del usuario?

### PE04

¿Cómo permitir que el usuario seleccione y registre el progreso del recorrido elegido desde una aplicación móvil?

---

## 4. Objetivo general

**Desarrollar una aplicación móvil que facilite la planificación de salidas dentro de Lima Metropolitana mediante la generación de alternativas de recorridos basadas en las condiciones y preferencias del usuario, considerando su ubicación de inicio y finalización, tiempo disponible, intereses, rango de gasto y forma de movilidad.**

---

## 5. Objetivos específicos

### OE01

Implementar un mecanismo que permita al usuario registrar las principales condiciones y preferencias de una salida, incluyendo ubicación, tiempo disponible, intereses, rango de gasto y forma de movilidad.

### OE02

Desarrollar un mecanismo de generación de recorridos que combine lugares de interés considerando sus horarios, duración estimada de las actividades y tiempos de desplazamiento.

### OE03

Implementar un mecanismo de evaluación y presentación de alternativas que facilite su comparación según su compatibilidad con las condiciones proporcionadas por el usuario.

### OE04

Desarrollar funcionalidades que permitan seleccionar un recorrido, registrar el progreso de sus paradas y consultar posteriormente la información correspondiente a los recorridos realizados.

---

## 6. Relación entre problemas y objetivos

| Problema específico | Objetivo específico |
|---|---|
| PE01 — Centralización de condiciones y preferencias | OE01 — Registrar las condiciones de la salida |
| PE02 — Generación de recorridos viables | OE02 — Generar recorridos considerando lugares y desplazamientos |
| PE03 — Comparación de alternativas | OE03 — Evaluar y presentar alternativas |
| PE04 — Ejecución y seguimiento | OE04 — Seleccionar, registrar progreso y consultar recorridos |

---

## 7. Relación con otros documentos

La definición detallada de las funcionalidades derivadas de estos objetivos se encuentra en:

- [`requisitos-funcionales.md`](../02-requisitos/requisitos-funcionales.md)
- [`reglas-negocio.md`](../02-requisitos/reglas-negocio.md)
- [`trazabilidad.md`](../02-requisitos/trazabilidad.md)

Los límites establecidos para la primera versión se encuentran en:

- [`alcance.md`](./alcance.md)