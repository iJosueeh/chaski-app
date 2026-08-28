# Casos de uso — Chaski

## 1. Propósito

Este documento describe los principales casos de uso de Chaski para su primera versión.

Los casos de uso representan las interacciones principales entre los actores y el sistema y se encuentran relacionados con los requisitos funcionales definidos en:

- [`requisitos-funcionales.md`](../02-requisitos/requisitos-funcionales.md)
- [`reglas-negocio.md`](../02-requisitos/reglas-negocio.md)
- [`trazabilidad.md`](../02-requisitos/trazabilidad.md)

---

# 2. Actores

## Usuario

Persona registrada en la aplicación que utiliza Chaski para configurar salidas, generar alternativas de recorrido, seleccionar planes, registrar su progreso y consultar recorridos anteriores.

## Administrador

Usuario con permisos administrativos encargado de mantener la información utilizada por el sistema para la generación de recorridos.

Puede gestionar:

- lugares;
- horarios;
- categorías;
- etiquetas;
- reportes administrativos.

---

# 3. Resumen de casos de uso

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

# 4. CU01 — Gestionar cuenta y preferencias

## Actor principal

Usuario.

## Objetivo

Permitir que el usuario gestione su acceso a la aplicación, su información básica y sus preferencias generales.

## Precondiciones

Para consultar o modificar preferencias, el usuario deberá encontrarse autenticado.

## Flujo principal

1. El usuario accede a la aplicación.
2. El usuario puede registrarse si todavía no dispone de una cuenta.
3. El usuario inicia sesión.
4. El sistema valida la autenticación.
5. El usuario accede a su perfil.
6. El usuario consulta o modifica sus preferencias.
7. El sistema valida la información ingresada.
8. El sistema guarda los cambios.
9. El sistema confirma la operación.

## Flujos alternativos

### Registro con correo existente

Si el correo ya se encuentra asociado a otra cuenta:

1. El sistema rechaza el registro.
2. Se informa al usuario que el correo ya se encuentra registrado.

### Datos inválidos

Si alguno de los datos proporcionados no cumple las condiciones requeridas:

1. El sistema no guarda los cambios.
2. Se informa al usuario qué información debe corregir.

## Postcondiciones

La información válida del usuario queda almacenada.

## Requisitos relacionados

- RF01
- RF02
- RF03

## Reglas relacionadas

- USR-01
- USR-02
- USR-03
- USR-04

---

# 5. CU02 — Crear solicitud de plan

## Actor principal

Usuario.

## Objetivo

Registrar las condiciones específicas que serán utilizadas para generar alternativas de recorrido.

## Precondiciones

- El usuario debe encontrarse autenticado.

## Flujo principal

1. El usuario inicia la creación de una nueva salida.
2. El sistema muestra las condiciones configurables.
3. El usuario indica la ubicación inicial.
4. El usuario define el intervalo de tiempo disponible.
5. Selecciona entre una y tres categorías de interés.
6. Indica un rango aproximado de gasto.
7. Selecciona una forma de movilidad.
8. Define el comportamiento del punto final.
9. Si selecciona otra ubicación, proporciona el punto final.
10. El usuario confirma la solicitud.
11. El sistema valida los datos.
12. El sistema registra la solicitud.
13. El sistema deja la solicitud disponible para generar alternativas.

## Flujos alternativos

### Intervalo temporal inválido

Si la hora final no es posterior a la inicial:

1. El sistema rechaza la solicitud.
2. Solicita corregir el intervalo.

### Cantidad de categorías inválida

Si el usuario no selecciona entre una y tres categorías:

1. El sistema no registra la solicitud.
2. Solicita corregir la selección.

### Rango de gasto inválido

Si los valores son negativos o el mínimo supera al máximo:

1. El sistema no registra la solicitud.
2. Informa el error.

### Punto final faltante

Si se selecciona finalizar en otra ubicación y no se proporciona una ubicación válida:

1. El sistema rechaza la solicitud.
2. Solicita ingresar el punto final.

## Postcondiciones

Se registra una solicitud válida asociada al usuario.

## Requisitos relacionados

- RF04
- RF05

## Reglas relacionadas

- USR-04
- SOL-01 a SOL-08

---

# 6. CU03 — Generar alternativas

## Actor principal

Usuario.

## Objetivo

Generar alternativas de recorrido compatibles con las condiciones de una solicitud.

## Precondiciones

- El usuario debe encontrarse autenticado.
- Debe existir una solicitud válida.
- La solicitud debe pertenecer al usuario.
- Debe existir información disponible de lugares.

## Flujo principal

1. El usuario solicita generar alternativas.
2. El sistema obtiene la solicitud correspondiente.
3. El sistema recupera los lugares candidatos.
4. Se descartan los lugares que no cumplan las condiciones mínimas.
5. El sistema obtiene estimaciones de desplazamiento entre los puntos necesarios.
6. Se construye el contexto de generación.
7. El sistema genera posibles recorridos.
8. Durante la generación se validan horarios, desplazamientos, tiempo disponible y demás restricciones obligatorias.
9. Se descartan los recorridos no viables.
10. Las alternativas viables son evaluadas.
11. El sistema ordena los recorridos según su nivel de compatibilidad.
12. Se controla la similitud entre las alternativas.
13. Se seleccionan hasta tres resultados.
14. Las alternativas finales son almacenadas.
15. El sistema muestra los resultados al usuario.

## Flujos alternativos

### No existen lugares candidatos

1. El sistema determina que no existen lugares suficientes para realizar la generación.
2. No se crean planes inválidos.
3. Se informa al usuario que no se encontraron alternativas.

### No existen recorridos viables

1. Los lugares candidatos son procesados.
2. Ningún recorrido satisface las restricciones obligatorias.
3. El sistema devuelve cero alternativas.
4. Se informa al usuario.

### Error del servicio geográfico

Si no es posible obtener la información necesaria de desplazamiento:

1. El sistema detiene la generación.
2. No utiliza valores de desplazamiento inventados.
3. Informa que no fue posible completar temporalmente la operación.

## Postcondiciones

Pueden quedar almacenadas entre cero y tres alternativas finales.

Solo las alternativas seleccionadas para presentación deberán persistirse como planes finales.

## Requisitos relacionados

- RF06
- RF07
- RF08

## Reglas relacionadas

- LUG-01 a LUG-05
- GEN-01 a GEN-10
- EVA-01 a EVA-13

---

# 7. CU04 — Consultar y seleccionar plan

## Actor principal

Usuario.

## Objetivo

Permitir que el usuario consulte las alternativas generadas, compare sus características y seleccione una.

## Precondiciones

- El usuario debe encontrarse autenticado.
- Deben existir alternativas generadas para una solicitud.

## Flujo principal

1. El usuario consulta las alternativas disponibles.
2. El sistema obtiene los planes correspondientes a la solicitud.
3. Se muestran las alternativas.
4. El usuario puede consultar el detalle de una alternativa.
5. El sistema muestra:
   - paradas;
   - duración;
   - rango de gasto;
   - desplazamientos;
   - información de lugares;
   - representación geográfica cuando corresponda.
6. El usuario selecciona una alternativa.
7. El sistema valida que el plan se encuentre en estado `GENERADO`.
8. El plan cambia a `SELECCIONADO`.
9. El sistema confirma la selección.

## Flujo alternativo

### Estado no válido

Si el plan ya no se encuentra en estado `GENERADO`:

1. El sistema rechaza la operación.
2. Se informa que el plan no puede seleccionarse.

## Postcondiciones

El plan seleccionado queda en estado `SELECCIONADO`.

Las demás alternativas podrán permanecer en estado `GENERADO`.

## Requisitos relacionados

- RF09
- RF10
- RF11
- RF12

## Reglas relacionadas

- GEN-07
- GEN-08
- GEN-09
- EVA-04
- EVA-05
- EVA-09
- PLA-01
- PLA-02

---

# 8. CU05 — Gestionar recorrido activo

## Actor principal

Usuario.

## Objetivo

Permitir al usuario iniciar un plan seleccionado y registrar el progreso de su recorrido.

## Precondiciones

- El usuario debe encontrarse autenticado.
- Debe existir un plan en estado `SELECCIONADO`.
- El usuario no debe tener otro recorrido en estado `EN_CURSO`.

## Flujo principal

1. El usuario inicia el plan seleccionado.
2. El sistema valida el estado del plan.
3. El sistema valida que el usuario no tenga otro recorrido activo.
4. El plan cambia a `EN_CURSO`.
5. El sistema muestra el recorrido y sus paradas.
6. El usuario realiza el recorrido.
7. Para cada parada pendiente puede:
   - marcarla como visitada;
   - marcarla como omitida.
8. El sistema actualiza el progreso.
9. Cuando no quedan paradas pendientes, el usuario solicita finalizar el recorrido.
10. El sistema verifica que exista al menos una parada visitada.
11. El plan cambia a `COMPLETADO`.
12. El sistema confirma la finalización.

## Flujos alternativos

### Usuario con otro recorrido activo

1. El sistema detecta otro plan en estado `EN_CURSO`.
2. Rechaza el inicio del nuevo recorrido.
3. Informa al usuario.

### Cancelar recorrido

El usuario puede cancelar un plan en estado `SELECCIONADO` o `EN_CURSO`.

1. El usuario solicita cancelar.
2. El sistema valida el estado.
3. El plan cambia a `CANCELADO`.
4. El progreso registrado se conserva.

### Todas las paradas fueron omitidas

1. No existen paradas pendientes.
2. Ninguna parada se encuentra en estado `VISITADA`.
3. El sistema no permite marcar el recorrido como completado.
4. El usuario podrá cancelarlo.

## Postcondiciones

El plan podrá permanecer en alguno de los siguientes estados:

- `EN_CURSO`;
- `COMPLETADO`;
- `CANCELADO`.

## Requisitos relacionados

- RF13
- RF14
- RF15
- RF16

## Reglas relacionadas

- PLA-03 a PLA-08
- PAR-01 a PAR-06

---

# 9. CU06 — Consultar historial

## Actor principal

Usuario.

## Objetivo

Permitir al usuario consultar información de los recorridos que forman parte de su historial.

## Precondiciones

- El usuario debe encontrarse autenticado.

## Flujo principal

1. El usuario accede al historial.
2. El sistema consulta los planes correspondientes al usuario que formen parte del historial.
3. Los recorridos son mostrados ordenadamente.
4. Para cada recorrido se presenta información resumida.
5. El usuario puede seleccionar un recorrido.
6. El sistema obtiene su detalle.
7. Se muestran el plan, las paradas, lugares y desplazamientos registrados.

## Flujo alternativo

### Historial vacío

Si el usuario todavía no posee recorridos asociados al historial:

1. El sistema presenta el estado vacío correspondiente.
2. No muestra planes que permanezcan únicamente en estado `GENERADO`.

## Postcondiciones

No se modifica información del sistema.

## Requisitos relacionados

- RF17

## Reglas relacionadas

- HIS-01
- HIS-02
- HIS-03
- HIS-04

---

# 10. CU07 — Gestionar lugares

## Actor principal

Administrador.

## Objetivo

Mantener la información de los lugares utilizados durante la generación de recorridos.

## Precondiciones

- El administrador debe encontrarse autenticado.
- Debe contar con permisos administrativos.

## Flujo principal

1. El administrador accede a la gestión de lugares.
2. El sistema muestra los lugares registrados.
3. El administrador selecciona una operación.
4. Puede:
   - registrar un lugar;
   - consultar su detalle;
   - modificarlo;
   - gestionar horarios;
   - asociar categorías;
   - asociar etiquetas;
   - activarlo;
   - desactivarlo.
5. El sistema valida la información.
6. Guarda los cambios.
7. Confirma la operación.

## Flujo alternativo

### Información incompleta

Si un lugar no posee la información mínima requerida:

1. El sistema podrá guardar la información según corresponda.
2. El lugar no deberá ser utilizado por el generador hasta cumplir las condiciones necesarias.

## Postcondiciones

La información del catálogo queda actualizada.

Los cambios no deberán alterar la información histórica de planes ya generados.

## Requisitos relacionados

- RF18

## Reglas relacionadas

- LUG-01
- LUG-02
- LUG-06
- ADM-01
- ADM-02

---

# 11. CU08 — Gestionar categorías y etiquetas

## Actor principal

Administrador.

## Objetivo

Mantener los elementos utilizados para clasificar los lugares.

## Precondiciones

- El administrador debe encontrarse autenticado.
- Debe contar con permisos administrativos.

## Flujo principal

1. El administrador accede a la administración de categorías o etiquetas.
2. El sistema muestra los elementos registrados.
3. El administrador puede:
   - registrar;
   - consultar;
   - modificar;
   - activar;
   - desactivar.
4. El sistema valida la información.
5. Guarda los cambios.
6. Confirma la operación.

## Postcondiciones

Las categorías y etiquetas quedan actualizadas.

## Requisitos relacionados

- RF19

## Reglas relacionadas

- ADM-03
- ADM-04
- ADM-05

---

# 12. CU09 — Consultar reportes

## Actor principal

Administrador.

## Objetivo

Consultar información resumida relacionada con el uso del sistema.

## Precondiciones

- El administrador debe encontrarse autenticado.
- Debe contar con permisos administrativos.

## Flujo principal

1. El administrador accede al módulo de reportes.
2. El sistema consulta la información registrada.
3. Se calculan los indicadores solicitados.
4. El sistema presenta los resultados.
5. Cuando corresponda, el administrador puede aplicar un periodo de consulta.

Los reportes podrán incluir:

- planes generados;
- recorridos completados;
- recorridos cancelados;
- categorías más seleccionadas;
- lugares incluidos con mayor frecuencia;
- lugares registrados con mayor frecuencia como visitados.

## Postcondiciones

La operación no modifica información del sistema.

## Requisitos relacionados

- RF20

## Reglas relacionadas

- ADM-06

---

# 13. Relaciones principales entre casos de uso

El flujo funcional principal puede resumirse como:

```text
CU01
Gestionar cuenta
      ↓
CU02
Crear solicitud
      ↓
CU03
Generar alternativas
      ↓
CU04
Consultar y seleccionar
      ↓
CU05
Gestionar recorrido
      ↓
CU06
Consultar historial
```

Las funciones administrativas apoyan este flujo:

```text
CU07 Gestionar lugares
          │
CU08 Gestionar categorías
          │
          ▼
      CU03 Generar
          
CU09 Consultar reportes
      ↑
datos generados por
el funcionamiento del sistema
```

---

# 14. Consideraciones

Los casos de uso describen el comportamiento funcional del sistema y no determinan directamente su implementación técnica.

Por ejemplo, un caso de uso puede involucrar internamente:

- aplicación móvil;
- base de datos;
- funciones del lado del servidor;
- servicios externos.

Estas decisiones se detallarán dentro de la documentación de arquitectura.

---

# 15. Documentos relacionados

- [Requisitos funcionales](../02-requisitos/requisitos-funcionales.md)
- [Reglas de negocio](../02-requisitos/reglas-negocio.md)
- [Trazabilidad](../02-requisitos/trazabilidad.md)
- [Modelo de dominio](./modelo-dominio.md)
- [Diagramas de secuencia](./secuencias.md)