// Helpers puros para a parada do bucle de páxinas por data (SDD: page-limit-by-date).
// Só dependen dos seus argumentos (non fan I/O), polo que se poden testar en illamento.

// Localiza o índice da columna de data da web entre os headers.
// - headers: `Array<Array<string>>` (un `th` → o array de textos `strong` internos).
// - Prioridade: 1º header que conteña "publicaci", 2º o primeiro que conteña "fecha".
// - Devolve `-1` se non hai columna de data detectable.
function localizarIndiceColunaData(headers) {
  let idxPublicaci = -1;
  let idxFecha = -1;
  for (let i = 0; i < (headers || []).length; i++) {
    const fila = headers[i] || [];
    const texto = fila.map(String).join(' ').toLowerCase();
    if (texto.includes('publicaci') && idxPublicaci === -1) idxPublicaci = i;
    if (texto.includes('fecha') && idxFecha === -1) idxFecha = i;
  }
  return idxPublicaci >= 0 ? idxPublicaci : idxFecha;
}

// Normaliza un valor de data da web a milisegundos UNIX, ou `null` se non é parseable.
// Admite `DD/MM/AAAA`, `DD/MM/AAAA HH:mm` e `AAAA-MM-DD`, con separadores `/`, `-` ou `.`.
// Calquera valor ausente/baleiro/ilexible/non-string/fora de rango devolve `null`.
function normalizarDataWeb(valor) {
  if (typeof valor !== 'string') return null;
  const s = valor.trim();
  if (!s) return null;

  // DD/MM/AAAA [HH:mm] — formato europeo orixe (separadores / - .)
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const dia = +m[1], mes = +m[2], ano = +m[3];
    const hora = m[4] !== undefined ? +m[4] : 0;
    const min = m[5] !== undefined ? +m[5] : 0;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || hora < 0 || min > 59 || min < 0) return null;
    const date = new Date(Date.UTC(ano, mes - 1, dia, hora, min));
    if (date.getUTCFullYear() !== ano || date.getUTCMonth() !== mes - 1 || date.getUTCDate() !== dia) return null;
    return date.getTime();
  }

  // AAAA-MM-DD (separadores / - .)
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const ano = +m[1], mes = +m[2], dia = +m[3];
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    const date = new Date(Date.UTC(ano, mes - 1, dia));
    if (date.getUTCFullYear() !== ano || date.getUTCMonth() !== mes - 1 || date.getUTCDate() !== dia) return null;
    return date.getTime();
  }

  return null;
}

// Decide se hai que parar o bucle de páxinas pola data.
// - `ultimaFilaMs`: data da última fila da páxina actual (ms) ou `null`.
// - `horizonteMs`: max data de publicación xa coñecida na BD (ms) ou `null` (sen histórico).
// Só corta con `<` estrito; ante `null` (sen histórico ou data ilexible) NON corta (fallback conservador).
function debePararPorData(ultimaFilaMs, horizonteMs) {
  if (horizonteMs == null) return false;
  if (ultimaFilaMs == null) return false;
  return ultimaFilaMs < horizonteMs;
}

module.exports = { localizarIndiceColunaData, normalizarDataWeb, debePararPorData };