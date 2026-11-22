# Arquitetura da interface

> Documento de apoio. O estado vigente fica em `estado-atual.md`; a especificação
> da reformulação em `specs/f5-ui-reformulacao.md`. Este arquivo explica **como**
> a interface está montada, para quem for mexer nela.

## Princípio

A interface **nunca é dona dos dados**. Ela pede ao motor e reconcilia o que
voltou. A F6 conecta geração individual/no lote à fila persistente, com estimativa
e confirmação antes de chamar IA. `resumos.js` coordena formulário em Configurações,
estimativa e histórico; Biblioteca e painel oferecem gerar, ler e copiar.
Segredos nunca são armazenados no navegador nem devolvidos pela API.
Preferências gerais e geração automática ao importar permanecem indisponíveis
com motivo explícito; a geração manual funciona pela confirmação de estimativa.

Sem framework, sem bundler, sem etapa de build no frontend: **JS puro em
módulos ES** servido pelo próprio motor, com CSS próprio. O motivo é o mesmo
desde a F1 — o aplicativo precisa funcionar **sem rede**, e qualquer coisa
vinda de CDN quebraria isso.

## Arquivos

```
platform/src/interface/publico/
├── index.html                  estrutura das 3 telas + 2 sobreposições
├── icone.svg
├── estilos/
│   └── principal.css           tema completo, sem importação externa
└── js/
    ├── aplicacao.js            entrada: navegação, importações, configurações
    ├── biblioteca.js           tabela virtualizada, seleção, lote, colunas
    ├── painel-leitura.js       painel sobreposto de leitura
    ├── arvore-organizacao.js   árvore lateral (Explorer)
    └── adicionar-link.js       janela de importação rápida
```

## Telas

| Tela | `data-tela-nome` | O que faz |
|---|---|---|
| Biblioteca | `biblioteca` | tabela virtualizada, filtros, colunas, árvore lateral, painel de leitura |
| Importações | `importacoes` | formulário de vídeo/playlist/lote, diagnóstico do yt-dlp, fila de trabalhos |
| Configurações | `configuracoes` | leitura das preferências do motor (sem expor segredos) |

A antiga tela `leitura` foi absorvida pela Biblioteca. `#leitura` na URL
redireciona para `#biblioteca` para não quebrar link salvo; não existe aba.

## Virtualização: a decisão mais importante

A Biblioteca desenha **apenas a janela visível** de linhas, com dois
espaçadores (`tr[data-espacador]`) que simulam o resto do scroll.

Três regras que precisam ser mantidas juntas, porque cada uma já causou defeito:

1. **Altura uniforme por modo.** Ampliado ajustável de 64 a 600 px (padrão
   136 px), compacto 64 px. Miniatura e quantidade visível de resumo acompanham
   o ajuste; a altura não varia por conteúdo nem por linha. Texto longo usa
   `-webkit-line-clamp` + botão "ver mais", nunca altura livre.

   A miniatura compara espaço lateral e empilhado, medindo altura natural do
   título/subtexto na largura real da coluna. Empilha somente se isso permitir
   imagem maior; respeita 16:9, padding e altura uniforme. Diminuir a linha pode
   restaurar o lateral; Compacto é lateral. Sem teto fixo de miniatura ou reserva
   fixa de 66 px. Leitura/escrita de medidas é agrupada por janela virtual;
   o estado temporário usado para medir o texto não é pintado.

2. **A altura vem do CSS, não de uma constante em JS.** O JS lê
   `--altura-linha` de `.aplicativo`. Uma cópia em JS já divergiu do CSS e fez a
   lista pular ao rolar — o virtualizador calculava a janela com o número errado.

3. **A janela é limitada por `itens.length`, não por `total`.** `total` é quantos
   registros a consulta tem; `itens` é o que já foi paginado para memória. Pedir
   índice acima de `itens.length` fazia a janela sair vazia.

A posição de scroll é capturada **no evento** e passada ao render. Lida dentro
do `requestAnimationFrame`, ela já pode ter avançado — outro defeito real que
apareceu na implementação.

Os espaçadores usam `colSpan` igual à quantidade de colunas visíveis. O seletor
fica em 46 px e uma coluna de leitura permanece flexível para absorver a sobra;
larguras e piso são recalculados ao mudar colunas ou redimensionar o viewport.
`redimensionamento-colunas.js` implementa as divisórias por ponteiro/teclado;
medidas manuais permanecem na Biblioteca e no objeto visual do localStorage.
Sem medidas manuais, as colunas de leitura absorvem a sobra. Com ambas
dimensionadas manualmente, respeita-se a soma das larguras, com rolagem interna.
Espaçadores têm altura explícita na linha e célula; uma âncora lógica atravessa
o reflow ao mover a barra deslizante, preservando o vídeo que estava no recorte.
`overflow-anchor: none` no viewport impede a ancoragem nativa de deslocar o
índice virtual durante a paginação. A Biblioteca usa toda a largura disponível,
inclusive acima de 1600 px; as demais telas preservam seu limite anterior.

O controle da lateral fica no topo da marca. Recolhida, seu alvo de 36×36 px
exibe a logo em repouso e ícone de expansão no hover/foco, com ativação nativa
por clique, teclado ou toque. A gaveta até 900 px continua independente.

### Resumo na linha

A rota de lista devolve `temResumo` (booleano), não o texto.
`calcularPrevias()` seleciona até 60 itens carregados com `temResumo` verdadeiro
e sem prévia em memória, fazendo **uma requisição por vídeo**, em paralelo.
Não existe endpoint de lote nem restrição estrita à janela visível nessa função.
O texto fica em memória na sessão.

## Painel de leitura

Abre **só** por ação explícita: `<button class="abrir-painel">` sobre a
miniatura. Selecionar a linha **nunca** abre o painel — isso é critério de
aceite e tem teste.

O painel carrega o vídeo (`/api/biblioteca/:id`), o resumo (`.../resumo`) e a
transcrição (`.../transcricao`) em paralelo. Ao fechar, não recarrega lista nem
toca em busca/filtros/ordenação — o contexto fica intacto porque o painel é uma
camada sobre a mesma página.

`Esc`, clique no fundo e o botão ✕ fecham. O foco volta ao elemento que abriu.
O foco fica preso dentro do painel enquanto ele está aberto.

## Árvore lateral

Quatro grupos, cada um alimentado por uma rota própria:

| Grupo | Rota | Ação ao selecionar |
|---|---|---|
| Canais | `GET /api/biblioteca/canais` | `canalId` na consulta |
| Playlists | `GET /api/biblioteca/playlists` | `playlistId` |
| Data de importação | `GET /api/biblioteca/meses` | `importadoDe`/`importadoAte` |
| Minhas coleções | `GET /api/colecoes` | `colecaoId` |

Todas usam os **mesmos filtros** que o painel de filtros. Não há segundo
mecanismo de filtragem: a árvore escreve no `<select>` correspondente e dispara
o mesmo `carregar()`.

Sem drag-and-drop — está fora por decisão, é trabalho futuro.

## Três coisas diferentes que costumam ser confundidas

| | O que muda | Onde fica |
|---|---|---|
| **Filtro** | quais vídeos aparecem | painel "Filtros" e árvore |
| **Ordenação** | em que ordem aparecem | cabeçalho da tabela (clicável) |
| **Coluna** | quais informações aparecem na linha | painel "Colunas" |

O painel de colunas diz isso em texto para não deixar dúvida. Filtro e
ordenação vão para o motor (a consulta muda); coluna é só aparência e fica em
`localStorage`.

## Preferências de visualização

| Chave | Onde | Por quê |
|---|---|---|
| `contextflow.biblioteca.ordem` | `sessionStorage` | ordem é da sessão, como antes da F5-UI |
| `contextflow.biblioteca.visual` | `localStorage` | colunas e modo sobrevivem ao fechar |
| `contextflow.biblioteca.barra` | `localStorage` | barra recolhida é preferência de espaço |
| `contextflow.arvore.aberto` | `localStorage` | grupos expandidos |

São preferência de apresentação por navegador, não dado do produto — por isso
não entram no banco. A F8 é quem trata preferências persistidas de verdade.

## Contrato com os testes

`testes/e2e/` depende de IDs e classes estáveis. A lista completa está na SPEC
(`specs/f5-ui-reformulacao.md` §7). Antes de renomear qualquer coisa, rode
`npm run test:e2e` — os 56 cenários são a rede de proteção.

## Acessibilidade

- Link "Pular para o conteúdo" no topo.
- Foco visível em tudo (`:focus-visible` com contorno azul).
- Painel e janela são `role="dialog"` com `aria-modal`, foco preso e `Esc`.
- A tabela expõe `aria-rowcount`, `aria-rowindex` e `aria-sort` nas colunas
  ordenáveis.
- Estados vazios e carregamento usam `role="status"` / `aria-live="polite"`.
- `prefers-reduced-motion` desliga animações.
