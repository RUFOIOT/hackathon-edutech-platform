# Plataforma · Hackathon EduTech Eight Academy by n8n

Web pública, registro, portal de equipos, módulo de jurado y dashboard 360 del evento
(6 y 7 de noviembre de 2026, Quito).

## Requisitos

- Node.js 20+ (CI usa 22)
- Java 21+ para los emuladores de Firebase
- Firebase CLI (`npm i -g firebase-tools`)

## Arranque local

```bash
npm install
cp .env.example .env.local   # para emuladores, ver valores sugeridos en CLAUDE.md
npm run emulators            # terminal 1
npm run seed                 # terminal 2, una vez
npm run dev                  # terminal 2 → http://localhost:3000
```

Ingresa en `/ingresar` con un correo del seed (p. ej. `staff-admin@edutech.test`). El enlace
mágico aparece en la terminal de los emuladores.

## Verificación

```bash
npm run lint && npm run typecheck && npm test && npm run test:rules && npm run build
```

Más detalle: [`CLAUDE.md`](CLAUDE.md) · decisiones: [`docs/DECISIONES.md`](docs/DECISIONES.md).
