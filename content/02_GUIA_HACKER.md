# Guía del Hacker · Hackathon EduTech Eight Academy by n8n

Todo lo que tu equipo necesita para llegar, construir y entregar. Léela completa antes del 6 de noviembre.

---

## 1. Antes del evento

**Checklist individual**

- [ ] Inscripción completa en la web y correo de confirmación recibido.
- [ ] Cuenta de GitHub activa, con tu usuario registrado en el formulario.
- [ ] Git instalado y configurado con el mismo correo de tu cuenta de GitHub (`git config --global user.email`), para que tus commits cuenten como tuyos.
- [ ] Cuenta en n8n Cloud o n8n local con Docker funcionando.
- [ ] Laptop, cargador, extensión eléctrica y adaptador de video (HDMI o USB-C).
- [ ] Categoría Junior: autorización del representante legal firmada y cargada.

**Checklist de equipo**

- [ ] Entre 2 y 5 integrantes confirmados en la plataforma.
- [ ] Track elegido: T1 problemáticas de la educación, T2 infraestructura de sistemas estudiantiles o T3 soluciones comerciales y administrativas.
- [ ] Un problema candidato y una persona real que lo vive, para entrevistarla.
- [ ] Roles definidos (ver sección 3).

Puedes llegar con ideas, bocetos e investigación. **No puedes llegar con código del proyecto ya escrito.**

## 2. Stack recomendado

No hay stack obligatorio. Lo que sí se exige es que funcione en vivo y que cualquier jurado técnico pueda ejecutarlo con las instrucciones del README.

| Capa | Opciones sugeridas |
|---|---|
| Automatización | n8n (cuenta para el premio especial) |
| Frontend | Next.js, React, Vue, Svelte, Flutter, o no-code con exportación |
| Backend y datos | Supabase, Firebase, PostgreSQL, SQLite, Google Sheets vía n8n |
| IA | APIs de Claude, OpenAI, Gemini, modelos locales con Ollama |
| Despliegue | Netlify, Vercel, Render, Railway, o ejecución local documentada |

## 3. Roles del equipo

Los roles no son exclusivos, pero cada uno debe tener un dueño.

| Rol | Responsabilidad |
|---|---|
| Producto | Define el problema y el usuario, prioriza qué entra y qué no |
| Construcción | Arquitectura, código y despliegue |
| Automatización | Flujos de n8n e integraciones |
| Datos e IA | Datos sintéticos, modelos y prompts |
| Pitch | Narrativa, demo y control del tiempo en el Show and Tell |

## 4. Repositorio: cómo se arma

### 4.1 Crear el repositorio (solo desde las 15:30 del viernes)

1. Entra a la organización `eight-academy-hackathon` con la invitación que recibirás por correo.
2. Crea tu repositorio desde la plantilla `edutech-2026-template` con el botón *Use this template*.
3. Nómbralo `edutech26-t{track}-{slug}`. Ejemplo: `edutech26-t1-alerta-temprana`.
4. Registra la URL del repositorio en la plataforma, en la pestaña de tu equipo.

Un repositorio creado antes del kick-off o fuera de la organización no se acepta.

### 4.2 Estructura obligatoria

```
edutech26-t1-alerta-temprana/
├── README.md            ← problema, usuario, solución, cómo correrlo, equipo
├── PRIOR_WORK.md        ← todo lo que no escribieron en el evento
├── AI_USAGE.md          ← qué herramientas de IA usaron y para qué
├── LICENSE              ← MIT recomendado
├── .env.example         ← variables necesarias, sin valores reales
├── docs/
│   ├── arquitectura.png ← diagrama de la solución
│   └── pitch.pdf        ← presentación del Show and Tell
├── n8n/
│   └── *.json           ← workflows exportados (si usan n8n)
├── data/
│   └── README.md        ← origen de los datos; confirmar que son sintéticos
└── src/                 ← el código
```

### 4.3 Reglas de commits

- Commits pequeños y frecuentes. El jurado revisa el historial: un solo commit gigante a las 11:59 resta en la rúbrica.
- Cada integrante que construye debe tener commits con su usuario.
- Nunca subas claves, tokens ni contraseñas. Usa `.env` y `.gitignore`. Una clave expuesta te obliga a rotarla y queda registrada como incidente.
- Mensajes descriptivos: `feat: alerta por inasistencia en flujo n8n`, no `cambios`.

## 5. Checkpoints obligatorios

| Hora | Checkpoint | Qué debe existir en el repositorio |
|---|---|---|
| Vie 19:00 | 1 · Problema | README con problema, usuario, evidencia de la entrevista y arquitectura propuesta |
| Sáb 10:30 | 2 · Demo mínima | Algo ejecutable de punta a punta, aunque sea feo |
| Sáb 12:00 | Code freeze | Tag `entrega` creado y formulario de entrega enviado |

La plataforma lee tu repositorio cada 15 minutos y muestra tu estado en el dashboard. Si un checkpoint aparece en rojo, la mesa técnica te contacta.

## 6. Cómo entregar (antes del sábado a las 12:00)

```bash
git add .
git commit -m "release: entrega final hackathon edutech 2026"
git tag entrega
git push origin main --tags
```

Luego, en la plataforma, pestaña **Entregar proyecto**:

1. Confirma la URL del repositorio.
2. Pega el enlace a la demo desplegada, o indica "ejecución local".
3. Sube el PDF del pitch.
4. Marca las declaraciones: datos sintéticos, trabajo previo declarado, uso de IA declarado.
5. Pulsa **Entregar proyecto**. Recibirás un correo con el hash del commit evaluado.

Si mueves el tag `entrega` después de las 12:00, el sistema lo detecta y el comité revisa el caso.

## 7. Show and Tell: 12 minutos

Tienes 12 minutos como máximo: 8 para exponer y demostrar, 4 para responder al jurado. El cronómetro es visible y el micrófono se apaga al minuto 12.

| Minuto | Bloque | Lo que el jurado necesita ver |
|---|---|---|
| 0:00 – 1:00 | El problema | Un dato o una historia real, no una definición |
| 1:00 – 2:00 | El usuario | A quién entrevistaron y qué aprendieron |
| 2:00 – 6:00 | Demo en vivo | El flujo principal funcionando de inicio a fin |
| 6:00 – 7:00 | Cómo está construido | Arquitectura, repositorio, automatizaciones |
| 7:00 – 8:00 | Por qué se adoptaría | Quién paga o quién lo usa mañana, y el siguiente paso |
| 8:00 – 12:00 | Preguntas | Respuestas directas; "no lo sabemos aún" es una respuesta válida |

**Consejos que suman puntos**

- Abre la demo antes de tu turno y ten un usuario de prueba con sesión iniciada.
- Ten un video de 60 segundos como respaldo si la red falla. Solo se usa si la mesa técnica confirma la falla.
- Muestra el repositorio en pantalla al menos 20 segundos.
- Ensaya con cronómetro dos veces el sábado por la mañana.

## 8. Datos y privacidad

- Trabajen solo con datos sintéticos. Si necesitan datos de ejemplo de un colegio, la mesa técnica entrega un dataset ficticio de estudiantes, notas, asistencia y pensiones.
- Si entrevistan a personas, no registren nombres completos ni datos sensibles: usen códigos como `EST-014`.
- Proyectos para menores de edad deben explicar en el README cómo protegerían sus datos en una implementación real.

## 9. Mentoría

Los mentores te ayudan a pensar, no escriben tu código. Pide mentoría desde la plataforma, pestaña **Pedir mentor**, indicando el tema: producto, técnica, n8n, IA o pitch. Hay dos rondas fijas y mentoría a demanda mientras la sede esté abierta.

## 10. Preguntas frecuentes

**¿Puedo cambiar de track durante el evento?** Sí, hasta el checkpoint 1 del viernes a las 19:00.

**¿Puedo usar un proyecto que ya tenía?** No como proyecto. Puedes reutilizar librerías o componentes genéricos declarándolos en `PRIOR_WORK.md`.

**¿Debo quedarme toda la noche en la sede?** No. La sede cierra a las 21:00 del viernes. Pueden seguir trabajando de forma remota y los commits cuentan.

**¿La IA está permitida?** Sí, y debe declararse. El jurado valora el criterio con el que la usaron.

**¿Qué pasa si mi demo falla en vivo?** El jurado evalúa con lo que ve y con el repositorio. Por eso el respaldo y el checkpoint 2 importan.

## 11. Contactos durante el evento

| Necesidad | Dónde |
|---|---|
| Problemas con la plataforma o GitHub | Mesa técnica · canal `#soporte-tecnico` |
| Logística, comida, horarios | Coordinación operativa |
| Bienestar o incidentes | DECE / Inspección |
| Reglas y disputas | Comité organizador |
