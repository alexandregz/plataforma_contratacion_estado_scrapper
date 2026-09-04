# Design — Parada do bucle de páxinas por data (`page-limit-by-date`)

Fase SDD: `design`. Cambio: `page-limit-by-date`.

> Este artefacto da fase `design` NON modifica `lib/`, `test/` nin `*.js`. Formaliza as decisións
> técnicas que se aplicarán na fase `apply`, mantendo o cambio limitado e aliñado coa `proposal` e a `spec`
> xa aprobadas.

## Contexto técnico (lectura do código actual)

Para aterrar as decisións convén deixar constancia do que se verificou no estado real do repo:

- `lib/parsearResultadosLicitacionsContratos.js` recolle as cabeceiras cun `$$eval` sobre
  `#tableLicitacionesPerfilContratante > thead > tr > th` que mapea cada `th` a `[...th.querySelectorAll("div > strong")].map(innerText)`. Resultado: **`headers` é un array de arrays**, un elemento (xeralmente de 1 texto) por columna.
- Os valores de cada fila léense cun `$$eval` sobre `#tableLicitacionesPerfilContratante > tbody > tr`,
  mapeando `td` a `innerText` → `pageData[i]` é un array de textos **aliñado por índice** coas columnas de `headers`.
- `createTable(table, headers)` e `insertIntoTable(table, headers, values)`: sobre cada elemento de `headers`
  aplican `.toString()`/`String(...)` (o texto do header) e `replace(/ /g, "_")`. Conclusión verificada:
  **a táboa principal SI garda columnas individuais**, ida columna = texto do header con espazos→`_`
  (p.ex. `Fecha_publicacion`), máis `url_portal` e `fecha_insercion` (esta última ao final).
  `normalizeEuroValue` só altera valores con `.`/`,`; as datas habituais (`DD/MM/AAAA`, `AAAA-MM-DD`) non
  conteñen eses símbolos, polo que se gardan **en bruto** tal como aparecen na web.
- O bucle `while (!isLastPage)`: procesa todas as filas da páxina actual, logo comproba o botón "seguinte";
  se existe, incrementa `contadorPaxinas` e navega; e ao final, se `limite_paxinas` está definido e
  `contadorPaxinas >= limite_paxinas`, marca `isLastPage` e `break`. Con `limite_paxinas = N` procésanse
  exactamente N páxinas. Esa semántica **non debe cambiar**.
- `existe outra cambio activa` (`exists-record-boolean`) sobre o mesmo ficheiro e sobre
  `lib/sqliteAccions.js`; este design **non toca a sinatura nin o chamador de `existsRecord`** e non duplica estado.
- `DB` é módulo-protegido en `lib/sqliteAccions.js`; calquera consulta a BD (incluído o horizonte) debe vivir
  nese módulo ou nun que reciba acceso a `DB`.

## Decisións de deseño

### D1 — Localización da columna de data pola texto do header (non por índice fixo)

Helper puro `localizarIndiceColunaData(headers)` que devolve o **índice** da columna de data ou `-1`
(`null`) se ninguén coincide. Regras (case-insensitive), por orde de preferencia:

1. Header que conteña `publicaci` (cobre `Fecha publicación`, `Fecha publicacion`, `Fecha de publicación`).
2. En defecto, primeiro header que conteña `fecha` (cobre `Fecha`, `Fecha(s)`, `Fechas`).
3. Se nengún coincide → `-1` → **non hai columna de data** → comportamento actual (non cortar).

Isto selecciona o correcto cando existen `Fecha` e `Fecha publicación` á vez (criterio "publicación" gaña),
sen depender dun índice numérico ríxido, e satisfai os scenarios de localización por texto da spec.

O **valor de data da última fila** lense como `ultimaFila[dateIdx]` onde `ultimaFila = pageData[pageData.length-1]`,
reutilizando exactamente o `pageData` xa lido no bucle (non se engade ningún selector novo nin se rompe o bucle
que xa le `tbody > tr`). Garda de lonxitude: se `dateIdx >= ultimaFila.length` → considerase sen valor.

### D2 — Parsing/normalización de datas a un comparador canónico (fallback conservador = non cortar)

Helper puro `normalizarDataWeb(valor)` → devolve un **comparador canónico en milisegundos UNIX** (`number`,
resultado de `Date.getTime()`) ou `null`/`undefined` cando non é lexible. Admite:

- `DD/MM/AAAA` e `DD/MM/AAAA HH:mm` (regex `^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}(?:\s+\d{1,2}:\d{2})?$`).
- `AAAA-MM-DD` e variantes con separadores `/`, `-`, `.`.
- Validación básica de mes (1–12) e día (1–31); valores inválidos → `null`.

Ante calquera valor ausente/baleiro/ilexible (`"En trámite"`, `"-"`, `"N/A"`, texto libre, formato
descoñecido, `null`, non-string, día/mes fora de rango) → **`null`**, e o chamador interpreta `null` como
"non hai evidencia de recencia" → **non cortar** nese salto (degradación á parada natural/tope). Satisfai
os scenarios de normalización `dd/mm/aaaa` e `aaaa-mm-dd` e de fila sen data lexible.

Ambos formatos normalizan á mesma unidade (`ms`), o que permite comparar correctamente datas en formatos
distintos antes de comparar (require da spec).

### D3 — Cálculo do horizonte: max da data de publicación dos expedientes xa gardados

**Origen recomendada (primary):** a **columna de data da táboa principal** resolta dinámicamente polo
header localizado na execución actual. O nome da columna calcúlase exactamente igual a como `createTable`/`insertIntoTable`
xeran os nomes: `String(headers[dateIdx]).replace(/ /g, "_")` (p.ex. `Fecha_publicacion`). Axuste con `DB`.

Helper `maxDataPublicacionBD(table, nomeColuna) -> number|null` en `lib/sqliteAccions.js` (accede a `DB`):
- Le todas as celas desa columna, parsea cada unha con `normalizarDataWeb`, e devolve o **máximo** dos
  `ms` parseados (comparación canónica, NON `MAX()` de SQLite, que sobre texto `DD/MM/AAAA` ordenaría mal).
- Se a táboa/columna non existe, ou ningún valor é parseable → devolve `null` → **sen horizonte** → non cortar.
- `try/catch` arredor da consulta para absorber táboas/columnas ausentes.

**Por que esta orixe, e por que non `fecha_publicacion` fixa:** a `proposal`/`spec` piden o max da **columna
de data da web gardada na táboa principal**. A vérificación do código (ver Contexto) confirma que esa columna
**sí existe por nome** (dinámico) na táboa principal, e o seu valor é a **mesma data da listaxe** coa que se
compara a última fila para cortar (consistencia de formato/orixe). `fecha_publicacion` como nome fixo non está
garantido porque o header real é variable (`Fecha`, `Fecha(s)`, `Fechas`, ...); a resolución dinámica cubre iso.
`_files.fecha_publicacion` fica documentada como alternativa (data da páxina de detalle, só rexistros con PDF),
mais NON se usa nesta slice: non é a mesma data de listaxe e a spec apunta á táboa principal.

> Nota de direccionalidade do risco: se o horizonte queda **infravalorado** (porque o valor máis recente está
> ausente/ilexible), a condición `ultimaFila < horizonte` corta **máis tarde** (máis conservador). O único risco
> real sería *sobrevalorar* o horizonte, o que require un valor parseable anómalo; a semana de validez de mes/día
> e a `try/catch` minimizan iso. Cando a BD está baleira ou non hai ningún valor parseable → `null` → nunca cortar.

#### Enum de tradeoffs — orixe da data de publicación por expediente gardado

1. **Táboa principal, columna de data dinámica (header actual) → RECOMENDADA.** Mesma data de listaxe que o
   punto de comparación; todo rexistro gardado está presente; cumpre literalmente a spec. Tradeoff: nome de
   columna dinámico (depende do header), que pode variar se o perfil cambia de cabeceira entre execucións
   (subestima horizonte → conservador); require `try/catch` ante columna ausente.
2. **`${table}_files.fecha_publicacion` (nome fixo, data da páxina de detalle).** Sempre existe e pópulase
   nos descarga de PDF. Tradeoff: é a data da páxina de detalle, non a da listaxe (formato/orixe non idéntico
   ao punto de comparación); só inclúe expedientes con ficheiros rexistrados; a spec di "táboa principal".
   **Descartada como primary**, documentada como alternativa/auxiliar de verificación.
3. **Parser de columna composta / re-parse do valor almacenado.** Tradeoff: desbotada — as columnas da táboa
   principal son individuais (por header), non compostas; un re-parse explícito engadiría fragilidade sen
   beneficio.
4. **`fecha_insercion` como horizonte.** Tradeoff: **prohibida pola spec** (data de inserción ≠ data de
   publicación) e ignoraría a recencia real da web. Descartada.
5. **Migración de esquema (engadir columna de data normalizada por rexistro).** Tradeoff: resolve a orixe de
   forma robusta, pero a `proposal` pecha "non tocar o esquema de BD". Fica como **enabler futuro fóra de
   scope** desta slice.

Criterio de selección: cero cambios de esquema, valor semanticamente igual ao punto de comparación, e fallback
conservador ante dúbida ⇒ **opción 1**.

### D4 — Estrutura da condición de parada no bucle

Acción pura `debePararPorData(ultimaFilaMs, horizonteMs) -> boolean`:

```
se horizonteMs == null  → false   (sen histórico/referencia fiable → non cortar)
se ultimaFilaMs == null → false   (data ilexible/ausente → non cortar)
senón return ultimaFilaMs < horizonteMs   (empate ou máis recente → false)
```

No bucle, despois de procesar todas as filas da páxina actual (para non perder os datos xa lidos) e **antes**
de comprobar o botón "seguinte":

```
if (debePararPorData(normalizarDataWeb(ultimaFila[dateIdx] || null), horizonteMs)) {
  // coluna localizada + data lexible + horizonte fiable + última fila máis vella ⇒ parar antes do tope
  isLastPage = true;
  break;
}
```

Garantías aliñadas coa spec e a proposal:

- **Só corta cando a data da última fila é ESTRITAMENTE máis vella ca o horizonte** (comparación `<`; empate e
  máis recente NON cortan).
- **`horizonteMs == null` ⇒ "sen histórico desactivado" ⇒ nunca corta**: cubre BD baleira (primeira carga),
  columna de data ausente e BD con histórico pero sen valores de publicación parseables. Non se introduce
  ningún flag/config novo para desactivar: o to semántico é a existencia dun horizonte fiable.
- **`limite_paxinas` segue como tope superior inamovible.** A parada por data va antes da navegación e antes
  do check de límite, polo que **só pode acurtar** o percorrido; cando o límite se alcanza primeiro, mantense o
  comportamento actual (`isLastPage` + `break`). O número de páxinas procesadas nunca excede o tope e a parada
  por data non se executa "enriba" do límite.
- **Nunca corta na primeira fila/páxina sen confianza**: con BD baleira non hai horizonte, e a comparación é
  sempre determinada. A carga inicial non se perde.
- **Recencia, non existencia**: a decisión non consulta nunca `existsRecord` (só mira a data da última fila
  fronte ao horizonte de BD). Non se toca o chamador de `existsRecord`.

O `horizonteMs` calcúlase **unha vez antes do bucle** (a partir de `dateIdx` localizado), non por páxina, para
evitar consultas repetidas; a data da última fila si se parsea por páxina.

## Fluxo de datos

```
headers ($$eval thead/th)
   └─ localizarIndiceColunaData(headers) → dateIdx (ou -1)
         └─ String(headers[dateIdx]).replace(/ /g,'_') → nomeColuna (data web)
               └─ maxDataPublicacionBD(table, nomeColuna) → horizonteMs (ms) | null   [unha vez]

bucle while (!isLastPage):
  pageData = $$eval tbody/tr (el[i] aliñado con headers[i])          [sen cambios]
  procesar filas (insert/PDFs)                                        [sen cambios]
  ultimaFila = pageData[pageData.length-1]
  ultimaMs   = normalizarDataWeb(ultimaFila[dateIdx])                  [novo]
  if (debePararPorData(ultimaMs, horizonteMs)) { isLastPage=true; break }   [novo]
  comprobar botón "seguinte" / navegar                                   [sen cambios]
  check limite_paxinas → isLastPage; break                              [sen cambios]
```

## Contratos

Helpers novos (a aplicar en `apply`, non agora):

- `localizarIndiceColunaData(headers: Array<Array<string>>) -> number` (`-1` se non hai). Puro.
- `normalizarDataWeb(valor: string|null) -> number|null` (`ms` UNIX canónico, ou `null`). Puro.
- `debePararPorData(ultimaFilaMs: number|null, horizonteMs: number|null) -> boolean`. Puro.
- `maxDataPublicacionBD(table: string, nomeColuna: string) -> number|null` (en `lib/sqliteAccions.js`,
  con acceso a `DB`; máximo de `normalizarDataWeb` sobre as celas non baleiras; `null` ante columna/táboa
  ausente ou sen valores parseables).

Formato canónico de comparación: **millisecond UNIX** (so porta `nn-mm-aaaa` e `aaaa-mm-dd` á mesma unidade).
Só os helpers puros son directamente unit-testables sen puppeteer nin BD real.

## Ficheiros afectados (só en fase apply)

- `lib/parsearResultadosLicitacionsContratos.js`: localizar `dateIdx`, calcular `horizonteMs` (unha vez),
  e engadir a condición de parada por data antes da navegación. Non cambia a leitura de filas, nin `existsRecord`,
  nin o correo, nin `_skipped.json`.
- `lib/sqliteAccions.js`: engadir `maxDataPublicacionBD` (non toca `existsRecord`, `createTable`,
  `insertIntoTable` nin a sinatura de ningún helper existente).
- `lib/parsearDatas.js` (novo módulo puro): `localizarIndiceColunaData`, `normalizarDataWeb`,
  `debePararPorData`.
- `test/`: novos unit tests puros (formato `bun test`), sen tocar a rede nin BD reais (fixtures temporais),
  coa rede de seguridade de 13 tests actuais intacta.

> Convención de estilo: o repo mestura `require`+`module.exports` (estilo ComonJS) malia `"type":"module"`;
> Bun tolera ese mestura. Os módulos novos deben seguir o mesmo estilo `require`/`module.exports` para
> non romper as importacións dos tests.

## Estratexia de probas (apply)

Unit tests puros sobre:
1. `normalizarDataWeb`: `DD/MM/AAAA`, `DD/MM/AAAA HH:mm`, `AAAA-MM-DD`, separadores `/ - .`, mes/día inválidos,
   `"En trámite"`, `"-"`, `"N/A"`, baleiro, `null`, non-string → `null`.
2. `localizarIndiceColunaData`: `["Fecha publicación", ...]`, `["Fecha(s)", ...]`, `Fechas`, e sen columna → `-1`;
   preferencia `publicaci` sobre só `fecha`.
3. `debePararPorData`: máis vella→true; igual→false; máis recente→false; horizonte `null`→false; data `null`→false.
4. `maxDataPublicacionBD`: max correcto sobre celas parseables mixtas; sen columna→`null`; só valores ilexibles→`null`.
Regresión: `bun test` completo e verde (13 + novos).

## Non-obxectivos / límites

- Non se modifica a semántica de `limite_paxinas` nin se elimina como rede de seguridade.
- Non se introduce ningún flag/config novo.
- Non se toca `_files`, o correo, `_skipped.json` nin o esquema de BD (só lectura da data existente).
- Non se usa `fecha_insercion` como horizonte nin `existsRecord` como condición de parada.
- Non se introduce ordenación explícita (depende da web) e o corte asume orde "novos primeiro"
  (conservador: sen confianza → non cortar).

## Riscos

- **Corte falso por desorde cronolóxica da web:** o deseño só corta con `<` estricto e data da última fila
  lexible; ante desorde, unha última fila máis recente ou non parseable non corta. A validez real da orde debe
  confirmarse por perfil en verificación.
- **Horizonte ausente/subestimado:** cubre con `null`→non cortar (conservador) e coa nota de direccionalidade
  do risco en D3.
- **Colisión coa cambio `exists-record-boolean`:** este design só engade helpers novos e a condición dentro do
  bucle; non altera a sinatura nin o chamador de `existsRecord`, nin duplica estado. Aplicar con coidado de
  non solapar edicións no mesmo ficheiro.

## Rollout

Fase `apply` implementa os 3 ficheiros + tests; fase `verify` roda `bun test` (sen cambios de esquema nin rede).
Primeiras execucións con BD baleira comportarán exactamente como hoxe (non cortar cedo). En execucións con
histórico e datas lexibles, o bucle poderá parar antes do tope cando a última fila sexa estritamente máis vella
ca o horizonte.