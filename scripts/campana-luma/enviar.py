"""Correo a los inscritos de Luma: arma los correos y los envía por un workflow temporal de n8n.

Uso:
  python3 -I enviar.py vista <archivo.html>   # guarda la vista previa
  python3 -I enviar.py prueba <correo>        # 1 correo de prueba
  python3 -I enviar.py masivo <csv_luma> --si # aprobados del CSV de Luma
La configuración sale del .env.n8n de la raíz del repo (N8N_API_URL, N8N_API_KEY, GMAIL_CREDENCIAL_ID,
TELEGRAM_INVITE_INSCRITOS). El CSV de Luma tiene datos personales: no se sube al repo.
"""
import uuid, csv, html, json, os, re, secrets, sys, time, urllib.error, urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ENV = dict(l.split("=", 1) for l in open(f"{REPO}/.env.n8n").read().splitlines() if "=" in l and not l.lstrip().startswith("#"))
ENV = {k.strip(): v.strip().strip("\"'") for k, v in ENV.items()}
API = ENV["N8N_API_URL"].rstrip("/") + "/api/v1"
WEB = "https://edutech-hackathon-2026.netlify.app"
TELEGRAM = ENV["TELEGRAM_INVITE_INSCRITOS"]
ASUNTO = "Ya estás dentro: registra tu equipo en la EduTech Hackathon (20–21 nov)"


def boton(url, texto, fondo, color):
    return (f'<a href="{url}" style="display:inline-block;background:{fondo};color:{color};padding:13px 24px;'
            f'border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px;margin:4px 6px 4px 0">{texto}</a>')


def correo_html(nombre):
    hola = f"¡Hola, {html.escape(nombre)}!" if nombre else "¡Hola!"
    p = lambda t: f'<p style="font-size:15px;line-height:1.6;margin:0 0 14px;color:#0e1b3d">{t}</p>'
    paso = lambda n, t, d: (
        '<tr><td style="vertical-align:top;padding:0 12px 14px 0"><div style="width:28px;height:28px;border-radius:50%;'
        f'background:#0e1b3d;color:#f0b23a;font-weight:bold;text-align:center;line-height:28px;font-size:14px">{n}</div></td>'
        f'<td style="padding:0 0 14px;font-size:15px;line-height:1.5;color:#0e1b3d"><b>{t}</b><br><span style="color:#3d4a66">{d}</span></td></tr>')
    return (
        '<div style="background:#f4f1ea;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">'
        '<div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">'
        '<div style="height:6px;background:linear-gradient(90deg,#6aa3dc,#e8a0b0,#6fb38c,#f0b23a)"></div>'
        '<div style="background:#0e1b3d;padding:28px 28px 24px;color:#ffffff">'
        '<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f0b23a">Eight Academy by n8n</p>'
        '<h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;color:#ffffff">Hackathon EduTech 2026</h1>'
        '<p style="margin:0;font-size:15px;color:#d6dcea">📅 Viernes 20 y sábado 21 de noviembre · 📍 Quito</p></div>'
        '<div style="padding:28px">'
        + p(f"<b>{hola}</b>")
        + p("Gracias por inscribirte en Luma. El siguiente paso es <b>registrarte en la plataforma oficial del hackathon</b>: "
            "ahí se forman los equipos, se entrega el proyecto y se hace el check-in con QR el día del evento.")
        + '<table role="presentation" style="border-collapse:collapse;margin:18px 0 6px">'
        + paso(1, "Regístrate en la plataforma", "Elige cómo: crea tu equipo e invita a tus compañeros por correo, únete con el código de 6 caracteres de tu equipo, o inscríbete individual.")
        + paso(2, "¿Aún sin equipo? Únete al grupo de Telegram", "En el tema <b>🔎 Buscando equipo</b> te presentas y armamos equipos de 2 a 5 personas.")
        + paso(3, "Prepárate", "Lee la Guía del hacker y ten lista tu cuenta de GitHub. El kick-off es el viernes 20 a las 15:30.")
        + '</table>'
        + '<p style="margin:8px 0 22px">' + boton(f"{WEB}/registro", "Registrar mi equipo", "#c9a24a", "#0e1b3d")
        + boton(TELEGRAM, "Unirme al grupo de Telegram", "#0e1b3d", "#ffffff") + '</p>'
        + '<div style="background:#fff6e0;border-left:4px solid #f0b23a;padding:12px 16px;border-radius:8px;margin:0 0 20px;font-size:14px;color:#0e1b3d">'
          '⏰ <b>El registro cierra el viernes 20 de noviembre a las 12:00</b> (hora de Ecuador). Sin registro en la plataforma no hay check-in.</div>'
        + p(f'Más información: <a href="{WEB}" style="color:#1d5fa8">sitio del hackathon</a> · '
            f'<a href="{WEB}/guia-hacker" style="color:#1d5fa8">Guía del hacker</a> · '
            f'<a href="{WEB}/tracks" style="color:#1d5fa8">Tracks</a>')
        + p("¡Nos vemos en Quito!<br><b>Equipo organizador · Hackathon EduTech</b>")
        + '</div><div style="padding:16px 28px;background:#f8f8fa;font-size:12px;color:#5b6478;line-height:1.5">'
          'Recibes este correo porque te inscribiste en el evento de Luma «n8n Hackathon Quito — Build with AI: EduTech». '
          'Si ya no quieres participar, responde a este correo y te quitamos de la lista.</div></div></div>')


def n8n(metodo, ruta, cuerpo=None):
    req = urllib.request.Request(API + ruta, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
                                 headers={"X-N8N-API-KEY": ENV["N8N_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read()
        return json.loads(t) if t else {}


def workflow(ruta):
    cred = {"id": ENV["GMAIL_CREDENCIAL_ID"], "name": "Gmail account"}
    return {
        "name": "TMP · Correo inscritos Luma (borrar)",
        "settings": {"executionOrder": "v1", "timezone": "America/Guayaquil", "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all"},
        "nodes": [
            {"id": str(uuid.uuid4()), "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "webhookId": str(uuid.uuid4()),
             "parameters": {"httpMethod": "POST", "path": ruta, "responseMode": "onReceived", "options": {}}},
            {"id": str(uuid.uuid4()), "name": "Separar", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 0],
             "parameters": {"jsCode": "return $input.first().json.body.correos.map((c) => ({ json: c }));"}},
            {"id": str(uuid.uuid4()), "name": "Enviar (Gmail)", "type": "n8n-nodes-base.gmail", "typeVersion": 2.1, "position": [660, 100],
             "parameters": {"sendTo": "={{ $json.para }}", "subject": "={{ $json.asunto }}", "emailType": "html", "message": "={{ $json.html }}",
                            "options": {"appendAttribution": False, "senderName": ENV.get("EDUTECH_CORREO_REMITENTE", "Hackathon EduTech")}},
             "credentials": {"gmailOAuth2": cred}, "onError": "continueRegularOutput"},
        ],
        "connections": {
            "Webhook": {"main": [[{"node": "Separar", "type": "main", "index": 0}]]},
            "Separar": {"main": [[{"node": "Enviar (Gmail)", "type": "main", "index": 0}]]},
        },
    }


def enviar(correos):
    ruta = "tmp-inscritos-" + secrets.token_hex(12)
    wf = n8n("POST", "/workflows", workflow(ruta))
    try:
        n8n("POST", f"/workflows/{wf['id']}/activate")
        time.sleep(3)
        base = ENV["N8N_API_URL"].rstrip("/")
        req = urllib.request.Request(f"{base}/webhook/{ruta}", data=json.dumps({"correos": correos}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                print("webhook:", r.status, r.read().decode()[:300])
        except urllib.error.HTTPError as e:
            print("webhook:", e.code, e.read().decode()[:500])
            return
        # Espera a que termine la ejecución y resume el resultado del nodo de Gmail.
        for _ in range(60 + 2 * len(correos)):
            time.sleep(3)
            ex = n8n("GET", f"/executions?workflowId={wf['id']}&includeData=true&limit=1")["data"]
            if ex and ex[0].get("finished") is not None and ex[0]["status"] not in ("running", "waiting", "new"):
                rd = ex[0].get("data", {}).get("resultData", {})
                salidas = [i["json"] for r in rd.get("runData", {}).get("Enviar (Gmail)", []) for i in (r.get("data", {}).get("main", [[]])[0] or [])]
                errores = [s.get("error") for s in salidas if s.get("error")]
                print(f"estado: {ex[0]['status']} · enviados: {len(salidas) - len(errores)} · fallidos: {len(errores)}", errores[:5], rd.get("error", {}).get("message", ""))
                break
        else:
            print("la ejecución no terminó a tiempo; revisa n8n")
    finally:
        try:
            n8n("POST", f"/workflows/{wf['id']}/deactivate")
        finally:
            n8n("DELETE", f"/workflows/{wf['id']}")
        print("workflow temporal borrado")


if __name__ == "__main__":
    modo = sys.argv[1]
    if modo == "vista":
        open(sys.argv[2], "w").write(correo_html("Felipe"))
        sys.exit()
    if modo == "prueba":
        correos = [{"para": sys.argv[2], "asunto": "[PRUEBA] " + ASUNTO, "html": correo_html("Felipe")}]
    else:
        filas = list(csv.DictReader(open(sys.argv[2], encoding="utf-8-sig"), delimiter=";"))
        vistos, correos = set(), []
        for f in filas:
            e = (f.get("email") or "").strip().lower()
            if f.get("approval_status") != "approved" or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", e) or e in vistos:
                continue
            vistos.add(e)
            correos.append({"para": e, "asunto": ASUNTO, "html": correo_html((f.get("first_name") or "").strip().title())})
        print("destinatarios:", len(correos))
        if "--si" not in sys.argv:
            sys.exit("Falta --si para enviar.")
    enviar(correos)
