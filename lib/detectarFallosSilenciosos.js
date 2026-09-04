// Detección de fallos silenciosos do scraper, extraída nun módulo propio para poder testala en illamento.
const { totalRowsInTable } = require('./sqliteAccions');

// Detecta táboas que deberían ter contido (histórico en BD) pero que nesta execución
// non produciron resultados (cambio de HTML, selector roto, etc.) e devolve as liñas de alerta.
//
// resumos: array de { table, encontrada, tenResultados } producidos por parsearResultadosLicitacionsContratos
function detectarFallosSilenciosos(resumos) {
  const alertas = [];
  for (const resumo of resumos) {
    if (!resumo.encontrada || !resumo.tenResultados) {
      const total = totalRowsInTable(resumo.table);
      if (total > 0) {
        const motivo = resumo.encontrada ? 'non devolveu resultados' : 'non se atopou a táboa esperada';
        alertas.push(`${resumo.table}: ${motivo}, pero ten ${total} rexistro(s) histórico(s). Revisa o HTML/scraper.`);
      }
    }
  }
  return alertas;
}

module.exports = { detectarFallosSilenciosos };