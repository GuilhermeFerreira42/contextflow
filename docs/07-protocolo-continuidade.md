# Protocolo de Continuidade de Projeto (ContextFlow)

> Documento operacional para **qualquer agente ou sessão** que trabalhe neste projeto.
> Consolida as três skills do usuário — *Investigar → Especificar → Entregar*,
> *Execução autônoma por fatias* e *Memória de projeto* — aplicadas a este repositório.
> Nome amigável: **Continuidade de Projeto**. Não substitui as skills originais; é a
> versão que aponta para os arquivos reais daqui.

---

## 1. Ao abrir uma sessão (obrigatório, nesta ordem)

1. Ler `docs/00-comece-aqui.md` → `docs/01-escopo-canonico.md` → `docs/estado-atual.md`.
2. Conferir o estado real: `git -C /home/user/contextflow2 status --short --branch`,
   `git log --oneline -5`, e se `platform/` sofreu alterações locais.
3. Se código e documentação divergirem, **investigar antes de agir** e corrigir o registro
   com os fatos confirmados. Preservar alterações locais do usuário.
4. Identificar: última fatia concluída, homologação pendente, bloqueios, próxima ação
   autorizada.
5. Ler **apenas** a SPEC e os arquivos de código relevantes para a fatia.

## 2. Regras permanentes

| # | Regra |
|---|---|
| 1 | **Autorização escalonada.** Discussão ≠ leitura ≠ SPEC ≠ implementação ≠ publicação. Implementar exige pedido explícito para aquele escopo. |
| 2 | **O original é sagrado.** `/home/user/contextflow` (Python) nunca é alterado, movido ou deletado. É referência. |
| 3 | **Nada de segredo no Git.** Chaves, tokens, bancos pessoais, cookies e `config/credentials.json` do original nunca são copiados. |
| 4 | **Fato ≠ hipótese ≠ proposta ≠ decisão.** Classificar cada afirmação; relatório antigo não é prova de execução atual. |
| 5 | **Fonte única de verdade por dado.** Não criar mecanismo paralelo, cache duplicado ou segundo catálogo. |
| 6 | **Sem shell injection.** yt-dlp sempre via `spawn` com array de argumentos e `shell: false`. |
| 7 | **Não declarar pronto sem evidência.** Teste verde isolado ou tela bonita não são entrega. |
| 8 | **Parar só a parte bloqueada.** Decisão de produto/segurança/arquitetura não resolvida ⇒ pergunta objetiva com recomendação, não improviso. |
| 9 | **Memória do agente ≠ funcionalidade do produto.** Anotações de continuidade não viram requisito. |
| 10 | **Pesquisa tem gate.** Investigar até a decisão ficar possível; não até esgotar a bibliografia. |

## 3. Ciclo de uma fatia

```
SPEC mínima  →  implementação  →  teste real  →  correção  →  commit  →  estado atualizado
```

**SPEC mínima** (em `docs/specs/f<N>-<nome>.md`) contém, proporcionalmente ao trabalho:

- objetivo, motivação, escopo e **exclusões**;
- estado atual validado e o que será reutilizado;
- fluxos, entradas/saídas, estados e transições, **dono de cada dado**;
- erros, limites, concorrência, cancelamento, persistência quando pertinente;
- compatibilidade, migração e **rollback** se tocar dados;
- matriz de aceite: **cenário → ação → resultado observável → teste/evidência**;
- riscos e decisões pendentes.

**Teste real** (não simulado):

1. Reproduzir pelo fluxo normal; para UI web, **navegador real**. O projeto usa
   CDP direto (`testes/e2e/executar.mjs`), não Playwright.
2. Provar efeito colateral: arquivo em disco, persistência após reabrir, resposta HTTP.
3. Testar o caminho de falha correspondente (rede cai, sem legenda, chave inválida).
4. Registrar por cenário: `aprovado / falhou / ignorado / não executado`.

**Commit próprio**, com escopo conferido e mensagem que diz o que foi validado.

## 4. Ao encerrar uma sessão (handoff)

Atualizar `docs/estado-atual.md` com:

- **Onde estamos:** objetivo, fatia, gate, branch e HEAD.
- **O que foi verificado:** achados + caminho das evidências, separando fato de hipótese.
- **O que foi decidido:** decisão, motivo, consequência.
- **O que mudou:** arquivos e commits.
- **O que falta:** bloqueios e aceite pendente.
- **Próxima ação autorizada:** primeira ação executável e seu limite.

Evidência volumosa (capturas, logs, saídas brutas) vai para
`/home/user/Continuidade de Projeto/` e é **referenciada** no estado por nome,
o que demonstra, revisão e como encontrar — nunca embutida no Git.

## 5. Estrutura de pastas (invariante)

```
/home/user/contextflow/        → projeto original Python — SOMENTE LEITURA
/home/user/contextflow2/       → repositório Git (docs/ + platform/)
/home/user/Continuidade de Projeto/ → operacional, FORA do Git
```

Nada de código em `docs/`. Nada de documentação canônica em `platform/`.
Novo arquivo de configuração/build/teste do executável vai em `platform/`.

## 6. Antipadrões proibidos

- Pesquisa infinita; documentação maior que o problema.
- Inventar fatos, testes, homologação, licenças ou funcionalidades.
- Confundir aprovação de proposta com autorização de implementação.
- Esconder erro com texto de interface, fallback silencioso ou mock.
- Mostrar controle funcional sem backend real.
- Reabrir decisão fechada sem evidência nova.
- Declarar "100% pronto" sem matriz de aceite executada e aceite humano.
