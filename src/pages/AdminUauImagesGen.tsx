/**
 * AdminUauImagesGen — Página admin pra gerar as 9 imagens UAU 1 (Visual)
 * do onboarding em 1 clique. Não exige CLI.
 *
 * Fluxo:
 *   1. Admin abre /admin/uau-images-gen
 *   2. Clica "Gerar 9 imagens"
 *   3. Por trás: chama image-lab-generate 9x em série (pra não estourar
 *      rate limit), recebe base64/URL, upload pro bucket Storage 'uau-images'
 *   4. Frontend do onboarding lê do Storage URL pública
 *
 * Custo: ~9 × $0.04 (Gemini 2.5 Flash Image) = ~$0.36 por execução.
 * Não precisa rodar de novo a menos que queira regenerar.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Check, X, RefreshCw, Sparkles, Image as ImageIcon } from "lucide-react";

const BUCKET = "uau-images";

interface ImageJob {
  id: string;
  style: string;
  theme: string;
  prompt: string;
  status: "pending" | "generating" | "uploading" | "done" | "error";
  error?: string;
  publicUrl?: string;
}

const STYLES = {
  realista: "photorealistic, high detail, natural lighting, cinematic",
  cartoon: "vibrant cartoon style, soft colors, friendly mood, illustration",
  foto: "professional photography, sharp focus, depth of field, studio lighting",
};

const THEMES = {
  paisagem: "wide mountain landscape with a lake at sunset, golden hour",
  futurista: "futuristic city skyline with flying vehicles and neon signs",
  natureza: "lush tropical forest with sun rays piercing through canopy",
};

function buildJobs(): ImageJob[] {
  const jobs: ImageJob[] = [];
  for (const [styleKey, styleDesc] of Object.entries(STYLES)) {
    for (const [themeKey, themeDesc] of Object.entries(THEMES)) {
      jobs.push({
        id: `${styleKey}-${themeKey}`,
        style: styleKey,
        theme: themeKey,
        prompt: `${themeDesc}, ${styleDesc}. Square 1:1 composition, centered, beautiful, no text, no watermark.`,
        status: "pending",
      });
    }
  }
  return jobs;
}

function bucketUrl(filename: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${BUCKET}/${filename}`;
}

export default function AdminUauImagesGen() {
  const [jobs, setJobs] = useState<ImageJob[]>(buildJobs);
  const [running, setRunning] = useState(false);
  const [existingFiles, setExistingFiles] = useState<Set<string>>(new Set());

  // Verifica quais arquivos já existem no bucket
  const refreshExisting = useCallback(async () => {
    const { data } = await supabase.storage.from(BUCKET).list();
    const names = new Set((data ?? []).map((f) => f.name));
    setExistingFiles(names);
    setJobs((prev) =>
      prev.map((j) =>
        names.has(`${j.id}.png`)
          ? { ...j, status: "done", publicUrl: bucketUrl(`${j.id}.png`) }
          : j,
      ),
    );
  }, []);

  useEffect(() => {
    void refreshExisting();
  }, [refreshExisting]);

  const updateJob = useCallback((id: string, patch: Partial<ImageJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const generateOne = useCallback(
    async (job: ImageJob): Promise<void> => {
      updateJob(job.id, { status: "generating", error: undefined });

      // 1. Chama admin-image-gen com retry em caso de rate limit
      const MAX_ATTEMPTS = 4;
      let data: any = null;
      let lastError: string | undefined;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const { data: respData, error } = await supabase.functions.invoke("admin-image-gen", {
          body: { prompt: job.prompt },
        });

        if (!error && respData?.ok) {
          data = respData;
          break;
        }

        const msg = error?.message ?? respData?.error ?? "no data";
        lastError = msg;
        const isRateLimit =
          msg.toLowerCase().includes("rate") ||
          msg.includes("429") ||
          msg.toLowerCase().includes("non-2xx");

        if (isRateLimit && attempt < MAX_ATTEMPTS) {
          const backoffMs = 5000 * attempt; // 5s, 10s, 15s
          updateJob(job.id, {
            status: "generating",
            error: `rate limit — aguardando ${backoffMs / 1000}s (tentativa ${attempt + 1}/${MAX_ATTEMPTS})`,
          });
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        updateJob(job.id, { status: "error", error: msg });
        return;
      }

      if (!data) {
        updateJob(job.id, { status: "error", error: lastError ?? "falhou após retries" });
        return;
      }

      // 2. Pega o blob (base64 ou URL)
      let blob: Blob;
      try {
        if (data.base64) {
          const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
          blob = new Blob([bytes], { type: "image/png" });
        } else if (data.image_url) {
          const resp = await fetch(data.image_url);
          blob = await resp.blob();
        } else {
          updateJob(job.id, { status: "error", error: "no image data" });
          return;
        }
      } catch (e) {
        updateJob(job.id, { status: "error", error: `decode: ${(e as Error).message}` });
        return;
      }

      // 3. Upload pro Storage
      updateJob(job.id, { status: "uploading" });
      const filename = `${job.id}.png`;
      const { error: upError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, blob, { upsert: true, contentType: "image/png" });

      if (upError) {
        updateJob(job.id, { status: "error", error: `upload: ${upError.message}` });
        return;
      }

      updateJob(job.id, {
        status: "done",
        publicUrl: bucketUrl(filename),
      });
    },
    [updateJob],
  );

  const generateAll = useCallback(async () => {
    setRunning(true);
    // Serial + delay de 3s entre cada — pra respeitar rate limit do Gemini Image
    for (const job of jobs) {
      if (job.status === "done") continue;
      await generateOne(job);
      await new Promise((r) => setTimeout(r, 3000));
    }
    setRunning(false);
    void refreshExisting();
  }, [jobs, generateOne, refreshExisting]);

  const regenerateOne = useCallback(
    async (job: ImageJob) => {
      setRunning(true);
      await generateOne(job);
      setRunning(false);
    },
    [generateOne],
  );

  const doneCount = jobs.filter((j) => j.status === "done").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ImageIcon className="w-7 h-7 text-indigo-500" />
            <h1 className="text-3xl font-bold text-slate-900">
              UAU Images — Onboarding V2 Tela 10
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Gera as 9 imagens (3 estilos × 3 temas) que aparecem na Tela 5 (UAU Visual)
            do quiz pré-signup. Usa <code>image-lab-generate</code> (Gemini 2.5 Flash Image
            via Lovable AI Gateway) e salva no bucket <code>uau-images</code>.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Custo estimado: ~9 × $0.04 = ~$0.36 por execução completa.
          </p>
        </header>

        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Status: {doneCount}/9 prontas
                {errorCount > 0 && (
                  <span className="ml-2 text-rose-600">· {errorCount} erro(s)</span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Gera em série (não paralelo) pra respeitar rate limit do Gemini.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshExisting}
                disabled={running}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Recarregar
              </Button>
              <Button
                onClick={generateAll}
                disabled={running || doneCount === 9}
                className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    {doneCount === 9 ? "Tudo pronto" : `Gerar ${9 - doneCount} imagem(ns)`}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
              style={{ width: `${(doneCount / 9) * 100}%` }}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <Card key={job.id} className="p-4 flex flex-col gap-3">
              <div className="aspect-square rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                {job.status === "done" && job.publicUrl ? (
                  <img
                    src={job.publicUrl}
                    alt={job.id}
                    className="w-full h-full object-cover"
                  />
                ) : job.status === "generating" ? (
                  <div className="flex flex-col items-center gap-2 text-indigo-500">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs">Gerando...</span>
                  </div>
                ) : job.status === "uploading" ? (
                  <div className="flex flex-col items-center gap-2 text-amber-500">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs">Subindo...</span>
                  </div>
                ) : job.status === "error" ? (
                  <div className="flex flex-col items-center gap-2 text-rose-500 px-2 text-center">
                    <X className="w-6 h-6" />
                    <span className="text-[10px] break-all">{job.error}</span>
                  </div>
                ) : (
                  <ImageIcon className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{job.id}</p>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{job.prompt}</p>
              </div>
              {(job.status === "error" || job.status === "done") && !running && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateOne(job)}
                  className="w-full text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Regenerar
                </Button>
              )}
              {job.status === "done" && (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="w-3 h-3" />
                  Pronto · bucket {BUCKET}
                </div>
              )}
            </Card>
          ))}
        </div>

        <Card className="p-4 mt-6 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-900">
            <strong>Pré-requisito:</strong> sua conta precisa ter role <code>admin</code> ou{" "}
            <code>dev</code> em <code>user_roles</code>. A edge function{" "}
            <code>image-lab-generate</code> valida isso.
          </p>
        </Card>
      </div>
    </div>
  );
}
