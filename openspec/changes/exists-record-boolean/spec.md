# Spec — `existsRecord()` booleano estrito

Fase SDD: `spec`. Cambio: `exists-record-boolean`.

## Propósito

Endurecer o contrato de `existsRecord(table, headers, values)` en
`lib/sqliteAccions.js` a un predicado puro que devolva booleano estrito
`true`/`false`, eliminando o retorno implícito de `undefined` na rama de
existencia. A semántica observable do scraper (que expedientes se tratan como
novos e se insiren) NON debe cambiar: o único chamador en produción
(`lib/parsearResultadosLicitacionsContratos.js:75`) xa normaliza con
`=== false`, polo que `true`/`false` estritos producen exactamente o mesmo
`isNew`. É un cambio mínimo de 2 ficheiros: `lib/sqliteAccions.js` (engadir
`return true;`) e `test/sqliteAccions.test.js` (migrar o bloque do contrato).

## Dominios afectados

- `sdd/storage` → `lib/sqliteAccions.js`: define `existsRecord` e é o único
  ficheiro de implementación tocado.
- `sdd/calling-behavior` → `lib/parsearResultadosLicitacionsContratos.js`:
  consumidor en produción; debe permanecer intacto.

## Criterios de aceptación

1. `existsRecord()` devolve booleano estrito `true` cando o rexistro existe e
   `false` cando non existe. Non hai ningún retorno `undefined` nin falsy
   incidental en ningunha vía.
2. A semántica de `isNew` no chamador non cambia: `existsRecord(...) === false`
   produce o mesmo valor de `isNew` que hoxe, tanto para rexistro existente
   como inexistente.
3. A condición `row == undefined` (igualdade solta, que tamén trata `null` como
   inexistente) presérvase tal cal como condición de non existencia.
4. Os únicos ficheiros tocados son `lib/sqliteAccions.js` e
   `test/sqliteAccions.test.js`; `lib/parsearResultadosLicitacionsContratos.js`
   e o entrypoint principal quedan intactos.
5. `bun test` permanece verde con 13 tests (migrándose 1), baixo
   `strict_tdd: true` (RED primeiro na fase apply).

## Requirimentos

### Requirement: `existsRecord` como predicado booleano estrito

A función `existsRecord(table, headers, values)` en `lib/sqliteAccions.js` MUST
devolver `true` cando a fila co valor `values[0]` na columna `headers[0]` da
táboa `table` existe, e MUST devolver `false` cando a fila non existe
(`row == undefined`, onde `row` é o resultado de `DB.prepare(...).get(...)`).

A condición de non existencia SHALL preservarse como `row == undefined`
(igualdade solta, que tamén trata `row === null` como inexistente).

A función SHALL proximamente devolver un booleano estrito `true`/`false` e
SHALL NOT devolver `undefined` nin ningún outro valor falsy incidental en
ningunha vía.

#### Scenario: Fila inexistente devolve `false`

- GIVEN unha táboa creada que contén `EXP-0001` pero non contén
  `EXP-NONEXISTE`
- AND `row == undefined` evalúase verdadeiro para `EXP-NONEXISTE`
- WHEN se invoca `existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE'])`
- THEN o resultado é estritamente `false` (`toBe(false)`)

#### Scenario: Fila existente devolve `true`

- GIVEN unha táboa creada que contén `EXP-0001`
- AND `row` non é `null` nin `undefined` para `EXP-0001`
- WHEN se invoca `existsRecord(TABLA, CABECEIRAS, ['EXP-0001'])`
- THEN o resultado é estritamente `true` (`toBe(true)`)

#### Scenario: Valor devolto sempre pertence a {true, false}

- GIVEN unha fila existente ou inexistente calquera
- WHEN se invoca `existsRecord(TABLA, CABECEIRAS, [valor])`
- THEN o resultado cumpre `expect([true, false]).toContain(resultado)`

### Requirement: Semántica de `isNew` inalterada no chamador

O chamador en produción `lib/parsearResultadosLicitacionsContratos.js:75`
(`const isNew = existsRecord(table, headers, el) === false;`) SHALL permanecer
intacto e SHALL producir exactamente o mesmo valor de `isNew` que antes do
cambio, para cada combinación de existencia de rexistro.

#### Scenario: Rexistro inexistente segue sendo "novo"

- GIVEN un rexistro que non existe na táboa
- AND `existsRecord(...)` devolve `false`
- WHEN o chamador avalía `existsRecord(...) === false`
- THEN `isNew` é `true` (o rexistro insírese), igual que hoxe

#### Scenario: Rexistro existente segue sen ser "novo"

- GIVEN un rexistro que xa existe na táboa
- AND `existsRecord(...)` devolve `true` (en vez do `undefined` actual)
- WHEN o chamador avalía `existsRecord(...) === false`
- THEN `isNew` é `false` (o rexistro non se insire), igual que hoxe

### Requirement: Alcance de cambio mínimo (2 ficheiros)

O cambio SHALL tocar exclusivamente `lib/sqliteAccions.js` (engadir
`return true;` na rama de existencia de `existsRecord`, mantendo
`row == undefined` como condición de non existencia e `return false` na rama
actual) e `test/sqliteAccions.test.js` (migrar o bloque do contrato actual a
booleano estrito). O ficheiro `lib/parsearResultadosLicitacionsContratos.js`
(import e chamada) e o entrypoint principal SHALL NOT seren modificados.

#### Scenario: Único retorno engadido é `return true`

- GIVEN a implementación actual de `existsRecord` sen `return` na rama de
  existencia
- WHEN se aplica o cambio mínimo
- THEN o único engadido na rama de existencia é `return true;` e non hai
  refactor adicional (nin normalización de `==` a `===`, nin cambio de
  consulta, nin captura de erros)

#### Scenario: O chamador non se modifica

- GIVEN `lib/parsearResultadosLicitacionsContratos.js:3` (import) e `:75`
  (chamada)
- WHEN se verifica o conxunto de cambios do cambio `exists-record-boolean`
- THEN eses dous usos non figuran entre as liñas modificadas

### Requirement: Suite de tests verde baixo strict_tdd

O comando `bun test` SHALL executar de forma verde con 13 tests en total
(migrándose 1), co novo contrato booleano estrito verificado por asercións
`toBe(false)`/`toBe(true)`. Na fase `apply`, baixo `strict_tdd: true`, a
migración do test ao contrato booleano estrito SHALL executarse primeiro
(RED, fallando mentres `existsRecord` devolve `undefined` para existentes) e só
despois SHALL engadirse `return true;` en `lib/sqliteAccions.js` (GREEN).

#### Scenario: O test migrado valida o booleano estrito

- GIVEN o bloque actual de test (liñas 47–52) que documenta o contrato
  `false`/`undefined`
- WHEN se migra o bloque ao novo contrato
- THEN contén `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE'])).toBe(false)`
- AND `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001'])).toBe(true)`

#### Scenario: Verificación final

- GIVEN o cambio aplicado na orde strict_tdd (RED→GREEN)
- WHEN se executa `bun test` na fase apply/verify
- THEN o contador é 13 pass / 0 fail nos 3 ficheiros de test

## Non-obxectivos

- Non se normaliza `==` a `===` na condición de `existsRecord` (traballo
  futuro separado e explícito).
- Non se cambia a consulta nin se capturan erros de táboa inexistente.
- Non se toca o repo duplicado `concellodeames_scrapper`.
- Non hai ningún outro cambio en `lib/` nin `test/` fóra dos 2 ficheiros do
  alcance.