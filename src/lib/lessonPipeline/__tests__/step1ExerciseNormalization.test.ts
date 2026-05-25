import { describe, expect, it } from 'vitest';
import { step1Intake } from '../step1-intake';

const baseInput = {
  model: 'v5' as const,
  title: 'A Camada de Interpretação',
  trackId: '3977a279-a916-47e4-8ce5-e4474cfbd021',
  trackName: 'IA para Profissionais',
  orderIndex: 2,
  estimatedTimeMinutes: 12,
  sections: [{
    id: 'section-1',
    visualContent: 'Conteúdo suficiente para validar a seção sem depender de áudio.',
  }],
};

describe('step1Intake exercise normalization', () => {
  it('normaliza e valida fill-in-blanks no formato text + blanks antes do áudio', async () => {
    const result = await step1Intake({
      ...baseInput,
      exercises: [{
        type: 'fill-in-blanks',
        data: {
          text: 'A vantagem vem de adicionar uma camada de _____ ao escritório, com um ponto de _____ antes de orientar o cliente.',
          blanks: [
            { id: 'blank-1', alternatives: ['explicação', 'tradução'], correctAnswer: 'interpretação' },
            { id: 'blank-2', alternatives: ['precaução', 'revisão'], correctAnswer: 'validação' },
          ],
        },
      }],
    });

    const exercise = result.exercises[0] as any;
    expect(exercise.data.sentences).toHaveLength(2);
    expect(exercise.data.sentences[0].text).toContain('_______');
    expect(exercise.data.sentences[0].correctAnswers).toEqual(['interpretação', 'explicação', 'tradução']);
    expect(exercise.data.sentences[1].correctAnswers).toEqual(['validação', 'precaução', 'revisão']);
  });

  it('falha no Step 1 quando fill-in-blanks não tem respostas válidas', async () => {
    await expect(step1Intake({
      ...baseInput,
      exercises: [{
        type: 'fill-in-blanks',
        data: { text: 'A camada de _____ muda o jogo.', blanks: [] },
      }],
    })).rejects.toThrow(/Falha na validação inicial do exercício 1/);
  });

  it('strips legado open-text de data-collection (proibido desde 2026-05)', async () => {
    const result = await step1Intake({
      ...baseInput,
      exercises: [{
        type: 'data-collection',
        data: {
          mode: 'open-text',
          question: 'Qual pergunta de cliente você mais recebe?',
          placeholder: 'Escreva 1 ou 2 linhas...',
          maxLength: 400,
        },
      }],
    });

    const data = (result.exercises[0] as any).data;
    expect(data.mode).toBeUndefined();
    expect(data.question).toBeUndefined();
    expect(data.placeholder).toBeUndefined();
    expect(data.maxLength).toBeUndefined();
  });
});