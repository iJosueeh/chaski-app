# Visión del producto — Chaski

## 1. Descripción

**Chaski** es una aplicación móvil orientada a facilitar la planificación de salidas dentro de Lima Metropolitana.

La aplicación busca transformar las condiciones y preferencias proporcionadas por el usuario en alternativas de recorridos que puedan realizarse dentro del tiempo disponible.

Para ello, considera información como:

- ubicación de inicio;
- ubicación o comportamiento esperado al finalizar la salida;
- tiempo disponible;
- intereses seleccionados;
- rango de gasto aproximado;
- forma de movilidad;
- ubicación, horarios, duración estimada y características de los lugares disponibles.

A partir de estas condiciones, Chaski genera y presenta hasta **tres alternativas de recorrido**, permitiendo al usuario compararlas y seleccionar la que considere más conveniente.

---

## 2. Problema que aborda

Planificar una salida puede requerir consultar diferentes fuentes para encontrar lugares, revisar horarios, calcular desplazamientos, estimar gastos y determinar si las actividades pueden realizarse dentro del tiempo disponible.

La información necesaria puede encontrarse distribuida entre aplicaciones de mapas, redes sociales, páginas web y recomendaciones de otras personas.

El problema no consiste únicamente en encontrar lugares de interés, sino en determinar cómo combinarlos dentro de un recorrido que sea compatible con las condiciones particulares de una salida.

Chaski busca apoyar este proceso centralizando las principales condiciones de planificación y utilizándolas para generar alternativas de recorrido.

---

## 3. Usuarios objetivo

La primera versión de Chaski está dirigida principalmente a personas que realizan salidas dentro de **Lima Metropolitana** y desean organizar actividades considerando restricciones de tiempo, ubicación, intereses, movilidad y gasto aproximado.

El proyecto contempla dos roles principales:

### Usuario

Puede:

- registrarse e iniciar sesión;
- administrar sus preferencias;
- configurar las condiciones de una salida;
- generar alternativas de recorrido;
- comparar los planes obtenidos;
- seleccionar un plan;
- seguir el progreso del recorrido;
- registrar paradas como visitadas u omitidas;
- finalizar o cancelar un recorrido;
- consultar recorridos anteriores.

### Administrador

Es responsable de mantener la información utilizada por el sistema para la generación de recorridos.

Puede:

- gestionar lugares;
- administrar horarios;
- gestionar categorías y etiquetas;
- activar o desactivar información del catálogo;
- consultar reportes generales del sistema.

---

## 4. Propuesta de valor

Chaski busca diferenciarse de una aplicación orientada únicamente al descubrimiento de lugares.

Su propósito no es responder solamente:

> ¿Qué lugares existen cerca de mí?

Sino apoyar una decisión más completa:

> ¿Qué recorrido puedo realizar considerando dónde empiezo, dónde necesito terminar, cuánto tiempo tengo, qué me interesa, cuánto aproximadamente deseo gastar y cómo voy a movilizarme?

Por ello, el producto combina información de lugares y desplazamientos con las condiciones proporcionadas por el usuario para construir alternativas de planificación.

---

## 5. Flujo principal del producto

El flujo principal de Chaski puede resumirse de la siguiente manera:

```text
CONFIGURAR
    ↓
GENERAR
    ↓
COMPARAR
    ↓
ELEGIR
    ↓
RECORRER
    ↓
REGISTRAR
```

### Configurar

El usuario proporciona las condiciones de la salida:

- punto de inicio;
- intervalo de tiempo disponible;
- intereses;
- rango de gasto;
- movilidad;
- comportamiento del punto final.

### Generar

El sistema obtiene lugares candidatos y analiza cuáles pueden formar parte de recorridos compatibles con las condiciones establecidas.

### Comparar

Se presentan hasta tres alternativas viables cuando sea posible generarlas.

Cada alternativa muestra información que permita compararla con las demás, como:

- lugares incluidos;
- duración estimada;
- gasto estimado;
- recorrido;
- nivel interno de compatibilidad.

### Elegir

El usuario selecciona la alternativa que desea realizar.

### Recorrer

El plan seleccionado pasa a ser el recorrido activo del usuario.

Durante su ejecución, el usuario puede registrar el progreso de las diferentes paradas.

### Registrar

Una vez terminado o cancelado el recorrido, la información correspondiente permanece disponible como parte de su historial cuando corresponda.

---

## 6. Principios del producto

### 6.1. Viabilidad antes que cantidad

Chaski no tiene como objetivo mostrar siempre tres alternativas.

Si las condiciones ingresadas no permiten construir tres recorridos suficientemente viables, el sistema podrá presentar una cantidad menor.

### 6.2. Las condiciones del usuario no se modifican silenciosamente

El sistema no debe ampliar automáticamente el tiempo, presupuesto o condiciones indicadas únicamente para conseguir generar un recorrido.

Cuando no existan alternativas viables, se deberá informar al usuario.

### 6.3. El rango de gasto es un criterio de compatibilidad

El rango de gasto indicado por el usuario representa una preferencia para evaluar alternativas y no necesariamente un límite económico estricto.

Los costos mostrados por el sistema son estimaciones y pueden existir lugares o desplazamientos cuyo costo no pueda determinarse.

### 6.4. Los tiempos son estimaciones

Los tiempos de desplazamiento y duración de las actividades utilizados durante la planificación son valores estimados.

Chaski no garantiza tiempos exactos de llegada o permanencia.

### 6.5. Diversidad de alternativas

Cuando existan suficientes recorridos viables, Chaski procurará presentar alternativas diferentes entre sí en lugar de mostrar varias opciones compuestas prácticamente por los mismos lugares.

### 6.6. El usuario conserva la decisión final

La valoración realizada por Chaski sirve para ordenar y presentar alternativas.

La selección final del recorrido corresponde siempre al usuario.

---

## 7. Alcance inicial del producto

La primera versión se desarrollará considerando:

- Lima Metropolitana como área inicial;
- aplicación móvil;
- usuarios autenticados;
- conjunto controlado de lugares;
- generación determinística de recorridos;
- estimaciones de tiempo y gasto;
- integración con servicios geográficos;
- seguimiento manual del progreso del recorrido;
- historial de recorridos;
- funciones básicas de administración.

Las características específicas incluidas y excluidas de la versión inicial se detallan en [Alcance del producto](./alcance.md).

---

## 8. Visión de evolución

La arquitectura de Chaski deberá permitir que en versiones posteriores puedan evaluarse nuevas fuentes de información, criterios de planificación o mecanismos de generación sin requerir modificar completamente el núcleo del producto.

Estas posibilidades representan líneas de evolución y **no forman parte de los compromisos de la versión inicial**.