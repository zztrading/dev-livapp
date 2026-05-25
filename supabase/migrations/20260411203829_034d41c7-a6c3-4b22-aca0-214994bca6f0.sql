-- Drop the constraint (not just the index)
ALTER TABLE public.user_gamification_events 
DROP CONSTRAINT IF EXISTS user_gamification_events_user_id_event_type_event_reference_key;

-- Drop the partial unique index
DROP INDEX IF EXISTS public.uq_gamification_user_event_ref;

-- Recreate a single index that excludes lesson_completed from uniqueness
CREATE UNIQUE INDEX uq_gamification_non_lesson 
ON public.user_gamification_events (user_id, event_type, event_reference_id) 
WHERE event_reference_id IS NOT NULL AND event_type != 'lesson_completed';