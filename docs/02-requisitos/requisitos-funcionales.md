# Requisitos funcionales — Chaski

## 1. Propósito

Este documento define los requisitos funcionales de Chaski para su primera versión.

Los requisitos describen las capacidades que deberá proporcionar el sistema a sus usuarios y administradores.

Las reglas y restricciones asociadas se documentan por separado en [Reglas de negocio](./reglas-negocio.md).

---

## 2. Convenciones

Cada requisito utiliza un identificador con el formato:

`RFXX`

donde `XX` corresponde al número correlativo del requisito.

### Prioridad

- **Alta:** necesaria para el flujo principal de la aplicación.
- **Media:** necesaria para completar funcionalidades complementarias.
- **Baja:** funcionalidad secundaria que no afecta el flujo principal.

---

# 3. Requisitos funcionales

## RF01 — Registrar usuario

**Prioridad:** Alta

El sistema deberá permitir que una persona registre una cuenta proporcionando la información requerida para su identificación y acceso a la aplicación.

---

## RF02 — Autenticar usuario

**Prioridad:** Alta

El sistema deberá permitir que los usuarios registrados inicien y cierren sesión mediante el mecanismo de autenticación definido para la aplicación.

---

## RF03 — Gestionar perfil y preferencias

**Prioridad:** Media

El sistema deberá permitir al usuario consultar y actualizar la información de su perfil y sus preferencias generales de planificación.

Las preferencias podrán incluir:

- categorías de interés;
- forma de movilidad preferida;
- rango de gasto habitual.

Las condiciones indicadas en una solicitud específica tendrán prioridad sobre las preferencias generales almacenadas.

---

## RF04 — Crear solicitud de planificación

**Prioridad:** Alta

El sistema deberá permitir al usuario crear una solicitud de planificación para una salida.

La solicitud deberá registrar como mínimo:

- fecha y hora de inicio;
- fecha y hora de finalización;
- ubicación inicial;
- intereses seleccionados;
- rango de gasto;
- forma de movilidad;
- comportamiento esperado del punto final.

---

## RF05 — Configurar punto final

**Prioridad:** Alta

El sistema deberá permitir al usuario establecer cómo desea finalizar su recorrido mediante una de las siguientes opciones:

1. regresar al punto de inicio;
2. finalizar en la última parada del recorrido;
3. finalizar en otra ubicación indicada por el usuario.

Cuando se seleccione una ubicación diferente, el usuario deberá proporcionar el punto final correspondiente.

---

## RF06 — Generar alternativas de recorrido

**Prioridad:** Alta

El sistema deberá generar alternativas de recorrido utilizando las condiciones registradas en una solicitud de planificación.

La generación deberá considerar:

- ubicación inicial;
- ubicación final cuando corresponda;
- tiempo disponible;
- intereses;
- rango de gasto;
- forma de movilidad;
- lugares disponibles;
- horarios de los lugares;
- duración estimada de las actividades;
- tiempos estimados de desplazamiento.

El sistema podrá generar hasta tres alternativas finales.

---

## RF07 — Evaluar y priorizar alternativas

**Prioridad:** Alta

El sistema deberá evaluar las alternativas viables utilizando criterios relacionados con:

- intereses del usuario;
- utilización del tiempo disponible;
- compatibilidad con el rango de gasto;
- desplazamiento requerido.

Las alternativas deberán ordenarse según su valoración antes de ser presentadas al usuario.

---

## RF08 — Controlar diversidad de alternativas

**Prioridad:** Media

El sistema deberá procurar que las alternativas finales presentadas al usuario sean suficientemente diferentes entre sí cuando existan suficientes recorridos viables.

---

## RF09 — Consultar alternativas generadas

**Prioridad:** Alta

El sistema deberá permitir al usuario consultar las alternativas generadas para una solicitud.

Cada alternativa deberá presentar información suficiente para facilitar su comparación con las demás.

---

## RF10 — Consultar detalle de un plan

**Prioridad:** Alta

El sistema deberá permitir consultar el detalle de una alternativa de recorrido, incluyendo:

- paradas;
- orden de visita;
- duración estimada;
- rango de gasto estimado;
- información de los lugares;
- desplazamientos estimados.

---

## RF11 — Visualizar recorrido geográficamente

**Prioridad:** Alta

El sistema deberá mostrar en un mapa:

- punto de inicio;
- paradas del recorrido;
- punto final cuando corresponda.

Cuando el servicio geográfico utilizado lo permita, también se mostrará una representación del trayecto entre los puntos del recorrido.

---

## RF12 — Seleccionar plan

**Prioridad:** Alta

El sistema deberá permitir al usuario seleccionar una de las alternativas generadas para convertirla en el plan elegido para la salida.

---

## RF13 — Iniciar recorrido

**Prioridad:** Alta

El sistema deberá permitir iniciar un plan previamente seleccionado.

Al iniciar el plan, este se convertirá en el recorrido activo del usuario.

---

## RF14 — Consultar recorrido activo

**Prioridad:** Alta

El sistema deberá permitir al usuario consultar durante la ejecución:

- las paradas del recorrido;
- su orden;
- información de los lugares;
- desplazamientos;
- estado de cada parada;
- progreso general del recorrido.

---

## RF15 — Registrar progreso de las paradas

**Prioridad:** Alta

El sistema deberá permitir al usuario registrar manualmente el progreso de las paradas del recorrido.

Una parada pendiente podrá ser:

- marcada como visitada;
- marcada como omitida.

---

## RF16 — Finalizar o cancelar recorrido

**Prioridad:** Alta

El sistema deberá permitir finalizar un recorrido cuando se cumplan las condiciones establecidas por las reglas de negocio.

Asimismo, deberá permitir cancelar un plan seleccionado o un recorrido que se encuentre en ejecución.

---

## RF17 — Consultar historial de recorridos

**Prioridad:** Media

El sistema deberá permitir al usuario consultar los recorridos que formen parte de su historial.

Para cada recorrido se podrá presentar información resumida como:

- nombre del plan;
- fecha;
- estado;
- duración estimada;
- rango de gasto estimado;
- cantidad de paradas.

El usuario podrá consultar posteriormente el detalle de un recorrido registrado.

---

## RF18 — Gestionar lugares

**Prioridad:** Media

El sistema deberá permitir al administrador gestionar los lugares utilizados para la generación de recorridos.

El administrador podrá:

- registrar lugares;
- consultar lugares;
- actualizar información;
- gestionar horarios;
- asociar categorías;
- asociar etiquetas;
- activar lugares;
- desactivar lugares.

---

## RF19 — Gestionar categorías y etiquetas

**Prioridad:** Media

El sistema deberá permitir al administrador gestionar las categorías y etiquetas utilizadas para clasificar los lugares.

El administrador podrá:

- registrar;
- consultar;
- modificar;
- activar;
- desactivar categorías y etiquetas.

---

## RF20 — Consultar reportes

**Prioridad:** Media

El sistema deberá permitir al administrador consultar información resumida sobre el uso de la aplicación.

Los reportes podrán incluir:

- cantidad de planes generados;
- cantidad de recorridos completados;
- cantidad de recorridos cancelados;
- categorías más seleccionadas;
- lugares incluidos con mayor frecuencia en los planes;
- lugares registrados con mayor frecuencia como visitados.

Los reportes tendrán carácter informativo y serán obtenidos a partir de la información registrada por el sistema.

---

## RF21 — Consultar el padrón de usuarios

**Prioridad:** Alta

El sistema deberá permitir que un administrador consulte el listado completo de cuentas registradas, con su nombre, correo, rol y estado de acceso, y que pueda buscar por nombre o correo y filtrar por rol y por estado.

---

## RF22 — Editar los datos y el rol de un usuario

**Prioridad:** Alta

El sistema deberá permitir que un administrador modifique el nombre visible y el rol de una cuenta, validando que el nombre tenga entre 2 y 60 caracteres y que el rol sea uno de los valores admitidos.

El sistema no deberá permitir que un administrador modifique su propio rol ni que desactive su propia cuenta.

---

## RF23 — Dar de baja una cuenta

**Prioridad:** Alta

El sistema deberá permitir que un administrador dé de baja una cuenta de usuario, de modo que se anule su nombre visible y se bloquee su acceso, conservando el registro histórico asociado a esa cuenta.

La baja requerirá una confirmación explícita del administrador antes de ejecutarse.

---

## RF24 — Supervisar las solicitudes de plan

**Prioridad:** Media

El sistema deberá permitir que un administrador consulte las solicitudes de planificación registradas por todos los usuarios, indicando el usuario, la ventana horaria, la movilidad, el presupuesto y los intereses declarados, y que pueda eliminarlas con confirmación explícita.

---

## RF25 — Supervisar las expediciones

**Prioridad:** Media

El sistema deberá permitir que un administrador consulte las expediciones registradas por todos los usuarios, indicando el estado de la expedición y el avance de paradas visitadas, y que pueda eliminarlas con confirmación explícita.

---

## RF26 — Administrar las fotografías de los destinos

**Prioridad:** Alta

El sistema deberá permitir que un administrador incorpore fotografías a un destino del catálogo, tomándolas con la cámara del dispositivo o eligiéndolas de la galería, y deberá validar que el archivo sea una imagen JPEG, PNG o WebP de hasta 5 MB antes de almacenarlo.

---

## RF27 — Marcar la portada y eliminar fotografías de un destino

**Prioridad:** Media

El sistema deberá permitir que un administrador designe una de las fotografías de un destino como portada y que elimine fotografías existentes, retirando también el archivo del almacenamiento para no dejar archivos huérfanos.

---

## RF28 — Consultar el historial de acciones administrativas

**Prioridad:** Alta

El sistema deberá registrar automáticamente cada modificación hecha por un administrador sobre cuentas, solicitudes de plan y expediciones, indicando quién la realizó, qué acción ejecutó, sobre qué registro y en qué momento, y deberá permitir que un administrador consulte ese historial de forma paginada.

El registro de estas acciones no dependerá de la aplicación: se generará en la base de datos al producirse el cambio.

---

## RF29 — Consultar las métricas de uso

**Prioridad:** Media

El sistema deberá permitir que un administrador consulte un resumen del uso de la aplicación que incluya la cantidad de cuentas registradas y activas, las solicitudes de planificación, las expediciones registradas y completadas, las paradas visitadas, los destinos activos y los destinos con fotografía de portada.

---

## RF30 — Avisar la cercanía de la siguiente parada

**Prioridad:** Media

El sistema deberá avisar al usuario cuando se encuentre a menos de una distancia configurable de la siguiente parada pendiente del recorrido activo, indicando el nombre del destino y la distancia restante, y deberá ofrecer la opción de marcarla como visitada.

El aviso dependerá del permiso de ubicación del dispositivo y su ausencia no deberá impedir el uso del recorrido.

---

## RF31 — Recordar la próxima parada del recorrido

**Prioridad:** Media

El sistema deberá programar un recordatorio para la siguiente parada pendiente del recorrido activo, que se notifique minutos antes de la hora de llegada estimada, y deberá reprogramarlo cuando cambie la parada pendiente.

---

## RF32 — Tomar una fotografía con la cámara del dispositivo

**Prioridad:** Media

El sistema deberá permitir que el usuario incorpore una fotografía de perfil tomándola con la cámara del dispositivo o eligiéndola de la galería, solicitando el permiso correspondiente en el momento de usarla y no al iniciar la aplicación.

---

## RF33 — Optimizar el orden geográfico de las paradas

**Prioridad:** Alta

El sistema deberá ordenar las paradas de cada plan generado de modo que se reduzca el desplazamiento total del recorrido, manteniendo fijas la primera parada y las condiciones de horario, presupuesto y viabilidad que dieron origen al plan.

Cuando ningún orden alternativo resulte factible o no represente una mejora apreciable, el sistema deberá conservar el orden original.

---

# 4. Relación con los casos de uso

| Requisito | Caso de uso principal |
|---|---|
| RF01 | CU01 — Gestionar cuenta y preferencias |
| RF02 | CU01 — Gestionar cuenta y preferencias |
| RF03 | CU01 — Gestionar cuenta y preferencias |
| RF04 | CU02 — Crear solicitud de plan |
| RF05 | CU02 — Crear solicitud de plan |
| RF06 | CU03 — Generar alternativas |
| RF07 | CU03 — Generar alternativas |
| RF08 | CU03 — Generar alternativas |
| RF09 | CU04 — Consultar y seleccionar plan |
| RF10 | CU04 — Consultar y seleccionar plan |
| RF11 | CU04 — Consultar y seleccionar plan |
| RF12 | CU04 — Consultar y seleccionar plan |
| RF13 | CU05 — Gestionar recorrido activo |
| RF14 | CU05 — Gestionar recorrido activo |
| RF15 | CU05 — Gestionar recorrido activo |
| RF16 | CU05 — Gestionar recorrido activo |
| RF17 | CU06 — Consultar historial |
| RF18 | CU07 — Gestionar lugares |
| RF19 | CU08 — Gestionar categorías y etiquetas |
| RF20 | CU09 — Consultar reportes |

---

| RF21 | CU10 — Administrar usuarios |
| RF22 | CU10 — Administrar usuarios |
| RF23 | CU10 — Administrar usuarios |
| RF24 | CU11 — Supervisar planes y expediciones |
| RF25 | CU11 — Supervisar planes y expediciones |
| RF26 | CU12 — Administrar fotografías de destinos |
| RF27 | CU12 — Administrar fotografías de destinos |
| RF28 | CU13 — Auditar las acciones de intendencia |
| RF29 | CU13 — Auditar las acciones de intendencia |
| RF30 | CU05 — Gestionar recorrido activo |
| RF31 | CU05 — Gestionar recorrido activo |
| RF32 | CU01 — Gestionar cuenta y preferencias |
| RF33 | CU03 — Generar alternativas |


# 5. Fuera del alcance funcional

Los siguientes elementos no constituyen requisitos funcionales de la primera versión:

- reservas;
- pagos;
- compra de entradas;
- solicitud de taxis;
- navegación giro a giro;
- precios exactos de transporte;
- información de tráfico o aforo en tiempo real;
- chat entre usuarios;
- funciones sociales;
- verificación de visitas mediante QR;
- regeneración automática del recorrido durante su ejecución;
- inteligencia artificial o Machine Learning.

Estas exclusiones se encuentran desarrolladas en [Alcance del producto](../01-producto/alcance.md).