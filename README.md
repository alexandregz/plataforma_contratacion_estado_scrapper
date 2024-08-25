# Scrapper Plataforma contratacion do Estado

Scrapper para parsear certas URLs da Plataforma de contratacion do Estado (https://contrataciondelestado.es/)


## Funcionamento

Comproba cada link xeral (Documentos, Licitacions, Contratos Menores, Encargos a medios propios e Consultas preliminares), creando unha BD para manter un histórico.

Cando atopa nova informacion en cada un dos links emite aviso. Para isto recolle todos os expedientes de cada tipo antes de parsear cada entidade.

Polo de agora non discrimina nen tipo de contrato, estado, adxudicatario, etc.
Polo de agora so parsea licitacións e contratos menores.


## Requerimentos

- puppeteer
- bun:sqlite
- node:fs, stream e util


## How to

- A(s) URL(s) que se parsean deben extraerse manualmente do Perfil Contratante
- Crea unha BD "nombre_de_ficheiro_json.db" e inserta cada expediente encontrado se non está insertado previamente
- descarga os PDFs relacionados en cada expediente encontrado, separando por directorios segundo o nome da táboa e subdirectorios cada expediente


## ToDo

- (?) extraer URLs do Perfil Contratante directamente