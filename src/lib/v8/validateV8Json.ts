import type { V8Section, V8InlineQuiz, V8InlinePlayground } from "@/types/v8Lesson";
import type { ValidationResult } from "./types";

/**
 * Valida JSON estruturado de aula V8 antes de gravar/processar.
 *
 * Regras: 22 erros hard + 6 warnings. Retorna { valid: false } se houver
 * qualquer erro hard. Warnings não invalidam mas alertam admin.
 *
 * Extraído de src/pages/AdminV8Create.tsx (era inline).
 */
export function validateV8Json(raw: unknown): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    sectionCount: 0,
    quizCount: 0,
    playgroundCount: 0,
    exerciseCount: 0,
    warnings: [],
    errors: [],
  };

  if (!raw || typeof raw !== "object") {
    result.valid = false;
    result.errors.push("JSON inválido ou vazio");
    return result;
  }

  const data = raw as Record<string, unknown>;

  if (data.contentVersion !== "v8") {
    result.errors.push('contentVersion deve ser "v8"');
    result.valid = false;
  }

  if (!data.title || typeof data.title !== "string") {
    result.errors.push("title é obrigatório (string)");
    result.valid = false;
  }

  // Sections
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    result.errors.push("sections[] deve ter pelo menos 1 seção");
    result.valid = false;
  } else {
    result.sectionCount = data.sections.length;
    (data.sections as V8Section[]).forEach((s, i) => {
      if (!s.id) result.warnings.push(`Section ${i}: falta id`);
      if (!s.title) result.errors.push(`Section ${i}: falta title`);
      if (!s.content?.trim()) result.warnings.push(`Section ${i}: content vazio`);
    });
  }

  const sectionsLength = Array.isArray(data.sections) ? data.sections.length : 0;

  // Inline quizzes
  if (Array.isArray(data.inlineQuizzes)) {
    result.quizCount = data.inlineQuizzes.length;
    (data.inlineQuizzes as V8InlineQuiz[]).forEach((q, i) => {
      const qType = q.quizType || 'multiple-choice';

      // Validação por tipo
      if (qType === 'multiple-choice') {
        if (!q.question) result.errors.push(`Quiz ${i}: falta question`);
        if (!Array.isArray(q.options) || q.options.length < 2) {
          result.errors.push(`Quiz ${i}: mínimo 2 opções`);
        }
        const correct = q.options?.filter((o) => o.isCorrect);
        if (!correct?.length) result.errors.push(`Quiz ${i}: nenhuma opção correta`);
      } else if (qType === 'true-false') {
        if (!q.statement) result.errors.push(`Quiz ${i}: falta statement`);
        if (typeof q.isTrue !== 'boolean') result.errors.push(`Quiz ${i}: falta isTrue (boolean)`);
      } else if (qType === 'fill-blank') {
        if (!q.sentenceWithBlank) result.errors.push(`Quiz ${i}: falta sentenceWithBlank`);
        if (!q.correctAnswer) result.errors.push(`Quiz ${i}: falta correctAnswer`);
      }

      // Validações comuns a todos os tipos
      if (!q.explanation) result.warnings.push(`Quiz ${i}: falta explanation`);
      if (q.afterSectionIndex < 0 || q.afterSectionIndex >= sectionsLength) {
        result.errors.push(`Quiz ${i}: afterSectionIndex (${q.afterSectionIndex}) fora do range [0, ${sectionsLength - 1}]`);
      }
    });
  }

  // Inline playgrounds
  if (Array.isArray(data.inlinePlaygrounds)) {
    result.playgroundCount = (data.inlinePlaygrounds as V8InlinePlayground[]).length;
    (data.inlinePlaygrounds as V8InlinePlayground[]).forEach((pg, i) => {
      if (!pg.title) result.errors.push(`Playground ${i}: falta title`);
      if (!pg.instruction || pg.instruction.length < 40) {
        result.errors.push(`Playground ${i}: instruction deve ter >= 40 caracteres`);
      }
      if (!pg.amateurPrompt) result.errors.push(`Playground ${i}: falta amateurPrompt`);
      if (!pg.professionalPrompt) result.errors.push(`Playground ${i}: falta professionalPrompt`);
      if (pg.amateurPrompt === pg.professionalPrompt) {
        result.errors.push(`Playground ${i}: amateurPrompt e professionalPrompt são iguais`);
      }
      if (pg.amateurPrompt?.length > 2000) result.warnings.push(`Playground ${i}: amateurPrompt muito longo (>2000 chars)`);
      if (pg.professionalPrompt?.length > 2000) result.warnings.push(`Playground ${i}: professionalPrompt muito longo (>2000 chars)`);
      if (!pg.successMessage) result.errors.push(`Playground ${i}: falta successMessage`);
      if (!pg.tryAgainMessage) result.errors.push(`Playground ${i}: falta tryAgainMessage`);
      if (pg.afterSectionIndex < 0 || pg.afterSectionIndex >= sectionsLength) {
        result.errors.push(`Playground ${i}: afterSectionIndex (${pg.afterSectionIndex}) fora do range [0, ${sectionsLength - 1}]`);
      }
      if (pg.userChallenge) {
        if (pg.userChallenge.hints?.length > 3) {
          result.errors.push(`Playground ${i}: máximo 3 hints`);
        }
        if (!pg.userChallenge.evaluationCriteria?.length) {
          result.warnings.push(`Playground ${i}: challenge sem evaluationCriteria`);
        }
      }
    });
  }

  // Exercises
  if (Array.isArray(data.exercises)) {
    result.exerciseCount = data.exercises.length;
  }

  if (result.errors.length > 0) result.valid = false;
  return result;
}
