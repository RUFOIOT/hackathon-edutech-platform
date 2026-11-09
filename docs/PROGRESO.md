# Progreso y pendientes (actualizado 9 nov 2026)

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
  11 con equipo completo, 3 sin respuesta). Los 328 «invitados» no reciben el correo.
- **9 nov:** recordatorio a los aprobados de Luma que aún no están en la plataforma (modo `recordatorio`
  con `--excluir`, lista de correos ya registrados sacada de `participants`): **64 enviados, 0 fallidos**.
  Al 9 nov: 73 aprobados en Luma (402 filas: 327 invitados, 2 rechazados), 25 registrados en la
  plataforma (8 coinciden por correo con Luma), 7 equipos completos, 6 individuales sin equipo.
- **9 nov:** aviso a los 7 registros a medias (`registration_drafts` sin `participants`; correos sacados de
  Firebase Auth con `accounts:lookup`) con el modo `incompleto`: **7 enviados, 0 fallidos**. Resumen al staff en Telegram.

## Pendiente

1. n8n Cloud volvió a ejecutar (4 nov: webhooks responden 200). Vigilar el consumo mensual del plan;
   WF-00 corre cada 30 minutos (~1.400 ejecuciones/mes).
2. Recordatorios a quienes siguen sin registrarse: exportar el CSV de Luma, armar la lista de correos ya
   registrados y correr `python3 -I scripts/campana-luma/enviar.py recordatorio "<csv>" --excluir <correos.txt> --si`.
3. Actualizar a mano la fecha del evento en Luma.
4. Confirmar en el POA del colegio que el 27–28 de noviembre está libre.

## Para trabajar desde otra máquina

- `git clone https://github.com/RUFOIOT/hackathon-edutech-platform.git && npm install`
- Copiar a mano (no están en el repo): `.env.n8n` (claves de n8n, Telegram y Gmail),
  `.env.local` y el CSV exportado de Luma. El repo es **público**: nunca subir esos archivos.
- Deploy a Netlify: ver `docs/DEPLOY.md` (siempre desde una copia limpia con `git archive`).
