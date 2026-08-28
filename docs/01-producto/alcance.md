# Alcance del producto — Chaski

## 1. Propósito

Este documento establece las funcionalidades contempladas para la primera versión de Chaski y delimita aquellas características que no forman parte del alcance inicial.

El objetivo es mantener una versión realizable dentro del contexto académico del proyecto y evitar incorporar funcionalidades que no sean necesarias para validar el flujo principal de planificación.

---

# 2. Alcance funcional

## 2.1. Gestión de usuarios

La aplicación permitirá:

- registro de usuarios;
- inicio y cierre de sesión;
- consulta y actualización del perfil;
- configuración de preferencias generales.

La autenticación será gestionada mediante el servicio seleccionado para el backend del proyecto.

---

## 2.2. Configuración de una salida

El usuario podrá crear una solicitud de planificación indicando:

- ubicación de inicio;
- fecha y hora de inicio;
- fecha y hora de finalización;
- entre una y tres categorías de interés;
- rango aproximado de gasto;
- forma de movilidad;
- comportamiento esperado del punto final.

El punto final podrá configurarse como:

1. regresar al punto de inicio;
2. finalizar en la última parada;
3. finalizar en otra ubicación indicada por el usuario.

---

## 2.3. Catálogo de lugares

El sistema utilizará un conjunto controlado de lugares que contendrá información necesaria para la generación de recorridos, incluyendo:

- nombre;
- descripción;
- ubicación;
- categorías;
- etiquetas;
- horarios;
- duración sugerida de visita;
- rango estimado de gasto;
- estado del lugar.

La disponibilidad de un lugar para nuevos recorridos dependerá de que se encuentre activo y posea la información mínima necesaria.

---

## 2.4. Generación de alternativas

Chaski generará alternativas de recorrido a partir de las condiciones proporcionadas por el usuario.

Durante este proceso se considerarán:

- intereses seleccionados;
- ubicación inicial;
- ubicación final cuando corresponda;
- tiempo disponible;
- horarios de los lugares;
- duración estimada de las actividades;
- tiempos de desplazamiento;
- rango de gasto;
- forma de movilidad.

El sistema podrá presentar **hasta tres alternativas**.

No se garantiza la generación de tres recorridos cuando no existan suficientes alternativas que cumplan las condiciones obligatorias.

---

## 2.5. Evaluación de alternativas

Las alternativas viables podrán ser evaluadas considerando criterios como:

- cobertura de los intereses seleccionados;
- aprovechamiento del tiempo disponible;
- compatibilidad con el rango de gasto;
- proporción de tiempo destinada al desplazamiento.

El resultado de esta evaluación será utilizado para ordenar las alternativas.

La valoración representa una medida interna de compatibilidad y no una probabilidad ni una garantía de satisfacción.

---

## 2.6. Diversidad de resultados

Cuando existan suficientes alternativas viables, el sistema procurará evitar presentar recorridos excesivamente similares.

La diversidad se evaluará considerando principalmente los lugares incluidos en cada recorrido.

---

## 2.7. Visualización de alternativas

El usuario podrá consultar información de los planes generados, incluyendo:

- lugares incluidos;
- orden de las paradas;
- duración estimada;
- rango de gasto estimado;
- desplazamientos;
- información de los lugares;
- representación geográfica del recorrido cuando el servicio utilizado lo permita.

---

## 2.8. Selección del recorrido

El usuario podrá seleccionar una de las alternativas generadas.

Una vez seleccionado, el plan podrá ser iniciado como recorrido activo.

El sistema permitirá como máximo un recorrido activo por usuario.

---

## 2.9. Seguimiento del recorrido

Durante un recorrido activo, el usuario podrá:

- consultar las paradas;
- visualizar el orden previsto;
- marcar una parada como visitada;
- marcar una parada como omitida;
- consultar el progreso;
- finalizar el recorrido cuando se cumplan las condiciones establecidas;
- cancelar el recorrido.

El registro del progreso será manual en la primera versión.

---

## 2.10. Historial

El usuario podrá consultar información de sus recorridos anteriores.

El historial estará compuesto por planes que hayan alcanzado estados asociados a su ejecución, incluyendo recorridos iniciados, completados o cancelados según las reglas de negocio establecidas.

Las alternativas que permanezcan únicamente como planes generados no serán consideradas recorridos realizados.

---

## 2.11. Administración

El sistema contemplará funcionalidades administrativas básicas para:

- registrar lugares;
- actualizar lugares;
- activar o desactivar lugares;
- gestionar horarios;
- gestionar categorías;
- gestionar etiquetas;
- consultar información resumida mediante reportes.

---

# 3. Alcance geográfico

La primera versión del proyecto estará orientada a **Lima Metropolitana**.

El conjunto de lugares utilizado durante el desarrollo y las pruebas será controlado por el equipo.

La ampliación hacia otras ciudades o regiones queda fuera del alcance inicial.

---

# 4. Alcance tecnológico

La solución contempla:

- aplicación móvil desarrollada con React Native;
- uso de Expo como entorno de desarrollo;
- backend mediante servicios de Supabase;
- PostgreSQL para persistencia;
- autenticación de usuarios;
- funciones del lado del servidor para operaciones que requieran lógica de negocio;
- integración con un servicio geográfico externo;
- consumo de información de rutas y desplazamientos.

La selección definitiva del proveedor geográfico estará sujeta a la evaluación técnica correspondiente.

---

# 5. Limitaciones y exclusiones

La versión inicial de Chaski **no contempla**:

- reservas en establecimientos;
- compra de entradas;
- pagos desde la aplicación;
- integración con servicios de taxi o transporte privado para solicitar viajes;
- precios exactos de servicios de transporte;
- navegación GPS giro a giro;
- información exacta de tráfico en tiempo real;
- información de aforo o colas en tiempo real;
- clasificación o garantía de seguridad de zonas;
- redes sociales internas;
- chat entre usuarios;
- publicación social de recorridos;
- verificación automática de visitas mediante códigos QR;
- generación dinámica de un nuevo recorrido cuando una parada sea omitida;
- funcionamiento completamente sin conexión;
- inteligencia artificial o Machine Learning para la generación de planes;
- expansión nacional en la primera versión.

---

# 6. Restricciones de las estimaciones

## Tiempo

Los tiempos utilizados para planificar los recorridos representan estimaciones obtenidas a partir de los datos disponibles.

El sistema no garantiza que el tiempo real de desplazamiento o permanencia sea exactamente igual al estimado.

## Gasto

Los valores económicos representan rangos aproximados.

Un costo igual a `0` representa una actividad identificada como gratuita, mientras que un costo desconocido deberá ser tratado como información no disponible y no como gratuidad.

El rango de gasto ingresado por el usuario será utilizado como criterio de compatibilidad y no necesariamente como una restricción absoluta.

## Lugares

La información sobre lugares dependerá de los datos disponibles en el catálogo y de las fuentes utilizadas.

Los lugares desactivados no serán considerados para la generación de nuevos recorridos.

---

# 7. Límites de la generación

La versión inicial utilizará un mecanismo determinístico de generación y evaluación de recorridos.

La implementación podrá establecer parámetros configurables para controlar la complejidad de la búsqueda, como:

- número máximo de lugares candidatos iniciales;
- cantidad de alternativas conservadas durante la búsqueda;
- número máximo de paradas por recorrido;
- cantidad máxima de resultados finales.

Estos parámetros corresponden a decisiones de implementación y podrán ajustarse durante las pruebas sin modificar el propósito funcional del producto.

---

# 8. Evolución futura

Fuera de la primera versión podrán evaluarse funcionalidades adicionales a partir de los resultados obtenidos durante el desarrollo y las pruebas.

La inclusión de una funcionalidad en esta sección no implica un compromiso de implementación.

Entre las posibilidades de evolución pueden encontrarse:

- ampliación del catálogo y cobertura geográfica;
- nuevas formas de movilidad;
- nuevas fuentes de información;
- mecanismos adicionales de personalización;
- mejoras en la generación de recorridos;
- información contextual adicional;
- nuevas herramientas administrativas.

Las funcionalidades futuras deberán evaluarse nuevamente en términos de utilidad, disponibilidad de datos, costo y complejidad técnica.