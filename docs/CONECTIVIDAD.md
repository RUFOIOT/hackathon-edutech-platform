# Instructivo de internet, recursos de sede y comunicación del wifi

Responsables de la red wifi: **Andrés Arias (TI), Pablo Marín y Daniel Robles**. Para coordinación
operativa, mesa técnica (EIGHT LABS) y TI del colegio. Complementa el
[RUNBOOK](RUNBOOK.md) (qué hacer si cae la red) y la guía §6 (conectividad `[CONFIRMAR]`).

> **Este repo es público.** Los nombres de red reales, las claves y la configuración de los equipos
> van en el documento interno de TI, nunca aquí ni en la web, el grupo de Telegram de inscritos o
> el correo masivo.

Los números son una propuesta para 150 personas. TI del colegio los valida en la visita técnica.

## 1. Redes

Tres redes separadas, y ninguna conectada a la red administrativa del colegio. Esa red tiene datos
de estudiantes y familias, que protege la LOPDP.

| Red | Quién | Visible | Seguridad | Capacidad |
|---|---|---|---|---|
| **Participantes** | Equipos y mentores | Sí | WPA2/WPA3 con clave, aislamiento entre clientes | 300 dispositivos (150 × laptop + celular) |
| **Staff** | Check-in, comité, jurado y mesa técnica | No (oculta) | Clave distinta, solo staff | 30 dispositivos |
| **Transmisión** | Proyectores, `/pantalla`, streaming | No | Cable de preferencia; wifi aparte si no hay cable | Prioridad alta (QoS) |

**Ancho de banda**
- Ideal: **300 Mbps simétricos**; mínimo 200 Mbps. La subida importa por los `git push`, las
  demos y los videos de respaldo.
- **Límite por dispositivo** en la red de participantes: unos 10 Mbps de bajada y 5 de subida, para
  que una descarga grande no deje sin red a una sala.
- **Puntos de acceso:** uno cada 30–40 dispositivos activos (8 a 10 en total), en 5 GHz y con
  canales que no se crucen entre salas.
- **Respaldo:**
  - Un segundo proveedor, o 2 routers 4G/5G con conmutación automática.
  - Un hotspot del celular para el staff.
  - La plataforma está en Netlify y Firebase, y funciona con datos móviles.

**Reglas del firewall**
- **Sin portal cautivo.** Rompe `git`, Docker y npm desde la terminal.
- **Abrir:** 443, 80 y **22** (SSH de GitHub).
- **No bloquear:**
  - `github.com`, `*.githubusercontent.com`, `ghcr.io`
  - `*.n8n.cloud`, `n8n.io`
  - `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`
  - `*.docker.io`, `*.docker.com`
  - `*.netlify.app`, `*.firebaseio.com`, `*.googleapis.com`
  - `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `huggingface.co`
  - `t.me`, `api.telegram.org`
- **Bloquear:** P2P y torrents. El filtro de contenidos del colegio suele bloquear varios de estos
  dominios, así que hay que probarlos uno por uno (sección 2).

## 2. Pruebas antes del evento

| Cuándo | Qué | Responsable |
|---|---|---|
| **Vie 13 nov** | Visita técnica: velocidad por sala (bajada y subida), cobertura, tomas eléctricas por sala, dónde va cada punto de acceso | TI del colegio y mesa técnica |
| **Vie 20 nov** | Prueba de carga con 30 o más dispositivos a la vez y prueba de dominios (abajo) | Mesa técnica |
| **Jue 26 nov** | Claves definitivas, tarjetas y carteles impresos, respaldo 4G cargado y probado | Mesa técnica |
| **Vie 27, 14:30** | Chequeo final de las 3 redes antes de abrir el check-in de las 15:30 | Mesa técnica |

**Prueba de dominios**, desde una laptop en la red de participantes:

```bash
git clone https://github.com/eight-academy-hackathon/edutech-2026-template.git && cd edutech-2026-template
ssh -T git@github.com              # debe saludar con tu usuario
npm view next version              # registro de npm
pip download requests -d /tmp/x    # PyPI
docker pull hello-world            # Docker Hub
curl -sI https://edutech-hackathon-2026.netlify.app | head -1
curl -sI https://app.n8n.cloud | head -1
```

Si un comando falla, se pide a TI que abra ese dominio y se repite la prueba. Hay que medir también
la velocidad con 30 dispositivos conectados, no con uno solo.

## 3. Recursos físicos

- **Energía:**
  - Una toma por persona y una regleta de 6 tomas por mesa de equipo.
  - Las salas se reparten entre circuitos distintos, que TI marca en el plano.
  - Los participantes traen su extensión, como pide la checklist de la Guía del hacker.
- **Salas de presentación** (Show and Tell del sábado 15:00, dos salas en paralelo): cada una con
  proyector o pantalla, cable HDMI, adaptador USB-C a HDMI, audio y `/pantalla?sala=…` abierta.
  En las salas de presentación, la demo va por cable de red si se puede.
- **Kit de la mesa técnica:**
  - 2 routers 4G/5G cargados, 5 cables de red, 1 switch y adaptadores (USB-C a HDMI, USB-C a red).
  - 6 regletas de repuesto.
  - Lista impresa de check-in y rúbricas impresas, para trabajar sin red.
  - 20 tarjetas de wifi de repuesto.
- **Laptops de respaldo:** `[CONFIRMAR]` si el colegio presta equipos a quien llegue sin laptop.
- **Noche del viernes:** la sede cierra a las 21:00 y el hacking sigue desde casa, así que cada
  equipo necesita internet propio esa noche.

## 4. Cómo se comunica el wifi

**Regla:** la clave **solo se entrega en la sede**. El enlace del grupo de Telegram de inscritos se
envió a más de 400 personas y la web es pública.

| Cuándo | Canal | Qué se dice |
|---|---|---|
| **Lun 23 nov** | `/admin/comunicados` (todos) y Telegram 📢 Anuncios | Que habrá wifi, qué traer y qué dejar listo en casa (mensaje A). Sin la clave |
| **Vie 27, check-in (15:30)** | Tarjeta que se entrega con el name tag | Nombre de la red, clave y código QR para conectarse (mensaje B) |
| **En sede** | Carteles A4 en cada sala y en la mesa técnica | El mismo QR; no se lee desde afuera |
| **Inauguración (16:00)** | Micrófono | Red, dónde está la mesa técnica y qué hacer si hay fallas |
| **Si cae la red** | Megáfono primero; `/admin/comunicados` y Telegram al volver | Mensaje C y, si hace falta, cambio del freeze (decide el comité) |

**El QR del wifi** es texto con este formato, convertido en código QR:
`WIFI:T:WPA;S:<nombre de la red>;P:<clave>;;`. Se genera en el computador de la mesa técnica, no
en servicios web. La clave **no cambia** entre viernes y sábado; se cambia solo si se filtra, y en
ese caso se reparten tarjetas nuevas en la puerta el sábado a las 08:00.

### Mensaje A · aviso previo (sin clave)

> 📶 **Internet en la sede.** Habrá wifi para participantes en la Eight Academy (sede La Prensa). La
> clave se entrega en el check-in del viernes 27 desde las 15:30.
>
> Trae laptop, cargador y una extensión eléctrica. Antes de llegar:
> - Instala Git, Node o Python, Docker si lo usas, y entra a tu cuenta de n8n.
> - Prueba que `git push` funcione con tu usuario de GitHub.
> - El código del proyecto se escribe desde el kick-off de las 17:00; instalar herramientas antes
>   sí está permitido.
>
> La sede cierra a las 21:00 y el hacking sigue desde casa, así que asegúrate de tener internet esa
> noche. Ten a mano el hotspot de tu celular como respaldo.

### Mensaje B · tarjeta de wifi (impresa, solo en sede)

> **Wifi participantes · Hackathon EduTech**
> Red: `<nombre>` · Clave: `<clave>` · [QR]
> ¿Problemas? Mesa técnica, `<ubicación>`. No compartas la clave fuera de la sede.

### Mensaje C · caída de la red

> ⚠️ **Se cayó el internet de la sede y ya lo estamos resolviendo.** Sigan trabajando y haciendo
> commits locales: valen, porque lo que cuenta es la fecha del commit, no la hora del push. Suban
> los cambios cuando vuelva la red. Si el corte llega cerca del freeze, el comité anunciará aquí si
> se extiende.

## 5. Responsables

| Tema | Responsable |
|---|---|
| **Red wifi: responsables** | **Andrés Arias (TI), Pablo Marín y Daniel Robles** |
| Red, puntos de acceso, firewall y proveedor | Andrés Arias · TI del colegio |
| Pruebas, kit, soporte en sala y respaldo 4G | Pablo Marín y Daniel Robles, con la mesa técnica (EIGHT LABS) |
| Mensajes a participantes (A y C) | Comité, desde `/admin/comunicados` |
| Tarjetas y carteles | Check-in, se entregan con el name tag |
| Decidir si se extiende el freeze | Comité |
