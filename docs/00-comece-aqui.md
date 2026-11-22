# ContextFlow V1 — entrada única para agente executor

**Status**: V1 em implementação. **F1 e F2 homologadas**; **F3 validada no Windows
com YouTube real** (19/11/2026; aceite humano e ressalvas no estado atual).
**F4 e F5 implementadas e testadas**; **F5-UI (reformulação da interface)
implementada e testada, homologação humana pendente**; **F6 implementada e testada
com provedores HTTP controlados no Windows**; homologação com provedor real pendente.
Base documental: pacote `ContextFlow_Pacote_Execucao_V1` (2026-11-18). Estado vivo em
`docs/estado-atual.md`.

**Rodadas recentes (22/11/2026):** entrega pós-F6 da Arena incorporada em
`5dbb7e0`/`76e57d1`; correção da miniatura/título conforme
`docs/specs/f6a-miniatura-adaptativa.md`, validada no Windows. Os outros sete
ajustes foram preservados. F7 não iniciada; resultados atuais no estado.
Depois, recuperada a capa do vídeo relatado (URL localizada404, JPEG padrão
disponível), com alternativas automáticas/cache e tentativa manual conforme
`docs/specs/f6a-recuperacao-miniaturas.md`. Prova real e testes no estado vigente.

**Direção vigente (21/11/2026):** após trazer a entrega da Arena, o proprietário
autorizou o Codex a implementar os refinamentos de alinhamento, leitura ampliada
e controle da lateral no topo. Resultados e evidências em `docs/estado-atual.md`;
SPEC em `docs/specs/f5-ui-refinamentos-leitura.md`. Homologação humana pendente.
Na rodada seguinte, o proprietário solicitou altura por barra deslizante e
larguras arrastáveis; implementadas conforme `docs/specs/f5-ui-dimensoes-grade.md`.
Em 22/11/2026, o pedido de comitar e avançar à próxima fatia autorizou a F6.
SPEC fechada antes da implementação: `docs/specs/f6-resumos.md`. Essa autorização
substitui a restrição anterior sobre F6; não autoriza iniciar F7/F8 nesta rodada.

**Se você é um agente chegando agora (Codex ou outro):** leia
`docs/handoff-codex.md` primeiro — ele diz o que verificar, em que ordem, e o
que **não** fazer sem autorização.

## Objetivo

Construir **ContextFlow V1**: aplicativo **local** multiplataforma (Windows/Linux),
**motor (backend) Node.js + TypeScript** com **interface web local**, contendo
Biblioteca, Importações e Configurações. A leitura acontece **na própria
Biblioteca** — na linha e num painel sobreposto —, não numa tela separada.
Vídeos do YouTube, metadados,
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
> projeto está em `C:\Users\Usuario\Desktop\projeto\contextflow2\` e a pasta
> `Continuidade de Projeto` fica **ao lado** dele, em `Desktop/projeto`. O que importa é
> a **relação** entre as pastas, não o prefixo.

## Ordem de leitura obrigatória

1. `docs/01-escopo-canonico.md` — decisões e limites V1/V2.
2. `docs/02-investigacao-e-reuso.md` — evidências do app original, comparadores, lacunas, E0.
3. `docs/03-arquitetura-e-contratos.md` — arquitetura, fronteiras de módulos, contratos.
4. `docs/04-plano-mestre.md` — fatias, gates, definição de concluído.
5. `docs/05-criterios-de-aceite.md` — matriz de cenários verificáveis.
6. `docs/06b-arquitetura-da-interface.md` — como a interface está montada (virtualização, painel, árvore).
7. `docs/estado-atual.md` — estado de retomada (branch, HEAD, o que foi feito, próximo passo).
8. `docs/06-continuidade-e-operacao.md` — governança documental e protocolo de sessão.
9. `docs/07-protocolo-continuidade.md` — protocolo vinculante para qualquer agente.
10. `docs/handoff-codex.md` — **transferência**: ambiente, comandos, o que está
   pendente e como provar que está pronto.

As SPECs de cada fatia estão em `docs/specs/` (`f1-esqueleto.md`,
`f2-persistencia.md`, `f3-ingestao.md`, `f4-trabalhos.md`). Leia só a que interessa à sua fatia.

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
