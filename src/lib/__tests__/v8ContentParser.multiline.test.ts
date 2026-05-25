import { describe, it, expect } from 'vitest';
import { parsePlaygroundBlocks } from '../v8ContentParser';

describe('v8ContentParser — pipe-style multiline in [PLAYGROUND]', () => {
  it('A: 1-line fields parse identically (regression)', () => {
    const raw = `[PLAYGROUND]
title: Anúncio
amateurPrompt: faz um anúncio
professionalPrompt: você é copywriter, foco em padaria
amateurResult: texto curto
professionalResult: headline forte
`;
    const [{ playground }] = parsePlaygroundBlocks(raw);
    expect(playground.title).toBe('Anúncio');
    expect(playground.amateurPrompt).toBe('faz um anúncio');
    expect(playground.professionalPrompt).toBe('você é copywriter, foco em padaria');
    expect(playground.amateurResult).toBe('texto curto');
    expect(playground.professionalResult).toBe('headline forte');
  });

  it('B: pipe-style multiline preserves \\n in amateurPrompt and professionalResult', () => {
    const raw = `[PLAYGROUND]
title: Anúncio
amateurPrompt: |
Faça um anúncio.
É urgente.
professionalPrompt: você é copywriter
amateurResult: curto
professionalResult: |
Headline forte.
Corpo com prova social.
CTA específico.
`;
    const [{ playground }] = parsePlaygroundBlocks(raw);
    expect(playground.amateurPrompt).toBe('Faça um anúncio.\nÉ urgente.');
    expect(playground.professionalResult).toBe('Headline forte.\nCorpo com prova social.\nCTA específico.');
    expect(playground.professionalPrompt).toBe('você é copywriter');
  });

  it('C: pipe-style stops at hints: list (no swallow)', () => {
    const raw = `[PLAYGROUND]
title: T
userChallengeInstruction: |
Linha 1.
Linha 2.
hints:
- dica 1
- dica 2
userChallengePrompt: prompt aqui
`;
    const [{ playground }] = parsePlaygroundBlocks(raw);
    expect(playground.userChallenge?.instruction).toBe('Linha 1.\nLinha 2.');
    expect(playground.userChallenge?.hints).toEqual(['dica 1', 'dica 2']);
    expect(playground.userChallenge?.challengePrompt).toBe('prompt aqui');
  });

  it('D: pipe-style as last field collects until end of block', () => {
    const raw = `[PLAYGROUND]
title: T
amateurPrompt: a
professionalPrompt: p
professionalResult: |
Linha A.
Linha B.

## Próxima Seção
Conteúdo fora do playground.
`;
    const [{ playground }] = parsePlaygroundBlocks(raw);
    // The block regex stops at \n## , so multiline only sees what's inside the block.
    expect(playground.professionalResult).toBe('Linha A.\nLinha B.');
  });
});
