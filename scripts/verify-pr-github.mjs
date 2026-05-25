#!/usr/bin/env node
/**
 * verify-pr-github.mjs
 *
 * Confirma status de um PR via API REST do GitHub com evidência crua.
 * Sem maquiagem: se um endpoint falhar, mostra o erro literal.
 *
 * Uso:
 *   GITHUB_TOKEN=... node scripts/verify-pr-github.mjs <pr_number> [owner/repo]
 *
 * Padrão owner/repo: myfcan/intel-ignite-pro
 *
 * Saída:
 *   1) PR state / merged / merge_commit_sha / merged_by / merged_at
 *   2) Check-runs do merge_commit_sha (verify-pr-sync etc.) — conclusion + URL
 *   3) Comentários de bot (user.type === 'Bot') — created_at + trecho
 *   4) Cruza merge_sha com git rev-parse local (sincronia)
 */

import { spawnSync } from 'node:child_process';

const SEP = '─'.repeat(57);
const token = process.env.GITHUB_TOKEN;
const prNumber = process.argv[2];
const repoArg = process.argv[3] || 'myfcan/intel-ignite-pro';

if (!token) {
  console.error('❌ GITHUB_TOKEN ausente no ambiente.');
  process.exit(2);
}
if (!prNumber || !/^\d+$/.test(prNumber)) {
  console.error('Uso: node scripts/verify-pr-github.mjs <pr_number> [owner/repo]');
  process.exit(2);
}
const [owner, repo] = repoArg.split('/');
if (!owner || !repo) {
  console.error(`❌ owner/repo inválido: ${repoArg}`);
  process.exit(2);
}

const H = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'lovable-verify-pr-github',
};

async function gh(path) {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, { headers: H });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body, url };
}

function header(n, title) {
  console.log(`\n${SEP}\n${n}. ${title}\n${SEP}`);
}

function trunc(s, n = 140) {
  if (!s) return '';
  const oneLine = String(s).replace(/\s+/g, ' ').trim();
  return oneLine.length > n ? oneLine.slice(0, n) + '…' : oneLine;
}

// ── 1. PR ──────────────────────────────────────────────────────────
header(1, `PR #${prNumber} — ${owner}/${repo}`);
const pr = await gh(`/repos/${owner}/${repo}/pulls/${prNumber}`);
if (!pr.ok) {
  console.error(`❌ GET pull falhou: HTTP ${pr.status}`);
  console.error(JSON.stringify(pr.body, null, 2));
  process.exit(1);
}
const p = pr.body;
console.log(`title:           ${p.title}`);
console.log(`state:           ${p.state}`);
console.log(`merged:          ${p.merged}`);
console.log(`merge_commit:    ${p.merge_commit_sha}`);
console.log(`merged_by:       ${p.merged_by?.login ?? '—'}`);
console.log(`merged_at:       ${p.merged_at ?? '—'}`);
console.log(`base ← head:     ${p.base.ref} ← ${p.head.ref} (${p.head.sha?.slice(0,8)})`);
console.log(`html_url:        ${p.html_url}`);

const mergeSha = p.merge_commit_sha;

// ── 2. Workflow runs do merge commit (Actions API) ────────────────
// Nota: usamos /actions/runs?head_sha=… (escopo Actions: Read)
// porque o seletor de fine-grained PAT não expõe a permissão
// "Checks: Read" necessária para /commits/{sha}/check-runs.
header(2, 'WORKFLOW RUNS no merge commit (Actions API)');
if (!mergeSha) {
  console.log('— sem merge_commit_sha, pulando.');
} else {
  const wr = await gh(`/repos/${owner}/${repo}/actions/runs?head_sha=${mergeSha}&per_page=100`);
  if (!wr.ok) {
    console.error(`❌ GET actions/runs falhou: HTTP ${wr.status}`);
    console.error(JSON.stringify(wr.body, null, 2));
  } else {
    const runs = wr.body.workflow_runs || [];
    console.log(`total: ${runs.length}`);
    for (const r of runs) {
      const icon = r.conclusion === 'success' ? '✅'
                 : r.conclusion === 'failure' ? '❌'
                 : r.conclusion === 'cancelled' ? '🚫'
                 : r.conclusion === 'skipped' ? '⏭️'
                 : r.status === 'in_progress'  ? '⏳'
                 : r.status === 'queued'       ? '⏸️'
                 : '•';
      console.log(`  ${icon} ${(r.name || r.display_title || '?').padEnd(40)}  status=${r.status}  conclusion=${r.conclusion ?? '—'}  event=${r.event}`);
      console.log(`     ${r.html_url}`);
    }
  }
}

// ── 3. Comentários ────────────────────────────────────────────────
header(3, 'COMENTÁRIOS (issue comments — inclui bots)');
const co = await gh(`/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`);
if (!co.ok) {
  console.error(`❌ GET comments falhou: HTTP ${co.status}`);
  console.error(JSON.stringify(co.body, null, 2));
} else {
  const comments = co.body || [];
  console.log(`total: ${comments.length}`);
  const bots = comments.filter(c => c.user?.type === 'Bot' || /\[bot\]$/.test(c.user?.login || ''));
  console.log(`bots:  ${bots.length}`);
  for (const c of comments) {
    const flag = (c.user?.type === 'Bot' || /\[bot\]$/.test(c.user?.login || '')) ? '🤖' : '👤';
    console.log(`\n  ${flag} @${c.user?.login}  ${c.created_at}`);
    console.log(`     ${trunc(c.body, 200)}`);
  }
}

// ── 4. Sincronia local ────────────────────────────────────────────
header(4, 'SINCRONIA LOCAL');
if (!mergeSha) {
  console.log('— sem merge_commit_sha.');
} else {
  spawnSync('git', ['fetch', 'origin', 'main'], { stdio: 'ignore' });
  const localHead = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const hasIt = spawnSync('git', ['merge-base', '--is-ancestor', mergeSha, 'HEAD']).status === 0;
  console.log(`local HEAD:   ${localHead}`);
  console.log(`merge sha:    ${mergeSha}`);
  console.log(`contém merge: ${hasIt ? '✅ SIM (sincronizado ou à frente)' : '❌ NÃO (DESATUALIZADO)'}`);
}

console.log(`\n${SEP}\nFIM\n${SEP}`);
