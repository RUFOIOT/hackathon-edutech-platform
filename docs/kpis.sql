-- Consultas SQL que verifican cada KPI del dashboard 360 contra el dataset exportado.
-- Se ejecutan con sqlite3 sobre los CSV de "Exportar dataset" (una tabla por hoja).
-- scripts/verificar-kpis.ts las corre contra el seed y compara con lo que muestra /admin.
-- Formato: una línea "-- kpi: <ruta>" seguida de una consulta que devuelve un solo valor.

-- kpi: convocatoria.inscritosTotales
SELECT COUNT(*) FROM participantes WHERE en_lista_espera = '0';
-- kpi: convocatoria.listaEspera
SELECT COUNT(*) FROM participantes WHERE en_lista_espera = '1';
-- kpi: convocatoria.equiposCompletos
SELECT COUNT(*) FROM equipos WHERE estado = 'completo';
-- kpi: convocatoria.individualesSinEquipo
SELECT COUNT(*) FROM participantes WHERE en_lista_espera = '0' AND team_id = '';
-- kpi: convocatoria.ocupacionCupoPct
SELECT ROUND(COUNT(*) * 100.0 / 150, 1) FROM participantes WHERE en_lista_espera = '0';
-- kpi: convocatoria.autorizacionesJuniorPendientes
SELECT COUNT(*) FROM participantes WHERE en_lista_espera = '0' AND categoria = 'JUNIOR' AND autorizacion_estado <> 'validado';
-- kpi: convocatoria.porTrack.T1
SELECT COUNT(*) FROM equipos WHERE track = 'T1';
-- kpi: convocatoria.porCategoria.JUNIOR
SELECT COUNT(*) FROM participantes WHERE en_lista_espera = '0' AND categoria = 'JUNIOR';
-- kpi: perfil.equiposSinConstruccion
SELECT COUNT(*) FROM equipos e WHERE NOT EXISTS (SELECT 1 FROM participantes p WHERE p.team_id = e.team_id AND CAST(p.nivel_desarrollo AS INTEGER) >= 3);
-- kpi: checkin.presentes
SELECT COUNT(*) FROM participantes WHERE en_lista_espera = '0' AND (checkin_viernes = '1' OR checkin_sabado = '1');
-- kpi: checkin.equiposConMenosDe2
SELECT COUNT(*) FROM equipos WHERE estado <> 'descalificado' AND CAST(presentes AS INTEGER) < 2;
-- kpi: repositorios.conRepoPct
SELECT ROUND(SUM(repo_registrado = '1') * 100.0 / COUNT(*), 1) FROM equipos WHERE estado <> 'descalificado';
-- kpi: repositorios.checkpoint1Pct
SELECT ROUND(SUM(checkpoint1 = 'cumplido') * 100.0 / COUNT(*), 1) FROM equipos WHERE estado <> 'descalificado';
-- kpi: repositorios.checkpoint2Pct
SELECT ROUND(SUM(checkpoint2 = 'cumplido') * 100.0 / COUNT(*), 1) FROM equipos WHERE estado <> 'descalificado';
-- kpi: repositorios.commitsTotales
SELECT SUM(CAST(commits AS INTEGER)) FROM kpis_por_hora;
-- kpi: repositorios.alertas.secretos
SELECT COUNT(*) FROM repos_snapshot WHERE tipos_alerta LIKE '%secreto%' OR tipos_alerta LIKE '%env-versionado%';
-- kpi: mentoria.abiertas
SELECT COUNT(*) FROM mentorias WHERE estado = 'abierta';
-- kpi: mentoria.tiempoMedioAtencionMin
SELECT ROUND(AVG(CAST(minutos_espera AS REAL)), 1) FROM mentorias WHERE minutos_espera <> '';
-- kpi: entregas.recibidas
SELECT COUNT(*) FROM entregas;
-- kpi: entregas.tagsMovidosTrasFreeze
SELECT COUNT(*) FROM entregas WHERE tag_movido_tras_freeze = '1';
-- kpi: entregas.fallasAdmisibilidad
SELECT COUNT(*) FROM equipos WHERE a1 <> '' AND (a1 = '0' OR a2 = '0' OR a3 = '0' OR a4 = '0' OR a5 = '0');
-- kpi: jurado.evaluacionesRegistradas
SELECT COUNT(*) FROM puntajes WHERE ronda = 'semifinal';
-- kpi: jurado.juecesConConflicto
SELECT COUNT(*) FROM jueces WHERE CAST(conflictos AS INTEGER) > 0;
-- kpi: semaforo.rojo
SELECT COUNT(*) FROM equipos WHERE estado <> 'descalificado' AND semaforo = 'rojo';
-- kpi: semaforo.ambar
SELECT COUNT(*) FROM equipos WHERE estado <> 'descalificado' AND semaforo = 'ambar';
-- kpi: semaforo.verde
SELECT COUNT(*) FROM equipos WHERE estado <> 'descalificado' AND semaforo = 'verde';
