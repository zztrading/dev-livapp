/**
 * Painel de validação prévia do JSON V5.
 * Roda antes do pipeline pra mostrar erros legíveis com path + sugestão.
 *
 * Fluxo: usuário cola JSON → clica "Validar JSON" → vê resultado.
 * Se editar o textarea depois, o resultado é invalidado (via prop `jsonStr`).
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { validateLessonJson, ValidationResult } from '@/lib/v5/validateLessonJson';

interface Props {
  jsonStr: string;
  /** Chamado sempre que o resultado muda (validado ou invalidado por edição). */
  onValidationChange?: (result: ValidationResult | null) => void;
}

export function LessonJsonValidator({ jsonStr, onValidationChange }: Props) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validatedFor, setValidatedFor] = useState<string>('');

  // Detecta se o JSON foi modificado desde a última validação.
  // NÃO zera o resultado automaticamente — preserva o último estado conhecido
  // pra UX, mas avisa que precisa revalidar antes de prosseguir.
  const isStale = result !== null && jsonStr !== validatedFor;

  // Quando fica stale, sinaliza para o pai limpar estado dependente
  // (ex: detectedCards no AdminV5CardConfig). O resultado visual permanece
  // mostrado pra o usuário comparar.
  useEffect(() => {
    if (isStale) {
      onValidationChange?.(null);
    }
  }, [isStale, onValidationChange]);

  const handleValidate = () => {
    if (!jsonStr.trim()) {
      const r: ValidationResult = {
        valid: false,
        errors: [{ path: '(root)', message: 'Cole o JSON antes de validar.' }],
        warnings: [],
      };
      setResult(r);
      setValidatedFor(jsonStr);
      onValidationChange?.(r);
      return;
    }
    const r = validateLessonJson(jsonStr);
    setResult(r);
    setValidatedFor(jsonStr);
    onValidationChange?.(r);
  };

  return (
    <div className="space-y-3">
      <Button onClick={handleValidate} variant="default" size="lg" className="w-full">
        <ShieldCheck className="w-4 h-4 mr-1.5" />
        {isStale ? 'Revalidar (JSON modificado)' : 'Validar qualidade do JSON'}
      </Button>

      {isStale && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            JSON modificado desde a última validação. O resultado abaixo está
            <strong> obsoleto</strong> — clique em revalidar.
          </span>
        </div>
      )}

      {result && (
        <>
          <p className="text-xs text-muted-foreground text-center">
            {result.errors.length} erro(s) • {result.warnings.length} aviso(s)
          </p>

          <Card
            className={
              result.valid
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-destructive/40 bg-destructive/5'
            }
          >
            <CardContent className="pt-4 space-y-3">
              {result.valid ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">
                    JSON válido — escolha uma ação abaixo.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium text-sm">
                    {result.errors.length} erro(s) bloqueando o processamento.
                  </span>
                </div>
              )}

              {result.errors.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {result.errors.map((err, i) => (
                    <li key={`e-${i}`} className="flex gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                      <div>
                        <code className="text-xs bg-background/80 px-1.5 py-0.5 rounded border">
                          {err.path}
                        </code>{' '}
                        <span>{err.message}</span>
                        {err.suggestion && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Sugestão: <code className="font-mono">{err.suggestion}</code>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {result.warnings.length > 0 && (
                <div className="pt-2 border-t border-amber-200/50">
                  <p className="text-xs font-medium text-amber-700 mb-1.5">Avisos:</p>
                  <ul className="space-y-1 text-xs text-amber-800">
                    {result.warnings.map((w, i) => (
                      <li key={`w-${i}`} className="flex gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                          <code className="bg-amber-100/70 px-1 rounded">{w.path}</code>{' '}
                          {w.message}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
