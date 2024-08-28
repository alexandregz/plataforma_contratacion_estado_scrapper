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
- emailjs (NOTA: este necesita empregase como módulo de ECMAScript, con import en lugar dun require, polo que engadiremos '"type":"module",' no package.json do proxecto)


## How to

- A(s) URL(s) que se parsean deben extraerse manualmente do Perfil Contratante
- Crea unha BD "nombre_de_ficheiro_json.db" e inserta cada expediente encontrado se non está insertado previamente
- descarga os PDFs relacionados en cada expediente encontrado, separando por directorios segundo o nome da táboa e subdirectorios cada expediente
- envía diariamente os expedientes insertados (novos) do día actual (ver exemplo*json para configurar o email de orixe/destino)

# Config en .json

A config vai nun ficheiro `.json`, así **non hai que instalar nada** adicional.

- `exemplo.json`: exemplo de ficheiro dun concello:
  - en `ENTIDADES` están as URLs do Perfil Contratante de cada entidade que queremos parsear así como o límite de páxinas a recorrer:
    - `limite_paxinas`: límite de páxinas a parsear dunha entidade do CONCELLO que indiquemos, a partir desa páxina non se seguirá recorrendo resultados. Se hai 500 páxinas de resultados en, por exemplo "Xunta de Goberno", podemos ponher de límite: `"Xunta de Goberno": { limite_paxinas: 10 }` e só recorrerá as 10 primeiras páxinas, deixando 490 sen seguir. As entidades inclúen todos os tipos de consulta, tanto "licitacións" como "contratos menores", polo que o límite é o mesmo para os dous tipos.

  - en `EMAIL_CAMPOS_ENVIO`, os campos empregados no envío de `emailjs`
  - en `EMAIL_CONFIG` a config de `emailjs` da conta a empregar para enviar (se é gmail debes crear un password de aplicación se tes habilitada a autentación de dous factores)


## ToDo

- (?) extraer URLs do Perfil Contratante directamente