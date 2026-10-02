# Dataset del dashboard 360

El botón **Exportar dataset** de `/admin` descarga los datos del evento en dos formatos:

- **CSV**: un ZIP con un archivo por hoja (`participantes.csv`, `equipos.csv`, …).
- **XLSX**: un libro con una hoja por tabla, cabecera en negrita y fila 1 fija.

El dataset es una tabla plana armada por `lib/dashboard/dataset.ts` (equivale a la vista
`v_dashboard_dataset` del prompt, ver D-36). Es la misma fuente con la que se calculan los KPIs
del dashboard, así que cualquier número de la pantalla se puede recalcular con SQL.

## Quién ve qué

| Rol | Contacto (nombres, apellidos, email, celular) | Hoja `puntajes` |
| --- | --- | --- |
| admin | Sí | Sí |
| comite | No | Sí |
| mesa_tecnica | No | No |

Cada exportación queda en `audit_log` (`dataset.export`, con los flags de contacto y puntajes).
Nunca se exportan cédulas, autorizaciones de menores ni tokens.

Fechas en ISO 8601 (UTC). `hora` y `fecha_inscripcion_dia` están en hora de Ecuador (UTC-5).
Los booleanos se exportan como `1` / `0`; vacío significa "no aplica" o "sin dato".

## Hojas y columnas

### participantes (una fila por persona inscrita)

`participant_id`, `team_id`, `categoria` (OPEN / JUNIOR), `nivel`, `ciudad`, `institucion`,
`rol_preferido`, `nivel_desarrollo`, `nivel_n8n`, `nivel_ia`, `nivel_diseno` (autoevaluación 0–3),
`hackathons_previos`, `modo_inscripcion` (equipo / codigo / individual), `en_lista_espera`,
`autorizacion_estado` (solo Junior: pendiente / validada / rechazada), `checkin_viernes`,
`checkin_sabado`, `fecha_inscripcion`, `fecha_inscripcion_dia`.
Solo admin: `nombres`, `apellidos`, `email`, `celular`.

### equipos (una fila por equipo)

`team_id`, `nombre`, `track` (T1–T3), `categoria`, `estado`, `miembros`, `requiere_adulto`,
`adulto_asignado`, `room_id`, `finalista`, `repo_registrado`, `checkpoint1`, `checkpoint2`
(ok / pendiente / falta), `commits_ventana`, `autores`, `ultimo_commit_at`, `entregado`,
`tag_sha`, `tag_movido_tras_freeze`, `a1`…`a5` (criterios de admisibilidad; `a4` vacío mientras la
mesa técnica no lo revise), `presentes`, `mentorias_abiertas`, `semaforo` (verde / ambar / rojo),
`semaforo_motivos` (separados por `; `).

### repos_snapshot (último snapshot por equipo)

`team_id`, `tomado_en`, `commits_en_ventana`, `autores`, `ultimo_commit_at`, `checkpoint1`,
`checkpoint2`, `alertas_rojas`, `alertas_ambar`, `tipos_alerta` (separados por `|`, p. ej.
`secreto|commit_antes_kickoff`). El historial completo de snapshots queda en Firestore.

### commits_por_hora

`team_id`, `hora` (`YYYY-MM-DD HH:00`, Ecuador), `commits`.

### entregas (solo equipos con tag de entrega)

`team_id`, `enviado_at`, `demo` (desplegada / ejecucion-local), `tiene_video`, `tag_sha`,
`tag_commit_at`, `tag_movido_tras_freeze`, `datos_sinteticos`, `prior_work`, `ai_usage`
(declaraciones del formulario de entrega).

### puntajes (solo admin y comité)

`ronda` (semifinal / final), `room_id`, `team_id`, `judge_id`, `c1`…`c6` (niveles 0–4), `total`
(0–100, con tope de 60 si C2 = 1), `tiempo_usado_seg`, `demo_en_vivo`.
Son puntajes crudos; la normalización por sala se calcula al publicar resultados.

### presentaciones

`room_id`, `team_id`, `ronda`, `orden`, `hora_programada`, `inicio_real`, `fin_real`,
`duracion_seg`, `atraso_min`.

### jueces

`judge_id`, `room_id`, `final`, `perfil`, `conflictos`, `conflictos_en_sala`, `evaluaciones`.
No incluye nombres: se cruzan con la lista del comité si hace falta.

### mentorias

`request_id`, `team_id`, `tema` (producto / tecnica / n8n / ia / pitch), `estado`
(abierta / atendida / cerrada), `abierta_at`, `atendida_at`, `minutos_espera`.

### kpis_por_hora

`hora`, `inscripciones`, `checkins`, `commits`, `mentorias`, `entregas`.

## Recalcular los KPIs con SQL

`docs/kpis.sql` tiene una consulta por KPI del dashboard (26 en total), cada una precedida de
`-- kpi: <ruta>`. Se escriben en SQL estándar y funcionan en sqlite3 y DuckDB.

### sqlite3

```bash
unzip edutech-dataset-*.zip -d dataset && cd dataset
sqlite3 kpis.db <<'SQL'
.mode csv
.import participantes.csv participantes
.import equipos.csv equipos
.import repos_snapshot.csv repos_snapshot
.import entregas.csv entregas
.import mentorias.csv mentorias
.import jueces.csv jueces
.import presentaciones.csv presentaciones
.import puntajes.csv puntajes
SQL
sqlite3 kpis.db < ../docs/kpis.sql
```

(Si exportaste como mesa técnica no hay `puntajes.csv`; las consultas que la usan se omiten.)

### DuckDB

```sql
CREATE VIEW participantes AS SELECT * FROM read_csv_auto('dataset/participantes.csv');
CREATE VIEW equipos AS SELECT * FROM read_csv_auto('dataset/equipos.csv');
-- … una vista por archivo, luego:
.read docs/kpis.sql
```

### Verificación automática

Con los emuladores y el seed cargados:

```bash
npm run dataset:verificar
```

Arma el dataset igual que `/admin`, calcula los KPIs con `lib/dashboard/kpis.ts`, carga los CSV
en sqlite3, corre `docs/kpis.sql` y compara valor por valor. Falla si alguno difiere.
