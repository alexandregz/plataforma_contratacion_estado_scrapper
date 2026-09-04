# Exploración — `existsRecord()` booleano estrito

Fase SDD: `explore` (só lectura; non se modificou `lib/`, `test/` nin `*.js`).
Cambio: `exists-record-boolean`.

## 1. Definición e todos os puntos de consumo

**Definición (única):** `lib/sqliteAccions.js`, función `existsRecord(table, headers, values)`, exportada en `module.exports` (liña 161).

```js
function existsRecord(table, headers, values) {
    const row = DB.prepare(`SELECT * FROM ${table} WHERE ${headers[0]} = ?`).get(values[0]);
    if(row == undefined) {
        return false;
    }
}
```

Comportamento actual:
- Rexistro NON existe (`row == undefined`) → retorna `false` explícito.
- Rexistro SI existe → non hai `return` explícito; retorna `undefined` (implícito da función JS).
- Nota: comparación con `==` (igualdade solta), non `===`.

**Puntos de consumo (busca global `existsRecord`, única fonte):**
- `lib/parsearResultadosLicitacionsContratos.js:3` — importa `existsRecord` (con `createTable`, `insertIntoTable`, `getTotalFilesFromExpediente`, `patchTable`).
- `lib/parsearResultadosLicitacionsContratos.js:75` — **consumidor real no runtime:**
  `const isNew = existsRecord(table, headers, el) === false;` dentro do bucle de páxinas (`for (i = 0; i < pageData.length; i++)`).
- `lib/parsearResultadosLicitacionsContratos.js:172` — só un comentario explicativo ("existsRecord = false"), non é unha chamada.
- `test/sqliteAccions.test.js:10` (import) e liñas 47–52 (test do contrato actual).
- Referencias en documentación: `ToDo.md:41`, `openspec/PROJECT_CONTEXT.md:56` (ambas aconsellan xa correxir a booleanidade).

Non hai outros consumidores (o grep cubriu todo o repo, incluíndo o entrypoint principal e helpers). Só existe **un único chamador en produción**, e ese chamador xa compara con `=== false`.

## 2. Contrato actual exacto e por que funciona hoxe

Contrato efectivo: `existsRecord()` devolve `false` cando o rexistro NON existe e `undefined` cando SI existe. Isto é un enum implícito de 2 estados, non unha función predicado pura.

Por que funciona hoxe:
- O único chamador (`parsearResultadosLicitacionsContratos.js:75`) reduce o resultado a un booleano con comparación estricta: `existsRecord(...) === false`.
  - Se NON existe → `false === false` → `isNew = true` (rexistro novo, insírese).
  - Se SI existe → `undefined === false` → `isNew = false` (xa existe, non se insire).
- O test (liñas 47–52) documenta precisamente este contrato:
  - `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE']) === false).toBe(true);`
  - `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001']) !== false).toBe(true);` — validación do chamador, non da booleanidade.
- O comportamento `undefined` é "correcto por accidente": ninguén usa `existsRecord()` directamente como truthiness, todos pasan por `=== false`.

## 3. Riscos / efectos colaterais de cambiar a booleano estrito

Análise de riscos para cambiar `existsRecord` para que che `return false;` cando non existe e `return true;` cando existe:

- **Bajo:** o único consumidor en produción (`parsearResultadosLicitacionsContratos.js:75`) xa normaliza con `=== false`; `true/false` estritos dan o mesmo `isNew` que hoxe (`false`→`true`, `true`→`false`). Pola contra, se o cambio se fixera a `true`... non; o risco verdadeiro é que hoxe o chamador compara contra `false`, e unha función booleana estrita mantén a semántica.
- **Chamadas que dependan de truthiness/`undefined`:** busquei exhaustivamente; NON hai ningunha chamada que use `existsRecord()` en contexto booleano directo (`if (existsRecord(...))` ou `!existsRecord(...)`). O único uso é `=== false`. Polo tanto non hai risco de inversión nin de valores falsy.
- **`==` vs `===` dentro da función:** a comprobación do rexistro usa `row == undefined`, que tamén é verdadeiro para `row === null`. Non é o obxecto deste cambio, pero débese preservar tal cal (a consulta `.get()` bun:sqlite devolve `null`/`undefined` cando non hai fila). Cando faga `return true` no caso de existencia, a lóxica debe manter esa mesma rama condicional.
- **Rexistro vs NON rexistro:** o enum actual `undefined/false` non se debe "capturar" en ningún outro sitio; non existe tal sitio.
- **Test do contrato actual (liñas 47–52):** este test documenta o contrato NON booleano e deixará de compilar/fallar se o cambiar. Debe migrarse ao novo contrato (RED primeiro), non manterse tal cal.

Conclusión de risco global: **baixo**. Non hai consumidores secundarios nin dependencia de truthiness fóra do `=== false` xa presente, que segue funcionando idéntico cun booleano estrito.

## 4. Que test tocará o cambio / implicacións de strict_tdd

Ficheiro afectado: `test/sqliteAccions.test.js`.

- Bloque actual `existsRecord: contrato actual usado no parseador (=== false cando non existe)` (liñas 47–52) documenta o comportamento `undefined`/`false`. Á Tarefa 4 (o propio test di "iso levará os seus propios tests"). Este bloque debe **substituirse** por un test do novo contrato booleano estrito, v. gr.:
  - `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE'])).toBe(false);`
  - `expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001'])).toBe(true);`
  - Opcional: `expect([true, false]).toContain(existsRecord(...));`
- O bloque `createTable crea a táboa e totalRowsInTable conta rexistros` insire `EXP-0001`, así que o test booleano pode reutilizar esa fixture (o estado entre tests no mesmo ficheiro non se reinicia; `beforeAll` crea táboa, os inserts deixan `EXP-0001` e `EXP-0002`).

**strict_tdd (openspec/config.yaml: `strict_tdd: true`):**
- Na fase `apply` cómpre RED primeiro: escribir/actualizar o test ao contrato booleano estrito (que fallará mentres `existsRecord` retorna `undefined` para existentes e non `true`) e, só despois, cambiar `lib/sqliteAccions.js`. O comando de verificación é `bun test` (todas as fases apply/verify usan `bun test`; estado actual 13 pass / 0 fail en 3 ficheiros).
- O único `return` a engadir na implementación é un `return true;` na rama de existencia (mantendo `row == undefined` como condición de non existencia e `return false`). Nada máis en `lib`/`test` debe cambiar.
- O chamador `parsearResultadosLicitacionsContratos.js:75` (`=== false`) non precisa cambios e, de feito, non se debe tocar para preservar semántica.

## Notas adxuntas

- O grep global confirmou que NON existen usos en `concellodeames_scrapper/concellodeames.js` nin chamadas con `!existsRecord`/truthiness directa (á diferenza do que a duplicación de lóxica en `ToDo.md` suxire como risco xeral do repo, non aplica a esta función nas súas vías actuais). Se algún día se activa a vía vella de `concello de ames`, esa copia ten a súa propia copia de lóxica e non importa `existsRecord` de `lib/`.