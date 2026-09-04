# Tasks — `existsRecord()` booleano estrito

Cambio: `exists-record-boolean` · Fase SDD: `tasks` · `strict_tdd: true` · `test_cmd: bun test`

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~8 (4 en `test/sqliteAccions.test.js`, 1 en `lib/sqliteAccions.js` + ~3 en rename de test) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes|No
Chained PRs recommended: Yes|No
Chain strategy: stacked-to-main|feature-branch-chain|size-exception|pending
```

- Decision needed before apply: **No** — cambio mínimo de 2 ficheiros, ben por debaixo do orzamento de 400 liñas; o risco é baixo e xa está completamente especificado.
- Chained PRs recommended: **No** — un único PR é suficiente.
- Chain strategy: **pending** — non aplica encadeamento de PRs para un cambio de 2 ficheiros.
- 400-line budget risk: **Low**.

Estimación do cambio: só se tocan `lib/sqliteAccions.js` (+1 liña `return true;` na rama de existencia) e `test/sqliteAccions.test.js` (migración dun bloque de 6 liñas → 2 asercións + rename do título). Non hai migracións, artefactos xerados, docs, cross-cutting concerns nin puntos de integración. Non supera as 400 liñas por marxe moi ampla.

## Orde strict_tdd (RED → GREEN)

Cada tarefa ten comezo, fin, verificación e límite de rollback claros. Ambas execútase en fase `apply` co comando `bun test` (13 tests nos 3 ficheiros).

### T1 — RED: migrar o bloque de test a booleano estrito

- [x] En `test/sqliteAccions.test.js`, migrar o bloque do contrato de `existsRecord` (liñas ~47–52) do contrato actual `=== false` / `!== false` ao booleano estrito, co mesmo título descrito no design:
  ```js
  test('existsRecord: booleano estrito true/false', () => {
    expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE'])).toBe(false);
    expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001'])).toBe(true);
  });
  ```
  Non engadir fixtures novas: reutilízase o estado da táboa `test_licitacions` construído nos tests anteriores do mesmo ficheiro (`EXP-0001` existe, `EXP-NONEXISTE` non existe), xa que o estado non se reinicia entre tests do mesmo ficheiro.
- [x] Verificación RED: executar `bun test`. Mentres `existsRecord` devolve `undefined` para existentes, `expect(...['EXP-0001']).toBe(true)` falla → esperar 1 test vermello (os outros 12 verdes). Non avanzar a T2 ata confirmar este RED.
- [ ] Rollback: restaurar o bloque orixinal de `test/sqliteAccions.test.js`; non hai outra afectación.
  <!-- sdd-owner: implementation -->

### T2 — GREEN: engadir `return true;` na rama de existencia

- [x] En `lib/sqliteAccions.js`, na función `existsRecord` (liñas ~65–70), engadir `return true;` na rama de existencia, preservando exactamente a condición `row == undefined` (igualdade solta, que trata `null` como inexistente) e o `return false;` actual. Non facer ningún outro refactor (nin normalizar `==` a `===`, nin cambiar a consulta, nin capturar erros). Resultado final:
  ```js
  function existsRecord(table, headers, values) {
      const row = DB.prepare(`SELECT * FROM ${table} WHERE ${headers[0]} = ?`).get(values[0]);
      if(row == undefined) {
          return false;
      }
      return true; // 🔹 único engadido: booleano estrito
  }
  ```
- [x] Verificación GREEN: executar `bun test` → confirmar **13 pass / 0 fail** nos 3 ficheiros (1 test migrado).
- [ ] Rollback: quitar o `return true;` de `lib/sqliteAccions.js` volve ao contrato anterior; o test migrado quedaría vermello (comportamento TDD esperado), o chamador non cambia de forma.
  <!-- sdd-owner: implementation -->

## Non-obxectivos / límites de execución

- **Non tocar** `lib/parsearResultadosLicitacionsContratos.js` (import `:3` e chamada `:75`), nin o entrypoint principal, nin ningún outro ficheiro de `lib/` nin `test/`.
- **Non se normaliza** `==` a `===`, non se muda a consulta nin se capturan erros de táboa inexistente.
- **Non se toca** o repo duplicado `concellodeames_scrapper`.
- Verificación auxiliar (fase verify): a semántica de `isNew` no chamador non muda — inexistente → `false === false` → `isNew = true`; existente → `true === false` → `isNew = false`. Idéntico ao estado actual (`undefined === false` → `false`).