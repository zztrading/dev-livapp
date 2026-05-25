-- FASE 1: Eliminar exercícios open-text (texto livre) das aulas ativas.
-- Substitui o último exercício (data-collection open-text) por multiple-choice contextual.
UPDATE public.lessons
SET exercises = jsonb_set(
  exercises,
  '{4}',
  jsonb_build_object(
    'id', 'exercise-replaced-opentext-1',
    'type', 'multiple-choice',
    'title', 'Aplicação prática no escritório',
    'instruction', 'Selecione a alternativa que melhor representa a postura do contador na transição tributária com IA:',
    'data', jsonb_build_object(
      'question', 'Qual é a postura mais estratégica do contador ao usar IA durante a transição tributária?',
      'options', jsonb_build_array(
        'Usar a IA para responder dúvidas de clientes com clareza, validando cada resposta com a legislação atual.',
        'Encaminhar todas as dúvidas dos clientes diretamente para a IA, sem revisão humana.',
        'Evitar usar IA para não correr riscos durante a reforma tributária.',
        'Aguardar o fim da transição para começar a usar ferramentas de IA no escritório.'
      ),
      'correctAnswer', 'Usar a IA para responder dúvidas de clientes com clareza, validando cada resposta com a legislação atual.',
      'explanation', 'A IA acelera a interpretação, mas a validação humana garante segurança jurídica e confiança do cliente.'
    )
  ),
  false
)
WHERE id IN (
  'c63ca5e9-abc9-4ff9-b5b9-c69d77fbe282',
  '21a5d254-b941-490f-948e-62257b077c49'
);