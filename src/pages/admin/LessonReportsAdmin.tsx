import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Flag, Loader2, Search, RefreshCw, AlertCircle, CalendarDays,
  BookOpenCheck, Filter
} from 'lucide-react';
import { LessonReportDetailModal, LessonReportRow } from '@/components/admin/LessonReportDetailModal';

const CATEGORIES = [
  'Ortografia ou gramática incorreta',
  'Conteúdo confuso ou pouco claro',
  'Erro técnico (áudio, vídeo, imagem)',
  'Resposta de exercício incorreta',
  'Sugestão de melhoria',
  'Outro',
];

const STATUS_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'novo', label: 'Novos' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'resolvido', label: 'Resolvidos' },
  { value: 'descartado', label: 'Descartados' },
];

const PERIOD_FILTERS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'novo': return <Badge variant="destructive">Novo</Badge>;
    case 'em_analise': return <Badge variant="secondary">Em análise</Badge>;
    case 'resolvido': return <Badge variant="success">Resolvido</Badge>;
    case 'descartado': return <Badge variant="outline">Descartado</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default function LessonReportsAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<LessonReportRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [periodFilter, setPeriodFilter] = useState('30');
  const [selected, setSelected] = useState<LessonReportRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('lesson_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (periodFilter !== 'all') {
        const days = parseInt(periodFilter, 10);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', since);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as LessonReportRow[];

      // Lookup lesson titles (UUIDs only) and user emails in parallel
      const lessonUuids = Array.from(new Set(rows.map(r => r.lesson_id).filter(isUuid)));
      const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));

      const [lessonsRes, usersRes] = await Promise.all([
        lessonUuids.length
          ? supabase.from('lessons').select('id, title, model').in('id', lessonUuids)
          : Promise.resolve({ data: [] as any[], error: null }),
        userIds.length
          ? supabase.from('users').select('id, email, name').in('id', userIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const lessonMap = new Map<string, { title: string; model: string | null }>();
      (lessonsRes.data || []).forEach((l: any) => lessonMap.set(l.id, { title: l.title, model: l.model }));
      const userMap = new Map<string, { email: string; name: string }>();
      (usersRes.data || []).forEach((u: any) => userMap.set(u.id, { email: u.email, name: u.name }));

      const enriched = rows.map(r => {
        const lesson = lessonMap.get(r.lesson_id);
        const user = userMap.get(r.user_id);
        return {
          ...r,
          lesson_title: lesson?.title || null,
          lesson_model: lesson?.model || null,
          user_email: user?.email || null,
          user_name: user?.name || null,
        };
      });

      setReports(enriched);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar reports', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('lesson_reports_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_reports' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          toast({ title: 'Novo report recebido', description: (payload.new as any).category });
        }
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Filtered list
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter(r => {
      if (statusFilter !== 'todos' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'todas' && r.category !== categoryFilter) return false;
      if (term) {
        const haystack = [
          r.lesson_title || '',
          r.lesson_id || '',
          r.user_email || '',
          r.user_name || '',
          r.details || '',
          r.category || '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [reports, search, statusFilter, categoryFilter]);

  // KPIs (over current loaded period)
  const kpis = useMemo(() => {
    const total = reports.length;
    const sevenAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7 = reports.filter(r => new Date(r.created_at).getTime() >= sevenAgo).length;
    const newCount = reports.filter(r => r.status === 'novo').length;
    const lessonsAffected = new Set(reports.map(r => r.lesson_id)).size;
    const catCount: Record<string, number> = {};
    reports.forEach(r => { catCount[r.category] = (catCount[r.category] || 0) + 1; });
    let topCat = '—';
    let topPct = 0;
    Object.entries(catCount).forEach(([cat, n]) => {
      const pct = total > 0 ? (n / total) * 100 : 0;
      if (pct > topPct) { topPct = pct; topCat = cat; }
    });
    return { total, last7, newCount, lessonsAffected, topCat, topPct };
  }, [reports]);

  const openReport = (r: LessonReportRow) => {
    setSelected(r);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Admin
        </Button>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Flag className="w-7 h-7 text-destructive" />
              Reports de Aulas
            </h1>
            <p className="text-muted-foreground">
              Triagem de problemas reportados por alunos via "Reportar problema" em V5/V8/V10.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <Flag className="w-3.5 h-3.5" /> Total no período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{kpis.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> Últimos 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{kpis.last7}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-destructive" /> Novos (não tratados)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-destructive">{kpis.newCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <BookOpenCheck className="w-3.5 h-3.5" /> Aulas afetadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{kpis.lessonsAffected}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                Top: {kpis.topCat} ({kpis.topPct.toFixed(0)}%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por aula, e-mail, descrição..."
                  className="pl-9"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Período</label>
                <div className="flex gap-1">
                  {PERIOD_FILTERS.map(p => (
                    <Button
                      key={p.value}
                      size="sm"
                      variant={periodFilter === p.value ? 'default' : 'outline'}
                      onClick={() => setPeriodFilter(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <div className="flex gap-1 flex-wrap">
                  {STATUS_FILTERS.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={statusFilter === s.value ? 'default' : 'outline'}
                      onClick={() => setStatusFilter(s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Categoria
              </label>
              <div className="flex gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant={categoryFilter === 'todas' ? 'default' : 'outline'}
                  onClick={() => setCategoryFilter('todas')}
                >
                  Todas
                </Button>
                {CATEGORIES.map(c => (
                  <Button
                    key={c}
                    size="sm"
                    variant={categoryFilter === c ? 'default' : 'outline'}
                    onClick={() => setCategoryFilter(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Flag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum report encontrado com os filtros atuais.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Aula</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Trecho</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => openReport(r)}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="text-sm">{r.category}</TableCell>
                      <TableCell className="text-sm max-w-[220px]">
                        <div className="truncate font-medium">
                          {r.lesson_title || <span className="text-muted-foreground italic">sem título</span>}
                        </div>
                        {r.lesson_model && (
                          <div className="text-xs text-muted-foreground">{r.lesson_model}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="truncate max-w-[180px]">{r.user_email || r.user_id}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                        <div className="truncate">{r.details || '—'}</div>
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openReport(r); }}>
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <LessonReportDetailModal
        report={selected}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onUpdated={load}
      />
    </div>
  );
}
