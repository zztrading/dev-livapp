import { EXERCISE_PLACEHOLDER } from '../exerciseConstants';

const DEFAULT_FEEDBACK = {
  allCorrect: 'Excelente!',
  someCorrect: 'Bom, mas revise algumas respostas.',
  needsReview: 'Revise o conteúdo da lição.',
};

const ROOT_DATA_KEYS_TO_SKIP = new Set(['id', 'type', 'title', 'instruction', 'data']);

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBlankMarkers(text: string): string {
  return text.replace(/_{3,}/g, EXERCISE_PLACEHOLDER);
}

function getDefaultTitle(type: string, index: number): string {
  const titles: Record<string, string> = {
    'multiple-choice': 'Escolha Múltipla',
    'true-false': 'Verdadeiro ou Falso',
    'complete-sentence': 'Complete a Sentença',
    'fill-in-blanks': 'Preencher os Espaços',
    'scenario-selection': 'Escolha o Cenário',
    'data-collection': 'Resposta Aplicada',
  };
  return titles[type] || `Exercício ${index + 1}`;
}

function getDefaultInstruction(type: string): string {
  const instructions: Record<string, string> = {
    'multiple-choice': 'Selecione a alternativa correta:',
    'true-false': 'Avalie se a afirmação é verdadeira ou falsa:',
    'complete-sentence': 'Complete as lacunas:',
    'fill-in-blanks': 'Preencha os espaços em branco:',
    'scenario-selection': 'Analise o cenário e selecione a melhor opção:',
    'data-collection': 'Responda com base na sua realidade:',
  };
  return instructions[type] || 'Responda a questão:';
}

function mergeExerciseData(exercise: any): any {
  const data = isRecord(exercise?.data) ? { ...exercise.data } : {};
  Object.entries(exercise || {}).forEach(([key, value]) => {
    if (!ROOT_DATA_KEYS_TO_SKIP.has(key) && data[key] === undefined) {
      data[key] = value;
    }
  });
  return data;
}

export function normalizeMultipleChoiceExerciseData(data: any): any {
  const normalized = { ...data };
  if (normalized.answer !== undefined) {
    if (typeof normalized.answer === 'number' && normalized.correctOptionIndex === undefined) {
      normalized.correctOptionIndex = normalized.answer;
    } else if (typeof normalized.answer === 'string' && !normalized.correctAnswer) {
      normalized.correctAnswer = normalized.answer;
    }
  }

  if (typeof normalized.correctAnswer === 'string') {
    return normalized;
  }

  if (
    Array.isArray(normalized.options) &&
    typeof normalized.correctOptionIndex === 'number' &&
    normalized.correctOptionIndex >= 0 &&
    normalized.correctOptionIndex < normalized.options.length
  ) {
    normalized.correctAnswer = normalized.options[normalized.correctOptionIndex];
    delete normalized.correctOptionIndex;
    delete normalized.answer;
  }

  return normalized;
}

function normalizeTrueFalseExerciseData(data: any): any {
  if (Array.isArray(data.statements)) {
    return data;
  }

  const correct = data.correct ?? data.answer ?? data.correctAnswer;
  const text = data.statement || data.question || data.instruction;
  if (typeof correct === 'boolean' && typeof text === 'string' && text.trim()) {
    return {
      statements: [{
        id: data.id || 'stmt-1',
        text,
        correct,
        explanation: data.explanation || data.feedback || 'Revise a afirmação no contexto da aula.',
      }],
      feedback: data.feedback && isRecord(data.feedback) ? data.feedback : {
        perfect: 'Perfeito!',
        good: 'Muito bem!',
        needsReview: 'Revise o conteúdo.',
      },
    };
  }

  return data;
}

function answersFromBlank(blank: any): string[] {
  if (typeof blank === 'string') return [blank].filter(Boolean);
  if (!isRecord(blank)) return [];
  const answers = [blank.correctAnswer, blank.answer, ...(blank.correctAnswers || []), ...(blank.alternatives || [])]
    .filter((answer) => typeof answer === 'string' && answer.trim().length > 0)
    .map((answer) => answer.trim());
  return Array.from(new Set(answers));
}

function normalizeSentenceData(data: any, index: number): any {
  if (Array.isArray(data.sentences) && data.sentences.length > 0) {
    const rootAnswers = Array.isArray(data.correctAnswers) ? data.correctAnswers : [];
    return {
      ...data,
      sentences: data.sentences.map((sentence: any, sentenceIndex: number) => {
        const sentenceObject = typeof sentence === 'string' ? { text: sentence } : sentence;
        const correctAnswers = sentenceObject.correctAnswers || sentenceObject.correctAnswer || rootAnswers[sentenceIndex] || [];
        return {
          ...sentenceObject,
          id: sentenceObject.id || `sentence-${index + 1}-${sentenceIndex + 1}`,
          text: normalizeBlankMarkers(sentenceObject.text || ''),
          correctAnswers: Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers].filter(Boolean),
          hint: sentenceObject.hint || 'Pense no conceito central apresentado na aula.',
        };
      }),
      feedback: data.feedback || DEFAULT_FEEDBACK,
    };
  }

  const text = data.text || data.sentence || data.question;
  const blanks = Array.isArray(data.blanks) ? data.blanks : [];
  const answerGroups = blanks.length > 0
    ? blanks.map(answersFromBlank)
    : [data.correctAnswers || data.correctAnswer || data.answer].map((value) => Array.isArray(value) ? value : [value].filter(Boolean));

  if (typeof text !== 'string' || text.trim().length === 0 || answerGroups.length === 0) {
    return data;
  }

  const placeholderMatches = text.match(/_{3,}/g) || [];
  const sentenceCount = Math.max(1, Math.min(answerGroups.length, Math.max(placeholderMatches.length, 1)));
  const sentences = Array.from({ length: sentenceCount }, (_, sentenceIndex) => {
    let blankCursor = 0;
    const sentenceText = text.replace(/_{3,}/g, () => {
      const replacement = blankCursor === sentenceIndex
        ? EXERCISE_PLACEHOLDER
        : (answerGroups[blankCursor]?.[0] || EXERCISE_PLACEHOLDER);
      blankCursor += 1;
      return replacement;
    });

    return {
      id: blanks[sentenceIndex]?.id || `sentence-${index + 1}-${sentenceIndex + 1}`,
      text: normalizeBlankMarkers(sentenceText),
      correctAnswers: answerGroups[sentenceIndex],
      hint: blanks[sentenceIndex]?.hint || data.hint || 'Pense no conceito central apresentado na aula.',
      explanation: blanks[sentenceIndex]?.explanation || data.explanation,
    };
  });

  return { ...data, sentences, feedback: data.feedback || DEFAULT_FEEDBACK };
}

function normalizeDataCollectionExerciseData(data: any, _exercise: any): any {
  // 🚫 Modo "open-text" foi removido. Se chegar dado open-text legado,
  // strip dos campos de texto livre — runtime fallback (em InteractiveLesson) cuidará.
  if (data.mode === 'open-text') {
    const { mode: _m, question: _q, placeholder: _p, maxLength: _ml, ...rest } = data;
    return rest;
  }
  return data;
}

export function normalizeExerciseForPipeline(exercise: any, index: number): any {
  const type = exercise?.type;
  let data = mergeExerciseData(exercise);

  if (type === 'multiple-choice') data = normalizeMultipleChoiceExerciseData(data);
  if (type === 'true-false') data = normalizeTrueFalseExerciseData(data);
  if (type === 'fill-in-blanks' || type === 'complete-sentence') data = normalizeSentenceData(data, index);
  if (type === 'data-collection') data = normalizeDataCollectionExerciseData(data, exercise);

  return {
    id: exercise?.id || `exercise-${index + 1}`,
    type,
    prompt: exercise?.prompt,
    title: exercise?.title || data.title || data.question || getDefaultTitle(type, index),
    instruction: exercise?.instruction || data.instruction || data.question || getDefaultInstruction(type),
    question: exercise?.question || data.question,
    data,
  };
}