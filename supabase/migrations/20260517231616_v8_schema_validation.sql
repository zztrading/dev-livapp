-- ============================================================================
-- V8 Schema Validation — espelha src/lib/v8/validateV8Json.ts em PL/pgSQL.
-- ============================================================================
-- Roda em BEFORE INSERT/UPDATE quando lessons.model = 'v8'.
--
-- MODO PERMISSIVO: detecta violações e grava em validation_alerts
-- (severity='warning'), MAS NÃO bloqueia o INSERT/UPDATE. Permite observar
-- por X dias antes de ativar enforcement.
--
-- Para ativar enforcement no futuro (após observação):
--   ALTER FUNCTION lessons_v8_validation_trigger() SET search_path = public;
--   E mudar o RETURN NEW final para RAISE EXCEPTION quando há erros.
-- ============================================================================

-- ─── 1. Função que valida o content JSONB e retorna erros/warnings ──────────
CREATE OR REPLACE FUNCTION public.validate_v8_lesson_schema(content JSONB)
RETURNS TABLE(errors TEXT[], warnings TEXT[])
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_warnings TEXT[] := ARRAY[]::TEXT[];
  v_sections JSONB;
  v_quizzes JSONB;
  v_playgrounds JSONB;
  v_section JSONB;
  v_quiz JSONB;
  v_pg JSONB;
  v_section_count INT := 0;
  v_correct_count INT := 0;
  v_idx INT;
  v_quiz_type TEXT;
  v_after_idx INT;
BEGIN
  -- ── content basics ──
  IF content IS NULL OR jsonb_typeof(content) <> 'object' THEN
    v_errors := array_append(v_errors, 'JSON inválido ou vazio');
    RETURN QUERY SELECT v_errors, v_warnings;
    RETURN;
  END IF;

  IF content->>'contentVersion' IS DISTINCT FROM 'v8' THEN
    v_errors := array_append(v_errors, 'contentVersion deve ser "v8"');
  END IF;

  IF content->>'title' IS NULL OR length(trim(content->>'title')) = 0 THEN
    v_errors := array_append(v_errors, 'title é obrigatório (string)');
  END IF;

  -- ── sections ──
  v_sections := content->'sections';
  IF v_sections IS NULL OR jsonb_typeof(v_sections) <> 'array' OR jsonb_array_length(v_sections) = 0 THEN
    v_errors := array_append(v_errors, 'sections[] deve ter pelo menos 1 seção');
  ELSE
    v_section_count := jsonb_array_length(v_sections);
    FOR v_idx IN 0..(v_section_count - 1) LOOP
      v_section := v_sections->v_idx;
      IF v_section->>'id' IS NULL OR length(trim(v_section->>'id')) = 0 THEN
        v_warnings := array_append(v_warnings, format('Section %s: falta id', v_idx));
      END IF;
      IF v_section->>'title' IS NULL OR length(trim(v_section->>'title')) = 0 THEN
        v_errors := array_append(v_errors, format('Section %s: falta title', v_idx));
      END IF;
      IF v_section->>'content' IS NULL OR length(trim(v_section->>'content')) = 0 THEN
        v_warnings := array_append(v_warnings, format('Section %s: content vazio', v_idx));
      END IF;
    END LOOP;
  END IF;

  -- ── inlineQuizzes ──
  v_quizzes := content->'inlineQuizzes';
  IF v_quizzes IS NOT NULL AND jsonb_typeof(v_quizzes) = 'array' THEN
    FOR v_idx IN 0..(jsonb_array_length(v_quizzes) - 1) LOOP
      v_quiz := v_quizzes->v_idx;
      v_quiz_type := COALESCE(v_quiz->>'quizType', 'multiple-choice');

      IF v_quiz_type = 'multiple-choice' THEN
        IF v_quiz->>'question' IS NULL THEN
          v_errors := array_append(v_errors, format('Quiz %s: falta question', v_idx));
        END IF;
        IF v_quiz->'options' IS NULL OR jsonb_typeof(v_quiz->'options') <> 'array'
           OR jsonb_array_length(v_quiz->'options') < 2 THEN
          v_errors := array_append(v_errors, format('Quiz %s: mínimo 2 opções', v_idx));
        ELSE
          SELECT count(*) INTO v_correct_count
          FROM jsonb_array_elements(v_quiz->'options') o
          WHERE (o->>'isCorrect')::boolean = true;
          IF v_correct_count = 0 THEN
            v_errors := array_append(v_errors, format('Quiz %s: nenhuma opção correta', v_idx));
          END IF;
        END IF;
      ELSIF v_quiz_type = 'true-false' THEN
        IF v_quiz->>'statement' IS NULL THEN
          v_errors := array_append(v_errors, format('Quiz %s: falta statement', v_idx));
        END IF;
        IF v_quiz->>'isTrue' IS NULL OR jsonb_typeof(v_quiz->'isTrue') <> 'boolean' THEN
          v_errors := array_append(v_errors, format('Quiz %s: falta isTrue (boolean)', v_idx));
        END IF;
      ELSIF v_quiz_type = 'fill-blank' THEN
        IF v_quiz->>'sentenceWithBlank' IS NULL THEN
          v_errors := array_append(v_errors, format('Quiz %s: falta sentenceWithBlank', v_idx));
        END IF;
        IF v_quiz->>'correctAnswer' IS NULL THEN
          v_errors := array_append(v_errors, format('Quiz %s: falta correctAnswer', v_idx));
        END IF;
      END IF;

      IF v_quiz->>'explanation' IS NULL THEN
        v_warnings := array_append(v_warnings, format('Quiz %s: falta explanation', v_idx));
      END IF;

      v_after_idx := (v_quiz->>'afterSectionIndex')::int;
      IF v_after_idx IS NULL OR v_after_idx < 0 OR v_after_idx >= v_section_count THEN
        v_errors := array_append(v_errors, format(
          'Quiz %s: afterSectionIndex (%s) fora do range [0, %s]',
          v_idx, COALESCE(v_after_idx::text, 'null'), v_section_count - 1
        ));
      END IF;
    END LOOP;
  END IF;

  -- ── inlinePlaygrounds ──
  v_playgrounds := content->'inlinePlaygrounds';
  IF v_playgrounds IS NOT NULL AND jsonb_typeof(v_playgrounds) = 'array' THEN
    FOR v_idx IN 0..(jsonb_array_length(v_playgrounds) - 1) LOOP
      v_pg := v_playgrounds->v_idx;

      IF v_pg->>'title' IS NULL THEN
        v_errors := array_append(v_errors, format('Playground %s: falta title', v_idx));
      END IF;
      IF v_pg->>'instruction' IS NULL OR length(v_pg->>'instruction') < 40 THEN
        v_errors := array_append(v_errors, format('Playground %s: instruction deve ter >= 40 caracteres', v_idx));
      END IF;
      IF v_pg->>'amateurPrompt' IS NULL THEN
        v_errors := array_append(v_errors, format('Playground %s: falta amateurPrompt', v_idx));
      END IF;
      IF v_pg->>'professionalPrompt' IS NULL THEN
        v_errors := array_append(v_errors, format('Playground %s: falta professionalPrompt', v_idx));
      END IF;
      IF v_pg->>'amateurPrompt' IS NOT NULL AND v_pg->>'amateurPrompt' = v_pg->>'professionalPrompt' THEN
        v_errors := array_append(v_errors, format('Playground %s: amateurPrompt e professionalPrompt são iguais', v_idx));
      END IF;
      IF v_pg->>'amateurPrompt' IS NOT NULL AND length(v_pg->>'amateurPrompt') > 2000 THEN
        v_warnings := array_append(v_warnings, format('Playground %s: amateurPrompt muito longo (>2000 chars)', v_idx));
      END IF;
      IF v_pg->>'professionalPrompt' IS NOT NULL AND length(v_pg->>'professionalPrompt') > 2000 THEN
        v_warnings := array_append(v_warnings, format('Playground %s: professionalPrompt muito longo (>2000 chars)', v_idx));
      END IF;
      IF v_pg->>'successMessage' IS NULL THEN
        v_errors := array_append(v_errors, format('Playground %s: falta successMessage', v_idx));
      END IF;
      IF v_pg->>'tryAgainMessage' IS NULL THEN
        v_errors := array_append(v_errors, format('Playground %s: falta tryAgainMessage', v_idx));
      END IF;

      v_after_idx := (v_pg->>'afterSectionIndex')::int;
      IF v_after_idx IS NULL OR v_after_idx < 0 OR v_after_idx >= v_section_count THEN
        v_errors := array_append(v_errors, format(
          'Playground %s: afterSectionIndex (%s) fora do range [0, %s]',
          v_idx, COALESCE(v_after_idx::text, 'null'), v_section_count - 1
        ));
      END IF;

      IF v_pg->'userChallenge' IS NOT NULL THEN
        IF v_pg->'userChallenge'->'hints' IS NOT NULL
           AND jsonb_array_length(v_pg->'userChallenge'->'hints') > 3 THEN
          v_errors := array_append(v_errors, format('Playground %s: máximo 3 hints', v_idx));
        END IF;
        IF v_pg->'userChallenge'->'evaluationCriteria' IS NULL
           OR jsonb_array_length(v_pg->'userChallenge'->'evaluationCriteria') = 0 THEN
          v_warnings := array_append(v_warnings, format('Playground %s: challenge sem evaluationCriteria', v_idx));
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_errors, v_warnings;
END;
$$;

COMMENT ON FUNCTION public.validate_v8_lesson_schema(JSONB) IS
  'Valida JSONB de aulas V8. Espelha src/lib/v8/validateV8Json.ts. Retorna (errors[], warnings[]).';

-- ─── 2. Trigger PERMISSIVO: loga violações sem bloquear ─────────────────────
CREATE OR REPLACE FUNCTION public.lessons_v8_validation_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_errors TEXT[];
  v_warnings TEXT[];
BEGIN
  -- Só roda para aulas V8.
  IF NEW.model IS DISTINCT FROM 'v8' THEN
    RETURN NEW;
  END IF;

  -- Skip se content vazio (draft inicial).
  IF NEW.content IS NULL OR NEW.content = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  SELECT errors, warnings
    INTO v_errors, v_warnings
    FROM public.validate_v8_lesson_schema(NEW.content);

  -- Se houver violações, grava em validation_alerts (não bloqueia).
  IF array_length(v_errors, 1) > 0 OR array_length(v_warnings, 1) > 0 THEN
    INSERT INTO public.validation_alerts (
      guarantee_name,
      test_name,
      severity,
      message,
      details
    ) VALUES (
      'v8-schema-validation',
      'lesson-' || COALESCE(NEW.id::text, 'new'),
      CASE WHEN array_length(v_errors, 1) > 0 THEN 'warning' ELSE 'info' END,
      CASE
        WHEN array_length(v_errors, 1) > 0 THEN
          format('V8 schema: %s erro(s), %s warning(s)',
                 COALESCE(array_length(v_errors, 1), 0),
                 COALESCE(array_length(v_warnings, 1), 0))
        ELSE
          format('V8 schema: %s warning(s)', COALESCE(array_length(v_warnings, 1), 0))
      END,
      jsonb_build_object(
        'lesson_id', NEW.id,
        'lesson_title', NEW.title,
        'errors', v_errors,
        'warnings', v_warnings,
        'mode', 'permissive',
        'detected_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.lessons_v8_validation_trigger() IS
  'Trigger PERMISSIVO em lessons. Loga violações de schema V8 sem bloquear INSERT/UPDATE.';

-- ─── 3. Anexa trigger ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS validate_v8_lesson_trigger ON public.lessons;

CREATE TRIGGER validate_v8_lesson_trigger
  BEFORE INSERT OR UPDATE OF content ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.lessons_v8_validation_trigger();
