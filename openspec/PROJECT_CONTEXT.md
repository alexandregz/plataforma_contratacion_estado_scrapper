# Project Context — plataforma_contratacion_estado_scrapper

Fase SDD `init` — snapshot do contexto do proxecto (2026-09-05).

## Proxecto

Scrapper da Plataforma de Contratacion do Estado (contrataciondelestado.es):
parsea as URLs do Perfil Contratante de cada concello, mantén un histórico en
`bun:sqlite` e avisa por email (emailjs) cando hai expedientes novos.

- Entry: `plataforma_contratacion_do_estado.js`
- Execución: `bun plataforma_contratacion_do_estado.js <concello.json> [database_nome]`
  (require `NODE_TLS_REJECT_UNAUTHORIZED=0` interior; fallback comentado a `node` se peta sqlite3 dyld).
- Helpers en `lib/`: `sqliteAccions.js`, `parsearResultadosLicitacionsContratos.js`,
  `enviarCorreoNovosExpedientes.js`, `detectarFallosSilenciosos.js`, `baixaLinkPDF*.js`,
  `config.js`, `getNewBrowserTab.js`, `creaRutaNonExiste.js`.
- Config por concello en `.json` (ver `exemplo.json`): `ENTIDADES` (URLs + `limite_paxinas`),
  `EMAIL_CAMPOS_ENVIO`, `EMAIL_CONFIG`.

## Stack / runtime

- Runtime: **Bun 1.3.14** (tamén runner de tests).
- `package.json`: `"type": "module"`, script `"test": "bun test"`.
- Dependencias: puppeteer ^23, emailjs ^4, nodemailer ^6 (nodemailer aparentemente sen uso directo).
- Idiomas: galego en código, comentarios, commits e docs.

## Test runner (detectado e verificado)

- Comando: `bun test` (equiv. `npm test`, que delega en `bun test`).
- Estado verificado na fase init: **13 pass / 0 fail** en ~166 ms, 3 ficheiros:
  - `test/sqliteAccions.test.js` (6) — unit, helpers de `lib/sqliteAccions.js` con fixtures temporais.
  - `test/detectarFallosSilenciosos.test.js` (4) — unit, `lib/detectarFallosSilenciosos.js`.
  - `test/enviarCorreo.smoke.test.js` (3) — smoke, mockea `emailjs` con `mock.module`
    (non envía correos reais) e reproduce a regresión de config baleira.
- Non hai capas de integración e2e configurables; o scraper require rede real e credenciais por concello.

## Config SDD

`openspec/config.yaml` (existente, rexenerado nesta init co contexto correcto):

- `strict_tdd: true` — RED→GREEN na fase apply (xa hai tests verdes que actúan de rede de seguridade).
- `test_cmd`: `bun test` en `rules.apply` e `rules.verify`.
- Regras por fase: proposal require_problem_statement; spec require_acceptance_criteria;
  design require_tradeoffs; tasks protect_review_workload.
- Layout OpenSpec: `openspec/specs/` (baleiro), `openspec/changes/archive/` (baleiro).

## Decisión de sesión (preflight)

- Modo: `interactive`; entrega: `ask-on-risk`; orzamento de revisión: 400.

## Riscos observados

- `.gitignore` exclúe `*db` e `*json` (agás `exemplo*.json`): os `.db` por concello e configs
  con credenciais non versionan — os cambios de fase non deben asumilos presentes.
- O smoke test envía correos reais se algún día se quita o `mock.module`: mantelo.
- `existsRecord` documenta nun test un contrato aínda non booleano puro (posible tarefa futura).