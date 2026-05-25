import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'supervisor' | 'user';

interface RoleState {
  isAdmin: boolean;
  isSupervisor: boolean;
  userRole: AppRole;
  loading: boolean;
}

const INITIAL_STATE: RoleState = {
  isAdmin: false,
  isSupervisor: false,
  userRole: 'user',
  loading: true,
};

// Cache em módulo: evita re-fetch + hidratação instável quando o mesmo userId
// é solicitado por múltiplos componentes ou após StrictMode duplicar o efeito.
const roleCache = new Map<string, RoleState>();

export function useIsAdmin(userId: string | undefined) {
  // Hidrata sincronamente do cache quando disponível — elimina o flash
  // "isAdmin:false → isAdmin:true" que causava re-render duplo nas telas.
  const [state, setState] = useState<RoleState>(() =>
    userId && roleCache.has(userId) ? roleCache.get(userId)! : INITIAL_STATE
  );
  const lastUserIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    if (!userId) {
      setState(INITIAL_STATE);
      lastUserIdRef.current = undefined;
      return;
    }

    // Se temos cache, aplica imediatamente (sem loading) e segue refetch silencioso.
    const cached = roleCache.get(userId);
    if (cached && lastUserIdRef.current === userId) {
      // já hidratado via initializer — não faz nada
    } else if (cached) {
      setState(cached);
    }
    lastUserIdRef.current = userId;

    let cancelled = false;

    const checkAdminStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (cancelled) return;

        if (error) {
          console.error('[useIsAdmin] Error:', error);
          const next = { ...INITIAL_STATE, loading: false };
          roleCache.set(userId, next);
          setState(next);
          return;
        }

        const roles = (data || []).map((r) => r.role as AppRole);
        const hasAdmin = roles.includes('admin');
        const hasSupervisor = roles.includes('supervisor');
        const next: RoleState = {
          isAdmin: hasAdmin,
          isSupervisor: hasSupervisor,
          userRole: hasAdmin ? 'admin' : hasSupervisor ? 'supervisor' : 'user',
          loading: false,
        };

        // Só faz setState se o resultado mudou de fato — evita re-render desnecessário.
        const prev = roleCache.get(userId);
        roleCache.set(userId, next);
        if (
          !prev ||
          prev.isAdmin !== next.isAdmin ||
          prev.isSupervisor !== next.isSupervisor ||
          prev.loading !== next.loading
        ) {
          setState(next);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[useIsAdmin] Unexpected error:', error);
        const next = { ...INITIAL_STATE, loading: false };
        roleCache.set(userId, next);
        setState(next);
      }
    };

    checkAdminStatus();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const canAccessAdmin = state.isAdmin || state.isSupervisor;

  return {
    isAdmin: state.isAdmin,
    isSupervisor: state.isSupervisor,
    canAccessAdmin,
    userRole: state.userRole,
    loading: state.loading,
  };
}

