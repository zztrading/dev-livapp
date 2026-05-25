import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ExternalLink, CheckCircle2, Eye, XCircle, Loader2, Inbox } from 'lucide-react';

export interface LessonReportRow {
  id: string;
  user_id: string;
  lesson_id: string;
  category: string;
  details: string | null;
  page_context: any;
  created_at: string;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
  // joined
  user_email?: string | null;
  user_name?: string | null;
  lesson_title?: string | null;
  lesson_model?: string | null;
}

interface Props {
  report: LessonReportRow | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'outline' }> = {
  novo: { label: 'Novo', variant: 'destructive' },
  em_analise: { label: 'Em análise', variant: 'secondary' },
  resolvido: { label: 'Resolvido', variant: 'success' },
  descartado: { label: 'Descartado', variant: 'outline' },
};

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function buildLessonUrl(lessonId: string, model?: string | null): string | null {
  if (!lessonId) return null;
  const m = (model || '').toLowerCase();
  if (m.includes('v10') || !isUuid(lessonId)) return `/v10/${lessonId}`;
  if (m.includes('v8')) return `/v8/${lessonId}`;
  if (m.includes('v7')) return `/v7-lesson/${lessonId}`;
  if (m.includes('v5') || m.includes('v3')) return `/lessons/${lessonId}`;
  // fallback: tentar V8 (mais comum atualmente)
  return `/v8/${lessonId}`;
}

export function LessonReportDetailModal({ report, open, onClose, onUpdated }: Props) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // sync notes when opening a different report
  if (report && notes === '' && report.admin_notes && open) {
    setNotes(report.admin_notes);
  }

  const updateStatus = async (newStatus: string) => {
    if (!report) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const updates: any = {
        status: newStatus,
        admin_notes: notes || null,
      };
      if (newStatus === 'resolvido' || newStatus === 'descartado') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = session?.user.id || null;
      } else {
        updates.resolved_at = null;
        updates.resolved_by = null;
      }
      const { error } = await supabase
        .from('lesson_reports')
        .update(updates)
        .eq('id', report.id);
      if (error) throw error;
      toast({ title: 'Atualizado', description: `Status: ${STATUS_LABELS[newStatus]?.label || newStatus}` });
      onUpdated();
      onClose();
      setNotes('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('lesson_reports')
        .update({ admin_notes: notes || null })
        .eq('id', report.id);
      if (error) throw error;
      toast({ title: 'Notas salvas' });
      onUpdated();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!report) return null;

  const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.novo;
  const lessonUrl = buildLessonUrl(report.lesson_id, report.lesson_model);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setNotes(''); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle>Detalhes do Report</DialogTitle>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <DialogDescription>
            Recebido em {new Date(report.created_at).toLocaleString('pt-BR')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Categoria */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Categoria</Label>
            <p className="font-medium mt-1">{report.category}</p>
          </div>

          {/* Aula */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Aula reportada</Label>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-medium">{report.lesson_title || <span className="text-muted-foreground italic">Título não encontrado</span>}</p>
              {lessonUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lessonUrl, '_blank')}
                  className="h-7 px-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Abrir aula
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{report.lesson_id}</p>
            {report.lesson_model && (
              <p className="text-xs text-muted-foreground">Modelo: {report.lesson_model}</p>
            )}
          </div>

          {/* Usuário */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Usuário</Label>
            <p className="font-medium mt-1">{report.user_name || '—'}</p>
            <p className="text-xs text-muted-foreground">{report.user_email || report.user_id}</p>
          </div>

          {/* Detalhes */}
          {report.details && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Descrição do problema</Label>
              <div className="mt-1 p-3 rounded-md bg-muted/40 border border-border whitespace-pre-wrap text-sm">
                {report.details}
              </div>
            </div>
          )}

          {/* Page context */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Contexto da página</Label>
            <pre className="mt-1 p-3 rounded-md bg-muted/40 border border-border text-xs overflow-x-auto">
              {JSON.stringify(report.page_context || {}, null, 2)}
            </pre>
          </div>

          {/* Notas internas */}
          <div>
            <Label htmlFor="admin-notes" className="text-xs text-muted-foreground uppercase tracking-wide">
              Notas internas (admin)
            </Label>
            <Textarea
              id="admin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações internas sobre este report..."
              className="mt-1 min-h-[90px]"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={saveNotes}
              disabled={saving}
              className="mt-1"
            >
              Salvar nota
            </Button>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => updateStatus('em_analise')}
              disabled={saving || report.status === 'em_analise'}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Em análise
            </Button>
            <Button
              variant="success"
              onClick={() => updateStatus('resolvido')}
              disabled={saving || report.status === 'resolvido'}
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar resolvido
            </Button>
            <Button
              variant="outline"
              onClick={() => updateStatus('descartado')}
              disabled={saving || report.status === 'descartado'}
            >
              <XCircle className="w-4 h-4" />
              Descartar
            </Button>
            <Button
              variant="ghost"
              onClick={() => updateStatus('novo')}
              disabled={saving || report.status === 'novo'}
              className="ml-auto"
            >
              <Inbox className="w-4 h-4" />
              Reabrir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
