# Manual del panel de administración

Guía para el comité, la mesa técnica y el staff del Hackathon EduTech Eight Academy by n8n.
Plataforma: **https://edutech-hackathon-2026.netlify.app**

## 1. Ingresar

1. Abre https://edutech-hackathon-2026.netlify.app/ingresar en el celular o la computadora.
2. Escribe tu correo y pulsa **Enviarme el enlace**.
3. Abre el correo de Firebase y toca el enlace **en el mismo navegador** donde lo pediste
   (si lo abres en otro, te pedirá confirmar el correo).
4. Entras directo a tu pantalla según tu rol. La sesión dura 5 días; el botón para salir está arriba a
   la derecha del panel.

No hay contraseñas. Si el correo no llega: revisa spam, espera un minuto y pide otro enlace.

## 2. Roles: quién ve qué

| Rol | Entra a | Ve |
| --- | --- | --- |
| **Admin** | `/admin` | Todo, incluidos correos y celulares, Privacidad y Organización |
| **Comité** | `/admin` | Dashboard, participantes, equipos, jurado, resultados, comunicados, auditoría |
| **Mesa técnica** | `/admin` | Dashboard, participantes, equipos, repositorios, check-in, mentoría. Sin contacto ni puntajes |
| **Check-in** | `/admin/checkin` | Solo el check-in |
| **Mentor** | `/admin/mentoria` | Solo la cola de mentoría |
| **Juez** | `/jurado` | Solo los equipos de su sala y su hoja de evaluación |

### Dar acceso a alguien (solo admin)

1. Panel → **Organización**.
2. Escribe su correo y nombre, marca uno o más roles (a los mentores, los temas que atienden) y
   pulsa **Guardar acceso**.
3. Avísale que entre en `/ingresar` con ese correo. Si vuelves a guardar el mismo correo, se
   reemplazan sus roles.
4. **Quitar acceso** lo saca del panel de inmediato (cierra sus sesiones). No puedes quitarte a ti
   mismo el rol de admin.

Los **jueces** se registran aparte, en **Jurado y salas** (correo, nombre, perfil y sala).

## 3. El dashboard (`/admin`)

Arriba ves la **fase del evento** (Convocatoria → … → Resultados), calculada con la fecha y hora
de Ecuador. El panel se actualiza solo en tiempo real; no hace falta recargar.

| Bloque | Para qué sirve |
| --- | --- |
| **Semáforo de riesgo** | Cada equipo en verde, ámbar o rojo con el motivo (sin repo, checkpoint vencido, sin commits recientes, mentoría esperando). Empieza aquí cada ronda de revisión |
| **Convocatoria** | Inscritos, lista de espera, equipos completos, personas sin equipo, cupo usado, autorizaciones Junior pendientes, por track y categoría |
| **Perfil técnico** | Niveles declarados; equipos sin nadie que programe |
| **Check-in** | Presentes por día y equipos con menos de 2 presentes |
| **Repositorios** | % con repo, checkpoints 1 y 2, commits, alertas (secretos expuestos) |
| **Mentoría** | Solicitudes abiertas y tiempo medio de atención |
| **Entregas** | Entregas recibidas, tags movidos después del freeze, fallas de admisibilidad |
| **Jurado / Resultados** | Avance de las evaluaciones y conflictos de interés |

**Exportar dataset (CSV o XLSX):** descarga todo en hojas. El admin recibe los datos de
contacto; el comité y la mesa técnica, no. Cada descarga queda en la auditoría. Antes del evento
descarga un XLSX y guárdalo como respaldo sin conexión.

## 4. Secciones del panel

### Participantes
- Busca a cualquier inscrito.
- **Autorizaciones Junior:** abre el PDF (el enlace caduca en minutos), revisa firmas y pulsa
  **Validar** o **Rechazar**. Al rechazar, la persona recibe un correo para volver a subirla.
- **Lista de espera:** **Admitir** cuando se libere cupo.

### Equipos
- **Crear equipo**, **Asignar** a alguien sin equipo (matchmaking del viernes), **Fusionar**
  equipos pequeños y **Cambiar** el track (hasta el checkpoint 1).
- Equipos con Junior: asigna el **mentor adulto** responsable (obligatorio por la guía).

### Repositorios
- Estado de cada repo: validado, último snapshot, checkpoints, alertas y tag `entrega`.
- **Revalidar ahora** consulta GitHub en el momento (además del monitor automático cada 15 min).
- **A4 (corresponde al track):** lo decide la mesa técnica con **Guardar**.

### Check-in
Ver la sección 5 (QR).

### Mentoría
- Cola ordenada por antigüedad. **Tomar solicitud** avisa que vas en camino; **Cerrar** al terminar.
- En rojo: más de 30 minutos esperando (también se avisa por Slack si n8n está conectado).

### Jurado y salas
1. **Guardar sala** (identificador, nombre, tracks) y **Registrar juez** en su sala.
2. **Generar orden de semifinal** (reemplaza el orden actual; puedes mover equipos).
3. Durante el Show and Tell, por sala: **Poner en pantalla** al equipo de turno y usa el
   cronómetro (**Iniciar**, **Pausar**, **Reiniciar**, **Terminar**). **Abrir pantalla de la sala**
   abre `/pantalla?sala=…` para el proyector.
4. **Publicar aviso** muestra un mensaje en todas las pantallas.
5. Al terminar una sala: **Cerrar sala** bloquea sus puntajes. Para corregir: **Reabrir** con motivo.

### Resultados
1. Con las salas cerradas, revisa la normalización por sala y los empates.
2. **Confirmar finalistas y abrir la final**.
3. Tras la final, ordena y **Publicar resultados**: se publican en `/resultados`, cada equipo ve
   su retroalimentación y n8n envía los certificados.

### Comunicados
Elige el alcance (todos, un track o un equipo), escribe el mensaje y **Enviar comunicado**. Se
envía por correo y Slack a través de n8n.

### Auditoría
Registro de cada acción sensible (quién, qué, cuándo). Filtra por entidad, acción o actor.

### Privacidad (solo admin)
- **Solicitudes de eliminación:** **Anonimizar** (plazo de respuesta: 15 días).
- **Política de retención:** el botón aparece 12 meses después del evento.

## 5. QR de check-in

### Cómo se genera

**No hay que generar nada a mano.** Cada persona inscrita tiene su QR personal en
**Mi equipo** (`/mi-equipo`), apenas termina la inscripción.

- El QR contiene un código firmado (`EDT1.<id>.<firma>`): no lleva nombre, correo ni datos
  personales, y no se puede falsificar el de otra persona.
- No caduca y sirve para los dos días.
- Puede mostrarse desde el celular o como captura de pantalla impresa.
- La firma usa `CHECKIN_QR_SECRET` (variable de Netlify). **No la cambies después de abrir las
  inscripciones**: los QR ya emitidos dejarían de servir (habría que usar la búsqueda manual).

**Qué decirles a los participantes** (por ejemplo, en el comunicado previo):
> El viernes desde las 13:30, abre https://edutech-hackathon-2026.netlify.app/mi-equipo en tu
> celular y muestra tu QR en la entrada. Categoría Open: trae tu documento de identidad.

### Cómo se usa en la puerta

1. El staff de check-in ingresa con su correo → abre **Check-in** en el celular.
2. En **Escanear QR**, pulsa **Abrir cámara** y da permiso (la primera vez el navegador lo pregunta).
3. Apunta al QR: aparece en grande **"Check-in registrado: Nombre"** (verde) o el motivo del
   error (rojo).
4. Verifica según la categoría:
   - **Open:** documento de identidad.
   - **Junior:** que su autorización figure como validada y que su mentor adulto esté en la sede.
5. El contador "N de M presentes" se actualiza en vivo para todo el staff.

**Sin QR o si la cámara falla:** escribe 2 letras del nombre o del equipo en **Búsqueda manual** y
pulsa **Registrar check-in**.

| Mensaje | Qué significa | Qué hacer |
| --- | --- | --- |
| "QR no válido" | Captura borrosa, recortada o QR alterado | Pide que lo abra en Mi equipo o usa la búsqueda manual |
| "Ya hizo check-in hoy" | Ya estaba registrada | Déjala pasar |
| "No encontramos a esa persona" | No está inscrita (o fue anonimizada) | Envíala a la mesa técnica |
| "No pudimos abrir la cámara" | Permiso negado | Permite la cámara en el navegador o usa la búsqueda manual |

El sistema registra un check-in por persona **por día** (viernes y sábado), con la hora y quién lo
hizo. Si no hay internet en la puerta: marca en la lista impresa y regístralo luego con la
búsqueda manual (ver `docs/RUNBOOK.md`).

## 6. Calendario de uso

| Momento | Quién | Qué hacer en el panel |
| --- | --- | --- |
| Antes de abrir inscripciones | Admin | Organización: dar acceso al staff. Revisar datos "Por anunciar" |
| Convocatoria (desde el 5 oct) | Comité | Validar autorizaciones Junior a diario; admitir de lista de espera; revisar el dashboard |
| Semana previa | Admin | Exportar XLSX de respaldo; registrar salas y jueces; probar el escáner con un QR real |
| Viernes 13:30 | Check-in | Escanear QR en la puerta |
| Viernes 14:30 | Comité | Equipos: matchmaking de inscritos individuales |
| Hacking | Mesa técnica | Semáforo cada 30 min; mentoría; repositorios y alertas |
| Sábado 12:00 | Mesa técnica | Revisar entregas, tags movidos y decidir A4 |
| Show and Tell | Comité | Jurado y salas: orden, pantalla, cronómetro, cerrar salas |
| Final y premiación | Comité | Resultados: finalistas, final, publicar |
| Después | Admin | Privacidad: solicitudes de eliminación |

## 7. Problemas frecuentes

- **"No tienes acceso a esta sección":** tu rol no la incluye. Pide al admin el rol adecuado.
- **No llega el enlace:** spam; espera un minuto; revisa que el correo esté bien escrito.
- **"Demasiados intentos seguidos":** espera los minutos que indica el mensaje.
- **No llegan los correos de bienvenida o comunicados:** n8n no está conectado o no responde.
  Los envíos quedan guardados y salen cuando vuelva (ver `n8n/README.md` y `docs/RUNBOOK.md`).

Más detalle técnico: [RUNBOOK.md](RUNBOOK.md) (qué hacer si algo falla) y
[DATASET.md](DATASET.md) (columnas del exportable).
