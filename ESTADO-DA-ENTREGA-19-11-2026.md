# Estado da entrega — ContextFlow V1

> **Pasta fora do Git.** Este arquivo é o resumo operacional para quem recebe o
> projeto. A fonte de verdade continua sendo `contextflow2/docs/`.
> Última atualização: 19/11/2025.

## Onde o projeto está

| Fase | Situação |
|---|---|
| F1 — esqueleto modular | ✅ concluída e **homologada** |
| F2 — persistência (SQLite nativo) | ✅ concluída e **homologada** |
| F3 — ingestão com yt-dlp | 🟨 **concluída tecnicamente** — falta o teste real do YouTube |
| F4 — fila de trabalhos | ⬜ próxima, SPEC ainda não escrita |

**Repositório:** `contextflow2/` · branch `main`
**Commits:** `9fb9f32` (F1) · `8009009` (lockfile) · `4c02f6f` (F2) ·
`7a215cc` (F3) · `f50bcc7`, `adccf5f` e `89d4230` (documentação de transferência)

## O que foi provado por execução

- **122/122** testes de unidade e integração (`npm test`)
- **17/17** cenários em navegador real (`npm run test:e2e`)
- `npm run verificar` → **TUDO OK**
- `npm run build` → gera `dist/` e sobe a partir dele
- Instalação em clone limpo: **0,38 s, zero compilação, zero dependência de produção**
- Persistência sobrevive a `SIGKILL` (outro processo relê os dados)
- Injeção de comando pela URL **bloqueada** (`spawn` com `shell: false`)
- App **rodou no Windows** do proprietário: `npm run dev`, importação, persistência confirmada

## O que NÃO foi provado — e por quê

| Item | Motivo | Como resolver |
|---|---|---|
| Importação real do YouTube | O ambiente Linux onde o projeto foi desenvolvido bloqueava o domínio (`TLS/SSL connection has been closed`) | Roteiro `docs/roteiro-teste-f3.md` na máquina do proprietário |
| `npm test` no Windows | Só o app rodou lá, não a suíte | Rodar e reportar a contagem (esperado: 6 testes pulados) |

**Nada disso está escondido:** está declarado em `docs/estado-atual.md`,
`docs/05-criterios-de-aceite.md` e `docs/specs/f3-ingestao.md` §10.

## O que o Codex precisa fazer primeiro

1. Ler `contextflow2/docs/handoff-codex.md` (mensagem de transferência completa).
2. Rodar a suíte na máquina do proprietário e reportar números reais.
3. Executar o roteiro da F3 (3 vídeos: manual, automática, sem legenda).
4. Corrigir o que aparecer.
5. Só então escrever `docs/specs/f4-trabalhos.md`.

## Como restaurar o projeto

Se recebeu o `.zip`: extrair e rodar `npm install` dentro de `platform/`.

Se recebeu apenas o `arquivo.txt` (base64):

```bash
base64 -d arquivo.txt > pkg.tar.gz
tar -xzf pkg.tar.gz
cd contextflow2/platform
npm install
```

Verificado: restauração íntegra, `git status` limpo, histórico completo,
`node_modules` ausente do pacote, **122/122 testes** e **17/17 E2E** rodando a
partir do pacote extraído.

## Regras que o Codex não pode quebrar

1. `contextflow/` (original em Python) é **somente leitura**.
2. **Nenhum segredo** no Git — chaves, tokens, banco pessoal, cookies.
3. **Não declarar pronto sem evidência.** Se não rodou, escrever "não executado".
4. **Uma fatia por commit**, com mensagem dizendo o que foi validado.
5. **Atualizar `docs/estado-atual.md`** no fim de cada sessão.
6. **Não reabrir decisões fechadas** sem evidência nova (lista no handoff §8).

## Ambiente necessário na máquina do proprietário

- **Node.js ≥ 22.5**
- **yt-dlp** instalado (`winget install yt-dlp`)
- Chrome ou Edge (já vem no Windows) — só para os testes E2E

**Nada além disso.** Nenhum container ou serviço auxiliar é necessário.
