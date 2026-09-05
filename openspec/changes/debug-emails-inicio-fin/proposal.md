# Proposal — Correos de debug de inicio/fin

Cambio: `debug-emails-inicio-fin` · Entregado no PR #6 (xunto cos fixes de correos/parada) por decisión do usuario.

## Problema

Durante a fase de depuración actual é difícil saber cando empeza e remata cada execución do scraper.
Só hai emails por entidade/tipo (novos) e de alerta; non hai un correo de "comezou" e "rematou".

## Obxectivo

Enviar, ademais dos correos existentes, un correo de **INICIO** e outro de **FIN** da execución
(con hora de comezo e hora de fin), controlados por un flag de config `EMAIL_DEBUG` para poder
desactivalos cando remate a depuración.

## Decisións pechadas (usuario)

- Entrégase no **mesmo PR #6** (non rama separada).
- **Flag `EMAIL_DEBUG`** na config (true/false) para activar/desactivar sen tocar código.
- Se o run falla, tamén se envía o correo de **FIN** (con nota do erro), ademais da alerta existente.

## Alcance

- `lib/enviarCorreoNovosExpedientes.js`: `enviarCorreoDebugStart(concello)` e
  `enviarCorreoDebugEnd(concello, horaInicio, err?)` (gated por `CONFIG.EMAIL_DEBUG`).
- `plataforma_contratacion_do_estado.js`: `horaInicio` ao comezo, correo de inicio ao arrancar,
  correo de fin ao rematar (normal e en `.catch`).
- Configs: `EMAIL_DEBUG: true` en `ames.json`, `san_cibrao.json` (locais) e documento en `exemplo.json`.

## Non-obxectivos

- Non cambia o formato do correo de novos nin das alertas.
- Non é un sistema de logs; é só o par de correos de inicio/fin.

## Criterios de éxito

- `enviarCorreoDebugStart`/`End` envían co `EMAIL_DEBUG: true` e email configurado; devolven `null`
  co flag desactivado.
- O driver envía inicio ao comezar e fin ao rematar (incluído en erro).
- `bun test` verde.