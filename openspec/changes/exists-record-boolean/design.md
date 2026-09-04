# Design — `existsRecord()` booleano estrito

Fase SDD: `design`. Cambio: `exists-record-boolean`.

## Contexto e obxectivo

`existsRecord(table, headers, values)` en `lib/sqliteAccions.js` retorna hoxe `false`
na rama de non existencia (`row == undefined`) pero non ten `return` na rama de
existencia, polo que retorna `undefined` (implícito de JS) cando o rexistro existe.
Iso converte a función nun enum implícito de dous estados en lugar dun predicado puro.

O obxectivo é endurecer o contrato a booleano estrito `true`/`false` sen **ningunha**
alteración funcional na detección de expedientes novos en runtime. O único chamador en
produción, `lib/parsearResultadosLicitacionsContratos.js:75`
(`const isNew = existsRecord(table, headers, el) === false;`), xa normaliza contra
`=== false`, así que `true`/`false` estritos producen exactamente o mesmo `isNew`.
É un cambio mínimo de 2 ficheiros.

## Decisións técnicas de implementación

### D1. Decisión principal: `return true;` na rama de existencia (vs `!!row`)

Engádese `return true;` na rama de existencia de `existsRecord`, mantendo sen tocar a
condición `row == undefined` (igualdade solta) como condición de non existencia e o
`return false;` actual.

```js
function existsRecord(table, headers, values) {
    const row = DB.prepare(`SELECT * FROM ${table} WHERE ${headers[0]} = ?`).get(values[0]);
    if(row == undefined) {
        return false;
    }
    return true; // 🔹 único engadido: booleano estrito
}
```

**Alternativa descartada — `return !!row;`:** produce idéntico resultado observable
(`!!row` → `true` para fila existente, `false` para `null`/`undefined`), pero é menos
explícito sobre o contrato e esixiría eliminar a rama condicional actual, o que
diluiría o diferencial mínimo demandado. Mantemos `return true;` / `return false;`
por claridade e por deixar visible a invariante de non existencia.

**Por que non tocar o chamador:** `lib/parsearResultadosLicitacionsContratos.js` xa
reduce o resultado con `=== false`. Modificalo engadiría ruído e risco sen beneficio;
queda intacto voluntariamente.

### D2. Preservar `row == undefined` (non normalizar `==` a `===`)

A condición de non existencia segue sendo `if(row == undefined)`. A igualdade solta é
intencionada: `bun:sqlite` `.get()` devolve tanto `null` como `undefined` para
absencia de fila, e `undefined == null` é `true` en JS. Cambiar a `===` alteraría o
tratamento de `null` (que deixaría de caer na rama de non existencia como `null ===
undefined` é `false`), mudando a semántica de "fila existente". Endurecer a `===` é
un traballo futuro separado e explícito, fóra do alcance deste cambio.

### D3. Orde de implementación baixo `strict_tdd: true` (`test_cmd: bun test`)

A orde exacta de aplicación en fase `apply` (RED→GREEN), ambas con `bun test`:

1. **RED — migrar o test primeiro:**
   `test/sqliteAccions.test.js` (bloque liñas 47–52), que hoxe valida o contrato
   `false`/`undefined`:
   ```js
   test('existsRecord: contrato usado no parseador (=== false cando non existe)', () => {
     // NOTA: a corrección de que devolva booleano true/false explícito é a Tarefa 4,
     // que levará os seus propios tests. Aquí validamos o contrato actual do chamador.
     expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE']) === false).toBe(true);
     expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001']) !== false).toBe(true);
   });
   ```
   migrase a booleano estrito:
   ```js
   test('existsRecord: booleano estrito true/false', () => {
     expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE'])).toBe(false);
     expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001'])).toBe(true);
   });
   ```
   Neste momento, coa implementación sen cambiar, `existsRecord(...['EXP-0001'])`
   devolve `undefined`, polo que `expect(...).toBe(true)` falla → **RED** (1 test
   falla, os outros 12 seguen verdes).

2. **GREEN — engadir `return true;`:**
   en `lib/sqliteAccions.js`, na rama de existencia de `existsRecord`, sen outro
   refactor. Re-executar `bun test` → 13 pass / 0 fail (1 test migrado).
   O test do bloque migrado xa valida o predicate puro co que o chamador segue
   funcionando idéntico.

**Fixture reutilizada:** non se engaden fixtures novas. Reutilízase o estado da táboa
`test_licitacions` construído no primeiro test (`insertIntoTable(..., ['EXP-0001', ...])`),
xa que no mesmo ficheiro de test o estado da táboa non se reinicia entre tests
(self-validado por `totalRowsInTable`); `EXP-NONEXISTE` segue sen existir na táboa.

## Tradeoffs documentados

| Decisión | Opción A (elixida) | Opción B (descartada) | Razoado |
| --- | --- | --- | --- |
| Ramo de existencia | `return true;` explícito | `return !!row;` | Idéntico observable, pero menos explícito e forza eliminar a rama, diluíndo o diferencial mínimo |
| Operador de non existencia | `row == undefined` (solta) | `row === undefined` (estrita) | A solta mantén `null` como inexistente; `===` rompería a semántica. Endurecemento fóra de alcance |
| Chamador | Intacto (`=== false`) | Refactorizado a `if(!existsRecord(...))` | Sen beneficio; engadiría risco e ruído |
| Rollback | Trivial | — | Quitar o `return true` volve ao contrato anterior sen afectar test nin chamador |

**Risco global:** baixo. Un único chamador en produción, xa normalizado contra
`=== false`. Non existen outros consumidores nin vías de truthiness que dependan do
`undefined` (verificado na proposal/spec: busca global só atopa import, chamada,
definición e test). Non hai inversión de semántica nin falsy incidental restante.

**Rollback:** trivial e reversible — basta con quitar o `return true;` de
`lib/sqliteAccions.js`. O test migrado e o chamador non dependen da reversión de
forma (o chamador non se modifica; o test quedaría vermello se se revertira a
implementación, como debe ser baixo TDD).

## Fluxo de datos e contratos

- **Contrato da función (finais):** `existsRecord(table, headers, values)` → booleano
  estrito `{true, false}` para toda entrada; sen retornos `undefined` nin falsy
  incidental en ningunha vía.
- **Entrada invariante:** condición de non existencia `row == undefined`, que trata
  `null` e `undefined` como inexistentes (preservada).
- **Saída do chamador:** `isNew = existsRecord(...) === false` — inalterado.
  - inexistente → `false === false` → `isNew = true` (insírese);
  - existente → `true === false` → `isNew = false` (non se insire).
- **Cadena de ficheiros:** `lib/sqliteAccions.js` (2 toques: `return true;` +
  test migrado) e `test/sqliteAccions.test.js` (bloque migrado). Ningún outro ficheiro.

## Ficheiros afectados (cambio de 2 ficheiros)

| Ficheiro | Tipo de cambio | Detalle |
| --- | --- | --- |
| `lib/sqliteAccions.js` | Implementación | Engadir `return true;` na rama de existencia de `existsRecord` (~liñas 65–70). `return false` e `row == undefined` intactos |
| `test/sqliteAccions.test.js` | Test | Migrar o bloque (liñas 47–52): `=== false`/`!== false` → `toBe(false)`/`toBe(true)` |

**Non se tocan:** `lib/parsearResultadosLicitacionsContratos.js` (import :3 e chamada
:75), o entrypoint principal, nin ningún outro ficheiro de `lib/` ou `test/`.

## Verificación

- Fase `apply` baixo `strict_tdd: true` coa orde RED→GREEN descrita en D3.
- Fase `verify`: `bun test` → **13 pass / 0 fail** nos 3 ficheiros de test
  (`sqliteAccions.test.js`, `detectarFallosSilenciosos.test.js`,
  `enviarCorreo.smoke.test.js`).
- Comprobación auxiliar: a semántica de `isNew` non muda para rexistro existente nin
  inexistente (ver "Saída do chamador").

## Non-obxectivos (recordatorio de alcance)

- Non se normaliza `==` a `===`.
- Non se cambia a consulta nin se capturan erros de táboa inexistente.
- Non se toca o repo duplicado `concellodeames_scrapper`.
- Non se modifica o chamador nin o entrypoint.