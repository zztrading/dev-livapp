import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface EnsureUserRowResult {
  /** true if a new public.users row was inserted, false if it already existed (and possibly got patched) */
  created: boolean;
  /** true if onboarding has been completed (used by callers to decide redirect target) */
  onboardingCompleted: boolean;
}

/**
 * Reads name + avatar from Supabase user metadata, handling the slight differences
 * between providers (Google uses `picture`/`full_name`; email signup uses `name`).
 */
function extractProfile(user: User): { name: string; avatarUrl: string | null } {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (user.email ? user.email.split('@')[0] : 'Usuário');
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null;
  return { name, avatarUrl };
}

/**
 * Make sure a row exists in public.users for the given authenticated user.
 * - If the row is missing, insert it with sensible defaults (onboarding_completed = false).
 * - If the row already exists, patch missing name/avatar from user_metadata
 *   (won't overwrite values the user has manually set in their profile).
 *
 * Returns the `onboarding_completed` flag so the caller can route accordingly.
 *
 * Safe to call multiple times; idempotent.
 */
export async function ensureUserRow(user: User): Promise<EnsureUserRowResult> {
  const { name, avatarUrl } = extractProfile(user);

  // 1. Check if the row already exists.
  const { data: existing } = await supabase
    .from('users')
    .select('id, name, avatar_url, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    // Only patch fields the user hasn't set themselves.
    const patch: Record<string, unknown> = {};
    if (!existing.name && name) patch.name = name;
    if (!existing.avatar_url && avatarUrl) patch.avatar_url = avatarUrl;

    if (Object.keys(patch).length > 0) {
      await supabase.from('users').update(patch).eq('id', user.id);
    }

    return {
      created: false,
      onboardingCompleted: !!existing.onboarding_completed,
    };
  }

  // 2. Row missing — insert with defaults.
  const { error } = await supabase.from('users').insert([
    {
      id: user.id,
      email: user.email ?? '',
      name,
      avatar_url: avatarUrl,
      onboarding_completed: false,
    } as any,
  ]);

  if (error) {
    // 23505 = duplicate key — race with another tab/request that inserted first. Safe to ignore.
    if (error.code !== '23505') {
      console.error('[ensureUserRow] insert failed:', error);
      throw error;
    }
  }

  return { created: true, onboardingCompleted: false };
}
