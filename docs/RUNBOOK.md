# Runbook del evento

Qué revisar y qué hacer el viernes 6 y el sábado 7 de noviembre de 2026. Las horas son de Ecuador.
Responsables por defecto: **mesa técnica** (plataforma, repositorios, n8n) y **comité** (decisiones).

## Checklist

### Una semana antes

- [ ] `npm run ensayo` contra el entorno de prueba con el seed: todos los pasos en OK (ver registro abajo).
- [ ] Exportar el dataset en XLSX (panel → Exportar) y guardar una copia offline.
- [ ] Imprimir la lista de participantes por equipo (desde el XLSX) para el check-in manual.
- [ ] Probar el escáner de check-in en los celulares del staff (cámara permitida).
- [ ] Los 10 workflows de n8n activos; un correo de prueba recibido; canal de Slack del staff listo.
- [ ] Cuota de la GitHub App revisada: `gh api rate_limit` con el token de instalación.
- [ ] Rúbricas en papel impresas (respaldo del jurado) y cronómetro físico por sala.

### Viernes 6, antes de las 13:30 (check-in)

- [ ] `/admin` carga y la barra de fase muestra "Check-in" desde las 13:30.
- [ ] Panel de check-in abierto en 2 celulares por puerta.
- [ ] WF-04 (monitor de repositorios) activo: empieza a las 15:30.

### Durante el hacking

- [ ] Revisar `/admin` cada 30 min: semáforo rojo, mentorías esperando más de 30 min, alertas rojas.
- [ ] 18:30 y 10:00: WF-05 avisa a los equipos en riesgo; confirmar en Slack.
- [ ] Checkpoint 2: la mesa técnica confirma a mano los equipos marcados como "requiere revisión".

### Sábado 7, code freeze (12:00)

- [ ] 12:05 llega a Slack y al comité el reporte de WF-06 (entregas y A1–A5).
- [ ] Revisar tags movidos después del freeze en `/admin/repositorios` y decidir A4.
- [ ] Cargar el orden de presentación por sala en `/admin/jurado`.

### Show and Tell, final y premiación

- [ ] `/pantalla?sala=…` abierta en el proyector de cada sala.
- [ ] Cerrar cada sala al terminar (bloquea los puntajes) antes de calcular finalistas.
- [ ] Publicar resultados desde `/admin/resultados`; WF-09 envía certificados (revisar Slack).

### Después del evento

- [ ] Atender solicitudes de eliminación en `/admin/privacidad` (plazo: 15 días).
- [ ] Borrar las ejecuciones fallidas guardadas en n8n (pueden contener correos).
- [ ] La política de retención se aplica desde `/admin/privacidad` cuando vence (12 meses).

## Si algo falla

### Cae la red de la sede

1. La plataforma está en Netlify y Firebase: el problema es la conexión local, no el servidor.
   Comparte un hotspot 4G para el staff (check-in y jurado funcionan desde el celular).
2. **Check-in sin conexión:** marca la asistencia en la lista impresa y regístrala en
   `/admin/checkin` (búsqueda manual) cuando vuelva la red. El conteo del dashboard se actualiza solo.
3. **Equipos:** los commits locales siguen valiendo; se suben cuando vuelva la red. Lo que cuenta
   para la entrega es la fecha del commit del tag `entrega`, no la hora del push. Si la caída
   ocurre cerca del freeze, el comité puede extender el freeze; anúncialo por megáfono y luego en
   `/admin/comunicados`.
4. **Jurado:** si la hoja no carga, usa la rúbrica impresa y transcribe los puntajes al volver la
   red, antes de cerrar la sala.

### GitHub limita la API (rate limit) o no responde

Síntomas: Slack recibe ":warning: N repositorios no se pudieron leer" (WF-04) o los snapshots
quedan con error en `/admin/repositorios`.

1. Comprueba la cuota: `gh api rate_limit` con el token de la GitHub App.
2. El snapshot no se cae: responde equipo por equipo y guarda el último bueno. No hace falta
   reiniciar nada.
3. Baja la frecuencia: desactiva WF-04 en n8n hasta que se restablezca la cuota (se renueva cada
   hora). Antes del freeze, pide snapshots solo de los equipos en duda desde `/admin/repositorios`
   (botón *Revalidar ahora*).
4. Movimientos del tag `entrega`: los registra el webhook en tiempo real aunque la API esté
   limitada. Si GitHub entero está caído, consulta https://www.githubstatus.com y el comité decide
   si extiende el freeze.

### n8n no responde

Síntomas: no llegan correos ni avisos de Slack; en Firestore `event_outbox` crecen los
`pendiente`.

1. **No se pierde nada:** cada evento queda en el outbox y la inscripción, la entrega o la
   publicación siguen funcionando.
2. Revisa n8n (instancia arriba, workflows activos, credenciales de Resend y Slack válidas).
3. Cuando vuelva, WF-00 reenvía los pendientes cada 5 minutos. Para forzarlo, ejecuta WF-00 a mano.
4. Eventos con 10 intentos fallidos quedan `fallido` y WF-00 avisa en Slack: revisa `ultimoError`
   en `event_outbox`, corrige y cámbialos a `pendiente` desde la consola de Firebase.
5. Mientras tanto: comunicados urgentes por megáfono y el grupo del staff; los acuses de entrega
   se pueden confirmar en `/admin/repositorios`.

### No llegan los enlaces de acceso

1. Revisa la carpeta de spam y que el correo esté bien escrito.
2. Firebase limita los envíos de enlace por hora: si hay muchos intentos, espera unos minutos.
3. Comprueba en la consola de Firebase que el dominio de la app sigue en *Dominios autorizados*.

### "Demasiados intentos seguidos"

Es el límite de peticiones (D-41). Por IP es holgado (150 confirmaciones de registro por 10 min,
pensado para el salón del colegio); por cuenta es más estricto. Basta esperar el tiempo indicado.
Si bloquea un uso legítimo, sube el valor en `lib/seguridad/limite.ts` y vuelve a desplegar.

### Error en una sala del jurado

- Juez con conflicto de interés: lo declara en su hoja; el sistema lo excluye de ese equipo.
- Puntaje equivocado con la sala ya cerrada: el comité reabre la sala en `/admin/jurado`, el juez
  corrige y se vuelve a cerrar. Queda en la auditoría.

## Registro del ensayo

Ejecutado con `npm run ensayo` sobre los emuladores con el seed y la app en la ventana de hacking
(`APP_FECHA_SIMULADA=2026-11-07T11:00:00-05:00`).

### Ensayo 2026-10-02 · http://localhost:3200 (seed, emuladores)

| Bloque | Paso | Resultado | Detalle |
| --- | --- | --- | --- |
| Antes del evento | Web pública, guías y privacidad responden | OK | 8 rutas con 200 |
| Antes del evento | Cabeceras de seguridad presentes | OK | CSP, nosniff, X-Frame-Options |
| Antes del evento | Cada rol entra solo a lo suyo | OK | admin, mesa técnica y check-in |
| Antes del evento | Respaldo offline: exportación XLSX y CSV (admin) | OK | 10 hojas; participantes con contacto |
| Antes del evento | La mesa técnica exporta sin contacto ni puntajes | OK | sin email, celular ni puntajes |
| Durante el evento | Check-in: lista y conteo en vivo | OK | 30 check-ins en el seed |
| Durante el evento | Proyector de sala responde | OK | /pantalla con 200 |
| Durante el evento | Endpoints de n8n rechazan peticiones sin firma | OK | 401 |
| Si GitHub limita la API | El snapshot no se cae: responde por equipo | OK | 10 equipos; 10 con error de GitHub (esperado sin credenciales) |
| Si n8n no responde | El outbox guarda y el reintento responde | OK | 0 pendientes antes; respuesta {"enviados":0,"pendientes":0,"fallidos":0} |
| Durante el evento | Consultas de los workflows con el seed | OK | 3 consultas con 200 |
| Durante el evento | Límite de peticiones activo | OK | 429 en el intento 121 desde la misma IP |
| Cierre | KPIs del dashboard coinciden con SQL | OK | 26/26 KPIs coinciden con su consulta SQL (corte: 2026-11-07T16:00:00.000Z). |
| Cierre | Firma de ida y vuelta con n8n (npm run n8n:test) | OK | Todo en orden. |
| Después del evento | Privacidad: solicitudes y plazo de retención visibles | OK | plazo y conteo visibles |

15/15 pasos OK.

Nota: en este ensayo el outbox no tenía eventos pendientes, así que el paso «n8n no responde» solo
comprobó que el reintento responde; el reenvío de pendientes está cubierto por `npm run n8n:test`
y por los tests unitarios de los workflows. Los snapshots fallan a propósito: el entorno local no
tiene credenciales de GitHub, y el paso verifica que la respuesta sigue siendo 200 por equipo.

