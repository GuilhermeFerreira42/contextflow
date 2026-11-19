# ContextFlow V1 — entrada única para agente executor

**Status**: V1 em implementação. **F1 e F2 homologadas**; **F3 concluída
tecnicamente** (aguarda teste real do YouTube). Base documental: pacote
`ContextFlow_Pacote_Execucao_V1` (2026-11-18). Estado vivo em
`docs/estado-atual.md`.

**Se você é um agente chegando agora (Codex ou outro):** leia
`docs/handoff-codex.md` primeiro — ele diz o que verificar, em que ordem, e o
que **não** fazer sem autorização.

## Objetivo

Construir **ContextFlow V1**: aplicativo **local** multiplataforma (Windows/Linux),
**motor (backend) Node.js + TypeScript** com **interface web local**, contendo
Biblioteca, Leitura, Importações e Configurações. Vídeos do YouTube, metadados,
legendas com timestamps, resumos via provedores configuráveis e persistência local.
Monólito modular. Chat sobre conteúdo é **V2** e não entra na V1.

## Onde está o quê

```
contextflow/        → projeto original (Python/wxPython). SOMENTE LEITURA. Congelado.
contextflow2/       → repositório Git do novo projeto
├── docs/           → documentação canônica (este arquivo, escopo, SPECs, decisões, estado)
└── platform/       → TODO o projeto executável Node.js + TypeScript
Continuidade de Projeto/  → materiais operacionais FORA do Git
```

> **Sobre os caminhos neste documento:** onde aparecer `/home/user/...`, leia como
> o caminho da **máquina onde você está trabalhando**. Aquele prefixo é do
> ambiente Linux onde o projeto foi desenvolvido; no Windows do proprietário o
> projeto está em `C:\Users\Usuario\Desktop\contextflow2\` e a pasta
> `Continuidade de Projeto` fica **ao lado** dele, em `Desktop`. O que importa é
> a **relação** entre as pastas, não o prefixo.

## Ordem de leitura obrigatória

1. `docs/01-escopo-canonico.md` — decisões e limites V1/V2.
2. `docs/02-investigacao-e-reuso.md` — evidências do app original, comparadores, lacunas, E0.
3. `docs/03-arquitetura-e-contratos.md` — arquitetura, fronteiras de módulos, contratos.
4. `docs/04-plano-mestre.md` — fatias, gates, definição de concluído.
5. `docs/05-criterios-de-aceite.md` — matriz de cenários verificáveis.
6. `docs/estado-atual.md` — estado de retomada (branch, HEAD, o que foi feito, próximo passo).
7. `docs/06-continuidade-e-operacao.md` — governança documental e protocolo de sessão.
8. `docs/07-protocolo-continuidade.md` — protocolo vinculante para qualquer agente.
9. `docs/handoff-codex.md` — **transferência**: ambiente, comandos, o que está
   pendente e como provar que está pronto.

As SPECs de cada fatia estão em `docs/specs/` (`f1-esqueleto.md`,
`f2-persistencia.md`, `f3-ingestao.md`). Leia só a que interessa à sua fatia.

## Regra de execução

Fatias **verticais** com testes reais; corrigir falhas novas; registrar evidências e
commits próprios; atualizar `docs/estado-atual.md` ao fim de cada sessão; separar
aprovação técnica de aceite humano. Não inventar funcionalidades nem declarar
"100% pronto" sem evidência. Ao surgir decisão de produto/segurança/arquitetura não
resolvida, **parar somente a parte bloqueada** e pedir decisão objetiva.

## Autoridade e limites

- O **projeto original** (`contextflow/`, Python) é **somente leitura**: fornece regras
  e contratos a respeitar, nunca recebe alterações.
- Segredos e dados pessoais (chaves, bancos, cookies, `config/credentials.json` do
  original) **nunca** entram no Git nem em `Continuidade de Projeto/`.
- Alterar o escopo canônico exige aprovação do proprietário.
