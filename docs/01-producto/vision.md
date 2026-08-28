# Visión del producto — Chaski

## 1. Descripción

**Chaski** es una aplicación móvil orientada a facilitar la planificación inteligente y personalizada de salidas urbanas dentro de **Lima Metropolitana**.

La aplicación transforma las condiciones y preferencias proporcionadas por el usuario en alternativas de recorridos que pueden realizarse de manera realista dentro del tiempo y presupuesto disponibles.

```mermaid
mindmap
  root((🚌 Chaski))
    Entradas del Usuario
      📍 Ubicación inicial y retorno
      ⏰ Ventana horaria disponible
      💰 Rango de gasto estimado
      🚶 Modalidad de movilidad
      🎯 1 a 3 Intereses prioritarios
    Procesamiento Inteligente
      🔍 Filtro geoespacial de catálogo
      🗺️ Matriz OD de tiempos de traslado
      ⚡ Beam Search determinístico
      ⚖️ Puntuación multicriterio
    Resultado al Usuario
      📱 Hasta 3 alternativas viables
      🚶 Seguimiento y check-in
      📜 Registro en historial
```

---

## 2. Problema que aborda

Planificar una salida suele requerir consultar múltiples fuentes fragmentadas: mapas para rutas, redes sociales para recomendaciones, páginas web para horarios y estimaciones empíricas para prever gastos y congestión vehicular.

El reto principal no es únicamente encontrar lugares atractivos, sino **determinar cómo combinarlos secuencialmente** dentro de un itinerario continuo y compatible con las restricciones de la persona:

> **El dilema tradicional:**
> ¿Cómo enlazar una cafetería en Barranco con una galería de arte en Miraflores sin exceder 3 horas disponibles, respetando mi presupuesto y terminando en mi punto de retorno?

Chaski resuelve esta fricción centralizando los parámetros y automatizando la generación de itinerarios ordenados.

---

## 3. Usuarios Objetivo y Roles

```mermaid
graph LR
    subgraph Actores["👥 Roles del Sistema"]
        U["👤 Usuario Final\n(Planifica, compara, recorre y registra)"]
        A["👨‍💼 Administrador\n(Gestiona catálogo, horarios y taxonomía)"]
    end

    subgraph Modulos["📱 Capacidades"]
        M1["Configurar & Generar"]
        M2["Recorrido Activo & Historial"]
        M3["Gestión de Lugares & Categorías"]
    end

    U --> M1
    U --> M2
    A --> M3

    classDef uStyle fill:#E1F5FE,stroke:#0288D1,stroke-width:1.5px;
    classDef aStyle fill:#E8F5E9,stroke:#2E7D32,stroke-width:1.5px;
    class U,M1,M2 uStyle;
    class A,M3 aStyle;
```

---

## 4. Propuesta de Valor

Chaski va más allá de un simple directorio geográfico (*«¿Qué hay cerca de mí?»*). Su valor radica en responder una pregunta multidimensional:

> **«¿Qué recorrido optimizado puedo realizar considerando dónde empiezo, a qué hora debo terminar, mis intereses, mi presupuesto y mi forma de transporte?»**

---

## 5. Flujo Principal del Producto

```mermaid
flowchart LR
    A["⚙️ 1. Configurar\nInicio, fin, tiempo,\ngasto y categorías"] --> B["⚡ 2. Generar\nAlgoritmo Beam Search\ny matriz OD"]
    B --> C["⚖️ 3. Comparar\nHasta 3 planes con\nscore y métricas"]
    C --> D["🎯 4. Elegir\nSeleccionar alternativa\npreferida"]
    D --> E["🚶 5. Recorrer\nCheck-in de paradas\ny navegación"]
    E --> F["📜 6. Registrar\nGuardado en historial\ny evaluación"]

    style A fill:#E3F2FD,stroke:#1565C0
    style B fill:#EDE7F6,stroke:#512DA8
    style C fill:#FFF8E1,stroke:#F57F17
    style D fill:#E0F2F1,stroke:#00695C
    style E fill:#FBE9E7,stroke:#D84315
    style F fill:#E8F5E9,stroke:#2E7D32
```

### Desglose de Etapas

| Etapa | Responsabilidad del Sistema | Acción del Usuario |
|---|---|---|
| **1. Configurar** | Valida restricciones (hora fin > inicio, 1–3 categorías, gasto $\ge 0$). | Ingresa ubicación, horario, categorías, presupuesto y movilidad. |
| **2. Generar** | Consulta catálogo, calcula matriz OD y ejecuta Beam Search en Edge Function. | Presiona el botón de generación y espera el resultado ($\le 3$ s). |
| **3. Comparar** | Muestra métricas de cada plan: duración total, gasto estimado y score de afinidad. | Revisa las opciones en tarjetas comparativas y visualiza las paradas en mapa. |
| **4. Elegir** | Cambia el estado del plan seleccionado a `SELECCIONADO`. | Confirma la opción elegida para su salida. |
| **5. Recorrer** | Permite registrar progreso (`VISITADA` / `OMITIDA`) y mantiene 1 salida activa. | Avanza físicamente por las paradas e interactúa con la app. |
| **6. Registrar** | Transiciona el plan a `COMPLETADO` o `CANCELADO` y lo almacena en historial. | Finaliza el recorrido y consulta el resumen en su historial personal. |

---

## 6. Principios Rectores del Producto

> [!IMPORTANT]
> **6.1. Viabilidad antes que cantidad:** Chaski no forzará la entrega de 3 planes si no existen suficientes rutas seguras y viables dentro del horario indicado. Preferirá entregar 1 o 2 de alta calidad a 3 con inconsistencias.

> [!IMPORTANT]
> **6.2. No modificación silenciosa de restricciones:** El sistema jamás ampliará automáticamente el tiempo o presupuesto del usuario para forzar un resultado. Si no hay opciones, lo informará con transparencia.

> [!NOTE]
> **6.3. Gasto y tiempo como estimaciones:** Los costos y traslados son aproximaciones referenciales basadas en promedios y datos viales; no constituyen garantías absolutas de cobro o puntualidad.

> [!TIP]
> **6.4. Diversidad de alternativas:** Mediante el índice de similitud de Jaccard, el sistema evita proponer planes que solo varían en una parada secundaria, garantizando opciones genuinamente distintas.

> [!NOTE]
> **6.5. El usuario conserva la decisión final:** El ordenamiento y puntuación del algoritmo son herramientas de orientación; la elección definitiva siempre pertenece al usuario.

---

## 7. Documentos Relacionados

* [`problema-y-objetivos.md`](./problema-y-objetivos.md) — Justificación metodológica y formulación PE/OE.
* [`alcance.md`](./alcance.md) — Fronteras funcionales y técnicas del MVP.
* [`../04-arquitectura/arquitectura-general.md`](../04-arquitectura/arquitectura-general.md) — Diseño de capas y componentes del sistema.