/**
 * V5 — Source-of-truth único para casamento de anchorText.
 *
 * Usado em 3 pontos:
 *  1. validateLessonJson.ts (validação prévia na UI)
 *  2. cardsReport.ts (validação no pipeline step6)
 *  3. GuidedLessonV5.tsx (cálculo de timestamp em runtime)
 *
 * REGRAS DE NORMALIZAÇÃO (alinhadas, não agressivas):
 *  - lowercase
 *  - strip de diacríticos (NFD + remove combining marks)
 *  - strip de markdown leve: ** __ * _ `
 *  - colapso de whitespace
 *
 * NÃO faz:
 *  - strip de pontuação (`.` `,` `!` `?`) — preserva números tipo "2.000"
 *  - fuzzy matching — anchor deve casar literalmente após normalização
 */

/** Normaliza string para comparação de anchor. */
export function normalizeAnchor(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacríticos combinantes
    .replace(/\*\*|__|\*|_|`/g, '') // markdown leve
    .replace(/\s+/g, ' ')
    .trim();
}

/** Retorna true se o anchor (após normalização) ocorre no texto (após normalização). */
export function anchorMatches(haystack: string, needle: string): boolean {
  const h = normalizeAnchor(haystack);
  const n = normalizeAnchor(needle);
  if (n.length === 0) return false;
  return h.includes(n);
}

/**
 * Encontra a posição do anchor no TEXTO ORIGINAL, mesmo que a normalização
 * altere o tamanho. Indispensável para o runtime calcular ratio = pos/len
 * corretamente — sem isso o card aparece em timestamp errado quando o texto
 * tem markdown ou diacríticos.
 *
 * Retorna -1 se não encontrar (mesmo contrato de String.prototype.indexOf).
 */
export function findAnchorPosition(haystack: string, needle: string): number {
  if (!haystack || !needle) return -1;

  // Constrói representação normalizada do haystack mantendo, para cada char
  // normalizado, o índice ORIGINAL onde ele começou.
  const normChars: string[] = [];
  const origIndex: number[] = [];
  let i = 0;
  const len = haystack.length;

  while (i < len) {
    // Olha 2 chars para detectar ** ou __
    const two = haystack.substr(i, 2);
    if (two === '**' || two === '__') {
      i += 2;
      continue;
    }
    const ch = haystack[i];
    if (ch === '*' || ch === '_' || ch === '`') {
      i += 1;
      continue;
    }

    // Normaliza este char isoladamente (NFD + strip diacrítico + lower).
    const decomposed = ch.normalize('NFD');
    let kept = '';
    for (const c of decomposed) {
      if (c.charCodeAt(0) >= 0x0300 && c.charCodeAt(0) <= 0x036f) continue;
      kept += c.toLowerCase();
    }

    // Colapso de whitespace: qualquer \s vira 1 espaço, e múltiplos consecutivos
    // são deduplicados.
    if (/\s/.test(kept)) {
      const last = normChars[normChars.length - 1];
      if (last === ' ') {
        i += 1;
        continue;
      }
      normChars.push(' ');
      origIndex.push(i);
    } else {
      for (const c of kept) {
        normChars.push(c);
        origIndex.push(i);
      }
    }
    i += 1;
  }

  // Trim do início (descarta espaço inicial pra alinhar com normalizeAnchor)
  let start = 0;
  while (start < normChars.length && normChars[start] === ' ') start++;

  const normHay = normChars.slice(start).join('');
  const normNeedle = normalizeAnchor(needle);
  if (normNeedle.length === 0) return -1;

  const found = normHay.indexOf(normNeedle);
  if (found === -1) return -1;

  return origIndex[start + found];
}
