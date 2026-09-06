# Proposal — Correo único agregado de novos expedientes

Cambio: `correo-unico-agregado` · Ramas: `feat/correo-unico-agregado`.

## Problema

Hoje envíase UN correo por táboa (entidade×tipo) desde o parseador. Con varias entidades/tipos, son
moitos correos de ruído. O ToDo do repo pedía: *"Só enviar un email con todas as taboas"*.

## Obxectivo

Enviar un **único correo** ao final da execución cos expedientes pendentes de todas as táboas,
agrupado por seccións por táboa, en lugar dos correos individuais por táboa.

## Decisións pechadas (usuario)

- **Agrupación:** por seccións por táboa (dir. `========== <taboa> ==========`).
- **Substitución:** elimínase o correo individual por táboa (o parseador xa non envía); só xa o único agregado.
- **Orde no run:** o correo único envíase **antes da alerta de fallo silencioso** (entre o debug de inicio e o de fin).

## Alcance

- `lib/enviarCorreoNovosExpedientes.js`: nova `enviarCorreoUnicoAgregado(concello, tables)`:
  xunta os `getExpedientesNonNotificados` de cada táboa nun só corpo, envía unha vez e marca en
  `email_enviados` tralo envío real (dedup conservado).
- `lib/parsearResultadosLicitacionsContratos.js`: quítase o correo por táboa (import e bloque).
- `plataforma_contratacion_do_estado.js`: recolle `tablesRevisadas` no bucle e chama
  `enviarCorreoUnicoAgregado` despois do bucle e antes da alerta.
- `envio_email.js` (util manual) segue usando `enviarCorreoNovosExpedientes` por táboa (mantense).

## Non-obxectivos

- Non cambia alertas de fallo silencioso nin correos de debug (inicio/fin).
- Non cambia o dedup `email_enviados`.

## Criterios de éxito

- `enviarCorreoUnicoAgregado` envía un só correo con seccións por táboa; `null` sen pendentes.
- O parseador xa non envía correo por táboa.
- `bun test` verde.