# Progreso y pendientes (actualizado 4 nov 2026)

Nota de traspaso para retomar el trabajo desde otra máquina.

## Hecho

- Hackathon reprogramado al **viernes 27 y sábado 28 de noviembre de 2026** (commits 93e97b6 y del 4 nov, que corrige el 20–21 nov),
  desplegado en https://edutech-hackathon-2026.netlify.app y anunciado al grupo de staff en Telegram.
- Cierre de inscripciones: **viernes 27 de noviembre, 12:00** (hora de Ecuador), antes del kick-off
  de las 15:30 (commit 1794697).
- Grupo de Telegram **«Inscritos · EduTech Hackathon 2026»** (supergrupo con temas; el bot
  @Eigthlabsbot es admin) con el tema **🔎 Buscando equipo**. El enlace de invitación está en
  `TELEGRAM_INVITE_INSCRITOS` de `.env.n8n`.
- Correo con diseño para los inscritos de Luma (`scripts/campana-luma/enviar.py`): **enviado el 4 nov**
  a los 47 aprobados (0 fallidos), con la invitación al grupo de Telegram; avisado al staff.
  Destinatarios: los **47 aprobados** del CSV de Luma (26 sin equipo, 7 con equipo incompleto,
  11 con equipo completo, 3 sin respuesta). Los 328 «invitados» no reciben el correo.

## Pendiente

1. n8n Cloud volvió a ejecutar (4 nov: webhooks responden 200). Vigilar el consumo mensual del plan;
   WF-00 corre cada 30 minutos (~1.400 ejecuciones/mes).
2. Inscritos de Luma que se sumen después del 27 oct: exportar un CSV nuevo y enviarles el correo
   (`python3 -I scripts/campana-luma/enviar.py masivo "<csv>" --si`; hoy envía a todos los aprobados del CSV).
3. Actualizar a mano la fecha del evento en Luma.
4. Confirmar en el POA del colegio que el 27–28 de noviembre está libre.

## Para trabajar desde otra máquina

- `git clone https://github.com/RUFOIOT/hackathon-edutech-platform.git && npm install`
- Copiar a mano (no están en el repo): `.env.n8n` (claves de n8n, Telegram y Gmail),
  `.env.local` y el CSV exportado de Luma. El repo es **público**: nunca subir esos archivos.
- Deploy a Netlify: ver `docs/DEPLOY.md` (siempre desde una copia limpia con `git archive`).
