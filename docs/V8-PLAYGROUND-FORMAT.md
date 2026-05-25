# V8 `[PLAYGROUND]` — Formato de bloco (single-line + multiline)

> Parser: `src/lib/v8ContentParser.ts` → `parsePlaygroundBlocks` → `parseFields`.
> Suporta **dois formatos**, mutuamente compatíveis no mesmo bloco:
> 1. **Single-line**: `key: valor` (formato original, 100% retrocompatível).
> 2. **Pipe-style multiline**: `key: |` seguido de linhas livres, terminado quando o parser encontra outra linha `key:` ou um item de lista (`- ...`).

---

## Regras do parser

- O parser percorre o bloco linha-a-linha.
- Se encontrar `key: <valor>` na mesma linha → grava direto.
- Se encontrar `key: |` (valor vazio após o `|`) → entra em modo **multiline** e concatena todas as linhas seguintes (preservando `\n` reais) até encontrar:
  - outra linha que pareça um novo campo (chave alfanumérica seguida de `:`), ou
  - um item de lista (`- ...`), ou
  - o fim do bloco (`\n## ` ou `[` outro bloco).
- O valor coletado passa por `trimEnd()`.
- Indentação **não é obrigatória** — linhas internas podem ou não estar indentadas.

## Campos suportados em multiline

Todos os campos textuais do `[PLAYGROUND]` aceitam pipe-style:

- `amateurPrompt`
- `professionalPrompt`
- `amateurResult`
- `professionalResult`
- `userChallengePrompt`
- `userChallengeInstruction`
- `instruction`
- `narration`
- `successMessage`
- `tryAgainMessage`
- `offlineFallbackMessage`
- `offlineFallbackExampleAnswer`

Listas (`hints:`, `evaluationCriteria:`) continuam usando o formato `- item`.

---

## Exemplo copy-paste (mistura single-line + multiline)

```
[PLAYGROUND]
title: Anúncio para padaria de bairro
subtitle: Veja a diferença entre prompt amador e prompt profissional
instruction: Compare os dois prompts e os dois resultados.

amateurPrompt: |
Faça um anúncio para minha padaria.
É urgente.

professionalPrompt: |
Você é copywriter local com foco em pequeno comércio.
Crie um anúncio de Instagram para uma padaria de bairro em São Paulo.
Foco em pão fresco saindo às 6h, tom acolhedor, CTA "vem tomar café".
Formato: 1 headline + 3 linhas de corpo + CTA.

amateurResult: Texto genérico, sem persona, sem CTA.

professionalResult: |
Headline forte e específica.
Corpo com prova social ("a padaria do seu bairro há 12 anos").
CTA claro: "vem tomar café às 6h".

userChallengeInstruction: |
Agora é sua vez.
Escreva um prompt profissional para o seu próprio negócio.

userChallengePrompt: Descreva: persona + contexto + formato + CTA.

hints:
- Comece definindo a persona ("Você é...")
- Inclua o público-alvo e a região
- Termine com um CTA verificável

evaluationCriteria:
- Persona definida
- Contexto de negócio claro
- CTA específico

successMessage: |
Excelente!
Seu prompt já tem persona, contexto e CTA — pronto pra rodar.

tryAgainMessage: Faltou clareza em algum dos 3 pilares (persona, contexto, CTA). Tenta de novo.

offlineFallbackMessage: |
Sem conexão com a IA agora.
Use o exemplo abaixo como referência.

offlineFallbackExampleAnswer: |
Você é copywriter local.
Crie um anúncio de Instagram para a Padaria do João, em Pinheiros (SP).
Tom acolhedor, foco em pão fresco às 6h.
CTA: "vem tomar café".
```

## Exemplo só single-line (continua válido)

```
[PLAYGROUND]
title: Anúncio
amateurPrompt: faz um anúncio
professionalPrompt: você é copywriter, foco em padaria de bairro, CTA "vem tomar café"
amateurResult: texto curto sem CTA
professionalResult: headline + corpo com prova social + CTA específico
successMessage: Mandou bem!
tryAgainMessage: Tenta de novo, foco em persona + CTA.
```

---

## Pegadinhas comuns

1. **Não use `\n` literal** dentro de uma linha single-line esperando virar quebra real. O parser não interpreta escapes — vira `\n` literal na string. Use pipe-style.
2. **Não inicie uma linha do bloco multiline com `algumaCoisa:`** — o parser vai achar que é um novo campo e fechar o bloco. Se precisar do caractere `:` no meio do texto, tudo bem (ex: `"às 6h: pão fresco"`); o problema é só linhas que **começam** com `chave:`.
3. **Itens de lista (`- ...`) terminam o multiline.** Se quiser um traço dentro do texto, use travessão (`—`) ou inicie a linha com outra coisa.
4. **Listas (`hints`, `evaluationCriteria`) continuam usando `- item`** — pipe-style ali não é suportado nem necessário.
5. **Pipe no último campo** funciona: o multiline coleta até o fim do bloco `[PLAYGROUND]` (delimitado por `\n## ` ou início de outro bloco).

## Testes de referência

`src/lib/__tests__/v8ContentParser.multiline.test.ts` cobre:
- A: regressão single-line.
- B: pipe-style em `amateurPrompt` (2 linhas) e `professionalResult` (3 linhas).
- C: pipe-style seguido de `hints:` (não engole a lista).
- D: pipe-style como último campo do bloco.
