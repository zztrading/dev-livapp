import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, DollarSign, AlertTriangle, Bell, Save, TrendingUp, Activity, Volume2, Copy, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { UsageLogHealth } from "@/components/admin/elevenlabs/UsageLogHealth";

const VOICE_MULTIPLIERS: Record<string, number> = {
  "Alice": 1.67,
  "Sarah": 1.0,
  "Laura": 1.0,
  "Matilda": 1.0,
};
const DEFAULT_MULTIPLIER = 1.67; // assume Voice Library if unknown

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
const fmtUsd4 = (n: number) => `$${n.toFixed(4)}`;
const calcCost = (chars: number, ratePer1k: number, mult: number) =>
  (chars / 1000) * ratePer1k * mult;

const multFor = (voice: string) => VOICE_MULTIPLIERS[voice] ?? DEFAULT_MULTIPLIER;

type Item = {
  ts: number;
  date: string;
  month: string;
  voice: string;
  voice_id: string;
  source: string;
  chars: number;
  text_sample: string;
  state: string;
};

type Granularity = "month" | "week" | "day";

// ISO week key: YYYY-Www (Mon-Sun)
function isoWeek(d: Date): string {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThu = new Date(target.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((target.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function localDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function periodKey(it: Item, g: Granularity): string {
  if (g === "month") return localDate(it.ts).slice(0, 7);
  if (g === "day") return localDate(it.ts);
  return isoWeek(new Date(it.ts));
}

export default function AdminElevenLabsCosts() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratePer1k, setRatePer1k] = useState(0.18);

  // filters
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [range, setRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fVoice, setFVoice] = useState("all");
  const [fSource, setFSource] = useState("all");
  const [fState, setFState] = useState("all");

  // alerts
  const [maxCalls, setMaxCalls] = useState<number>(1000);
  const [maxCost, setMaxCost] = useState<number>(50);
  const [savingAlerts, setSavingAlerts] = useState(false);

  // log table
  const [logLimit, setLogLimit] = useState(100);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("elevenlabs_alert_config")
        .select("max_calls_per_month, max_cost_usd_per_month")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setMaxCalls(data.max_calls_per_month ?? 1000);
        setMaxCost(Number(data.max_cost_usd_per_month) ?? 50);
      }
    })();
    fetchItems();
  }, []);

  async function saveAlerts() {
    setSavingAlerts(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from("elevenlabs_alert_config")
      .update({
        max_calls_per_month: maxCalls,
        max_cost_usd_per_month: maxCost,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("id", 1);
    setSavingAlerts(false);
    if (err) toast.error("Falha ao salvar: " + err.message);
    else toast.success("Limites salvos");
  }

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("elevenlabs-usage-items", {
        body: {},
      });
      if (err) throw err;
      setItems(data.items || []);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  // Distinct options
  const periods = useMemo(() => {
    return Array.from(new Set((items ?? []).map(i => periodKey(i, granularity)))).sort().reverse();
  }, [items, granularity]);
  const voices = useMemo(() => Array.from(new Set((items ?? []).map(i => i.voice))).sort(), [items]);
  const sources = useMemo(() => Array.from(new Set((items ?? []).map(i => i.source))).sort(), [items]);
  const states = useMemo(() => Array.from(new Set((items ?? []).map(i => i.state))).sort(), [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const fromTs = range?.from ? new Date(range.from).setHours(0, 0, 0, 0) : null;
    const toTs = range?.to ? new Date(range.to).setHours(23, 59, 59, 999) : (range?.from ? new Date(range.from).setHours(23, 59, 59, 999) : null);
    return items.filter(i =>
      (fromTs === null || i.ts >= fromTs) &&
      (toTs === null || i.ts <= toTs) &&
      (fVoice === "all" || i.voice === fVoice) &&
      (fSource === "all" || i.source === fSource) &&
      (fState === "all" || i.state === fState)
    );
  }, [items, range, fVoice, fSource, fState]);

  // Summaries on filtered
  const totalCalls = filtered.length;
  const totalChars = filtered.reduce((s, i) => s + i.chars, 0);
  const totalCost = filtered.reduce((s, i) => s + calcCost(i.chars, ratePer1k, multFor(i.voice)), 0);

  const dateRange = useMemo(() => {
    if (!filtered.length) return null;
    const min = filtered.reduce((m, i) => Math.min(m, i.ts), Infinity);
    const max = filtered.reduce((m, i) => Math.max(m, i.ts), 0);
    return { min: new Date(min), max: new Date(max) };
  }, [filtered]);

  // Aggregation by selected granularity
  const byPeriod = useMemo(() => {
    const m: Record<string, { calls: number; chars: number; cost: number }> = {};
    for (const i of filtered) {
      const k = periodKey(i, granularity);
      m[k] = m[k] || { calls: 0, chars: 0, cost: 0 };
      m[k].calls++;
      m[k].chars += i.chars;
      m[k].cost += calcCost(i.chars, ratePer1k, multFor(i.voice));
    }
    return Object.entries(m).map(([k, v]) => ({ period: k, ...v })).sort((a, b) => b.period.localeCompare(a.period));
  }, [filtered, granularity, ratePer1k]);

  const byVoice = useMemo(() => {
    const m: Record<string, { calls: number; chars: number; cost: number }> = {};
    for (const i of filtered) {
      m[i.voice] = m[i.voice] || { calls: 0, chars: 0, cost: 0 };
      m[i.voice].calls++;
      m[i.voice].chars += i.chars;
      m[i.voice].cost += calcCost(i.chars, ratePer1k, multFor(i.voice));
    }
    return Object.entries(m).map(([k, v]) => ({ voice: k, ...v })).sort((a, b) => b.cost - a.cost);
  }, [filtered, ratePer1k]);

  const bySource = useMemo(() => {
    const m: Record<string, { calls: number; chars: number; cost: number }> = {};
    for (const i of filtered) {
      m[i.source] = m[i.source] || { calls: 0, chars: 0, cost: 0 };
      m[i.source].calls++;
      m[i.source].chars += i.chars;
      m[i.source].cost += calcCost(i.chars, ratePer1k, multFor(i.voice));
    }
    return Object.entries(m).map(([k, v]) => ({ source: k, ...v })).sort((a, b) => b.calls - a.calls);
  }, [filtered, ratePer1k]);

  // Duplicates: same text_sample generated more than once
  const duplicates = useMemo(() => {
    const m: Record<string, { count: number; chars: number; sample: string; voices: Set<string> }> = {};
    for (const i of filtered) {
      const k = i.text_sample;
      if (!k) continue;
      if (!m[k]) m[k] = { count: 0, chars: 0, sample: k, voices: new Set() };
      m[k].count++;
      m[k].chars += i.chars;
      m[k].voices.add(i.voice);
    }
    return Object.values(m)
      .filter(v => v.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [filtered]);

  const wastedCalls = duplicates.reduce((s, d) => s + (d.count - 1), 0);
  const wastedChars = duplicates.reduce((s, d) => s + Math.round(d.chars * (d.count - 1) / d.count), 0);
  const wastedCost = duplicates.reduce((s, d) => s + calcCost(Math.round(d.chars * (d.count - 1) / d.count), ratePer1k, DEFAULT_MULTIPLIER), 0);

  // Alert breaches (uses ALL items per month, ignores filters)
  const allByMonth = useMemo(() => {
    const m: Record<string, { calls: number; cost: number }> = {};
    for (const i of items ?? []) {
      m[i.month] = m[i.month] || { calls: 0, cost: 0 };
      m[i.month].calls++;
      m[i.month].cost += calcCost(i.chars, ratePer1k, multFor(i.voice));
    }
    return Object.entries(m).map(([k, v]) => ({ month: k, ...v })).sort((a, b) => b.month.localeCompare(a.month));
  }, [items, ratePer1k]);
  const breaches = allByMonth.filter(m => m.calls > maxCalls || m.cost > maxCost);

  // Log table (sort desc by ts)
  const logRows = useMemo(() => [...filtered].sort((a, b) => b.ts - a.ts).slice(0, logLimit), [filtered, logLimit]);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <UsageLogHealth />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-7 w-7" />
            ElevenLabs — Controle e Análise
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tráfego completo da API ElevenLabs. Filtre por mês, voz, source e status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">$/1k chars</Label>
            <Input
              type="number"
              step="0.01"
              value={ratePer1k}
              onChange={(e) => setRatePer1k(Number(e.target.value))}
              className="w-24 h-9"
            />
          </div>
          <Button onClick={fetchItems} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Erro ao buscar dados</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOP STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="h-4 w-4" /> Chamadas
            </div>
            <div className="text-3xl font-bold">{totalCalls.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-4 w-4" /> Caracteres
            </div>
            <div className="text-3xl font-bold">{totalChars.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-4 w-4" /> Custo estimado
            </div>
            <div className="text-3xl font-bold text-primary">{fmtUsd(totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Volume2 className="h-4 w-4" /> Período
            </div>
            <div className="text-sm font-medium">
              {dateRange ? (
                <>
                  {dateRange.min.toLocaleDateString("pt-BR")}<br />→ {dateRange.max.toLocaleDateString("pt-BR")}
                </>
              ) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ALERTS */}
      <Card className="border-yellow-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-yellow-600" /> Alertas mensais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Máx. chamadas / mês</Label>
            <Input type="number" value={maxCalls} onChange={(e) => setMaxCalls(Number(e.target.value))} />
          </div>
          <div>
            <Label>Máx. custo / mês (USD)</Label>
            <Input type="number" step="0.01" value={maxCost} onChange={(e) => setMaxCost(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <Button onClick={saveAlerts} disabled={savingAlerts} className="w-full">
              {savingAlerts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar limites
            </Button>
          </div>
        </CardContent>
      </Card>

      {breaches.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-destructive">
                  {breaches.length} mês(es) acima do limite
                </p>
                <ul className="text-sm space-y-1">
                  {breaches.map(b => (
                    <li key={b.month}>
                      <strong>{b.month}</strong>: {b.calls.toLocaleString()} chamadas
                      {b.calls > maxCalls && <span className="text-destructive"> (&gt;{maxCalls})</span>}
                      {" · "}{fmtUsd(b.cost)}
                      {b.cost > maxCost && <span className="text-destructive"> (&gt;${maxCost})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FILTERS */}
      {items && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label>Período</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full h-10 justify-start text-left font-normal", !range && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {range?.from ? (
                      range.to ? (
                        <>{format(range.from, "dd/MM/yy", { locale: ptBR })} — {format(range.to, "dd/MM/yy", { locale: ptBR })}</>
                      ) : (
                        format(range.from, "dd/MM/yy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione um intervalo</span>
                    )}
                    {range && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRange(undefined); }}
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                      >
                        limpar
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={(r) => {
                      setRange(r);
                      if (r?.from && r?.to) setPickerOpen(false);
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  <div className="flex items-center justify-between gap-2 border-t p-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => {
                        const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 6);
                        setRange({ from, to }); setPickerOpen(false);
                      }}>7 dias</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29);
                        setRange({ from, to }); setPickerOpen(false);
                      }}>30 dias</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const now = new Date();
                        setRange({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: now });
                        setPickerOpen(false);
                      }}>Este mês</Button>
                    </div>
                    <Button size="sm" onClick={() => setPickerOpen(false)}>Aplicar</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Granularidade</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
              >
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mês</option>
              </select>
            </div>
            <div>
              <Label>Voz</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={fVoice} onChange={(e) => setFVoice(e.target.value)}>
                <option value="all">Todas ({voices.length})</option>
                {voices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label>Source</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={fSource} onChange={(e) => setFSource(e.target.value)}>
                <option value="all">Todos ({sources.length})</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={fState} onChange={(e) => setFState(e.target.value)}>
                <option value="all">Todos ({states.length})</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AGGREGATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Por {granularity === "month" ? "mês" : granularity === "week" ? "semana" : "dia"}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{granularity === "month" ? "Mês" : granularity === "week" ? "Semana" : "Dia"}</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Caracteres</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byPeriod.map(m => {
                  const breach = granularity === "month" && (m.calls > maxCalls || m.cost > maxCost);
                  return (
                    <TableRow key={m.period} className={breach ? "bg-destructive/10" : ""}>
                      <TableCell className="font-medium">{m.period}</TableCell>
                      <TableCell className="text-right">{m.calls.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{m.chars.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{fmtUsd(m.cost)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por voz</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Voz</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Caracteres</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byVoice.map(v => (
                  <TableRow key={v.voice}>
                    <TableCell className="font-medium">{v.voice} <span className="text-xs text-muted-foreground">×{multFor(v.voice)}</span></TableCell>
                    <TableCell className="text-right">{v.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{v.chars.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{fmtUsd(v.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por source</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Caracteres</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bySource.map(s => (
                  <TableRow key={s.source}>
                    <TableCell className="font-medium">{s.source}</TableCell>
                    <TableCell className="text-right">{s.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{s.chars.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{fmtUsd(s.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className={duplicates.length > 0 ? "border-orange-500/50" : ""}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Copy className="h-4 w-4" /> Duplicatas (desperdício)
            </CardTitle>
            {duplicates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {wastedCalls} chamadas redundantes · {wastedChars.toLocaleString()} chars · ~{fmtUsd(wastedCost)} desperdiçado
              </p>
            )}
          </CardHeader>
          <CardContent>
            {duplicates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma duplicata no recorte atual.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Texto</TableHead>
                    <TableHead className="text-right">Repetições</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {duplicates.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs max-w-md truncate">{d.sample}</TableCell>
                        <TableCell className="text-right font-bold text-orange-600">{d.count}×</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DETAILED LOG */}
      {filtered.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Log detalhado ({filtered.length.toLocaleString()} chamadas)</CardTitle>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={logLimit} onChange={(e) => setLogLimit(Number(e.target.value))}>
              <option value={50}>50 últimas</option>
              <option value={100}>100 últimas</option>
              <option value={500}>500 últimas</option>
              <option value={2000}>2000 últimas</option>
            </select>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Voz</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Chars</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead>Texto</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.ts).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{r.voice}</TableCell>
                      <TableCell className="text-xs">{r.source}</TableCell>
                      <TableCell className="text-xs">{r.state}</TableCell>
                      <TableCell className="text-right text-xs">{r.chars.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{fmtUsd4(calcCost(r.chars, ratePer1k, multFor(r.voice)))}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{r.text_sample}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!items && !loading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Carregando dados…
          </CardContent>
        </Card>
      )}
    </div>
  );
}
