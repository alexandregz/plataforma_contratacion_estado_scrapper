# Tasks — Corrección: correos duplicados e parada por fronteira

Cambio: `fix-correos-e-parada` · Issue: #5 · Entrega: single PR (mínimo, risco Low).

## Tarefas

### Dedup de correos (email_enviados) — feito
- [x] `lib/sqliteAccions.js`: `createEmailEnviados`, `expedientesXaEnviados`, `marcarExpedientesEnviados`.
- [x] `lib/enviarCorreoNovosExpedientes.js`: filtrar só os non notificados; marcar TRALO envío real
      (non marcar cando se omite por falta de email configurado).

### Parada por fronteira — feito
- [x] `lib/parsearResultadosLicitacionsContratos.js`: `novosNestaPaxina` no bucle; parar cando a páxina
      enteira está toda coñecida (0 novos); `limite_paxinas` mantido como tope.
- [x] Eliminar o módulo obsoleto `lib/parsearDatas.js` + `test/parsearDatas.test.js` e `maxDataPublicacionBD`.

### Tests — feito
- [x] `test/sqliteAccions.test.js`: dedup `email_enviados` (baleiro, marcar+listar idempotente, por táboa).
- [x] `test/enviarCorreo.smoke.test.js`: re-execución NON reenvía (dedup) e todos notificados ⇒ null.
- [x] `bun test` → 19 pass / 0 fail.