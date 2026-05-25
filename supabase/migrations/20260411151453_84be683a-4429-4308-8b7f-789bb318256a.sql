
-- Add unique constraint for upsert on lesson_ratings
ALTER TABLE public.lesson_ratings 
ADD CONSTRAINT lesson_ratings_user_lesson_unique UNIQUE (user_id, lesson_id);
