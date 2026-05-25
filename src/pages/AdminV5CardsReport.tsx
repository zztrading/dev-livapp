import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  FileWarning,
} from 'lucide-react';
import type { CardsReport } from '@/lib/lessonPipeline/cardsReport';

interface ExecutionRow {
  id: string;
  lesson_title: string | null;
  model: string | null;
  status: string | null;
  created_at: string | null;
  lesson_id: string | null;
  output_data: any;
}

const PAGE_SIZE = 25;

export default function AdminV5CardsReport() {
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyInvalid, setOnlyInvalid] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pipeline_executions')
      .select('id, lesson_title, model, status, created_at, lesson_id, output_data')
      .eq('model', 'v5')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('[AdminV5CardsReport] load error:', error);
    }
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const report: CardsReport | undefined = r.output_data?.cardsReport;
        if (onlyInvalid && (!report || report.summary.invalid === 0)) return false;
        if (!term) return true;
        return (r.lesson_title || '').toLowerCase().includes(term);
      })
      .slice(0, PAGE_SIZE);
  }, [rows, search, onlyInvalid]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileWarning className="h-7 w-7 text-primary" />
            V5 — Relatório de Experience Cards
          </h1>
          <p className="text-muted-foreground mt-1">
            Auditoria automática de cards renderizados por seção. Gerado pelo Step 6 do
            pipeline (warning, não bloqueia publicação).
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Recarregar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center gap-4 flex-wrap">
          <Input
            placeholder="Buscar por título da aula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Switch
              id="only-invalid"
              checked={onlyInvalid}
              onCheckedChange={setOnlyInvalid}
            />
            <Label htmlFor="only-invalid">Somente execuções com cards inválidos</Label>
          </div>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} execução(ões) exibida(s)
          </span>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma execução V5 encontrada com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const report: CardsReport | undefined = row.output_data?.cardsReport;
            const isOpen = openId === row.id;
            return (
              <Collapsible
                key={row.id}
                open={isOpen}
                onOpenChange={(o) => setOpenId(o ? row.id : null)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 flex-wrap">
                        {isOpen ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <CardTitle className="text-base flex-1 min-w-0 truncate">
                          {row.lesson_title || '(sem título)'}
                        </CardTitle>
                        <Badge variant="outline">{row.status}</Badge>
                        {report ? (
                          <>
                            <Badge variant="secondary">
                              {report.summary.total} cards
                            </Badge>
                            {report.summary.invalid > 0 ? (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {report.summary.invalid} inválidos
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="outline">sem relatório</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString()
                            : ''}
                        </span>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6">
                      {report ? (
                        <ReportDetail report={report} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhum cardsReport persistido para esta execução (provavelmente
                          executada antes da implementação do relatório).
                        </p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportDetail({ report }: { report: CardsReport }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total" value={report.summary.total} />
        <StatBox label="Válidos" value={report.summary.valid} tone="success" />
        <StatBox
          label="Inválidos"
          value={report.summary.invalid}
          tone={report.summary.invalid > 0 ? 'danger' : 'neutral'}
        />
        <StatBox label="Catálogo" value={report.catalogSize} />
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <Badge variant="outline">inline: {report.summary.byOrigin.inline}</Badge>
        <Badge variant="outline">root: {report.summary.byOrigin.root}</Badge>
        {report.summary.byOrigin.unknown > 0 && (
          <Badge variant="outline">
            unknown: {report.summary.byOrigin.unknown}
          </Badge>
        )}
        {Object.entries(report.summary.byIssueType)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => (
            <Badge key={k} variant="destructive">
              {k}: {n}
            </Badge>
          ))}
      </div>

      {report.invalidCards.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-destructive">
            Cards inválidos ({report.invalidCards.length})
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seção</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Anchor</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Problemas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.invalidCards.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>#{c.sectionIndex}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.type || <span className="text-destructive">∅</span>}
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate">
                    {c.anchorText || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.origin}</Badge>
                  </TableCell>
                  <TableCell className="text-xs space-y-1">
                    {c.issues.map((iss, j) => (
                      <div key={j}>
                        <Badge variant="destructive" className="mr-1">
                          {iss.type}
                        </Badge>
                        {iss.message}
                        {iss.suggestion && (
                          <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                            {' '}
                            — {iss.suggestion}
                          </span>
                        )}
                      </div>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Detalhamento por seção</h3>
        {report.bySections.map((s) => (
          <Collapsible key={s.sectionIndex}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 text-left p-2 rounded hover:bg-muted/50 text-sm">
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium">Seção #{s.sectionIndex}</span>
                <span className="text-muted-foreground">— {s.total} cards</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Anchor</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.cards.map((c) => (
                    <TableRow key={c.index}>
                      <TableCell>{c.index}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.type || '∅'}
                      </TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate">
                        {c.anchorText || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.duration != null ? `${c.duration}s` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.origin}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.valid ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">
                            ok
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            {c.issues.length} issue(s)
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </>
  );
}

function StatBox({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const cls =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
