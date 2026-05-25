import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, lessonId, model } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lessonId || typeof lessonId !== "string") {
      return new Response(JSON.stringify({ error: "lessonId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Cache check
    const promptHash = await sha256(prompt.trim().toLowerCase());
    const storagePath = `v10-ai-images/${lessonId}/${promptHash}.png`;

    const { data: existingFile } = await supabase.storage
      .from("lesson-audios")
      .createSignedUrl(storagePath, 60);

    // If file exists, return public URL directly
    if (existingFile?.signedUrl) {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/lesson-audios/${storagePath}`;
      console.log(`[v10-ai-image] Cache HIT: ${storagePath}`);
      return new Response(JSON.stringify({ imageUrl: publicUrl, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedModel = model || "google/gemini-2.5-flash-image";
    let imageBase64: string | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[v10-ai-image] Attempt ${attempt + 1}/${maxRetries} with model ${selectedModel}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.status === 429) {
          console.warn(`[v10-ai-image] Rate limited (429), retry in ${3 * (attempt + 1)}s`);
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }

        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[v10-ai-image] Gateway error ${response.status}: ${errText}`);
          continue;
        }

        const data = await response.json();
        const b64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (b64 && b64.startsWith("data:image/")) {
          imageBase64 = b64.split(",")[1];
          break;
        } else {
          console.warn(`[v10-ai-image] No image in response, retrying...`);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.warn(`[v10-ai-image] Timeout on attempt ${attempt + 1}`);
        } else {
          console.error(`[v10-ai-image] Error on attempt ${attempt + 1}:`, err);
        }
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Falha ao gerar imagem após 3 tentativas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode and upload to Storage
    const binaryStr = atob(imageBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from("lesson-audios")
      .upload(storagePath, bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error(`[v10-ai-image] Upload error:`, uploadError);
      return new Response(JSON.stringify({ error: "Falha no upload da imagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/lesson-audios/${storagePath}`;
    console.log(`[v10-ai-image] Generated and uploaded: ${storagePath}`);

    return new Response(JSON.stringify({ imageUrl: publicUrl, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[v10-ai-image] Fatal error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
