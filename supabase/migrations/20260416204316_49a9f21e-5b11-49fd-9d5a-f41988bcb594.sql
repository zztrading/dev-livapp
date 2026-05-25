UPDATE lessons SET content = jsonb_set(
  jsonb_set(
    content,
    '{sections,4,videos,0,triggerAtPercent}',
    '0.45'::jsonb,
    true
  ),
  '{sections,5,videos,0,triggerAtPercent}',
  '0.36'::jsonb,
  true
) WHERE id = '561bb15c-d3f9-4b36-b8ae-54c69a6c2ed8';