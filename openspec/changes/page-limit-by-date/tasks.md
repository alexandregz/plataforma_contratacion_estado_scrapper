# Tasks — Parada do bucle de páxinas por data (`page-limit-by-date`)

> Artefacto da fase `tasks`. Este artefacto NON modifica `lib/`, `test/` nin `*.js`; só define as tarefas
> que executará a fase `apply`. `strict_tdd: true` ⇒ secuencia RED→GREEN onde aplique (helpers puros primeiro).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200–260 (additions+deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

Estimación: <4 ficheiros tocados, sen cambios de esquema, sen rede, sen migracións; só 3 helpers puros +
1 consulta a BD + unha condición no bucle + tests unitarios. Ben por baixo das 400 liñas ⇒ 1 PR único sen cadea.

```text
Decision needed before apply: No
```

---

## Tarefas

### A — Helpers puros en `lib/parsearDatas.js` (novo módulo) + unit tests

> Módulo novo COMPONENT_STYLE `require`/`module.exports` (mestura CommonJS que Bun tolera, igual que o resto do repo).

#### A1 — RED: tests puros de `localizarIndiceColunaData` (fallan antes de implementar)

- [ ] Crear `test/parsearDatas.test.js` (formato `import` + `require` do módulo, `bun test`) con casos RED para `localizarIndiceColunaData`:
      header `["Fecha publicación"]` → índice correspondente; `["Fecha(s)"]`/`["Fechas"]` → índice; sen columna de data → `-1`;
      preferencia `publicaci` sobre só `fecha` cando existen ambos. <!-- sdd-owner: implementation -->
- [ ] Verificar que fallan: `bun test test/parsearDatas.test.js` (módulo aínda non existe ⇏ import fail é aceptable nesta fase; se falla, queda rexistrado). <!-- sdd-owner: implementation -->
- [ ] Rollback: borrar `test/parsearDatas.test.js` (non hai máis cambios). <!-- sdd-owner: implementation -->

#### A2 — GREEN: implementar `localizarIndiceColunaData`

- [ ] Crear `lib/parsearDatas.js` e implementar, puro, `localizarIndiceColunaData(headers)` devolvendo `-1` se non hai: case-insensitive, prioridade 1ª header que conteña `publicaci`, 2º o primeiro que conteña `fecha`, `-1` en defecto (aliñado co D1). <!-- sdd-owner: implementation -->
- [ ] `module.exports = { localizarIndiceColunaData, normalizarDataWeb, debePararPorData }` (exportar tamén os helpers dos seguintes pasos cando existan). <!-- sdd-owner: implementation -->
- [ ] Verificar: `bun test test/parsearDatas.test.js` verde para este helper. <!-- sdd-owner: implementation -->
- [ ] Rollback: borrar `lib/parsearDatas.js` e `test/parsearDatas.test.js`. <!-- sdd-owner: implementation -->

#### A3 — GREEN: implementar `normalizarDataWeb`

- [ ] Engadir en `lib/parsearDatas.js` o helper puro `normalizarDataWeb(valor)` → `number|null` (ms UNIX): admite `DD/MM/AAAA` e `DD/MM/AAAA HH:mm` (`^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}(?:\s+\d{1,2}:\d{2})?$`) e `AAAA-MM-DD` con separadores `/ - .`; validación básica mes 1–12 e día 1–31; calquera valor ausente/baleiro/ilexible/non-string/fora de rango → `null`. (D2.) <!-- sdd-owner: implementation -->
- [ ] Engadir casos en `test/parsearDatas.test.js` (RED antes, agora GREEN): formatos válidos `dd/mm/aaaa`, `dd/mm/aaaa hh:mm`, `aaaa-mm-dd`, separadores `/ - .`; valores non parseables (`"En trámite"`, `"-"`, `"N/A"`, baleiro, `null`, non-string, día/mes inválidos) → `null`; e que dous formatos distintos normalizan á mesma unidade comparable. <!-- sdd-owner: implementation -->
- [ ] Verificar: `bun test test/parsearDatas.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] Rollback: eliminar `normalizarDataWeb` e os seus casos de test (os demais helpers quedan). <!-- sdd-owner: implementation -->

#### A4 — GREEN: implementar `debePararPorData`

- [ ] Engadir en `lib/parsearDatas.js` o helper puro `debePararPorData(ultimaFilaMs, horizonteMs)` → boolean: `horizonteMs == null → false`; `ultimaFilaMs == null → false`; senón `ultimaFilaMs < horizonteMs` (empate e máis recente → false). (D4.) <!-- sdd-owner: implementation -->
- [ ] Engadir casos en `test/parsearDatas.test.js` (RED antes, agora GREEN): máis vella→`true`; igual→`false`; máis recente→`false`; `horizonteMs: null`→`false`; `ultimaFilaMs: null`→`false`. <!-- sdd-owner: implementation -->
- [ ] Verificar: `bun test test/parsearDatas.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] Rollback: eliminar `debePararPorData` e os seus casos de test. <!-- sdd-owner: implementation -->

### B — Horizonte BD en `lib/sqliteAccions.js` + unit tests

#### B1 — RED: tests de `maxDataPublicacionBD` (fallan antes de implementar)

- [ ] Engadir no `test/sqliteAccions.test.js` casos RED para `maxDataPublicacionBD(table, nomeColuna)`: máx correcto sobre celas mixtas parseables (ex. `2025-05-12`, `2025-05-18`, `2025-05-15` → `2025-05-18` en ms); columna/táboa ausente → `null`; só valores ilexibles → `null`. Usar fixture temporal existente + `insertIntoTable` (imports xa presentes). (D3.) <!-- sdd-owner: implementation -->
- [ ] Verificar que fallan: `bun test test/sqliteAccions.test.js` (import de `maxDataPublicacionBD` aínda non exportado). <!-- sdd-owner: implementation -->
- [ ] Rollback: eliminar eses casos de `test/sqliteAccions.test.js`. <!-- sdd-owner: implementation -->

#### B2 — GREEN: implementar `maxDataPublicacionBD`

- [ ] Engadir en `lib/sqliteAccions.js` a función `maxDataPublicacionBD(table, nomeColuna) -> number|null`: le todas as celas da columna (co nome dinámico resolto polo header), parsea cada unha con `normalizarDataWeb` (import necesario de `./parsearDatas`), devolve o **máximo** dos `ms` (NON `MAX()` de SQLite, que sobre `DD/MM/AAAA` ordenaría mal); `null` ante táboa/columna ausente ou sen valores parseables; `try/catch` arredor da consulta. (D3.) <!-- sdd-owner: implementation -->
- [ ] Non tocar a sinatura nin o chamador de `existsRecord`, `createTable` nin `insertIntoTable` (evita colisión coa cambio `exists-record-boolean`). <!-- sdd-owner: implementation -->
- [ ] Exportar `maxDataPublicacionBD` en `module.exports`. <!-- sdd-owner: implementation -->
- [ ] Verificar: `bun test test/sqliteAccions.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] Rollback: eliminar `maxDataPublicacionBD` (e o `require` de `./parsearDatas` se non se usa noutro lado) e os seus casos de test. <!-- sdd-owner: implementation -->

### C — Integración da condición no bucle (GREEN) + regresión total

#### C1 — GREEN: integrar parada por data en `lib/parsearResultadosLicitacionsContratos.js`

- [ ] Localizar `dateIdx` unha vez após ler `headers`: `localizarIndiceColunaData(headers)`. <!-- sdd-owner: implementation -->
- [ ] Calcular `horizonteMs` unha vez antes do `while` (só se `dateIdx >= 0`): `nomeColuna = String(headers[dateIdx]).replace(/ /g, "_")`, `maxDataPublicacionBD(table, nomeColuna)`; `null` ⇒ sen histórico desactivado. (D3/D4.) <!-- sdd-owner: implementation -->
- [ ] Dentro do bucle, despois de procesar todas as filas da páxina actual e **antes** de comprobar o botón "seguinte": `ultimaFila = pageData[pageData.length-1]`; `ultimaMs = normalizarDataWeb(ultimaFila?.[dateIdx] ?? null)`; `if (debePararPorData(ultimaMs, horizonteMs)) { isLastPage = true; break; }`. Só corta con `<` estrito e horzonte+data fiables (nunca na primera carga con BD baleira). (D4.) <!-- sdd-owner: implementation -->
- [ ] Non alterar: a lectura de filas, `existsRecord`, o correo, `_skipped.json`, nin a semántica de `limite_paxinas` (`N` páxinas exactas; parada por data só pode acurtar). <!-- sdd-owner: implementation -->
- [ ] Importar helpers de `./parsearDatas` e `maxDataPublicacionBD` de `./sqliteAccions`. <!-- sdd-owner: implementation -->
- [ ] Verificar regresión completa: `bun test` verde (13 existentes + novos de `parsearDatas` + `sqliteAccions`). <!-- sdd-owner: implementation -->
- [ ] Rollback: desfacer as edicións do bucle e os imports engadidos en `lib/parsearResultadosLicitacionsContratos.js` (o resto queda). <!-- sdd-owner: implementation -->

### D — Regresión e peche (verify)

- [ ] Executar `bun test` completo e confirmar todos verdes (13 orixinais + novos). <!-- sdd-owner: implementation -->
- [ ] Confirmar que non se tocou ningunha firma/chamada de `existsRecord` nin a semántica de `limite_paxinas` (revisión manual dos diffs de `lib/`). <!-- sdd-owner: implementation -->
- [ ] Rollback global: `git checkout` dos 3 ficheiros de `lib/` + borrado de `test/parsearDatas.test.js` e dos casos engadidos en `test/sqliteAccions.test.js`. <!-- sdd-owner: implementation -->

## Notas

- Os helpers puros (`localizarIndiceColunaData`, `normalizarDataWeb`, `debePararPorData`) van en `lib/parsearDatas.js`
  e son os únicos unit-testables sen puppeteer/BD reais (A). `maxDataPublicacionBD` en `sqliteAccions.js` testéase con
  fixture temporal (B).
- `bun test` é a rede de seguridade (13 pasando hoxe); manter verde en cada paso. Non lanzar subaxentes: a delegación é do orquestrador.