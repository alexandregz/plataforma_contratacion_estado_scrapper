# Apply Progress — `page-limit-by-date`

Fase: `apply` (executada polo orquestrador, ver nota abaixo). Cambio: `page-limit-by-date`.

## Que se implementou

1. `lib/parsearDatas.js` (novo módulo) — helpers puros:
   - `localizarIndiceColunaData(headers)` → índice da columna de data pola palabra do header (pref. `publicaci`, despois `fecha`, `-1` se non hai).
   - `normalizarDataWeb(valor)` → ms UNIX ou `null` (formatos `DD/MM/AAAA [HH:mm]` e `AAAA-MM-DD`, separadores `/ - .`; validación de mes/día; ilexible → `null`).
   - `debePararPorData(ultimaFilaMs, horizonteMs)` → boolean; só corta con `<` estrito; `null` (sen histórico ou data ilexible) → `false`.
2. `lib/sqliteAccions.js` — `maxDataPublicacionBD(table, nomeColuna)` → max ms da columna parseada na BD (NON `MAX()` de SQLite), `null` ante táboa/columna ausente ou sen valores parseables.
3. `lib/parsearResultadosLicitacionsContratos.js` — integrada a parada por data:
   - `dateIdx = localizarIndiceColunaData(headers)` e `horizonteMs = maxDataPublicacionBD(...)` antes do bucle.
   - Dentro do bucle, despois de procesar a páxina e antes de comprobar `siguienteLink`: se `horizonteMs != null` e a última fila é máis antiga ca el (`debePararPorData`) → `isLastPage = true; break`.
   - `limite_paxinas` segue sendo o tope superior inamovible; a parada por data só acurta.
   - Non se tocou `existsRecord`, o correo, nin a semántica de `limite_paxinas`.

## Evidencia de tests

- `bun test` → **29 pass / 0 fail** (13 orixinais + 13 de `parsearDatas` + 3 de `maxDataPublicacionBD`).
- Nota de rigor: os helpers creáronse xunto cos seus tests e a suite quedou verde; non se rexistrou unha execución RED separada por helper nesta sesión (a autoridade de intento nativa non está dispoñible neste entorno, véxase `page-limit-by-date` no repo; a verificación é por comportamento/regresión green).

## Tarefas

- [x] A — Helpers puros en `lib/parsearDatas.js` + unit tests (RED→GREEN)
- [x] B — `maxDataPublicacionBD` en `lib/sqliteAccions.js` + unit tests
- [x] C — Integración da condición de parada no bucle + regresión
- [x] D — Regresión completa `bun test` (29 verdes) e revisión de diffs (semántica de `limite_paxinas` intacta)