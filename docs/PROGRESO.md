# Progreso y pendientes (actualizado 27 oct 2026)

Nota de traspaso para retomar el trabajo desde otra máquina.

## Hecho

- Hackathon reprogramado al **viernes 20 y sábado 21 de noviembre de 2026** (commit 93e97b6),
  desplegado en https://edutech-hackathon-2026.netlify.app y anunciado al grupo de staff en Telegram.
- Cierre de inscripciones: **viernes 20 de noviembre, 12:00** (hora de Ecuador), antes del kick-off
  de las 15:30 (commit 1794697).
- Grupo de Telegram **«Inscritos · EduTech Hackathon 2026»** (supergrupo con temas; el bot
  @Eigthlabsbot es admin) con el tema **🔎 Buscando equipo**. El enlace de invitación está en
  `TELEGRAM_INVITE_INSCRITOS` de `.env.n8n`.
- Correo con diseño para los inscritos de Luma: `scripts/campana-luma/enviar.py`.
  Destinatarios: los **47 aprobados** del CSV de Luma (26 sin equipo, 7 con equipo incompleto,
  11 con equipo completo, 3 sin respuesta). Los 328 «invitados» no reciben el correo.

## Pendiente

1. **n8n Cloud responde 500** («There was a problem executing the workflow») en todos los
   webhooks, incluidos los de producción, y no registra ejecuciones. Revisar plan o límite de
   ejecuciones en https://cyberdog87.app.n8n.cloud. Mientras tanto, los correos automáticos de la
   plataforma y los avisos de Telegram al staff tampoco salen.
2. Cuando n8n responda, enviar el correo a los inscritos:
   ```bash
   python3 -I scripts/campana-luma/enviar.py vista /tmp/vista.html          # vista previa
   python3 -I scripts/campana-luma/enviar.py prueba <tu-correo>             # 1 prueba
   python3 -I scripts/campana-luma/enviar.py masivo "<csv de Luma>"         # cuenta destinatarios
   python3 -I scripts/campana-luma/enviar.py masivo "<csv de Luma>" --si    # envío real
   ```
   El script crea un workflow temporal en n8n (Gmail, credencial «Gmail account»), envía y lo borra.
   Después, avisar al grupo de staff con el resumen (enviados, fallidos, enlace del grupo).
3. Actualizar a mano la fecha del evento en Luma.
4. Confirmar en el POA del colegio que el 20–21 de noviembre está libre.

## Para trabajar desde otra máquina

- `git clone https://github.com/RUFOIOT/hackathon-edutech-platform.git && npm install`
- Copiar a mano (no están en el repo): `.env.n8n` (claves de n8n, Telegram y Gmail),
  `.env.local` y el CSV exportado de Luma. El repo es **público**: nunca subir esos archivos.
- Deploy a Netlify: ver `docs/DEPLOY.md` (siempre desde una copia limpia con `git archive`).
