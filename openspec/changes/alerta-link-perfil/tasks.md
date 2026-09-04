# Tasks — Alerta de fallo silencioso con link ao perfil

Cambio: `alerta-link-perfil` · Issue: #3 · Entrega: single PR (mínimo, <50 liñas, risco Low).

## Tarefas

### T1 — RED: tests do link (feitos)
- [x] O test de `detectarFallosSilenciosos` afirme que a alerta con `url` contén `🔗 Perfil: <url>`.
- [x] O test afirme que un resumo sen `url` NON inclúe `🔗 Perfil`.

### T2 — GREEN: incluír o link na alerta (feito)
- [x] `lib/parsearResultadosLicitacionsContratos.js`: `resumoDoProceso.url = (CONFIG.ENTIDADES[entidade] || {}).url || ''`.
- [x] `lib/detectarFallosSilenciosos.js`: engadir `\n   🔗 Perfil: ${resumo.url}` á liña de alerta cando hai URL.

### T3 — Regresión
- [x] `bun test` → 30 pass / 0 fail.
- [x] Revision dos diffs: só se tocaron os 2 ficheiros de `lib/` + o test do detector; non se tocou o envío de correo nin a detección.