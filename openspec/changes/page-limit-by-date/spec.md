# Spec — Parada do bucle de páxinas por data (`page-limit-by-date`)

Fase SDD: `spec`. Cambio: `page-limit-by-date`.

> Este artefacto da fase `spec` NON modifica `lib/`, `test/` nin `*.js`. Só especifica o comportamento
> que debe cumprirse tras a fase `apply`.

## Propósito

Refinar a condición de parada do bucle de páxinas de
`lib/parsearResultadosLicitacionsContratos.js` para non perder licitacións novas que caen máis alá do
`limite_paxinas` da config da entidade. A parada actual é cuantitativa e "a cegas". O novo comportamento
engade unha parada temperá **por recencia**: cando as filas da web veñen do máis recente ao máis antigo
e a última fila da páxina actual é máis vella que o expediente máis recente xa coñecido na BD, as páxinas
seguintes serán aínda máis antigas ⇒ non queda nada novo ⇒ pódese parar antes do tope.

A condición por data **só pode acurtar** o percorrido. `limite_paxinas` mantense como tope de seguridade
superior inamovible, e ante calquera dúbida (data ausente, ilexible, BD baleira, desorde) non se corta e
vixíase o comportamento actual. Isto preserva a semántica actual do tope e evita perdas silenciosas.

## Ámbito

- `lib/parsearResultadosLicitacionsContratos.js`: o bucle `while (!isLastPage)` incorpora, na condición,
  unha saída temperá por data; localiza a columna de data polo header, parsea a data da última fila da
  páxina e compáraa contra a referencia de BD.
- Helpers de soporte (probable en `lib/`): normalización/parseo de datas e consulta do max de referencia
  en BD.
- NON se toca `_files`, o correo, `_skipped.json`, o esquema de BD nin `fecha_insercion` como horizonte.

## Criterios de aceptación

1. En execucións con histórico na BD e datas lexibles, o scraper NON perde licitacións novas que caen
   máis alá do `limite_paxinas` actual: para por data cando é seguro que non queda nada máis recente.
2. Coa parada por data activa e datas lexibles, NEVER se corta cando a última fila da páxina ten data
   máis recente ou igual que a referencia de BD.
3. Con BD baleira (primeira carga) ou filas sen data lexible, o comportamento é o actual: recórrese ata
   o fín natural ou ata `limite_paxinas`, sen cortes temperáns.
4. `limite_paxinas` é un tope superior: o número de páxinas procesadas nunca o excede e a parada por
   data só o acurta.
5. `bun test` mantense completo e verde (13 tests actuais + os novos de regresión), sen regresións no
   resto de módulos.

## Requirimentos

### Requirement: Localización da columna de data polo header, non por índice fixo

O bucle de páxinas SHALL identificar a columna de data da táboa principal
`#tableLicitacionesPerfilContratante` pola **texto do header** (coincidencia case-insensitive con
"fecha"/"publicación", p.ex. "Fecha", "Fecha(s)", "Fecha publicación"), e non por un índice numérico
ríxido. Se ningún header coincide, SHALL tratar o perfil como sen columna de data.

O valor da data SHALL lerse por fila do índice así localizado, aliñado coa orde do `td` correspondente
(os `el[]` por fila seguen a orde de `headers`).

#### Scenario: Perfil con header "Fecha publicación" localizado por texto

- GIVEN un perfil cuxos headers son `["Expediente", "Importe", "Fecha publicación"]`
- WHEN se localiz a columna de data polo texto do header
- THEN identifícase o índice do header "Fecha publicación" pola coincidencia co texto e non por un
  índice fixo

#### Scenario: Perfil sen columna de data recoñecida → sen horizonte

- GIVEN un perfil cuxos headers non conteñen ningunha cabeceira con "fecha"/"publicación"
- WHEN se intenta localizar a columna de data
- THEN non hai horizonte por data e o bucle NON aplica a parada temperá (comportamento actual)

#### Scenario: Formato distinto do header non rompe a localización

- GIVEN un perfil cuxos headers usan "Fechas"
- WHEN se localiza a columna de data por coincidencia de texto case-insensitive con "fecha"
- THEN localízase correctamente ese índice

### Requirement: Normalización e parsing de datas con fallback = non cortar

O valor de data da última fila de cada páxina SHALL normalizarse e parsearse a unha representación
comparable. A comparación SHALL admitir os formatos `dd/mm/aaaa` e `aaaa-mm-dd` (e variantes
recoñecibles de día/mes/ano) antes de comparar.

Ante calquera valor non parseable ou ausente (baleiro, "En trámite", "-", "N/A", texto libre, formato
descoñecido), o comportamento SHALL ser **non cortar** nese salto: degradar á parada natural ou ao
tope de seguridade, nunca parar por conclusión dunha data ilexible.

#### Scenario: Data lexible en `dd/mm/aaaa` deixa decidir por recencia

- GIVEN unha última fila con data "14/05/2025" e unha referencia de BD parseable
- WHEN se normaliza e compara o valor da fila contra a referencia
- THEN a comparación é determinada e pode activar a parada temperá se a fila é máis vella

#### Scenario: Fila sen data lexible → non cortar

- GIVEN unha última fila con data "En trámite" (non parseable)
- WHEN se avalía a condición de parada por data nese salto
- THEN NON se corta por data e o bucle segue ata o fín natural ou `limite_paxinas`

#### Scenario: Data en formato `aaaa-mm-dd` normalízase antes de comparar

- GIVEN unha última fila con data "2025-05-14"
- AND unha referencia de BD en formato distinto
- WHEN se aplica a normalización antes de comparar
- THEN ambas representáronse en unidades comparables e a comparación é correcta

### Requirement: Cálculo do horizonte = max da data de publicación dos expedientes xa gardados

O horizonte de referencia SHALL calcularse como o **máximo** da data de publicación (a columna de data da
web gardada na táboa principal) dos expedientes xa existentes na BD da entidade. NON SHALL usarse
`fecha_insercion` como se fose data de publicación para o horizonte de recencia da web.

Se a BD almacena unha columna de data de publicación fiábel, o max toma os seus valores; se esa data non
está fiable ou presente de forma xeneralizada, o horizonte SHALL considerarse non dispoñible e NON cortar.

#### Scenario: Max de publicaciones existentes determina o horizonte

- GIVEN expedientes existentes na táboa principal coas datas de publicación `2025-05-12`, `2025-05-18` e
  `2025-05-15`
- WHEN se calcula a referencia de BD
- THEN o horizonte é `2025-05-18` (o máximo)

#### Scenario: BD sen columna de data de publicación fiábel → sen horizonte

- GIVEN unha BD cuxa táboa principal non garda unha data de publicación fiable da web
- WHEN se calcula o horizonte
- THEN non hai referencia fiable e NON se aplica a parada por data

#### Scenario: `fecha_insercion` non se usa como horizonte

- GIVEN expedientes con `fecha_insercion` recente pero datado de publicación máis antigo
- WHEN se calcula o horizonte de recencia da web
- THEN a referencia baséase na data de publicación, NON en `fecha_insercion`

### Requirement: Parada temperá pola última fila de cada páxina

A condición de saída temperá SHALL avaliarse pola **última fila da páxina actual** (a derradeira da páxina,
pois as filas veñen do máis recente ao máis antigo). A parada temperá SHALL activarse SO cando:
(a) a columna de data está localizada, (b) a data da última fila é lexible, (c) existe un horizonte de BD
fiable, e (d) a data da última fila é **estritamente máis antiga** que o horizonte. Nestas condicións, as
páxinas seguintes serán aínda máis antigas ⇒ SHALL pararse antes do tope.

A parada por data SHALL NOT activarse con empate de datas (data da última fila igual ao horizonte), nin con
datas máis recentes.

#### Scenario: Última fila máis vella ca o horizonte → parar temperao

- GIVEN unha BD con horizonte `2025-05-18`
- AND a nota da última fila da páxina actual é `2025-05-10` (lexible, máis antiga)
- AND NON se acadou `limite_paxinas`
- WHEN se avalía a saída temperá
- THEN párase o bucle por data antes do tope (as seguintes páxinas serán aínda máis antigas)

#### Scenario: Empate de datas → non cortar

- GIVEN unha BD con horizonte `2025-05-18`
- AND a nota da última fila da páxina actual é `2025-05-18` (igual)
- WHEN se avalía a saída temperá
- THEN NON se corta por data (non hai evidencia de que a seguinte páxina sexa máis antiga) e continúase

#### Scenario: Última fila máis recente ca o horizonte → non cortar

- GIVEN unha BD con horizonte `2025-05-18`
- AND a nota da última fila da páxina actual é `2025-05-20` (máis recente)
- WHEN se avalía a saída temperá
- THEN NON se corta e continúase co bucle

### Requirement: `limite_paxinas` mantense como tope superior de seguridade

A semántica actual de `limite_paxinas` SHALL preservarse: con `limite_paxinas = N` procésanse exactamente
**N páxinas** (a 1ª + saltos ata `contadorPaxinas >= N`, co `break` antes de procesar a páxina que o
supera). A parada por data SHALL NOT ampliar nin eliminar este tope: só pode facer que o bucle pare antes.

Se `limite_paxinas` non está configurado, mantense a parada natural polo fín do paginado (`isLastPage` cando
non hai `siguienteLink`), coa parada por data só como saída temperá adicional cando hai confianza.

#### Scenario: Parada por data acurta o percorrido sen exceder o tope

- GIVEN unha entidade con `limite_paxinas = 10`
- AND a parada por data actívase na páxina 3
- WHEN remata o bucle
- THEN procesáronse 3 páxinas (menos que o tope) e o tope non se ampliou nin se tocou

#### Scenario: Sen data/horizonte, o tope segue protexendo

- GIVEN unha entidade con `limite_paxinas = 10`
- AND sen columna de data ou BD baleira (nunca se corta por data)
- WHEN o bucle percorre as páxinas
- THEN procésanse exactamente 10 páxinas (o tope actual) e despois detense

#### Scenario: `limite_paxinas` non configurado → parada natural

- GIVEN unha entidade sen `limite_paxinas` e sen parada por data activable
- WHEN o bucle percorre as páxinas
- THEN detense no fín natural do paginado (sen `siguienteLink`), como hoxe

### Requirement: Comportamento con BD baleira / sen histórico = non cortar cedo

Con BD baleira ou sen histórico fiable (sen max de data de publicación calculable), a parada por data SHALL
NOT activarse. O bucle SHALL manter o comportamento actual: recorrer ata o fín natural ou ata
`limite_paxinas`, nunca parar na primeira páxina, para non perder a carga inicial.

#### Scenario: Primeira execución con BD baleira

- GIVEN unha BD baleira (sen ningún expediente gardado)
- WHEN se executa o scraper
- THEN NON hai horizonte fiable e NON se corta por data
- AND o bucle recorre ata o fín natural ou ata `limite_paxinas`
- THEN non se perde a carga inicial da primeira páxina

#### Scenario: BD con histórico pero datado de publicación non fiable

- GIVEN unha BD con expedientes pero sen columna de data de publicación fiable
- WHEN se calcula o horizonte
- THEN NON hai referencia fiable e NON se aplica a parada por data (comportamento actual)

### Requirement: Chamada de recencia por data, NON por existencia

A condición de parada SHALL basearse na recencia real (data de publicación da web fronte ao horizonte de
BD), e SHALL NOT usar `existsRecord(...) === true` como condición de parada, porque a presenza histórica
non implica que a nova estea xa cuberta (a páxina 1 pode estar chea de coñecidos mentres a nova está máis
abaixo).

#### Scenario: A parada ignora a existencia e só mira recencia

- GIVEN unha páxina 1 chea de expedientes coñecidos (existen en BD) pero con datas de publicación
  lexibles
- WHEN se avalía a parada
- THEN a decisión baséase na data da última fila fronte ao horizonte, NON na simple existencia
- AND se a última fila é máis vella ca o horizonte párase (as novas xa cubertas están arriba)

#### Scenario: Expediente novo máis abaixo non se perde pola existencia

- GIVEN a páxina 1 con moitos coñecidos e un expediente novo só visible nunha páxina inicial posterior
- WHEN o horizonte aínda non está superado pola última fila da páxina actual
- THEN NON se para antes de chegar a esa páxina por causa de existencia

### Requirement: Tolerancia á desorde cronolóxica (conservador)

A parada por data SHALL asumir a orde "novos primeiro" do perfil. Se a web non ordena por data
descendente constante (a última fila non é necesariamente a máis antiga), o deseño SHALL ser conservador:
ante calquera indicio de desorde ou data non fiable na posición da última fila, NON cortar por data e
degradar á parada natural/tope.

A condición de parada SHALL ONLY cortar con confianza cando a data da última fila é lexible e
estritamente máis antiga ca o horizonte; en caso contrario non corta.

#### Scenario: Última fila máis recente malia desorde subxacente

- GIVEN un perfil ordenado de forma non estritamente cronolóxica
- AND a última fila da páxina actual ten data máis recente ca o horizonte
- WHEN se avalía a parada temperá
- THEN NON se corta (a condición espor de data máis antiga non se cumpre)

## Non-obxectivos

- Non se cambia a semántica actual de `limite_paxinas` nin se elimina como rede de seguridade.
- Non se toca o correo, `_files`, `_skipped.json` nin o esquema de BD.
- Non se introduce ordenación explícita por parte do scraper (depende da web).
- Non se usa `fecha_insercion` como data de publicación para o horizonte.
- Non hai ningún cambio en `lib/`, `test/` nin `*.js` nesta fase (só especificar; a implementación é da
  fase apply).

## Notas sobre o estado actual

- `openspec/specs/` está baleiro: non hai spec canónica preexistente; esta é a especificación de dominio
  nova para o paginado por data.
- Hai outra cambio activa no repo (`exists-record-boolean`) no mesmo ficheiro
  `lib/parsearResultadosLicitacionsContratos.js` e `lib/sqliteAccions.js`; vixiar non solapar os retoques
  do chamador (`existsRecord`) nin duplicar estado.
- `bun test` actual: 13 tests en 3 ficheiros (rede de seguridade para a fase apply / regresión).