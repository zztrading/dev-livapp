#!/usr/bin/env node
/**
 * verify-pr-sync.mjs
 *
 * Automatiza o checklist "Confirmar PR" pós-merge:
 *   1. Sincronização local vs merge commit alvo
 *   2. Integridade pós-merge (arquivos, imports, tsc --noEmit)
 *   3. Edge functions que precisam re-deploy (lista + executa)
 *   4. Estado do src/integrations/supabase/types.ts
 *   + aviso para arquivos protegidos
 *
 * Uso:
 *   node scripts/verify-pr-sync.mjs <merge_commit_sha>
 *   node scripts/verify-pr-sync.mjs            # usa origin/main HEAD
 *
 * Nota CI: o workflow .github/workflows/verify-pr-sync.yml faz checkout
 * com fetch-depth: 0 (history completa) — o `git fetch` adicional para
 * a base branch usa o default (sem --depth) para evitar `fatal: depth 0`.
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const SEP = '─────────────────────────────────────────';
const PROTECTED_FILES = [
  'src/hooks/usePromptAchievements.ts',
  'src/components/lessons/GuidedLessonV5.tsx',
];

let exitCode = 0;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return {
    status: r.status ?? -1,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
  };
}

function header(n, title) {
  console.log(`\n${SEP}\n${n}. ${title}\n${SEP}`);
}

function fail(msg) {
  console.log(`❌ ${msg}`);
  exitCode = 1;
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}
function info(msg) {
  console.log(`• ${msg}`);
}

// ─── Resolve target commit ────────────────────────────────────────
const argSha = process.argv[2];
console.log('🔄 git fetch origin main ...');
sh('git', ['fetch', 'origin', 'main']);

let targetSha = argSha;
if (!targetSha) {
  const r = sh('git', ['rev-parse', 'origin/main']);
  targetSha = r.stdout;
  console.log(`(sem argumento — usando origin/main = ${targetSha.slice(0, 8)})`);
}

const targetFull = sh('git', ['rev-parse', targetSha]).stdout;
const targetMsg = sh('git', ['log', '-1', '--format=%h %s', targetFull]).stdout;
if (!targetFull) {
  fail(`Commit alvo não encontrado: ${targetSha}`);
  process.exit(1);
}

// ─── 1. SINCRONIZAÇÃO ─────────────────────────────────────────────
header(1, 'SINCRONIZAÇÃO');
const localHead = sh('git', ['rev-parse', 'HEAD']).stdout;
const localMsg = sh('git', ['log', '-1', '--format=%h %s', 'HEAD']).stdout;
const inHistory = sh('git', ['merge-base', '--is-ancestor', targetFull, 'HEAD']).status === 0;

info(`Último commit local: ${localMsg}`);
info(`Commit alvo:         ${targetMsg}`);
if (localHead === targetFull || inHistory) {
  ok('Status: SINCRONIZADO');
} else {
  fail('Status: DESATUALIZADO — rode `git pull origin main`');
}

// ─── 2. INTEGRIDADE PÓS-MERGE ─────────────────────────────────────
header(2, 'PÓS-MERGE — VERIFICAÇÃO DE INTEGRIDADE');

// arquivos do PR (merge commit ^.. merge commit)
const diffRange = `${targetFull}^..${targetFull}`;
const diffRes = sh('git', ['diff', '--name-status', diffRange]);
let changedFiles = [];
if (diffRes.status === 0 && diffRes.stdout) {
  changedFiles = diffRes.stdout.split('\n').map((l) => {
    const [status, ...rest] = l.split('\t');
    return { status, path: rest.join('\t') };
  });
} else {
  // fallback (commit não-merge)
  const r2 = sh('git', ['show', '--name-status', '--format=', targetFull]);
  changedFiles = r2.stdout
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [status, ...rest] = l.split('\t');
      return { status, path: rest.join('\t') };
    });
}

console.log(`Arquivos alterados (${changedFiles.length}):`);
for (const f of changedFiles) console.log(`  ${f.status}\t${f.path}`);

// tsc --noEmit
console.log('\n🧪 Rodando `npx tsc --noEmit` ...');
const tsc = sh('npx', ['tsc', '--noEmit'], { timeout: 300_000 });
const tscOut = [tsc.stdout, tsc.stderr].filter(Boolean).join('\n');
if (tsc.status === 0) {
  ok('tsc --noEmit: 0 erros');
} else {
  fail(`tsc --noEmit: exit ${tsc.status}`);
  console.log(tscOut);
  const broken = tscOut
    .split('\n')
    .filter((l) => /TS2307|Cannot find module/.test(l));
  if (broken.length) {
    console.log('\n⚠️  Possíveis imports quebrados:');
    broken.forEach((l) => console.log(`  ${l}`));
  }
}

// ─── 3. EDGE FUNCTIONS ────────────────────────────────────────────
header(3, 'EDGE FUNCTIONS');

const fnFiles = changedFiles
  .map((f) => f.path)
  .filter((p) => p.startsWith('supabase/functions/'));
const fnByName = new Map();
let sharedTouched = false;
for (const p of fnFiles) {
  const parts = p.split('/');
  const name = parts[2];
  if (!name) continue;
  if (name === '_shared') {
    sharedTouched = true;
    continue;
  }
  if (!fnByName.has(name)) fnByName.set(name, []);
  fnByName.get(name).push(p);
}

let toDeploy = [...fnByName.keys()];

if (sharedTouched) {
  console.log('⚠️  supabase/functions/_shared/* foi alterado — TODAS as functions que importam de _shared precisam re-deploy.');
  // descobrir consumidores de _shared
  const grep = sh('grep', ['-rl', '-E', "from ['\"]\\.\\./_shared/", 'supabase/functions']);
  if (grep.status === 0) {
    const consumers = new Set();
    grep.stdout.split('\n').filter(Boolean).forEach((p) => {
      const parts = p.split('/');
      const name = parts[2];
      if (name && name !== '_shared') consumers.add(name);
    });
    toDeploy = Array.from(new Set([...toDeploy, ...consumers]));
  }
}

if (toDeploy.length === 0) {
  ok('Nenhuma edge function precisa de redeploy.');
} else {
  console.log(`Functions que precisam de redeploy (${toDeploy.length}):`);
  for (const name of toDeploy) {
    const evidence = fnByName.get(name);
    if (evidence?.length) {
      console.log(`  • ${name} — alterada diretamente (${evidence.length} arquivo(s))`);
    } else {
      console.log(`  • ${name} — depende de _shared/*`);
    }
  }

  console.log('\n🚀 Executando deploy ...');
  for (const name of toDeploy) {
    const r = sh('npx', ['supabase', 'functions', 'deploy', name, '--no-verify-jwt'], {
      timeout: 180_000,
    });
    if (r.status === 0) {
      ok(`deploy ${name}`);
    } else {
      fail(`deploy ${name} falhou (exit ${r.status})`);
      console.log(r.stdout);
      console.log(r.stderr);
    }
  }
}

// ─── 4. SUPABASE TYPES ────────────────────────────────────────────
header(4, 'SUPABASE TYPES');

const typesPath = 'src/integrations/supabase/types.ts';
const typesInDiff = changedFiles.some((f) => f.path === typesPath);
const newMigrations = changedFiles.filter(
  (f) => f.path.startsWith('supabase/migrations/') && f.status !== 'D'
);

if (newMigrations.length > 0 && !typesInDiff) {
  fail(`POSSIVELMENTE DESATUALIZADO — ${newMigrations.length} migration(s) no PR sem update em ${typesPath}.`);
  newMigrations.forEach((m) => console.log(`  • ${m.path}`));
  console.log('  (Não regenerado — apenas reportado.)');
} else if (newMigrations.length === 0) {
  ok(`Nenhuma migration nova no PR — ${typesPath} EM SYNC (heurística).`);
} else {
  ok(`Migration(s) e ${typesPath} ambos presentes no diff — EM SYNC.`);
}

// ─── ARQUIVOS PROTEGIDOS ──────────────────────────────────────────
header('⚠️', 'ARQUIVOS PROTEGIDOS — NÃO ALTERAR');
const touchedProtected = changedFiles.filter((f) => PROTECTED_FILES.includes(f.path));
if (touchedProtected.length === 0) {
  ok('Nenhum arquivo protegido foi tocado neste PR.');
} else {
  console.log('🚨 OBSERVAÇÃO (NÃO CORRIGIR — apenas reportar):');
  for (const f of touchedProtected) {
    console.log(`  • ${f.status}\t${f.path}`);
    const stat = sh('git', ['diff', '--stat', diffRange, '--', f.path]);
    if (stat.stdout) console.log(`    ${stat.stdout.split('\n')[0]}`);
  }
}

console.log(`\n${SEP}\nFINAL: exit ${exitCode}\n${SEP}`);
process.exit(exitCode);
