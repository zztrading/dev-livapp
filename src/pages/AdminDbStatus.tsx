import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, Database, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TableRow {
  name: string;
  rows: number | null;
  error: string | null;
}

interface StatusResponse {
  connection: 'ok' | 'error';
  latency_ms: number;
  connection_error: string | null;
  tables: TableRow[];
  generated_at: string;
}

export default function AdminDbStatus() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatusResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: invokeErr } = await supabase.functions.invoke('db-status', {
        method: 'GET',
      });
      if (invokeErr) throw invokeErr;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as StatusResponse);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const latencyTone = (ms: number) =>
    ms < 150 ? 'text-emerald-500' : ms < 500 ? 'text-amber-500' : 'text-destructive';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Status do Banco</h1>
              <p className="text-sm text-muted-foreground">
                Visualização somente leitura · conexão, latência e contagem de tabelas.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2">Atualizar</span>
          </Button>
        </header>

        {error && (
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-medium">Falha ao carregar status</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Conexão</p>
              <div className="flex items-center gap-2 mt-1">
                {data.connection === 'ok' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-lg font-semibold">Online</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="text-lg font-semibold">Falha</span>
                  </>
                )}
              </div>
              {data.connection_error && (
                <p className="text-xs text-destructive mt-1">{data.connection_error}</p>
              )}
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Latência</p>
              <p className={`text-3xl font-semibold mt-1 tabular-nums ${latencyTone(data.latency_ms)}`}>
                {data.latency_ms}<span className="text-base font-normal ml-1">ms</span>
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Snapshot</p>
              <p className="text-sm mt-1">{new Date(data.generated_at).toLocaleString()}</p>
            </Card>
          </div>
        )}

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Tabelas principais</h2>
            <Badge variant="secondary">{data?.tables.length ?? 0} tabela(s)</Badge>
          </div>

          {loading && !data ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Tabela</th>
                    <th className="px-3 py-2 font-medium text-right">Linhas</th>
                    <th className="px-3 py-2 font-medium text-center w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.tables ?? []).map((t) => (
                    <tr key={t.name} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{t.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.rows !== null ? t.rows.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {t.error ? (
                          <span title={t.error}>
                            <XCircle className="w-4 h-4 text-destructive inline" />
                          </span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                  {data && data.tables.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma tabela consultada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Endpoint somente leitura · nenhum dado é alterado · nenhuma migration criada.
        </p>
      </div>
    </div>
  );
}
