import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Migration {
  version: string;
  name: string | null;
  statement_count: number | null;
}

interface StatusResponse {
  total: number;
  latest: string | null;
  migrations: Migration[];
  generated_at: string;
}

export default function AdminMigrationsStatus() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatusResponse | null>(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: invokeErr } = await supabase.functions.invoke('migrations-status', {
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

  const filtered = (data?.migrations ?? []).filter(m =>
    !filter ||
    m.version.toLowerCase().includes(filter.toLowerCase()) ||
    (m.name ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Status de Migrations</h1>
              <p className="text-sm text-muted-foreground">
                Visualização somente leitura das migrations aplicadas no banco.
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
              <p className="text-xs uppercase text-muted-foreground">Total aplicadas</p>
              <p className="text-3xl font-semibold mt-1">{data.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Última versão</p>
              <p className="text-lg font-mono mt-1 break-all">{data.latest ?? '—'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Snapshot</p>
              <p className="text-sm mt-1">{new Date(data.generated_at).toLocaleString()}</p>
            </Card>
          </div>
        )}

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por versão ou nome..."
              className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
            />
            <Badge variant="secondary">{filtered.length} resultado(s)</Badge>
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
                    <th className="px-3 py-2 font-medium">Versão</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium text-right">Statements</th>
                    <th className="px-3 py-2 font-medium text-center w-12">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.version} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{m.version}</td>
                      <td className="px-3 py-2 text-muted-foreground">{m.name ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.statement_count ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma migration encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Endpoint somente leitura · nenhum dado é alterado.
        </p>
      </div>
    </div>
  );
}
