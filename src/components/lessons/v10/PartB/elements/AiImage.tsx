import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AiImageProps {
  prompt: string;
  lessonId?: string;
  caption?: string;
  model?: string;
  onImageReady?: () => void;
}

const AiImage: React.FC<AiImageProps> = ({ prompt, lessonId, caption, model, onImageReady }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!lessonId);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // No lessonId = admin preview mode → show prompt as static text
    if (!lessonId) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const generate = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('v10-generate-ai-image', {
          body: { prompt, lessonId, model },
        });

        if (controller.signal.aborted) return;

        if (fnError) {
          setError('Erro ao gerar imagem');
          console.error('[AiImage] Edge function error:', fnError);
          return;
        }

        if (data?.imageUrl) {
          setImageUrl(data.imageUrl);
        } else if (data?.error) {
          setError(data.error);
        } else {
          setError('Nenhuma imagem retornada');
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.error('[AiImage] Fetch error:', err);
        setError('Falha na conexão');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    generate();

    return () => {
      controller.abort();
    };
  }, [prompt, lessonId, model]);

  // Admin preview: show prompt as styled text
  if (!lessonId) {
    return (
      <div style={{
        background: '#F3F4F6',
        border: '1px dashed #9CA3AF',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🎨</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const }}>
            AI Image (preview)
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.4, fontStyle: 'italic' }}>
          {prompt}
        </p>
        {caption && (
          <p style={{ fontSize: 9, color: '#9CA3AF' }}>{caption}</p>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 6,
      }}>
        <div
          style={{
            width: '100%',
            height: 180,
            borderRadius: 12,
            background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }}
        />
        <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center' as const }}>
          ✨ Gerando imagem com IA...
        </p>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 4,
      }}>
        <p style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
          ⚠️ {error}
        </p>
        <p style={{ fontSize: 9, color: '#9CA3AF', fontStyle: 'italic' }}>
          Prompt: {prompt.slice(0, 80)}...
        </p>
      </div>
    );
  }

  // Success state
  if (imageUrl) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 6,
        animation: 'fadeIn 0.6s ease-out',
      }}>
        <img
          src={imageUrl}
          alt={caption || 'Imagem gerada por IA'}
          style={{
            width: '100%',
            borderRadius: 12,
            objectFit: 'cover' as const,
          }}
          onLoad={() => onImageReady?.()}
        />
        {caption && (
          <p style={{ fontSize: 10, color: '#6B7280', textAlign: 'center' as const, lineHeight: 1.4 }}>
            {caption}
          </p>
        )}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return null;
};

export default AiImage;
