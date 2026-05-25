/**
 * Regressão para `normalizeMultipleChoiceData` (Step 5).
 *
 * Cobre os 3 campos aceitos no schema canônico + alias retroativo `answer`:
 *   - correctOptionIndex (number)  — canônico
 *   - correctAnswer     (string)   — texto da opção
 *   - answer            (number|string) — alias retroativo (legacy/GPT)
 */

import { describe, it, expect } from 'vitest';
import { normalizeMultipleChoiceData } from '../step5-generate-exercises';

const baseOptions = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

describe('normalizeMultipleChoiceData', () => {
  it('1. aceita correctOptionIndex e converte para correctAnswer (texto)', () => {
    const result = normalizeMultipleChoiceData({
      question: 'q?',
      options: [...baseOptions],
      correctOptionIndex: 1,
    });
    expect(result.correctAnswer).toBe('Bravo');
    expect(result.correctOptionIndex).toBeUndefined();
  });

  it('2. aceita correctAnswer (string) presente em options', () => {
    const result = normalizeMultipleChoiceData({
      question: 'q?',
      options: [...baseOptions],
      correctAnswer: 'Charlie',
    });
    expect(result.correctAnswer).toBe('Charlie');
  });

  it('3. falha quando correctAnswer (string) não está em options', () => {
    expect(() =>
      normalizeMultipleChoiceData({
        question: 'q?',
        options: [...baseOptions],
        correctAnswer: 'Echo',
      })
    ).toThrow(/não está nas opções disponíveis/);
  });

  it('4. aceita answer:number como alias de correctOptionIndex', () => {
    const result = normalizeMultipleChoiceData({
      question: 'q?',
      options: [...baseOptions],
      answer: 1,
      explanation: 'porque sim',
    });
    expect(result.correctAnswer).toBe('Bravo');
    expect(result.answer).toBeUndefined();
    expect(result.explanation).toBe('porque sim');
  });

  it('5. aceita answer:string como alias de correctAnswer', () => {
    const result = normalizeMultipleChoiceData({
      question: 'q?',
      options: [...baseOptions],
      answer: 'Delta',
    });
    expect(result.correctAnswer).toBe('Delta');
  });

  it('6. falha quando nenhum dos 3 campos está presente', () => {
    expect(() =>
      normalizeMultipleChoiceData({
        question: 'q?',
        options: [...baseOptions],
      })
    ).toThrow(/correctOptionIndex.*correctAnswer.*answer/);
  });

  it('7. falha quando correctOptionIndex está fora do range', () => {
    expect(() =>
      normalizeMultipleChoiceData({
        question: 'q?',
        options: [...baseOptions],
        correctOptionIndex: 99,
      })
    ).toThrow(/fora do range/);
  });

  it('preserva o caso real que falhava antes do fix (answer:1 + wrapper data)', () => {
    // Replica do JSON enviado pelo GPT que disparou o erro original
    const realCase = {
      answer: 1,
      options: [
        'Os sistemas contábeis não conseguem emitir guias e SPED no prazo',
        'Os sistemas executam o que foi parametrizado, mas não interpretam norma nova',
        'Os clientes não querem ouvir sobre reforma tributária',
        'A reforma tributária já eliminou ICMS e ISS imediatamente',
      ],
      question: 'Qual é o "gap" central descrito na aula?',
      explanation: 'O gap é a falta de interpretação...',
    };
    const result = normalizeMultipleChoiceData(realCase);
    expect(result.correctAnswer).toBe(
      'Os sistemas executam o que foi parametrizado, mas não interpretam norma nova'
    );
  });
});
