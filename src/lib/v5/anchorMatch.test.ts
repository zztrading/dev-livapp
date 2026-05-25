import { describe, it, expect } from 'vitest';
import {
  normalizeAnchor,
  anchorMatches,
  findAnchorPosition,
} from './anchorMatch';

describe('normalizeAnchor', () => {
  it('lowercases + strips diacriticos', () => {
    expect(normalizeAnchor('É UM HONORÁRIO')).toBe('e um honorario');
  });

  it('remove markdown leve', () => {
    expect(normalizeAnchor('**eu conferi e confirmo.**')).toBe(
      'eu conferi e confirmo.'
    );
    expect(normalizeAnchor('`código`')).toBe('codigo');
    expect(normalizeAnchor('_itálico_')).toBe('italico');
  });

  it('preserva pontuação (regressão: 2.000 não vira 2 000)', () => {
    expect(normalizeAnchor('R$ 2.000,00')).toBe('r$ 2.000,00');
  });

  it('colapsa whitespace', () => {
    expect(normalizeAnchor('foo   bar\n\nbaz')).toBe('foo bar baz');
  });
});

describe('anchorMatches', () => {
  it('casa anchor com markdown no texto', () => {
    const text = 'Aqui **eu conferi e confirmo** o resultado.';
    expect(anchorMatches(text, 'eu conferi e confirmo')).toBe(true);
  });

  it('casa anchor sem acento contra texto com acento', () => {
    expect(anchorMatches('Não é um bug.', 'nao e um bug')).toBe(true);
  });

  it('case insensitive', () => {
    expect(anchorMatches('FOO BAR', 'foo bar')).toBe(true);
  });

  it('rejeita anchor que não existe', () => {
    expect(anchorMatches('foo bar', 'baz')).toBe(false);
  });

  it('rejeita anchor vazio', () => {
    expect(anchorMatches('foo bar', '')).toBe(false);
  });
});

describe('findAnchorPosition', () => {
  it('retorna posição no texto original quando anchor casa direto', () => {
    const text = 'Olá mundo, foo bar baz.';
    const pos = findAnchorPosition(text, 'foo bar');
    expect(pos).toBe(text.indexOf('foo bar'));
  });

  it('retorna posição no texto original mesmo com markdown', () => {
    const text = 'Olá **eu conferi e confirmo** agora.';
    const pos = findAnchorPosition(text, 'eu conferi e confirmo');
    // Posição do "e" de "eu" dentro do **...**
    expect(pos).toBe(text.indexOf('eu conferi'));
  });

  it('retorna posição correta com acentos', () => {
    const text = 'Não é um bug. É o design.';
    const pos = findAnchorPosition(text, 'nao e um bug');
    expect(pos).toBe(0);
  });

  it('retorna -1 quando não encontra', () => {
    expect(findAnchorPosition('foo bar', 'xyz')).toBe(-1);
  });

  it('retorna -1 para anchor vazio ou texto vazio', () => {
    expect(findAnchorPosition('', 'foo')).toBe(-1);
    expect(findAnchorPosition('foo', '')).toBe(-1);
  });

  it('mantém ratio aproximadamente correto após strip de markdown', () => {
    const text = 'Início. **meio destacado** fim do texto.';
    const pos = findAnchorPosition(text, 'meio destacado');
    expect(pos).toBe(text.indexOf('meio destacado'));
    // Sanity: posição razoável, não no fim
    expect(pos).toBeLessThan(text.length / 2 + 5);
  });
});
