# Proposal — Alerta de fallo silencioso con link ao perfil afectado

Cambio: `alerta-link-perfil`. Issue: #3 (label `bug`).

## Problema

O correo de alerta de fallo silencioso indica o nome da táboa e unha mensaxe xenérica, pero
**non inclúe un link directo ao perfil** onde se produciu o fallo.
Exemplo actual: `Xunta_de_Goberno_contratos_menores: non se atopou a táboa esperada, pero ten 2 rexistro(s) histórico(s)...`

## Obxectivo (único)

Que a liña de alerta inclúa o **link directo ao Perfil Contratante** (a `url` da entidade en `CONFIG.ENTIDADES`)
para poder comprobar directamente o fallo.

## Alcance

- `lib/parsearResultadosLicitacionsContratos.js`: o resumo devolto por táboa pasa a levar `url` (a URL da entidade).
- `lib/detectarFallosSilenciosos.js`: engade unha liña `🔗 Perfil: <url>` na alerta cando hai URL; sen URL, omítese.
- Test: `test/detectarFallosSilenciosos.test.js` (afirma o link e o caso sen URL).

## Non-obxectivos

- Non se cambia o formato de envío de correo nin a detección en si.
- Non se tocan as alertas de erro fatal nin as de novos expedientes.

## Criterios de éxito

- A alerta con `url` mostra `🔗 Perfil: <url>`.
- A alerta sen `url` non mostra a liña de perfil.
- `bun test` verde (30).