# Rúbrica de evaluación · Hackathon EduTech Eight Academy by n8n

Un solo instrumento para los tres tracks y ambas categorías. Lo evalúan el jurado en el Show and Tell y la validación automática del repositorio.

---

## 1. Filtro de admisibilidad (pasa o no pasa)

Se verifica antes del Show and Tell. Un equipo que no cumple los cinco puntos no es evaluado y el comité notifica el motivo.

| N° | Condición | Cómo se verifica |
|---|---|---|
| A1 | Repositorio en la organización oficial, creado después del kick-off | GitHub API · fecha de creación |
| A2 | Tag `entrega` creado antes de las 12:00 del sábado y no movido después | GitHub API · fecha del commit etiquetado y registro del webhook |
| A3 | `README.md`, `PRIOR_WORK.md` y `AI_USAGE.md` presentes | Lectura automática del árbol del repositorio |
| A4 | El proyecto corresponde al track inscrito | Mesa técnica |
| A5 | Declaración de datos sintéticos firmada en el formulario de entrega | Plataforma |

## 2. Criterios y pesos

| Código | Criterio | Peso | Evalúa |
|---|---|---|---|
| C1 | Problema y usuario | 20 % | Jurado |
| C2 | Solución funcionando en vivo | 25 % | Jurado |
| C3 | Calidad técnica y repositorio | 15 % | Jurado técnico + métricas automáticas |
| C4 | Automatización e inteligencia (n8n / IA) | 15 % | Jurado |
| C5 | Viabilidad e impacto en la institución educativa | 10 % | Jurado |
| C6 | Show and Tell | 15 % | Jurado |

**Regla de no compensación:** si C2 obtiene 1, el puntaje total del equipo no puede superar 60/100, sin importar el resto. Una presentación brillante no compensa un producto que no funciona.

## 3. Descriptores (escala 1 a 5)

### C1 · Problema y usuario (20 %)

| Nivel | Descriptor |
|---|---|
| 5 | Problema específico, con evidencia de campo (entrevistas o datos) y un usuario concreto. El equipo sabe qué no va a resolver. |
| 4 | Problema claro con un usuario identificado y alguna evidencia, aunque parcial. |
| 3 | Problema razonable pero genérico; el usuario se describe como categoría ("los estudiantes"). |
| 2 | El problema se infiere de la solución, sin evidencia. |
| 1 | No se identifica un problema educativo real. |

### C2 · Solución funcionando en vivo (25 %)

| Nivel | Descriptor |
|---|---|
| 5 | El flujo principal corre en vivo de punta a punta, con datos, sin intervención manual oculta. |
| 4 | Funciona en vivo con fallas menores que no impiden entender el valor. |
| 3 | Funciona parcialmente; una parte clave se muestra simulada y el equipo lo declara. |
| 2 | Solo se muestran pantallas o un video; nada se ejecuta en vivo. |
| 1 | No hay producto demostrable. |

### C3 · Calidad técnica y repositorio (15 %)

| Nivel | Descriptor |
|---|---|
| 5 | Arquitectura coherente, código legible, README permite ejecutarlo, historial de commits distribuido en el tiempo y entre integrantes, sin secretos expuestos. |
| 4 | Buena estructura con huecos menores de documentación o historial. |
| 3 | Funciona, pero el repositorio es difícil de seguir o el historial está concentrado en pocos commits. |
| 2 | Código desordenado, sin instrucciones de ejecución. |
| 1 | Repositorio incompleto o con secretos expuestos. |

**Insumo automático (se muestra al jurado, no puntúa por sí solo):** número de commits en la ventana, número de autores, horas con actividad, presencia de `.env.example`, alertas de secretos.

### C4 · Automatización e inteligencia (15 %)

| Nivel | Descriptor |
|---|---|
| 5 | La automatización o la IA resuelve una parte esencial del problema, con criterio: el equipo explica qué verifica, cuáles son los límites y qué pasa si falla. Workflows exportados en el repositorio. |
| 4 | Uso relevante y bien integrado, con explicación parcial de límites. |
| 3 | Uso correcto pero accesorio; el producto funcionaría casi igual sin él. |
| 2 | Uso decorativo o no verificado. |
| 1 | No hay automatización ni IA, o su uso no se declaró. |

### C5 · Viabilidad e impacto (10 %)

| Nivel | Descriptor |
|---|---|
| 5 | Ruta clara de adopción en una institución real: quién la usa, quién paga o quién la sostiene, costo aproximado y siguiente paso concreto. |
| 4 | Ruta de adopción plausible con supuestos razonables. |
| 3 | Se menciona un modelo, sin validar. |
| 2 | Impacto declarado sin ruta. |
| 1 | No se considera la adopción. |

En T3 (comercial y administrativo) este criterio exige estimar el ahorro de tiempo o dinero del proceso automatizado.

### C6 · Show and Tell (15 %)

| Nivel | Descriptor |
|---|---|
| 5 | Narrativa clara, demo bien guiada, dentro de los 8 minutos, respuestas precisas al jurado. |
| 4 | Clara y dentro de tiempo, con algún tramo confuso. |
| 3 | Se entiende, pero excede el tiempo o las respuestas son vagas. |
| 2 | Desordenada; el jurado no logra entender el valor. |
| 1 | No se presenta o no se ajusta al formato. |

## 4. Cálculo del puntaje

Puntaje del criterio = (nivel ÷ 5) × peso.
Puntaje del juez = suma de los seis criterios, sobre 100.
Puntaje del equipo en la sala = promedio de los jueces de esa sala, aplicando la regla de no compensación de C2.

**Ejemplo:** C1=4, C2=5, C3=3, C4=4, C5=3, C6=4
= 16 + 25 + 9 + 12 + 6 + 12 = **80/100**

## 5. Normalización entre salas

Cuando la semifinal usa más de una sala, cada sala tiene jurados distintos. Para comparar de forma justa, el puntaje de cada equipo se normaliza dentro de su sala:

`z = (puntaje del equipo − promedio de la sala) ÷ desviación estándar de la sala`

Los 5 mejores valores de z pasan a la final. En la final, el mismo jurado evalúa a los 5 equipos con la rúbrica completa desde cero y no se arrastran puntajes. Si una sala tiene menos de 4 equipos, no se normaliza y el comité decide los cupos.

## 6. Desempates (en este orden)

1. Mayor puntaje en C2.
2. Mayor puntaje en C1.
3. Menor tiempo de exposición utilizado.
4. Votación del jurado de la final.

## 7. Premios especiales

| Premio | Base de decisión |
|---|---|
| Mejor por track | Mayor puntaje de la semifinal dentro del track, excluyendo a los 3 ganadores generales |
| Premio n8n | Mayor puntaje en C4 entre equipos con workflows de n8n en `/n8n` · desempata el representante de n8n |
| Mejor equipo Junior | Mayor puntaje entre equipos 100 % Junior |
| Pase a la Aceleradora | Comité, entre el top 10, priorizando C1 y C5 |

## 8. Integridad del jurado

- Cada juez declara conflictos de interés en la plataforma antes de evaluar. Un juez con conflicto no puntúa a ese equipo y su promedio se calcula con los jueces restantes.
- Los puntajes se registran en la plataforma durante los 3 minutos posteriores a cada presentación. No se modifican después del cierre de la sala sin autorización del comité, y todo cambio queda en el registro de auditoría.
- Cada juez escribe al menos una fortaleza y una recomendación por equipo. Ese texto se envía a los equipos con su resultado.

## 9. Hoja de evaluación del juez

```
Equipo: ____________________   Track: T__   Sala: ___   Juez: ____________
Conflicto de interés: [ ] No  [ ] Sí → no evaluar

C1 Problema y usuario            (20 %)  1 2 3 4 5
C2 Solución en vivo              (25 %)  1 2 3 4 5
C3 Calidad técnica y repositorio (15 %)  1 2 3 4 5
C4 Automatización e IA           (15 %)  1 2 3 4 5
C5 Viabilidad e impacto          (10 %)  1 2 3 4 5
C6 Show and Tell                 (15 %)  1 2 3 4 5

Tiempo usado: __:__    Demo en vivo: [ ] Sí  [ ] Respaldo autorizado
Fortaleza: ______________________________________________
Recomendación: __________________________________________
```
