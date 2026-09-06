# Tasks — Correo único agregado de novos expedientes

Cambio: `correo-unico-agregado` · Ramas: `feat/correo-unico-agregado` · Entrega: single PR.

## Tarefas (feitas)

### T1 — Función agregada — feito
- [x] `lib/enviarCorreoNovosExpedientes.js`: `enviarCorreoUnicoAgregado(concello, tables)`. Xunta os
      non notificados de cada táboa nun só corpo con seccións `========== <taboa> ==========`, envía un
      único correo e marca tralo envío real (dedup). `null` sen pendentes.

### T2 — Quitar o correo por táboa do parseador — feito
- [x] `lib/parsearResultadosLicitacionsContratos.js`: eliminado o import de `enviarCorreoNovosExpedientes`
      e o bloque de envío por táboa (sustituído por nota de que o correo é único no driver).

### T3 — Integración no driver — feito
- [x] `plataforma_contratacion_do_estado.js`: `tablesRevisadas` recolle os `db_name` no bucle; chámase
      `enviarCorreoUnicoAgregado` despois do bucle e **antes** da alerta de fallo silencioso.

### T4 — Tests — feito
- [x] Smoke: `enviarCorreoUnicoAgregado` envía un só correo agrupado (2 táboas) e marca; sen pendentes → null.
- [x] `bun test` → 24 pass / 0 fail.