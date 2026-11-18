# Registro de cambios — entrega APF3

## 1. Propósito

Este documento explica cómo está organizado el trabajo de la entrega: en qué rama vive cada cambio, por qué se separó en dos solicitudes de integración (PR) y qué resuelve cada confirmación de cambio (commit).

Sirve para que cualquier integrante del equipo pueda revisar la entrega sin tener que reconstruir la historia desde el historial de Git.

---

## 2. Organización del trabajo

| Rama | Contenido | Base | PR |
|---|---|---|---|
| `feat/admin-crud-y-reorden-rutas` | Código de la aplicación, migraciones y pruebas | `main` | #2 |
| `docs/apf3-informe` | Requisitos, casos de uso, trazabilidad, algoritmo y capturas | `main` | #3 |

Las dos ramas salen de `main` y no comparten archivos, así que se pueden revisar y aprobar en cualquier orden, sin conflictos.

**Por qué dos PR y no uno:** la solicitud de código ya reúne 58 archivos; sumarle la documentación habría hecho imposible una revisión real, y un error de redacción habría quedado mezclado con código ya probado. Separarlas permite que cada PR tenga un propósito y un criterio de revisión distintos.

Todas las confirmaciones de cambio están atribuidas a la cuenta del autor de la entrega en GitHub.

---

## 3. PR #2 — Código de la aplicación

Doce confirmaciones de cambio, agrupadas por tema.

### 3.1. Generador de planes

| Commit | Qué resuelve |
|---|---|
| `feat(plan-engine): ordenar las paradas por cercania geografica` | El plan se armaba con el orden en que la búsqueda lo construyó, sin considerar la distancia entre paradas consecutivas, y eso producía recorridos que iban y volvían sobre la misma zona. Se agregó un paso que reordena las paradas posteriores a la primera y solo acepta el nuevo orden si sigue siendo viable y reduce el desplazamiento |
| `test(plan-engine): escenarios completos del generador` | Cinco escenarios con destinos reales de Miraflores y Barranco que verifican generación, diversidad, cobertura de intereses, límites de tiempo y presupuesto, y conservación del orden |

### 3.2. Panel de administración

| Commit | Qué resuelve |
|---|---|
| `feat(admin): editar usuarios y gestionar planes desde el panel` | Edición de nombre, rol y estado con validación previa; baja por anonimización, que conserva el historial y bloquea el acceso; supervisión y eliminación de solicitudes y expediciones |
| `feat(admin): auditoria de acciones y metricas de negocio` | Tabla de auditoría llenada por disparadores de la base de datos, historial paginado y métricas de uso |
| `fix(admin): hacer visible el boton de editar datos y rol` | El botón no declaraba color de fondo y su texto era blanco, así que se dibujaba invisible sobre la tarjeta y el administrador no encontraba cómo editar |
| `fix(admin): evitar que la fecha de registro se desborde en la ficha` | El valor de la fecha se salía del borde derecho de la tarjeta y se cortaba |
| `chore(db): esquema base, seed de horarios y RPC administrativas` | Migración con las funciones administrativas y los datos semilla del catálogo (20 destinos, 6 categorías, 74 horarios) |

### 3.3. Fotografías de destinos

| Commit | Qué resuelve |
|---|---|
| `feat(admin): fotografias de los destinos con limpieza del bucket` | Pantalla para incorporar fotografías desde la cámara o la galería, designar portada, eliminar imágenes y limpiar archivos que quedaron sin registro |
| `fix(places): generar el nombre del archivo sin depender de crypto` | React Native no expone `crypto`, y el generador de nombres lo usaba directamente: la subida fallaba antes de empezar con `Property 'crypto' doesn't exist` |

### 3.4. Unidad 3 — cámara, sensores y notificaciones

| Commit | Qué resuelve |
|---|---|
| `feat(silabo): camara, sensores y avisos del recorrido` | Foto de perfil desde cámara o galería, permiso de ubicación solicitado al usarlo, aviso de parada cercana y notificaciones locales |
| `fix(silabo): programar el recordatorio al abrir el recorrido` | La función que programa el recordatorio existía y estaba probada, pero ninguna pantalla la llamaba, así que nunca se ejecutaba |

### 3.5. Documentación de la entrega

| Commit | Qué resuelve |
|---|---|
| `docs: reflejar el panel administrativo y las 787 pruebas en el README` | README puesto al día con el panel, el reordenamiento y el recuento real de pruebas |

---

## 4. PR #3 — Documentación

| Commit | Qué resuelve |
|---|---|
| `docs: requisitos, trazabilidad y evidencia de la entrega APF3` | Define RF21 a RF33, incorpora los casos de uso CU10 a CU13, corrige las referencias a requisitos que no existían, amplía la matriz de trazabilidad con la relación requisito → archivo → prueba, documenta el reordenamiento geográfico y agrega las capturas de evidencia |

---

## 5. Cómo revisar la entrega

1. **Primero el código (PR #2).** Verificar que la suite esté en verde con `npm test`, y revisar los tres puntos de mayor riesgo: el reordenamiento de paradas no altera el costo del plan, la baja de usuarios no borra registros y la auditoría se llena sin intervención de la aplicación.
2. **Después la documentación (PR #3).** Comprobar que cada requisito documentado corresponda a algo que existe en el código y que las capturas coincidan con la pantalla descrita.
3. **Verificación sobre la base de datos.** Las funciones administrativas rechazan a un usuario anónimo con el código `42501`, y editar una cuenta desde el panel genera una fila de auditoría con el autor, el cambio y la fecha.

---

## 6. Estado

| Elemento | Estado |
|---|---|
| Código de la aplicación | Completo y verificado (tipos, lint y pruebas en verde) |
| Base de datos | Migraciones aplicadas en el proyecto de desarrollo |
| Documentación | Requisitos, casos de uso, trazabilidad, algoritmo y capturas |
| Evidencia en dispositivo | Panel de administración, edición, auditoría y cámara. Faltan las capturas del recorrido activo |
| Pendiente de configuración | Plantilla de correo con `{{ .Token }}` para que el registro entregue el código de seis dígitos |
