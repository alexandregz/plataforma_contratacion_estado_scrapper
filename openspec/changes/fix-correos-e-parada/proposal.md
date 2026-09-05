# Proposal — Corrección: correos duplicados e parada por data inoperante

Cambio: `fix-correos-e-parada` · Issue: #5 (label `bug`).

## Problema (dúas causas raíz)

1. **Correos duplicados ao re-executar o mesmo día.** `enviarCorreoNovosExpedientes` consideraba
   "novidades" os rexistros con `fecha_insercion` de hoxe; re-executar reenvía o mesmo correo cos mesmos datos.
2. **A parada por data non corta nas contratos menores.** As táboas de `contratos_menores` non teñen
   columna de data → `localizarIndiceColunaData` => -1 ⇒ a parada por data queda desactivada e seguía paginando
   ata `limite_paxinas` aínda que xa comprobara eses expedientes.

## Obxectivo

- Cada expediente novo enviado por correo **unha soa vez** (non reenviar en re-execución do mesmo día).
- A parada do bucle debe parar cando a páxina **xa está toda coñecida** (todos os expedientes xa na BD),
  independentemente da columna de data. `limite_paxinas` segue como tope de seguridade.

## Alcance

- **Dedup correos:** nova táboa `email_enviados(taboa, expediente, enviado_en)` en `lib/sqliteAccions.js`.
  `enviarCorreoNovosExpedientes` só envía os non notificados e márcasos tralo envío REAL (non se marca
  se o envío se omitiu por non haber email configurado).
- **Parada:** en `lib/parsearResultadosLicitacionsContratos.js`, substituír a parada por data pola
  **fronteira por existencia** (novosNestaPaxina === 0 ⇒ parar). Elimínsase o módulo `parsearDatas` e
  `maxDataPublicacionBD` (dependencia de data).

## Non-obxectivos

- Non se cambia o formato do correo de alerta nin dos novos expedientes.
- Non se introduce filtrado por data de publicación no correo (decisión de produto, vese #5).

## Criterios de éxito

- Re-executar o mesmo día NON reenvía expedientes xa notificados.
- A parada do bucle funciona sen columna de data (páxina toda coñecida).
- `bun test` verde.