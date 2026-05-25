import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingDown, Repeat, Activity } from "lucide-react";
import { toast } from "sonner";

interface ValidationAlert {
  id: string;
  created_at: string;
  guarantee_name: string;
  test_name: string;
  severity: string;
  message: string;
  details: any;
  resolved: boolean;
}

interface UsageRow {
  source_function: string;
  cache_hit: boolean;
  char_count: number;
  request_hash: string;
  created_at: string;
}

interface FunctionStats {
  source: string;
  total: number;
  hits: number;
  misses: number;
  hit_rate: number;
  chars_saved: number;
  chars_billed: number;
}

interface RegenRow {
  request_hash: string;
  miss_count: number;
  sample_function: string;
  chars: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-500/30",
  warning: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  info: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

export function UsageLogHealth() {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<ValidationAlert[]>([]);
  const [stats, setStats] = useState<FunctionStats[]>([]);
  const [regens, setRegens] = useState<RegenRow[]>([]);
  const [totals, setTotals] = useState({ calls: 0, hits: 0, hitRate: 0, chars: 0 });

  async function load() {
    setLoading(true);
    try {
      // Janela: últimos 7 dias
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Alertas ativos relacionados a ElevenLabs.
      const { data: alertRows } = await supabase
        .from("validation_alerts")
        .select("*")
        .like("guarantee_name", "elevenlabs%")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);

      setAlerts((alertRows ?? []) as ValidationAlert[]);

      // 2. Cache health por função (últimos 7d).
      const { data: usageRows } = await supabase
        .from("elevenlabs_usage_log")
        .select("source_function, cache_hit, char_count, request_hash, created_at")
        .gte("created_at", since)
        .limit(50000);

      const rows = (usageRows ?? []) as UsageRow[];

      const byFn = new Map<string, FunctionStats>();
      for (const r of rows) {
        const s = byFn.get(r.source_function) ?? {
          source: r.source_function,
          total: 0,
          hits: 0,
          misses: 0,
          hit_rate: 0,
          chars_saved: 0,
          chars_billed: 0,
        };
        s.total += 1;
        if (r.cache_hit) {
          s.hits += 1;
          s.chars_saved += r.char_count;
        } else {
          s.misses += 1;
          s.chars_billed += r.char_count;
        }
        byFn.set(r.source_function, s);
      }
      const statsArr = Array.from(byFn.values()).map(s => ({
        ...s,
        hit_rate: s.total > 0 ? s.hits / s.total : 0,
      })).sort((a, b) => b.total - a.total);
      setStats(statsArr);

      // 3. Top regenerações: mesmo hash com >1 miss.
      const missByHash = new Map<string, { count: number; sample_fn: string; chars: number }>();
      for (const r of rows) {
        if (r.cache_hit) continue;
        const cur = missByHash.get(r.request_hash) ?? { count: 0, sample_fn: r.source_function, chars: r.char_count };
        cur.count += 1;
        missByHash.set(r.request_hash, cur);
      }
      const regenArr = Array.from(missByHash.entries())
        .filter(([, v]) => v.count > 1)
        .map(([hash, v]) => ({
          request_hash: hash,
          miss_count: v.count,
          sample_function: v.sample_fn,
          chars: v.chars,
        }))
        .sort((a, b) => b.miss_count - a.miss_count)
        .slice(0, 10);
      setRegens(regenArr);

      // 4. Totais.
      const totalCalls = rows.length;
      const totalHits = rows.filter(r => r.cache_hit).length;
      const totalChars = rows.reduce((acc, r) => acc + (r.cache_hit ? 0 : r.char_count), 0);
      setTotals({
        calls: totalCalls,
        hits: totalHits,
        hitRate: totalCalls > 0 ? totalHits / totalCalls : 0,
        chars: totalChars,
      });
    } catch (err: any) {
      toast.error("Falha ao carregar health: " + (err?.message ?? "erro"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function resolveAlert(id: string) {
    const { error } = await supabase
      .from("validation_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Falha ao resolver: " + error.message);
    } else {
      toast.success("Alerta resolvido");
      setAlerts(alerts.filter(a => a.id !== id));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Health da Bridge (últimos 7 dias)</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Chamadas totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.calls.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Cache hit %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totals.hitRate < 0.4 ? "text-red-600" : totals.hitRate < 0.6 ? "text-yellow-600" : "text-green-600"}`}>
              {(totals.hitRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totals.hits} hits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Chars cobrados (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.chars.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              Hashes com regen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${regens.length > 0 ? "text-yellow-600" : "text-green-600"}`}>
              {regens.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Textos cacheados que foram regerados</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas ativos ({alerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta ativo. 🎉</p>
          ) : (
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id} className={`border rounded p-3 ${SEVERITY_STYLES[a.severity] ?? ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="uppercase text-xs">{a.severity}</Badge>
                        <span className="text-xs opacity-75">{a.guarantee_name} / {a.test_name}</span>
                      </div>
                      <p className="text-sm font-medium">{a.message}</p>
                      <p className="text-xs opacity-75 mt-1">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => resolveAlert(a.id)}>
                      Resolver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cache hit por função */}
      <Card>
        <CardHeader>
          <CardTitle>Cache hit por função</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados nos últimos 7 dias.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Hits</TableHead>
                  <TableHead className="text-right">Misses</TableHead>
                  <TableHead className="text-right">Hit %</TableHead>
                  <TableHead className="text-right">Chars cobrados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map(s => (
                  <TableRow key={s.source}>
                    <TableCell className="font-mono text-xs">{s.source}</TableCell>
                    <TableCell className="text-right">{s.total}</TableCell>
                    <TableCell className="text-right text-green-600">{s.hits}</TableCell>
                    <TableCell className="text-right">{s.misses}</TableCell>
                    <TableCell className={`text-right font-medium ${s.hit_rate < 0.4 ? "text-red-600" : s.hit_rate < 0.6 ? "text-yellow-600" : "text-green-600"}`}>
                      {(s.hit_rate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">{s.chars_billed.toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top regenerações */}
      <Card>
        <CardHeader>
          <CardTitle>Top textos regerados (cache miss repetido)</CardTitle>
        </CardHeader>
        <CardContent>
          {regens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum texto regerado mais de 1x. Cache funcionando.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hash</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Regen count</TableHead>
                  <TableHead className="text-right">Chars/call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regens.map(r => (
                  <TableRow key={r.request_hash}>
                    <TableCell className="font-mono text-xs">{r.request_hash.slice(0, 16)}…</TableCell>
                    <TableCell className="font-mono text-xs">{r.sample_function}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{r.miss_count}×</TableCell>
                    <TableCell className="text-right">{r.chars}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
