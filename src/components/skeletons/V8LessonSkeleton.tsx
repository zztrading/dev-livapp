import { Skeleton } from "@/components/ui/skeleton";

/**
 * V8LessonSkeleton — placeholder visual durante o carregamento da aula V8.
 * Espelha a estrutura do V8LessonPlayer:
 *   - header fixo (progress + título + contador)
 *   - container max-w-2xl com seção de conteúdo
 * Mantém min-h-screen e bg branco para evitar flash de layout.
 */
export const V8LessonSkeleton = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900" aria-busy="true" aria-label="Carregando aula">
      {/* Header fixo */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200">
        {/* Progress bar */}
        <div className="h-1 w-full bg-slate-100" />
        {/* Header content */}
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <Skeleton className="h-4 flex-1 max-w-[60%]" />
          <Skeleton className="h-3 w-10 flex-shrink-0" />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="pt-16">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Título da seção */}
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-3/4" />
          </div>

          {/* Bloco de texto */}
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Card visual (placeholder pra eventual imagem/quote) */}
          <Skeleton className="h-32 w-full rounded-2xl" />

          {/* Segundo bloco de texto */}
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Botão de avançar */}
          <div className="pt-2 flex justify-center">
            <Skeleton className="h-12 w-44 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};
