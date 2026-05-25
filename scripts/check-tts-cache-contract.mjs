#!/usr/bin/env node
/**
 * Contract check: toda edge function que chama api.elevenlabs.io/v1/text-to-speech
 * precisa importar buildCacheKey de _shared/tts-guard.ts.
 *
 * Previne regressão da duplicação documentada (53% das chamadas eram redundantes
 * porque novas funções podiam chamar a API sem cache hash-based).
 *
 * Falha o CI se encontrar função sem buildCacheKey.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "supabase/functions";

// Endpoints que disparam cobrança no ElevenLabs.
const BILLABLE_ENDPOINTS = [
  "api.elevenlabs.io/v1/text-to-speech",
];

const REQUIRED_IMPORT = "buildCacheKey";

function walkFunctionFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const e of entries) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) {
      const idx = join(full, "index.ts");
      try {
        if (statSync(idx).isFile()) files.push(idx);
      } catch {/* sem index.ts */}
    }
  }
  return files;
}

function fileCallsBillable(content) {
  return BILLABLE_ENDPOINTS.some(ep => content.includes(ep));
}

function fileImportsBuildCacheKey(content) {
  // Permite import estático ou dinâmico do tts-guard.
  return content.includes(REQUIRED_IMPORT);
}

const offenders = [];
for (const file of walkFunctionFiles(ROOT)) {
  const content = readFileSync(file, "utf8");
  if (!fileCallsBillable(content)) continue;
  if (!fileImportsBuildCacheKey(content)) {
    offenders.push(file);
  }
}

if (offenders.length > 0) {
  console.error("❌ Edge functions que chamam ElevenLabs mas NÃO usam buildCacheKey:");
  for (const f of offenders) console.error("   -", f);
  console.error("");
  console.error("Cada função TTS deve importar buildCacheKey de _shared/tts-guard.ts");
  console.error("e usá-lo como chave de cache antes de chamar a API. Veja exemplos em");
  console.error("v10-generate-audio ou v8-generate.");
  process.exit(1);
}

console.log(`✅ Contract OK: todas as funções que chamam ElevenLabs importam ${REQUIRED_IMPORT}.`);
process.exit(0);
