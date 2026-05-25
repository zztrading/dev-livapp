import { supabase } from '@/integrations/supabase/client';

/**
 * Determines if the lesson rating modal should be shown after completion.
 * 
 * Rules:
 * 1. First lesson of a journey (course) → always show
 * 2. Last lesson of a journey (course) → always show
 * 3. Every 3rd lesson in between (positions 1, 4, 7, 10...) → show
 * 
 * Position is 1-based within the course's active lessons sorted by order_index.
 */
export async function shouldShowLessonRating(
  lessonId: string,
  courseId?: string | null,
  trailId?: string | null
): Promise<boolean> {
  try {
    // Need a grouping context (course or trail)
    const groupField = courseId ? 'course_id' : trailId ? 'trail_id' : null;
    const groupValue = courseId || trailId;

    if (!groupField || !groupValue) return false;

    // Fetch all active lessons in the same group, ordered
    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, order_index')
      .eq(groupField, groupValue)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error || !lessons || lessons.length === 0) return false;

    const currentIndex = lessons.findIndex(l => l.id === lessonId);
    if (currentIndex === -1) return false;

    const position = currentIndex + 1; // 1-based
    const totalLessons = lessons.length;

    // Rule 1: First lesson
    if (position === 1) return true;

    // Rule 3: Last lesson
    if (position === totalLessons) return true;

    // Rule 2: Every 3rd (1, 4, 7, 10...)
    if ((position - 1) % 3 === 0) return true;

    return false;
  } catch (err) {
    console.error('[shouldShowLessonRating] Error:', err);
    return false;
  }
}
