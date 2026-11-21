# SPEC F5-UI — Reformulação da interface (Biblioteca centrada)

> **Status:** aprovada para implementação pelo proprietário (21/11/2026).
> Substitui a versão anterior deste arquivo, escrita pelo Codex **sem
> implementação correspondente** e a partir de um HTML que quebrava a interface.
> Referências visuais: `docs/mockups/` (ver §2).

## 0. Ponto de partida verificado (21/11/2026)

Antes de qualquer decisão, o estado real foi medido — não presumido:

| Verificação | Resultado |
|---|---|
| HEAD do repositório | `d796135` — F4 e F5 (Biblioteca: virtualização, filtros, seleção, lote, coleções, migração 003) commitadas |
| `npm test` | **178/178** |
| `npm run test:e2e` | **46/46** |
| Backend | completo para esta etapa: 19 rotas, incluindo lote, coleções, playlist e trabalhos |
| Interface | funcional, mas **visualmente distante** dos mockups |

**Incidente encontrado e descartado:** o Codex havia editado `index.html` (não
commitado) removendo 24 elementos que o JS consome — `#biblioteca-viewport`,
`#sentinela-biblioteca`, `#formulario-importacao`, `#url-video`,
`#limpar-filtros`, `#remover-selecao`, `#formulario-colecao`, entre outros — e
removido a linha `<script type="module" src="/js/aplicacao.js">`. Resultado
medido: **5/27 cenários E2E**, interface sem nenhum comportamento. Também havia
um script inline de depuração esquecido (`window.__CF_INLINE_EXECUTADO`).

Essas alterações foram descartadas (`git checkout -- .`) e a árvore voltou a
178/178 e 46/46. A versão quebrada está preservada fora do Git, para referência
do que **não** repetir.

### O que existe hoje e será preservado

- `platform/src/interface/publico/index.html` — 4 telas, 38 IDs
- `.../js/aplicacao.js` — status do motor, navegação, importação, trabalhos, leitura, configurações
- `.../js/biblioteca.js` — virtualização por janela de linhas (altura 48 px), seleção por ID, ações em lote, coleções, ordenação persistida em `sessionStorage`
- `.../estilos/principal.css` — tema grafite + azul, 1050 linhas
- **Contrato de testes:** o E2E depende de IDs e classes estáveis (§7). Renomear
  qualquer um deles quebra regressão já homologada.

## 1. Objetivo

Reposicionar a interface em torno da **Biblioteca como área de trabalho**:
linhas ampliadas com miniatura e leitura de resumo direto na linha, colunas
configuráveis, painel sobreposto de leitura, árvore lateral de organização e
janela "Adicionar link". Aparência conforme os mockups.

**Isto é reformulação de interface.** Não reescreve o motor, não altera
contratos entre módulos, não muda o schema (exceto uma migração aditiva
justificada em §8) e não antecipa a F6.

## 2. Referências visuais

| Arquivo | O que fixa |
|---|---|
| `docs/mockups/biblioteca-lista.png` (+ `.html`) | layout de duas colunas: miniatura grande à esquerda, resumo com timestamps à direita; sidebar com árvore "Organizar por"; topbar com busca, Filtros, Adicionar link |
| `docs/mockups/biblioteca-planilha.png` (+ `.html`) | planilha densa: miniatura pequena com duração sobreposta, título, canal, duração, estado da transcrição em pílula, resumo truncado com reticências |

**Os dois são complementares**, conforme a mensagem do proprietário: a
*planilha* define a estrutura de colunas e a densidade de informação da linha;
*a lista* define a experiência de leitura ampliada.

**Decisão de composição:** a Biblioteca terá **um modo de linha ampliada** com
miniatura (≈168×94 px) + bloco de texto com resumo e timestamps, e **colunas
configuráveis** em torno disso (canal, duração, estado, resumo, data). O modo
denso da planilha é obtido **ocultando colunas e reduzindo a miniatura** pela
mesma configuração de colunas — não por dois componentes distintos. Isso evita
dois caminhos de renderização e preserva a virtualização existente.

> **Nota técnica:** os HTML dos mockups usam **Tailwind via CDN**. O ambiente de
> desenvolvimento não alcança o CDN e a aplicação **não pode** depender de rede.
> Portanto o tema é implementado em CSS próprio (`principal.css`), usando o
> mockup como referência de medidas, cores e hierarquia — não como código a
> importar. As capturas PNG foram geradas compilando o Tailwind localmente.

## 3. Escopo

### Entra

1. **Layout geral** — sidebar de navegação + árvore, topbar com ações, área central.
2. **Biblioteca com linhas ampliadas** — miniatura, título, canal, duração, data, estado, resumo.
3. **Colunas configuráveis** — escolher quais informações aparecem; persistir a escolha.
4. **Pesquisa, filtros e ordenação** — preservar os existentes; ordenação clicável no cabeçalho; diferenciação explícita entre coluna, filtro e ordenação.
5. **Leitura na linha** — resumo e trechos de transcrição com tempo, com altura limitada e expansão sob demanda (não linhas ilimitadas).
6. **Painel sobreposto** — abre por botão dedicado, sem sair da Biblioteca; título, miniatura, canal, link original, transcrição completa com timestamps, resumo, coleções e estado. Fecha devolvendo o contexto.
7. **Árvore lateral (Explorer)** — grupos: Canais, Playlists, Data de importação, Minhas coleções; expandir/recolher; selecionar filtra a Biblioteca; sidebar recolhível.
8. **Janela "Adicionar link"** — URL de vídeo ou playlist, integrada à importação existente; encaminha para `/api/ingestao/importar` ou `/api/ingestao/lote`; resultado aparece em Importações.
9. **Importações e Configurações** — mantidas, com a nova identidade visual.
10. **Acessibilidade e teclado** — foco visível, Esc fecha painel/janela, árvore navegável.

### Não entra

- Drag-and-drop entre grupos/coleções (futuro explícito na mensagem).
- Geração de resumos por IA (F6). O botão de resumo aparece **desabilitado com
  motivo** enquanto o módulo estiver `pendente`.
- Autenticação, multiusuário, exportação.
- Troca de framework, bundler ou etapa de build no frontend.

## 4. Arquitetura da interface

Mantém o padrão atual: **JS puro em módulos ES**, servido pelo motor, sem build.

```
index.html
├── .aplicativo (grid: sidebar | conteúdo)
│   ├── aside.barra-lateral
│   │   ├── .marca            (+ botão recolher)
│   │   ├── nav .navegacao    (Biblioteca, Importações, Configurações)
│   │   └── .arvore-organizacao  ← novo: Explorer
│   └── main.conteudo
│       ├── section[data-tela-nome=biblioteca]
│       │   ├── header: título, contador, busca, Filtros, Adicionar link
│       │   ├── .tabela-envoltorio#biblioteca-viewport  ← virtualização existente
│       │   └── diálogos existentes (remoção, nova coleção)
│       ├── section[data-tela-nome=importacoes]
│       └── section[data-tela-nome=configuracoes]
├── #painel-leitura   ← novo: overlay estilo Trello
└── #dialogo-adicionar-link  ← novo: janela de importação
```

A tela **Leitura** deixa de existir como aba própria: sua função é absorvida
pela leitura na linha e pelo painel sobreposto. A rota `#leitura` redireciona
para `#biblioteca` com o painel do primeiro item, para não quebrar link salvo.
*(Justificativa: a mensagem define três telas principais — Biblioteca,
Importações, Configurações — e declara a leitura na Biblioteca como comportamento
principal.)*

### Virtualização: como continua funcionando com linha de altura variável

O `biblioteca.js` atual usa **altura fixa de 48 px** e espaçadores para simular
o scroll. Linha ampliada com resumo tem altura variável, o que quebraria essa
conta.

**Solução adotada (sem reescrever a virtualização):** altura de linha **fixa por
modo**, escolhida pelo usuário e conhecida antes de desenhar:

| Modo | Altura | Miniatura | Resumo |
|---|---|---|---|
| Ampliado (padrão) | 168 px | 168×94 | até 5 linhas + "ver mais" |
| Compacto | 72 px | 96×54 | 1 linha com reticências |

A altura é uma constante do modo, então a janela de linhas continua sendo
aritmética simples — a mesma técnica de hoje, com outro número. Textos longos
usam **limite de linhas + expansão por linha**, nunca altura livre.

## 5. Contratos afetados

**Nenhum contrato de módulo muda.** A interface consome o que já existe:

| Necessidade | Rota existente |
|---|---|
| Lista paginada com filtros e ordenação | `GET /api/biblioteca?busca&estado&canalId&colecaoId&playlistId&temResumo&ordenacao&ordenacaoDirecao&cursor&limite` |
| Canais para a árvore | `GET /api/biblioteca/canais` |
| Playlists para a árvore | `GET /api/biblioteca/playlists` |
| Coleções para a árvore | `GET /api/colecoes` |
| Detalhe do vídeo | `GET /api/biblioteca/:id` |
| Transcrição com tempos | `GET /api/biblioteca/:id/transcricao` |
| Importar vídeo | `POST /api/ingestao/importar` |
| Importar lote | `POST /api/ingestao/lote` |
| Trabalhos da fila | `GET /api/trabalhos` |
| Ações em lote | `POST /api/biblioteca/lote` |

### Adição necessária: resumo do vídeo

O painel e a linha precisam **exibir** resumo. Hoje o contrato só expõe
`temResumo: boolean`; o texto do resumo vive na tabela `resumos` (criada na F2,
sem consumidor ainda).

**Adição mínima:** `GET /api/biblioteca/:id/resumo` devolvendo
`{ estado, texto, provedor, modelo, atualizadoEm }` ou `404` quando não houver.
Leitura pura, sem geração — a F6 é quem escreve. Sem isso o resumo na linha
seria um campo vazio permanente.

## 6. Erros e estados vazios

| Situação | Comportamento |
|---|---|
| Biblioteca vazia | mensagem explícita com caminho para Importações (mantido) |
| Sem legenda no vídeo | painel mostra "sem transcrição" com o motivo persistido, não um vazio mudo |
| Resumo pendente (F6) | botão desabilitado com motivo visível |
| Falha ao carregar transcrição | mensagem na área, sem derrubar o painel |
| Importação inválida | validação local de URL antes de enviar; erro do motor exibido |

## 7. Contrato de testes (não quebrar)

O E2E atual depende destes seletores. **Todos continuam existindo**, mesmo que a
aparência mude:

`#busca` `#contador` `#contador-selecao` `#biblioteca-viewport` `#corpo-biblioteca`
`tr[data-id]` `tr[data-id] .titulo-video` `#vazio-biblioteca` `#selecao-visivel`
`#selecionar-visiveis` `#limpar-selecao` `#reimportar-selecao` `#remover-selecao`
`#colecao-destino` `#adicionar-colecao` `#desvincular-colecao` `#nova-colecao`
`#criar-colecao` `#formulario-colecao` `#nome-colecao` `#cancelar-colecao`
`#confirmar-remocao` `#descricao-remocao` `#cancelar-remocao`
`#confirmar-remocao-botao` `#filtro-estado` `#filtro-canal` `#filtro-playlist`
`#filtro-colecao` `#filtro-resumo` `#limpar-filtros` `#resultado-biblioteca`
`#formulario-importacao` `#tipo-importacao` `#url-video` `#botao-importar`
`#resultado-validacao` `#diagnostico-texto` `#lista-config dt` `th[data-ordenacao]`
`[data-aba]` `[data-tela-nome]` `.aplicativo` `.status-texto` `.marca-simbolo`
`.vazio-texto` `.trabalho[data-id]`

Se um seletor precisar mudar, o teste muda **no mesmo commit**, com justificativa
na mensagem.

## 8. Dados

Sem migração nesta etapa, exceto se necessário para colunas:
a preferência de colunas e o modo de linha cabem em `sessionStorage`/`localStorage`
do navegador — não são dado do produto e não entram no banco. Justificativa:
são preferência de visualização por dispositivo, não conteúdo do usuário; a
F8 é quem trata preferências persistidas de verdade.

## 9. Critérios de aceite

| # | Critério | Verificação |
|---|---|---|
| U1 | Biblioteca abre com linhas ampliadas, miniatura e resumo legível | E2E + captura |
| U2 | Colunas podem ser ocultadas/exibidas e a escolha persiste ao navegar | E2E novo |
| U3 | Modo compacto reduz altura e miniatura pela mesma configuração | E2E novo |
| U4 | Ordenação por título, canal e data funciona pelo cabeçalho | E2E existente + novo |
| U5 | Filtros de estado, canal, playlist, coleção e "com resumo" continuam funcionando | E2E existente |
| U6 | Botão de leitura abre o painel sobreposto com dados completos | E2E novo |
| U7 | Fechar o painel devolve à Biblioteca com busca, filtros, ordenação e scroll preservados | E2E novo |
| U8 | Árvore lista canais, playlists, datas e coleções; expandir/recolher funciona | E2E novo |
| U9 | Selecionar nó da árvore filtra a Biblioteca usando as rotas existentes | E2E novo |
| U10 | Sidebar recolhe e a Biblioteca ocupa a largura liberada | E2E novo |
| U11 | "Adicionar link" valida URL local e envia para `/api/ingestao/importar` | E2E novo |
| U12 | Importação feita pela janela aparece em Importações com progresso real | E2E novo |
| U13 | Importações e Configurações mantêm todos os recursos atuais | E2E existente |
| U14 | Seleção, ações em lote e coleções continuam funcionando | E2E existente |
| U15 | Nenhuma regressão: suíte atual (178) e E2E atual (46) verdes | `npm test` + `npm run test:e2e` |
| U16 | Sem erro de script no console em nenhuma das telas | E2E |

**Homologação humana permanece pendente** até avaliação visual do proprietário.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Virtualização com altura variável | altura fixa por modo (§4) |
| Perder seletores do E2E | lista fechada em §7; testes rodam a cada etapa |
| Resumo não existir (F6 pendente) | rota de leitura + estado explícito "sem resumo" |
| Excesso de requisições na árvore | uma chamada por grupo, cacheada em memória na sessão |
| Repetir o incidente do Codex | `npm test` + `npm run test:e2e` a cada passo, não só no fim |

## 11. Processo

Implementação em etapas verificáveis, cada uma com testes verdes antes da
seguinte:

1. Esqueleto visual + tema (sem tirar comportamento de lugar)
2. Biblioteca: linha ampliada, colunas, modo compacto
3. Painel sobreposto
4. Árvore lateral + recolher sidebar
5. Adicionar link
6. Importações e Configurações com a nova identidade
7. Varredura de regressão e documentação

## 12. Definição de concluído

- U1–U16 verificados com evidência executada.
- `npm test` e `npm run test:e2e` verdes, com contagem relatada.
- `npm run build` e `npm run verificar` OK.
- `docs/estado-atual.md` atualizado; capturas em `docs/mockups/evidencia/`.
- Um commit por etapa, mensagem dizendo o que foi validado.
- Homologação humana explicitamente pendente.
