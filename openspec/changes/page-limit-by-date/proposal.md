# Proposal — `page-limit-by-date`

Refinar a condición de parada do bucle de páxinas en
`lib/parsearResultadosLicitacionsContratos.js` para non perder licitacións novas que caen máis alá
do `limite_paxinas` da config da entidade.

> Artefacto de fase `proposal`. Este cambio NON modifica `lib/`, `test/` nin `*.js` nesta fase.

## Problema

O bucle de páxinas de `parsearResultadosLicitacionsContratos.js` segue paginando ata o fín natural
(`isLastPage` cando non hai `siguienteLink`) ou ata o tope configurado `limite_paxinas` por entidade
(`CONFIG.ENTIDADES[entidade].limite_paxinas`). Cando unha entidade ten un `limite_paxinas` baixo e as
súas táboas están ordenadas por recencia (novos primeiro), as licitacións novas que aparecen en
páxinas máis alá dese tope **pérdense**: nunca se chegan a ler nin a introducir na BD, e o scraper
non as detecta como expedientes novos ao trocar o correo.

O `limite_paxinas` actúa hoxe como unha parada "a cegas": limítase por cantidade de páxinas sen ter
en conta se xa se atoparon os expedientes máis recentes que teño na base de coñecemento.

## Obxectivo e resultado esperado (único)

**Obxectivo único:** non perder licitacións novas que caen alén do tope actual, conservando o resto
do comportamento do scraper.

**Resultado esperado:** nas execucións con histórico na BD, o bucle pode parar **antes** de `limite_paxinas`
cando estea seguro de que xa non hai expedientes máis recentes que os xa coñecidos; así recolecta as
súas páxinas iniciais (onde estarían as novas) e evita que un `limite_paxinas` baixo as deixe fóra.

## Horizonte de parada (decisión pechada)

- **Referencia "máis recente xa coñecido" en BD:** o máximo da data de publicación da web (columna de
  data do perfil, p.ex. `Fecha(s)` / `Fecha publicación`) dos expedientes xa gardados na táboa
  principal. Se esa columna non é fiable, a decisión de fallback queda pechada (ver regras).
- **Punto de comparación na web:** a data de publicación **da última fila de cada páxina** (derradeira
  da páxina, dado que as filas veñen do máis recente ao máis antigo), lida da columna de data do header
  correspondente.
- **Parada temperá:** se ca última fila da páxina actual ten unha data **máis vella** que a referencia
  de BD, as páxinas seguintes serán aínda máis antigas ⇒ non queda nada novo ⇒ parar antes do tope.

### Fallback pechado

- **Fila sen data lexible/parseable:** NON cortar nese salto (para non perder datos). Só cortar con
  confianza cando as datas son lexibles e a comparación é determinada.

### Primeiras execucións (sen histórico) — pechado

- **Non cortar cedo:** con BD baleira ou sen referencia de data fiable, manter o comportamento actual
  (percorrer ata o fín natural ou ata `limite_paxinas`). Non parar na primeira páxina para non perder
  a carga inicial.

### Tope fixo de seguridade — pechado

- **`limite_paxinas` mantense como tope de seguridade máximo.** A parada por data só pode cortar
  **antes** dese límite, nunca amplialo nin eliminalo.

## Usuarios / situación

- **Operadores do scraper** que lanzan `bun plataforma_contratacion_do_estado.js <concello.json>`
  por concello e reciben avisos por email dos expedientes novos.
- **Entidades cun `limite_paxinas` configurado** no `ENTIDADES` do `concello.json`. Son as que hoxe
  están expostas a perder novidades máis alá do tope.
- Situación tipo: unha entidade con `limite_paxinas` baixo e moita actividade; as licitacións novas
  entran na BD só se o tope alcanza a abarcalas. Con esta cambio vese garantido que as novas que haxa
  nas páxinas iniciais non se perdan por un tope cuantitativo cando a recencia xa ofrece un corte
  seguro.

## Regras de negocio

1. **Nunca perder novidades:** a condición de parada por data só se activa cando hai confianza
   (datas lexibles) de que non queda nada máis recente que a referencia de BD. Ante calquera dúbida
   (data ausente, formato ilexible, BD sen histórico) non se corta e vixia o tope de seguridade.
2. **`limite_paxinas` segue sendo un tope superior inamovible:** a parada por data pode acurtar o
   percorrido, xamais amplialo. Non se cambia a semántica actual do tope por accidente.
3. **Primeira carga completa:** con BD baleira non hai referencia; recórrese ata o fín natural ou ata
   `limite_paxinas`. Non hai cortes temperáns na primeira execución.
4. **Comparación por recencia real, non por existencia:** non usar `existsRecord(...) === true` como
   condición de parada (só indica presenza histórica; a páxina 1 pode estar chea de coñecidos mentres
   a nova está máis abaixo). O horizonte debe basearse en data de publicación (web) / recencia.

## Lacuna do estado actual

- O `limite_paxinas` é un tope cuantitativo que non sabe se xa esgotou a recencia; corta por unha
  cota de páxinas aínda que queden novas por abaixo.
- Non existe hoxe ningunha lectura da columna de data de publicación por fila na táboa principal (a
  `fecha_publicacion` fiábel da BD é opcional e depende das columnas do perfil; `fecha_insercion`
  existe sempre pero non é data de publicación).
- A decisión de seguir ou parar é binaria (páxina seguinte existe + cota non acadada = seguir), sen
  conciencia da recencia dos contidos xa vistos.

## Implicacións e impacto

- **`lib/parsearResultadosLicitacionsContratos.js`:** o bucle incorpora unha condición de saída
  temperá por data; localiza a columna de data polo header, parsea o valor da última fila e compara
  contra a referencia de BD. (Só en fase apply.)
- **Nova lóxica de soporte** (probable en `lib/`): helper de normalización/parseo de datas e consulta
  do max de referencia en BD. Non se toca `_files`, correo nin `_skipped.json`, agás que se decida
  reforzar en fases posteriores.
- **Custo por execución:** os cortes por data adoitan reducir o número de páxinas procesadas e, polo
  tanto, aperturas de pestanas/descargas de PDF; pero un corte erróneo implicaría perda silenciosa,
  polo que o deseño pecha cara ao conservadorismo (non cortar ante dúbida).
- **Monitorización actual:** xa hai un informe de fallos silenciosos (`_skipped.json` /
  `enviarCorreoAlertas`) que serve de contrapeso para detectar perdas.
- **BD por concello:** non cambia o esquema (só lectura da data existente, se a web a amosa).

## Edge cases

1. **Filas sen data / data ilexible** ("En trámite", "-", "N/A", formatos non recoñecidos,
   baleiro): NON cortar nese salto; seguir como hoxe ata o fín natural ou o tope.
2. **BD baleira ou sen histórico:** non hai referencia de max; non cortar cedo, recorrer o tope natural.
3. **BD sen columna de data de publicación fiábel:** caer na semántica actual (fín natural / tope);
   nunca usar `fecha_insercion` como se fose data de publicación para cortar por recencia da web.
4. **Ordenación non estritamente cronolóxica:** se a web non ordena por data descendente constante,
   a última fila da páxina pode non ser a máis antiga ⇒ risco de corte en falso. O deseño debe
   asumir a orde "novos primeiro" do perfil e, ante desordes, optar por non cortar / conservador.
5. **Formato de datas:** dd/mm/aaaa vs aaaa-mm-dd e outras variantes; normalizar antes de comparar,
   e valores non parseables ⇒ non cortar.
6. **Empate de datas:** se a última fila ten data igual á referencia, non hai evidencia de que as
   próximas sexan máis antigas; comportamento conservador (non cortar só con `>=`).
7. **`limite_paxinas` non configurado:** mantense o comportamento natural actual; o tope por data só
   engade a saída temperá cando hai confianza.
8. **Perfil sen columna de data:** non hai horizonte por data; comportamento actual por completo.

## Alcance do primeiro slice

- Agregar no bucle de `parsearResultadosLicitacionsContratos.js` a lectura da columna de data da web
  (localizada polo texto do header, non por índice ríxido), a súa normalización/parseo por fila, e a
  condición de saída temperá pola última fila de cada páxina fronte á referencia de BD.
- Os helpers de soporte (parseo de datas e max de referencia en BD) como parte do mesmo slice.
- Test unitarios e de regresión que cubran: datas lexibles, filas sen data, BD baleira, empate de
  datas e semántica de `limite_paxinas` preservada. (Fase apply / tarefas.)

## Non-obxectivos

- **Non** cambiar a semántica actual de `limite_paxinas` nin eliminalo como rede de seguridade.
- **Non** tocar o correo, `_files`, `_skipped.json` nin o esquema de BD.
- **Non** introducir ordenación explícita por parte do scraper (depende da web).
- **Non** usar `fecha_insercion` como data de publicación para o horizonte.
- **Non** implementar nada en `lib/`, `test/` nin `*.js` nesta fase (só especificar e, posteriormente,
  aplicar).

## Restricións e tradeoffs

- **Tradeoff central — cobertura vs risco de perda silenciosa:** un corte por data máis temperán
  reduce custo e fai que as novas non se perdan por cota, pero un corte en falso (por desorde ou data
  mal parseada) perdería datos en silencio. Pechase o tradeoff cara ao conservadorismo: só cortar con
  datas lexibles e comparación determinada, e nunca en BD baleira.
- **`limite_paxinas` como cinto de seguridade de peticións:** manterse como tope superior evita abuso
  do site e cobre os casos sen data/ordenación, polo que non se elimina.
- **Dependencia da orde de recencia da web:** a viabilidade do corte por data asume ordenación
  descendente constante; se un perfil ordena por outro criterio, a condición debe degradar a non
  cortar. Isto impón validación en fase de verificación (test/regresión e confirmación do ordenamento
  real por perfil).
- **Columna de data presente na BD só se a web a amosa:** o horizonte por data de publicación non está
  garantido estruturalmente; o fallback pechado (non cortar) absorbe esa ausencia.

## Criterios de éxito

1. Nenas execucións con histórico e datas lexibles, o scraper **non** perde licitacións novas que
   aparece en páxinas máis alá do `limite_paxinas` actual, parando por data cando é seguro.
2. Co comportamento de parada por data activo e datas lexibles, **nunca** se corta cando a última
   fila da páxina ten data máis recente (ou igual) que a referencia de BD.
3. Con DB baleira (primeira carga) ou filas sen data lexible, o comportamento é o actual: recórrese
   ata o fín natural ou ata `limite_paxinas`, sen cortes temperáns.
4. `limite_paxinas` móstrase como tope superior: o número de páxinas procesadas nunca o excede, e a
   parada por data só o acurta.
5. `bun test` mantense completo e verde (13 tests actuais + os novos de rexresión), sen regresións no
   resto de módulos.