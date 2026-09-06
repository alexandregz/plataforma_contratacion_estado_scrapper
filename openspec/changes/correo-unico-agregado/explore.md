# Explore — `correo-unico-agregado`

Cambio SDD: enviar un único correo cos novos expedientes pendentes de todas as entidades/tipos, no canto de un por táboa.

## Fluxo actual (verificado)

1. O driver `plataforma_contratacion_do_estado.js` recorre entidades → por cada unha `TIPOS_A_REVISAR`
   (`<entidade_db>_licitacions`, `<entidade_db>_contratos_menores`) e chama
   `parsearResultadosLicitacionsContratos(browser, page, db_name, concello, entidade)`.
2. Dentro dese parseador, ao final de cada táboa (liñas ~188-191) envíase UN correo por táboa:
   `await enviarCorreoNovosExpedientes(concello, table)` (todos os non notificados desa táboa, con dedup).
3. `enviarCorreoNovosExpedientes` (lib/enviarCorreoNovosExpedientes.js) usa `getExpedientesNonNotificados(table)`,
   envía, e marca en `email_enviados` tralo envío real.

## Punto de intervención

- Eliminar o envío por táboa do parseador.
- Acumular os `db_name` no driver e, ao final do run, chamar un novo `enviarCorreoUnicoAgregado(concello, tables)`
  que xunta todos os pendentes nun só correo agrupado por táboa e marca todo tralo envío.

## Notas

- `envio_email.js` (util manual) segue usando `enviarCorreoNovosExpedientes` por táboa: manténse esa función
  para non romper o tool.
- Alertas de fallo silencioso e correos de debug (inicio/fin) son independentes e quedan como están.
- O dedup `email_enviados` pola táboa consérvase: envío único agrupado e marcas por táboa.