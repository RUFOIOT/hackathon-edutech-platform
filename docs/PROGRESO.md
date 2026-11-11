# Progreso y pendientes (actualizado 11 nov 2026)

Nota de traspaso para retomar el trabajo desde otra máquina.

## Hecho

- Hackathon reprogramado al **viernes 27 y sábado 28 de noviembre de 2026** (commits 93e97b6 y del 4 nov, que corrige el 20–21 nov),
  desplegado en https://edutech-hackathon-2026.netlify.app y anunciado al grupo de staff en Telegram.
- Cierre de inscripciones: **viernes 27 de noviembre, 12:00** (hora de Ecuador), antes del kick-off
  de las 17:00 (commit 1794697; agenda del viernes compactada el 9 nov: check-in 15:30).
- Grupo de Telegram **«Inscritos · EduTech Hackathon 2026»** (supergrupo con temas; el bot
  @Eigthlabsbot es admin) con el tema **🔎 Buscando equipo**. El chat_id (`TELEGRAM_CHAT_ID_INSCRITOS`; tema 📢 Anuncios = 2) y el enlace de invitación están en
  `.env.n8n` (`TELEGRAM_INVITE_INSCRITOS`). Bienvenida publicada en Anuncios el 5 nov.
- Correo con diseño para los inscritos de Luma (`scripts/campana-luma/enviar.py`): **enviado el 4 nov**
  a los 47 aprobados (0 fallidos), con la invitación al grupo de Telegram; avisado al staff.
  Destinatarios: los **47 aprobados** del CSV de Luma (26 sin equipo, 7 con equipo incompleto,
  11 con equipo completo, 3 sin respuesta). Los «invitados» recibieron la invitación el 9 nov (ver abajo).
- **9 nov:** recordatorio a los aprobados de Luma que aún no están en la plataforma (modo `recordatorio`
  con `--excluir`, lista de correos ya registrados sacada de `participants`): **64 enviados, 0 fallidos**.
  Al 9 nov: 73 aprobados en Luma (402 filas: 327 invitados, 2 rechazados), 25 registrados en la
  plataforma (8 coinciden por correo con Luma), 7 equipos completos, 6 individuales sin equipo.
- **9 nov:** aviso a los 7 registros a medias (`registration_drafts` sin `participants`; correos sacados de
  Firebase Auth con `accounts:lookup`) con el modo `incompleto`: **7 enviados, 0 fallidos**. Resumen al staff en Telegram.
- **9 nov:** invitación al evento a los «invited» de Luma (cargados el 28 sep, nunca se inscribieron) con el modo
  `invitacion`, en 4 lotes de hasta 90: **324 enviados, 0 fallidos** (3 ya estaban en la plataforma). Ese día salieron
  395 correos desde la cuenta de Gmail de n8n; no repetir envíos grandes el mismo día por el límite diario de Gmail.
  4 rebotaron (direcciones inexistentes) y ninguna respuesta pidió la baja. Rebotes y bajas van en
  `scripts/campana-luma/no-enviar.txt` (git-ignorado; copiarlo a mano entre máquinas), que el script excluye siempre.
- **9 nov:** carta de invitación (inglés y portugués) para una participante de Brasil que pide apoyo a su universidad;
  enviada por correo desde la cuenta del organizador. La carta no queda en el repo (datos personales).

- **11 nov:** aplicados los acuerdos de la reunión de staff del 10 nov (hoja de agenda del staff en Google Sheets; D-47):
  agenda nueva (taller n8n 16:20, dinámica de integración 16:40, matchmaking 16:50, checkpoint 1 a las 19:00,
  checkpoint 2 a las 12:30, entrega/code freeze a las 14:00, Show and Tell 15:00–16:30 en 2 salas con 3 jurados,
  premiación 16:45), sin final ni finalistas, premios reducidos a 1.º y 2.º Open, mejor Junior y certificado para
  todos, y crons de n8n movidos. Falta desplegar la web y volver a subir los workflows a n8n (ver pendientes).

## Pendiente

1. n8n Cloud volvió a ejecutar (4 nov: webhooks responden 200). Vigilar el consumo mensual del plan;
   WF-00 corre cada 30 minutos (~1.400 ejecuciones/mes).
2. Recordatorios a quienes siguen sin registrarse: exportar el CSV de Luma, armar la lista de correos ya
   registrados y correr `python3 -I scripts/campana-luma/enviar.py recordatorio "<csv>" --excluir <correos.txt> --si`.
3. Actualizar a mano la fecha del evento en Luma.
4. Confirmar en el POA del colegio que el 27–28 de noviembre está libre.
5. Desplegar la web con la agenda nueva (Netlify, copia limpia) y volver a subir los workflows a n8n
   (`scripts/n8n-desplegar.ts`): WF-04, WF-05, WF-06 y WF-09 cambiaron de horario o de contenido.
6. Abiertos de la reunión de staff: qué se hace con un Junior inscrito solo si no hay otros Junior; si se mantiene
   la evidencia de entrevista en el checkpoint 1 (ahora solo 2 h después del kick-off); documento de identidad de
   Open en el check-in; cupo máximo del Show and Tell (~12 equipos con 2 salas); cena VIP (lugar, personas,
   presupuesto); el registro aún permite equipos MIXTO aunque ahora son de una sola categoría.

## Para trabajar desde otra máquina

- `git clone https://github.com/RUFOIOT/hackathon-edutech-platform.git && npm install`
- Copiar a mano (no están en el repo): `.env.n8n` (claves de n8n, Telegram y Gmail),
  `.env.local`, `scripts/campana-luma/no-enviar.txt` y el CSV exportado de Luma. El repo es **público**: nunca subir esos archivos.
- Deploy a Netlify: ver `docs/DEPLOY.md` (siempre desde una copia limpia con `git archive`).
