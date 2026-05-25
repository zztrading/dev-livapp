import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TrailDetailSkeleton } from '@/components/skeletons';

/**
 * Substitui a antiga página /trail/:id (TrailDetail).
 *
 * Comportamento: dado um trailId, busca o primeiro curso ATIVO da trilha
 * (menor order_index) e redireciona para /course/:courseId — a página
 * com certificado + mapa de ícones das aulas (única UI permitida para
 * navegação de trilhas/cursos).
 *
 * Fallback: se a trilha não tiver curso ativo, redireciona para /dashboard.
 */
export default function TrailToCourseRedirect() {
  const { id: trailId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trailId) {
      navigate('/dashboard', { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('courses')
          .select('id, order_index, is_active')
          .eq('trail_id', trailId)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (dbError) {
          console.error('[TrailToCourseRedirect] DB error:', dbError);
          setError('Erro ao carregar a trilha.');
          setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
          return;
        }

        if (data?.id) {
          navigate(`/course/${data.id}`, { replace: true });
        } else {
          // Trilha sem curso ativo — volta para o Dashboard
          console.warn('[TrailToCourseRedirect] No active course for trail:', trailId);
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[TrailToCourseRedirect] Unexpected error:', err);
        setError('Erro inesperado.');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trailId, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {error} Redirecionando…
      </div>
    );
  }

  return <TrailDetailSkeleton />;
}
