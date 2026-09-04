# Explore — `page-limit-by-date`

Cambio: refinar a condición de parada do bucle de páxinas en
`lib/parsearResultadosLicitacionsContratos.js` para non perder licitacións novas que caen
máis alá do `limite_paxinas` da config: parar cando xa non hai expedientes máis recentes do que
xa temos na BD.

> Só lectura / notas. Este artefacto NON modifica `lib/`, `test/` nin `*.js`.

## 1. O bucle `while (!isLastPage)`

Fonte: `lib/parsearResultadosLicitacionsContratos.js`, dentro de
`async function parsearResultadosLicitacionsContratos(browser, page, table, concello, entidade)`.

### Navegación entre páxinas

- Ao final de cada iteración búscase o botón de seguinte con
  `page.$$('table[id="tableLicitacionesPerfilContratante"] > tfoot > tr > td > div > input[id$="siguienteLink"]')`.
- Se existe → `page.click(...)` + `page.waitForNavigation({ waitUntil: 'networkidle0' })`
  (salta á seguinte páxina) e increméntase `contadorPaxinas++` (o incremento faise ao saltar,
  NON ao procesar).
- Se non existe botón → `isLastPage = true` (última páxina real).

### Decisión de `isLastPage` e `limite_paxinas`

Hai dous puntos de parada:

1. **Non hai `siguienteLink`** → `isLastPage = true` (fín natural do paginado).
2. **Tope por config** (comprobase DESPOIS de saltar de páxina):
   ```js
   if (CONFIG.ENTIDADES[entidade].limite_paxinas) {
     if (contadorPaxinas >= CONFIG.ENTIDADES[entidade].limite_paxinas) {
       isLastPage = true;
       break;
     }
   }
   ```
   Orde real no tempo por iteración: (a) procesa as filas da páxina actual, (b) salta de páxina
   (++contadorPaxinas), (c) comproba o tope e fai `break` **antes** de procesar a páxina á que
   saltou. Consecuencia: con `limite_paxinas = N` procésanse exactamente **N páxinas** (a 1ª +
   saltos ata chegar a `contadorPaxinas = N`), sen procesar a páxina que provoca o `>=`.

### Orde dos resultados

- A navegación é sempre cara adiante mediante `siguienteLink` (do máis recente ao máis antigo na
  representación da Plataforma de Contratación do Estado: as licitacións máis novas saen
  primeiro). Esta orde "novos primeiro" é o que fai viable un horizonte por data.
- Non hai cláusula de ordenación explícita no scraper: todo depende do ordenamento por defecto da
  web por perfil de contratante.

### Chamada e contorno

- Driver: `plataforma_contratacion_do_estado.js:118`
  `parsearResultadosLicitacionsContratos(browser, page, db_name, concello, entidade)`.
- `CONFIG` vén de `lib/config.js`. `limite_paxinas` é opcional por entidade en `ENTIDADES`
  (ver `exemplo.json`).

## 2. Información de recencia dispoñible

### Columnas / headers extraídas

- Cabeceiras: `page.$$eval("#tableLicitacionesPerfilContratante > thead > tr > th", ...)`,
  collendo o texto de `div > strong`. Úsase `headers` para `createTable(table, headers)` e
  `headers[0]` como clave primaria (Expediente).
- `headersFiles = ["filename", headers[0], "tipo", "fecha_publicacion"]` para a táboa
  `table + '_files'`.
- Filas: `page.$$eval("#tableLicitacionesPerfilContratante > tbody > tr", ...)` → cada `el` é un
  `Array` cos `innerText` de cada `td`, de modo que `el[0]` é o Expediente e o resto son as
  columnas segundo a orde de `headers`.

### Data de publicación por fila

- **Depende das columnas do perfil**: `headers` son as que amose a Plataforma nese perfil
  (p.ex.: "Expediente", "Tipo", "Estado", "Importe", e frecuentemente unha columna de data
  tipo "Fecha"/"Fechas"/"Fecha publicación"). Non hai garantía estructural de que exista unha
  columna de data, nin de que ocupe un índice fixo.
- Para o deseño, a columna data debería localizarse polo **texto do header** (buscar unha
  coincidencia con "fecha"/"publicación"), non por índice ríxido, e parsear o seu valor por fila.
- Na táboa `_files` SÍ existe un `fecha_publicacion` propio, pero ese ángulo é por ficheiro, non
  por expediente na táboa principal.

### Recencia en BD

- `createTable` engade `url_portal` (primeiro) e `fecha_insercion` (derradeiro) a TODA táboa
  principal; `insertIntoTable` xérao con `datetime('now','localtime')` sen pasalo por parámetro.
  => **A única data sempre presente na táboa principal é `fecha_insercion`** (cando nós o
  insertamos). Se a web ten unha columna de data, esa gárdase como columna máis, pero é opcional.
- A táboa principal non garda un `fecha_publicacion` canónico do expediente máis alá do que poida
  ser unha columna da web. Isto é clave: o "horizonte" fiable é `fecha_insercion`.

## 3. A BD como horizonte de parada

### `existsRecord(table, headers, values)`

```js
const row = DB.prepare(`SELECT * FROM ${table} WHERE ${headers[0]} = ?`).get(values[0]);
return row == undefined ? false : true;
```
- Comproba so a **primeira columna** (Expediente, por clave primaria).
- `existsRecord(...) === false` ⇒ "é novo para nós" (é o que dispara o insert).
- **Limitación**: `true` só significa "xá estaba na BD nalgún momento pasado", non "xa o vimos
  nun run de hoxe". A páxina 1 pode estar chea de expedientes vellos xa coñecidos mentres o
  expediente novo está máis abaixo. => NON é por si só unha condición de parada segura.

### `getAllIDsfromEntityBetweenDates(table, data_comezo, data_fin)`

```js
SELECT * FROM ${table} WHERE date(fecha_insercion) BETWEEN date(?1) AND date(?2);
```
- Filtra por `fecha_insercion` (data de inserción no noso run), non por data de publicación.
- Devolve filas completas (non só IDs malia o nome).
- Úsase en `enviarCorreoNovosExpedientes` ("hoxe" e "hoxe+1") para detectar o que entrou no
  último run. Sirve para saber QUE se inseriu máis recente que hoxe, e por tanto para derivar o
  valor de "o máis recente que xa temos."

### Uso proposto (nota, sen implementar)

- Referencia de "máis recente xa coñecido": o máximo de `fecha_insercion` (ou da columna de data
  da web, se existe e é fiable) entre os expedientes existentes.
- Condición principal: cando na páxina actual a fila máis antiga (derradeira da páxina, pois
  veñen novos primeiro) teña unha data **máis vella** que esa referencia, entón as páxinas
  seguintes serán aínda máis antigas ⇒ non queda nada novo ⇒ `isLastPage = true`.
- **Combinación recomendada**: usar `limite_paxinas` como **tope de seguridade** (especialmente
  para non abusar do site e para cubrir casos sen data/ordenación) e a comparación por data como
  condición principal de saída anticipada.

## 4. Riscos / consideracións de deseño

1. **Orde non estritamente cronolóxica**: a condición "última fila da páxina máis vella que o
   límite ⇒ parar" asume ordenación por data descendente constante. Se a web ordena por outro
   criterio (estado, tipo) ou mestura, pararíase en falso deixando pasar expedientes novos que
   están máis abaixo. Verificar o ordenamento real por perfil antes de confiar no corte por data.
2. **Filas desordenadas / excepcións**: pode haber filas coa data baleira, en texto ("En trámite",
   "-", "N/A") ou con formatos distintos (dd/mm/aaaa vs aaaa-mm-dd). Un parseo erróneo pode
   inverter a comparación. Precísase normalizar e xestionar valores ausentes (tratalos como
   "non cortar" ou retroceder ao tope de seguridade).
3. **`existsRecord === true` non implica insert hoxe**: non usar `existsRecord` como condición de
   parada única; só indica presenza histórica. Unhorizonte por data debe basearse en recencia
   real (data da web e/ou `fecha_insercion`), non na simple existencia.
4. **BD sen `fecha_publicacion` garantido**: a táboa principal só ten `fecha_insercion` sempre;
   `fecha_publicacion` da web é opcional (depende das columnas do perfil). Calquera comparación
   por data de publicación debe tolerar a súa ausencia e caer en `fecha_insercion` ou no tope.
5. **Primeiras execucións / BD baleira**: sen histórico inicial non hai referencia de límite
   (max = baleiro). Nese caso o comportamento debe ser o actual (percorrer ata o fín natural ou
   ata `limite_paxinas`), nunca cortar na 1ª páxina.
6. **Semántica actual de `limite_paxinas`**: con `>=` e o `break` tras navegar, procésanse N
   páxinas exactamente. Calquera nova condición non debe cambiar esta semántica por accidente nin
   eliminar o tope como red de seguridade de peticións.
7. **Custo por fila**: cada fila aberta abre pestana e pode baixar PDFs. Un corte por data máis
   temperán reduce ese custo, pero un corte erróneo implica perda silenciosa de datos; xa hai un
   informe de fallos silenciosos (`_skipped.json` / `enviarCorreoAlertas`) que pode actuar de
   contrapeso.
8. **Ámbito**: o cambio toca o bucle de `parsearResultadosLicitacionsContratos.js` (fase apply),
   e probablemente require un helper de normalización de datas e de max en BD. Non afecta a
   `_files` nin ó correo, salvo que se queira usar `fecha_publicacion` de `_files` como reforzo.

## Conclusión

- O deseño viable: identificar a columna de data da web polo header, usar o max de
  `fecha_insercion` (e/ou data da web) de BD como horizonte, e parar cando a última fila da
  páxina actual é máis vella ca ese horizonte, mantendo `limite_paxinas` como tope de seguridade.
- Hai incertezas clave que a fase proposal/spec debe resolver: orde real de ordenación por perfil,
  obrigatoriedade/formato da columna data, e comportamento con BD baleira/ausencia de data.