# Proposal — `existsRecord()` booleano estrito

Fase SDD: `proposal`. Cambio: `exists-record-boolean`.

## Declaración de problema

`existsRecord(table, headers, values)` en `lib/sqliteAccions.js` ten un contrato
ambiguo e fráxil: devolve `false` explícito cando o rexistro **non** existe, pero
sen `return` na rama de existencia retorna `undefined` (implícito de JS) cando o
rexistro **si** existe.

Isto fai da función un enum implícito de dous estados (`false`/`undefined`) en
lugar dun predicado puro. Funciona "correcto por accidente": o único chamador en
produción reduce o resultado a booleano con `=== false`, polo que nunca observa a
fragilidade. Calquera uso futuro de `existsRecord()` en contexto de truthiness
(`if (existsRecord(...))`, `!existsRecord(...)`) interpretaría `undefined` como
falso e invertería a semántica de forma silenciosa.

## Obxectivo e resultado esperado

**Obxectivo único:** endurecer o contrato de `existsRecord()` a booleano estrito
`true`/`false`, sen **ningunha** alteración funcional na detección de expedientes
novos en runtime.

**Resultado esperado ao rematar o cambio:**

- `existsRecord()` devolve `true` cando o rexistro existe e `false` cando non.
- O conxunto de tests `bun test` segue verde (13 tests, migrándose 1 test).
- O comportamento observable do scraper (que expedientes se tratan como novos e
  se insiren) é idéntico ao actual.

## Usuarios e situacións afectadas

- **Directo (runtime):** `lib/parsearResultadosLicitacionsContratos.js:75` —
  `const isNew = existsRecord(table, headers, el) === false;` dentro do bucle de
  páxinas. É o único consumidor en produción. Compára xa con `=== false`, así que
  `true`/`false` estritos producen exactamente o mesmo `isNew` que hoxe.
- **Test:** `test/sqliteAccions.test.js` (bloque liñas 47–52) documenta o contrato
  actual non booleano e debe migrarse ao novo contrato.
- **Non hai ningún outro consumidor.** A busca global só atopou o import e a
  chamada do parseador, a definición da función e o test. Non existen usos
  directos de truthiness nin dependencias de `undefined`.

## Regras de negocio relevantes

- Un expediente consóidase como "novo" (insírese na BD) só cando non existía
  previamente na táboa; esa detección baséase en `existsRecord(...) === false`.
- Non hai regras de permisos, autorizacións, prazos nin requisitos de
  compliance/seguridade implicados nesta función; é unha utilidade de persistencia
  interna sen límites de volume particulares.

## Lacuna do estado actual (gap)

- A función non é un predicado puro: retorna `undefined` en lugar de `true` na
  rama de existencia.
- O contrato queda "documentado por accidente" por un test e un chamador únicos
  que comparan contra `false`, en lugar de documentarse na propia función.
- `ToDo.md:41` e `openspec/PROJECT_CONTEXT.md:56` xa sinalan esta booleanidade
  pendente como limpeza futura.

## Implicacións e impacto

- **Semántica de `isNew` NON cambia.** O chamador usa `existsRecord(...) === false`:
  - rexistro non existe → `false === false` → `isNew = true` (insírese);
  - rexistro existe → `true === false` → `isNew = false` (non se insire).
  Identico ao comportamento actual (`undefined === false` → `false`).
- **Test afectado:** substituir o bloque que valida o contrato actual por
  asercións de booleano estrito (`toBe(false)` para inexistente, `toBe(true)` para
  existente). A fixture `EXP-0001` reutilízase do test de `createTable`/
  `totalRowsInTable` (o estado da táboa entre tests no mesmo ficheiro non se
  reinicia).
- **Ficheiros tocados:** só `lib/sqliteAccions.js` (engadir `return true`) e
  `test/sqliteAccions.test.js` (migrar o bloque). O chamador
  `lib/parsearResultadosLicitacionsContratos.js` permanece intacto.
- **strict_tdd:** na fase apply cómpre RED primeiro — actualizar o test ao
  booleano estrito (que fallará mentres `existsRecord` devolva `undefined` para
  existentes) e só despois engadir `return true;` en `lib/sqliteAccions.js`.
  Verificación con `bun test`.
- **Impacto noutros equipos/procesos:** nulo — é un cambio interno de lib sem
  expoñentes fóra do repo.

## Edge cases

- **`null` (rexistro inexistente):** `bun:sqlite` `.get()` devolve `null`/`undefined`
  cando non hai fila. A condición `row == undefined` (igualdade solta) trata `null`
  como inexistente e retorna `false`. Mantense esa mesma rama condicional; o único
  cambio é engadir `return true` na rama contraria.
- **Fila existente baleira de valores:** se a fila existe, `row` non é
  `null`/`undefined`, así que entra na rama de existencia → `true`. Comportamento
  coherente co contrato booleano.
- **Táboa inexistente:** a consulta `.get()` de `bun:sqlite` sobre unha táboa que
  non existe lanza e propágase (non se captura dentro de `existsRecord`). Isto non
  cambia con este trabalho; queda igual ao estado actual.
- **Script/ESTADO:** non aflora ningún comportamento novo: `undefined` deixa de
  producirse, polo que non hai ningunha vía que dependa de falsy incidental.

## Alcance do primeiro slice (só isto)

1. `lib/sqliteAccions.js` — en `existsRecord`, engadir `return true;` na rama de
   existencia, mantendo `row == undefined` como condición de non existencia e
   `return false` na rama actual.
2. `test/sqliteAccions.test.js` — migrar o bloque do contrato actual a booleano
   estrito:
   - `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE'])).toBe(false);`
   - `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001'])).toBe(true);`
3. Verificación: `bun test` verde.

## Non-obxectivos (fóra do alcance)

- O repo duplicado `concellodeames_scrapper` — ten a súa propia copia de lóxica e
  non importa `existsRecord` de `lib/`; queda intacto.
- Calquera refactor adicional de `lib/sqliteAccions.js` (normalizar a `===` na
  condición, cambiar a consulta, capturar erros de táboa inexistente, etc.) queda
  fóra deste cambio.
- Cambios no enum de estados nin noutras funcións (non existe enum de estados
  implicado nesta función).
- Non se toca `lib/parsearResultadosLicitacionsContratos.js` nin o entrypoint
  principal.

## Restricións e tradeoffs

- **Restricións:**
  - Diferencial mínimo: só `return true` na implementación e a migración do test.
  - Preservar a condición `row == undefined` (igualdade solta) tal cal; non
    endurecer nada máis da función.
  - strict_tdd (`bun test`) con RED primeiro na fase apply.
  - Convención do repo: código, comentarios e commits en galego.
- **Tradeoffs (decisións de deseño):**
  - **Booleano estrito `true`/`false` vs outros retornos:** é o contrato JS máis
    idiomático para un predicado e o máis seguro ante truthiness futura. Alternativa
    (devolver `!!row`) é equivalente pero menos explícita; mantemos `return true` /
    `return false` por claridade.
  - **Non cambiar `==` a `===`:** evita calquera risco de alterar o tratamento de
    `null`; ese endurecemento é un posible traballo futuro separado e explícito.
  - **Risco global:** baixo. Un único chamador en produción, xa normalizado a
    `=== false`, que segue funcionando idéntico. Non hai inversión de semántica nin
    vías de truthiness dependentes de `undefined`.
  - **Rollback:** trivial e reversíbel — quitar o `return true` volve ao contrato
    anterior sen afectar nin o test nin o chamador (que non cambian de forma).

## Criterios de éxito

- `existsRecord()` devolve booleano estrito `true`/`false`.
- `bun test` pasa con 13 tests verdes (1 migrado).
- A semántica de `isNew` no parseador non cambia (detección de expedientes novos
  idéntica á actual).
- `lib/parsearResultadosLicitacionsContratos.js` non se modifica.