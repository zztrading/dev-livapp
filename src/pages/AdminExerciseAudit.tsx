import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Play, CheckCircle, AlertTriangle, Loader2, Pencil, Sparkles, Eye, Filter, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuditRecord {
  id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_active: boolean;
  exercise_id: string;
  section_index: number;
  section_title: string;
  exercise_type: string;
  exercise_data: any;
  source_array: string;
  audit_status: string;
  errors_found: any[];
  corrected_data: any;
  correction_reason: string;
  section_content: string;
  applied_at: string;
  audited_at: string;
  corrected_at: string;
}

type PipelineStep = 'idle' | 'resetting' | 'discovering' | 'auditing' | 'correcting' | 'done';

export default function AdminExerciseAudit() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editModal, setEditModal] = useState<AuditRecord | null>(null);
  const [editData, setEditData] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [liveErrors, setLiveErrors] = useState({ logic_inverted: 0, wrong_answer: 0, irrelevant: 0, ambiguous: 0 });

  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from('exercise_audits')
      .select('*')
      .order('lesson_title')
      .order('section_index');

    if (error) {
      toast.error('Erro ao carregar auditorias');
      console.error(error);
    } else {
      setRecords((data || []) as unknown as AuditRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const callEdgeFunction = async (action: string, extra: any = {}) => {
    const { data, error: invokeError } = await supabase.functions.invoke('v8-audit-exercises', {
      body: { action, ...extra },
    });

    if (invokeError) {
      throw new Error(invokeError.message || 'Edge function error');
    }
    return data;
  };

  const runFullPipeline = async () => {
    try {
      // Step 1: Discover
      setPipelineStep('discovering');
      setProgress({ current: 0, total: 1, label: 'Descobrindo exercícios...' });
      const discoverResult = await callEdgeFunction('discover');
      const pendingCount = discoverResult.pending_count || 0;

      toast.success(`${discoverResult.total_exercises} exercícios em ${discoverResult.total_lessons} aulas. ${pendingCount} pendentes.`);
      await fetchRecords();

      // Step 2: Audit pending items
      if (pendingCount === 0) {
        setPipelineStep('done');
        await fetchRecords();
        toast.info('Nenhum exercício pendente para auditar.');
        return;
      }

      setPipelineStep('auditing');
      let auditRemaining = pendingCount;
      let auditedTotal = 0;
      setLiveErrors({ logic_inverted: 0, wrong_answer: 0, irrelevant: 0, ambiguous: 0 });

      while (auditRemaining > 0) {
        setProgress({ current: auditedTotal, total: pendingCount, label: `Auditando... ${auditedTotal}/${pendingCount}` });
        const auditResult = await callEdgeFunction('audit', { batch_size: 3 });
        auditedTotal += auditResult.audited;
        auditRemaining = auditResult.remaining;
        await fetchRecords();
        
        // Update live error counts from fetched records
        updateLiveErrors();
      }

      // Step 3: Correct errors
      setPipelineStep('correcting');
      let correctedTotal = 0;
      const { count: errCount } = await supabase
        .from('exercise_audits')
        .select('id', { count: 'exact', head: true })
        .eq('audit_status', 'has_errors');
      let correctRemaining = errCount || 0;
      const initialErrors = correctRemaining;

      if (correctRemaining === 0) {
        setPipelineStep('done');
        await fetchRecords();
        toast.success('Auditoria pedagógica completa! Nenhum erro encontrado.');
        return;
      }

      while (correctRemaining > 0) {
        setProgress({ current: correctedTotal, total: initialErrors, label: `Corrigindo... ${correctedTotal}/${initialErrors}` });
        const correctResult = await callEdgeFunction('correct', { batch_size: 3 });
        const batchProgress = correctResult.corrected || 0;
        correctedTotal += batchProgress;
        const prevRemaining = correctRemaining;
        correctRemaining = correctResult.remaining;
        await fetchRecords();
        if (correctRemaining >= prevRemaining && batchProgress === 0) {
          console.warn('[pipeline] Correction loop stuck, breaking');
          break;
        }
      }

      setPipelineStep('done');
      await fetchRecords();
      toast.success(`Auditoria pedagógica completa! ${correctedTotal} corrigidos.`);
    } catch (err: any) {
      toast.error(err.message);
      setPipelineStep('idle');
    }
  };

  const handleForceReaudit = async () => {
    if (!window.confirm('Resetar TODOS os exercícios (exceto publicados) e re-auditar com avaliação pedagógica?\n\nIsso vai re-analisar todos os 152+ exercícios.')) return;
    
    try {
      setPipelineStep('resetting');
      setProgress({ current: 0, total: 1, label: 'Resetando registros...' });
      
      const resetResult = await callEdgeFunction('reset_all');
      toast.success(`${resetResult.reset_count} exercícios resetados para pendente`);
      await fetchRecords();
      
      // Now run the full pipeline
      await runFullPipeline();
    } catch (err: any) {
      toast.error(err.message);
      setPipelineStep('idle');
    }
  };

  const updateLiveErrors = () => {
    setLiveErrors(prev => {
      const current = records.filter(r => r.audit_status === 'has_errors' || r.audit_status === 'corrected' || r.audit_status === 'applied');
      const counts = { logic_inverted: 0, wrong_answer: 0, irrelevant: 0, ambiguous: 0 };
      for (const r of current) {
        const verdict = r.errors_found?.[0]?.verdict;
        if (verdict === 'LOGIC_INVERTED') counts.logic_inverted++;
        else if (verdict === 'WRONG_ANSWER') counts.wrong_answer++;
        else if (verdict === 'IRRELEVANT_STATEMENT') counts.irrelevant++;
        else if (verdict === 'AMBIGUOUS') counts.ambiguous++;
      }
      return counts;
    });
  };

  useEffect(() => { updateLiveErrors(); }, [records]);

  const openEditModal = (record: AuditRecord) => {
    setEditModal(record);
    const dataToEdit = record.corrected_data || record.exercise_data;
    setEditData(JSON.stringify(dataToEdit, null, 2));
    setPreviewData(null);
    setAiInstruction('');
  };

  const handleSaveManual = async () => {
    if (!editModal) return;
    try {
      const parsed = JSON.parse(editData);
      await callEdgeFunction('apply', { audit_id: editModal.id, corrected_data: parsed });
      toast.success('Exercício atualizado e publicado!');
      setEditModal(null);
      await fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'JSON inválido');
    }
  };

  const handleAiReCorrect = async () => {
    if (!editModal || !aiInstruction.trim()) return;
    setAiLoading(true);
    try {
      const result = await callEdgeFunction('re-correct', {
        audit_id: editModal.id,
        admin_instruction: aiInstruction,
      });
      setPreviewData(result.corrected_data);
      setEditData(JSON.stringify(result.corrected_data, null, 2));
      toast.success('Nova versão gerada pela IA');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const verdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'LOGIC_INVERTED': return <Badge className="bg-red-700 text-white text-[10px]">Lógica Invertida</Badge>;
      case 'WRONG_ANSWER': return <Badge className="bg-orange-600 text-white text-[10px]">Resposta Errada</Badge>;
      case 'IRRELEVANT_STATEMENT': return <Badge className="bg-purple-600 text-white text-[10px]">Irrelevante</Badge>;
      case 'AMBIGUOUS': return <Badge className="bg-yellow-600 text-white text-[10px]">Ambíguo</Badge>;
      default: return null;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>;
      case 'clean': return <Badge className="bg-emerald-600">Limpo ✓</Badge>;
      case 'has_errors': return <Badge variant="destructive">Com Erros</Badge>;
      case 'corrected': return <Badge className="bg-amber-600">Corrigido</Badge>;
      case 'applied': return <Badge className="bg-emerald-600">Publicado ✓</Badge>;
      case 'correction_failed': return <Badge className="bg-red-900 text-white">Falha IA</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filtered = statusFilter === 'all' ? records : records.filter(r => r.audit_status === statusFilter);

  const counts = {
    total: records.length,
    pending: records.filter(r => r.audit_status === 'pending').length,
    clean: records.filter(r => r.audit_status === 'clean').length,
    has_errors: records.filter(r => r.audit_status === 'has_errors').length,
    corrected: records.filter(r => r.audit_status === 'corrected').length,
    applied: records.filter(r => r.audit_status === 'applied').length,
    correction_failed: records.filter(r => r.audit_status === 'correction_failed').length,
  };

  const totalVerdicts = liveErrors.logic_inverted + liveErrors.wrong_answer + liveErrors.irrelevant + liveErrors.ambiguous;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-bold">Auditoria Pedagógica de Exercícios V8</h1>
          <p className="text-muted-foreground text-sm">Verifica se as respostas corretas são factualmente corretas com base no conteúdo da seção</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <Card className="cursor-pointer" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{counts.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setStatusFilter('pending')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{counts.pending}</div>
              <div className="text-xs">Pendentes</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setStatusFilter('clean')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-500">{counts.clean}</div>
              <div className="text-xs">Limpos</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setStatusFilter('has_errors')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-500">{counts.has_errors}</div>
              <div className="text-xs">Com Erros</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setStatusFilter('corrected')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-amber-500">{counts.corrected}</div>
              <div className="text-xs">Corrigidos</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setStatusFilter('applied')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-500">{counts.applied}</div>
              <div className="text-xs">Publicados</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setStatusFilter('correction_failed')}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-800">{counts.correction_failed}</div>
              <div className="text-xs">Falha IA</div>
            </CardContent>
          </Card>
        </div>

        {/* Verdict Breakdown */}
        {totalVerdicts > 0 && (
          <Card className="border-amber-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Erros pedagógicos:</span>
                {liveErrors.logic_inverted > 0 && (
                  <div className="flex items-center gap-1">
                    <Badge className="bg-red-700 text-white text-xs">{liveErrors.logic_inverted}</Badge>
                    <span className="text-xs">Lógica Invertida</span>
                  </div>
                )}
                {liveErrors.wrong_answer > 0 && (
                  <div className="flex items-center gap-1">
                    <Badge className="bg-orange-600 text-white text-xs">{liveErrors.wrong_answer}</Badge>
                    <span className="text-xs">Resposta Errada</span>
                  </div>
                )}
                {liveErrors.irrelevant > 0 && (
                  <div className="flex items-center gap-1">
                    <Badge className="bg-purple-600 text-white text-xs">{liveErrors.irrelevant}</Badge>
                    <span className="text-xs">Irrelevante</span>
                  </div>
                )}
                {liveErrors.ambiguous > 0 && (
                  <div className="flex items-center gap-1">
                    <Badge className="bg-yellow-600 text-white text-xs">{liveErrors.ambiguous}</Badge>
                    <span className="text-xs">Ambíguo</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Buttons */}
        <Card>
          <CardContent className="p-4">
            {pipelineStep === 'idle' || pipelineStep === 'done' ? (
              <div className="flex gap-3">
                <Button onClick={() => runFullPipeline()} size="lg" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  <Play className="w-5 h-5 mr-2" />
                  {counts.pending > 0 ? `Auditar ${counts.pending} Pendentes` : 'Verificar Novos'}
                </Button>
                <Button onClick={handleForceReaudit} size="lg" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Resetar e Re-auditar Tudo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">{progress.label}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                  />
                </div>
                <div className="flex gap-2">
                  {['resetting', 'discovering', 'auditing', 'correcting'].map((step) => (
                    <Badge
                      key={step}
                      variant={pipelineStep === step ? 'default' : 'outline'}
                      className={pipelineStep === step ? 'bg-emerald-600' : ''}
                    >
                      {step === 'resetting' ? '0. Reset' : step === 'discovering' ? '1. Descobrir' : step === 'auditing' ? '2. Auditar' : '3. Corrigir'}
                    </Badge>
                  ))}
                </div>
                {/* Live error count during audit */}
                {pipelineStep === 'auditing' && totalVerdicts > 0 && (
                  <div className="text-sm text-amber-600">
                    ⚠️ Erros encontrados até agora: {totalVerdicts}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Table */}
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum exercício auditado. Clique "Verificar Novos" para começar.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Exercícios ({filtered.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <select
                    className="text-sm border rounded px-2 py-1 bg-background"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendentes</option>
                    <option value="clean">Limpos</option>
                    <option value="has_errors">Com Erros</option>
                    <option value="corrected">Corrigidos</option>
                    <option value="applied">Publicados</option>
                    <option value="correction_failed">Falha IA</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aula</TableHead>
                      <TableHead>Exercício</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Diagnóstico</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="max-w-[150px] truncate">
                          <div className="text-sm font-medium">{record.lesson_title}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.lesson_active ? '🟢' : '⚪'} §{record.section_index + 1}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{record.exercise_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{record.exercise_type}</Badge>
                        </TableCell>
                        <TableCell>{statusBadge(record.audit_status)}</TableCell>
                        <TableCell>
                          {Array.isArray(record.errors_found) && record.errors_found.length > 0 ? (
                            <div className="text-xs space-y-1">
                              {record.errors_found[0]?.verdict && verdictBadge(record.errors_found[0].verdict)}
                              {record.errors_found[0]?.explanation && (
                                <div className="text-muted-foreground max-w-[250px] line-clamp-2">
                                  {record.errors_found[0].explanation}
                                </div>
                              )}
                              {/* Fallback for old-format errors */}
                              {!record.errors_found[0]?.verdict && record.errors_found.slice(0, 2).map((e: any, i: number) => (
                                <div key={i} className="flex items-start gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                                  <span className="truncate max-w-[200px]">{e.description}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditModal(record)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Edit Modal */}
        <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                Editar: {editModal?.exercise_id} ({editModal?.exercise_type})
              </DialogTitle>
            </DialogHeader>

            {/* Show verdict info at top of modal */}
            {editModal?.errors_found?.[0]?.verdict && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  {verdictBadge(editModal.errors_found[0].verdict)}
                </div>
                <p className="text-sm text-muted-foreground">{editModal.errors_found[0].explanation}</p>
              </div>
            )}

            <Tabs defaultValue="form" className="flex-1">
              <TabsList className="w-full">
                <TabsTrigger value="form" className="flex-1">
                  <Pencil className="w-4 h-4 mr-1" /> Formulário
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">
                  <Sparkles className="w-4 h-4 mr-1" /> Pedir à IA
                </TabsTrigger>
                <TabsTrigger value="compare" className="flex-1">
                  <Eye className="w-4 h-4 mr-1" /> Comparar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="mt-3">
                <ScrollArea className="h-[50vh]">
                  <Textarea
                    value={editData}
                    onChange={(e) => setEditData(e.target.value)}
                    className="font-mono text-xs min-h-[400px]"
                    placeholder="JSON do exercício..."
                  />
                </ScrollArea>
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
                  <Button onClick={handleSaveManual} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="w-4 h-4 mr-1" /> Salvar e Publicar
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Instrução para a IA:</label>
                  <Textarea
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="Ex: Mude a pergunta do card 1 para falar sobre limitações de bancos de imagem"
                    className="min-h-[80px]"
                  />
                </div>
                <Button
                  onClick={handleAiReCorrect}
                  disabled={aiLoading || !aiInstruction.trim()}
                  className="w-full"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Gerar Correção
                </Button>
                {previewData && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preview da correção:</label>
                    <ScrollArea className="h-[300px]">
                      <pre className="text-xs font-mono bg-muted p-3 rounded-md whitespace-pre-wrap">
                        {JSON.stringify(previewData, null, 2)}
                      </pre>
                    </ScrollArea>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setPreviewData(null)}>Descartar</Button>
                      <Button onClick={handleSaveManual} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle className="w-4 h-4 mr-1" /> Aplicar e Publicar
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="compare" className="mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Original:</label>
                    <ScrollArea className="h-[400px]">
                      <pre className="text-xs font-mono bg-muted p-3 rounded-md whitespace-pre-wrap">
                        {JSON.stringify(editModal?.exercise_data, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {editModal?.corrected_data ? 'Corrigido:' : 'Sem correção ainda'}
                    </label>
                    <ScrollArea className="h-[400px]">
                      <pre className="text-xs font-mono bg-muted p-3 rounded-md whitespace-pre-wrap">
                        {editModal?.corrected_data
                          ? JSON.stringify(editModal.corrected_data, null, 2)
                          : 'Nenhuma correção aplicada'}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
                {editModal?.correction_reason && (
                  <div className="mt-3 p-3 bg-amber-500/10 rounded-md">
                    <span className="text-sm font-medium">Razão: </span>
                    <span className="text-sm">{editModal.correction_reason}</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
