/**
 * Kit GPT Custom — Card visível no topo do AdminV5CardConfig.
 * Permite baixar/copiar o prompt-mestre e o catálogo de cards
 * pra colar num GPT custom no chatgpt.com.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Download, Copy, BookOpen, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { buildCardCatalog, buildGptMasterPrompt } from '@/lib/v5/buildGptKit';

function downloadFile(filename: string, content: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function GptKitCard() {
  const { toast } = useToast();

  const handleDownload = (kind: 'prompt' | 'catalog') => {
    const content = kind === 'prompt' ? buildGptMasterPrompt() : buildCardCatalog();
    const filename =
      kind === 'prompt' ? 'aiilv-v5-prompt-mestre.md' : 'aiilv-v5-card-catalog.md';
    downloadFile(filename, content);
    toast({
      title: 'Arquivo baixado',
      description: `${filename} • ${(content.length / 1024).toFixed(1)} KB`,
    });
  };

  const handleCopy = async (kind: 'prompt' | 'catalog') => {
    const content = kind === 'prompt' ? buildGptMasterPrompt() : buildCardCatalog();
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Copiado',
        description: `${(content.length / 1024).toFixed(1)} KB no clipboard`,
      });
    } catch {
      toast({
        title: 'Falha ao copiar',
        description: 'Use o botão Baixar como alternativa.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl">Kit GPT Custom — Crie aulas com ChatGPT</CardTitle>
              <Badge variant="secondary" className="ml-1">novo</Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Baixe os 2 arquivos abaixo, crie um GPT em{' '}
              <a
                href="https://chatgpt.com/gpts/editor"
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-1 text-primary"
              >
                chatgpt.com/gpts/editor <ExternalLink className="w-3 h-3" />
              </a>{' '}
              e cole o <strong>Prompt-Mestre</strong> em <em>Instructions</em>. Depois é só
              pedir aulas no chat e colar o JSON gerado abaixo nesta página.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Prompt-Mestre */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Prompt-Mestre</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Schema V5 completo + regras pedagógicas + catálogo + exemplo. Cole em{' '}
              <em>Instructions</em> do GPT custom.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleDownload('prompt')} className="flex-1">
                <Download className="w-4 h-4 mr-1.5" />
                Baixar .md
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy('prompt')}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Copiar
              </Button>
            </div>
          </div>

          {/* Catálogo */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-secondary" />
              <h3 className="font-semibold text-sm">Catálogo de Cards</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Lista completa dos ~210 experience cards com descrição. Útil pra consulta rápida
              ou anexar como Knowledge no GPT.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleDownload('catalog')}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Baixar .md
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy('catalog')}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Copiar
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-1">
          Sempre que adicionar novos cards no código, rebaixe o Prompt-Mestre e atualize as
          Instructions do seu GPT.
        </p>
      </CardContent>
    </Card>
  );
}
