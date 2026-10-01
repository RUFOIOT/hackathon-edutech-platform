# Configurar la organización de GitHub y la plantilla

Pasos para dejar lista la organización del evento antes de abrir la convocatoria. Los ejecuta una
persona con rol **owner** de la organización. Tiempo estimado: 45 minutos.

## 1. Organización

1. Crear (o confirmar) la organización `eight-academy-hackathon` (guía §6: nombre por confirmar).
   Si el nombre cambia, actualizar `githubOrg` en `config/event.ts` y `GITHUB_ORG` en el entorno.
2. En **Settings → Member privileges**:
   - Base permissions: **No permission**: cada equipo verá solo sus repositorios.
   - Repository creation: **Private** y **Public** permitidos para miembros.
   - Repository deletion and transfer: **desactivado**, para que nadie borre la evidencia.
3. En **Settings → Actions → General**: permitir acciones de GitHub y de creadores verificados.

## 2. Repositorio plantilla `edutech-2026-template`

```bash
cd template-repo
git init -b main
git add .
git commit -m "chore: plantilla oficial Hackathon EduTech 2026"
gh repo create eight-academy-hackathon/edutech-2026-template --public --source . --push
```

Luego, en el repositorio: **Settings → General → Template repository** (activar).

Verificar que el Action **Checks de la hackathon** pase en verde en el primer push.

> La plantilla debe crearse **antes** del kick-off. Los repositorios de los equipos se crean
> **desde** ella después de las 15:30 del viernes: su fecha de creación es la que valida A1.

## 3. GitHub App de la plataforma

En **Settings → Developer settings → GitHub Apps → New GitHub App** de la organización:

| Campo | Valor |
|---|---|
| Nombre | `edutech-2026-plataforma` |
| Homepage URL | `APP_BASE_URL` de producción |
| Webhook URL | `https://<APP_BASE_URL>/api/github/webhook` |
| Webhook secret | un valor aleatorio de 32+ caracteres → `GITHUB_WEBHOOK_SECRET` |
| Permisos de repositorio | **Contents: Read-only**, **Metadata: Read-only** |
| Eventos | **Push**, **Create**, **Delete** |
| ¿Dónde se instala? | Only on this account |

Después de crearla:

1. Anotar el **App ID** → `GITHUB_APP_ID`.
2. **Generate a private key** → descargar el `.pem` y guardarlo en una sola línea con `\n` en
   `GITHUB_APP_PRIVATE_KEY`. Borrar el archivo descargado tras configurarlo.
3. **Install App** → en la organización → **All repositories**, para que lea los repos que se creen
   durante el evento.
4. El número al final de la URL de la instalación
   (`/organizations/eight-academy-hackathon/settings/installations/<ID>`) →
   `GITHUB_APP_INSTALLATION_ID`.
5. En **Advanced → Recent Deliveries**, verificar que el `ping` respondió **200**.

Con 30 equipos y snapshots cada 15 minutos, el consumo estimado es de unas 1.000 consultas por hora
(la caché de blobs evita re-escanear archivos sin cambios). El límite de una instalación es de
5.000 por hora.

## 4. Invitar participantes

Las invitaciones a la organización se envían por correo con el usuario de GitHub del registro.
Hasta automatizarlas, se pueden enviar con la CLI:

```bash
# participantes.txt: un usuario de GitHub por línea (exportado desde /admin/participantes)
while read -r u; do gh api -X PUT "orgs/eight-academy-hackathon/memberships/$u" -f role=member; done < participantes.txt
```

## 5. Jurado técnico

Crear el equipo de organización `jurado` con permiso **Read** sobre todos los repositorios, para que
el jurado técnico pueda revisar repos privados durante el evento (guía §6).

## 6. Después del code freeze

La guía pide que los repositorios sean **públicos desde el code freeze**:

```bash
gh repo list eight-academy-hackathon --limit 200 --json name --jq '.[].name' \
  | grep '^edutech26-' \
  | while read -r r; do gh repo edit "eight-academy-hackathon/$r" --visibility public --accept-visibility-change-consequences; done
```

Antes de hacerlos públicos, revisar en `/admin/repositorios` que no queden alertas de secretos sin
resolver.
