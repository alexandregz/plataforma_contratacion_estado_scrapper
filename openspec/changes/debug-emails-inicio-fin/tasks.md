# Tasks — Correos de debug de inicio/fin

Cambio: `debug-emails-inicio-fin` · PR #6 · Entrega: single PR.

## Tarefas (feitas)

### T1 — Funcións de correo de debug — feito
- [x] `lib/enviarCorreoNovosExpedientes.js`: `enviarCorreoDebugStart(concello)` e
      `enviarCorreoDebugEnd(concello, horaInicio, err?)`; ambas gated por `CONFIG.EMAIL_DEBUG`
      (devolven `null` se desactivado). O fin inclúe hora de fin, duración e, se houbo, o erro.

### T2 — Integración no driver — feito
- [x] `plataforma_contratacion_do_estado.js`: `const horaInicio = new Date()` ao comezo;
      correo de inicio ao arrancar; correo de fin ao rematar (execución normal e en `.catch`).

### T3 — Config — feito
- [x] `EMAIL_DEBUG: true` en `ames.json` e `san_cibrao_das_vinhas.json` (locais, gitignored).
- [x] Documentado `EMAIL_DEBUG: true` en `exemplo.json` (trackeado).

### T4 — Tests — feito
- [x] Smoke: `enviarCorreoDebugStart/End` envían con EMAIL_DEBUG true; devolven null sen flag.
- [x] `bun test` → 22 pass / 0 fail.