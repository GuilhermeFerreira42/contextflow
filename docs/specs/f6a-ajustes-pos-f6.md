# SPEC F6-A — Ajustes pós-F6 (interface e fluxos existentes)

> **Status:** implementado e validado nesta rodada (ver §11 — o que a execução
> corrigiu em relação ao plano). Autorizada pelo pedido
> `comando_codex_ajustes_pos_F6_ContextFlow.md` (22/11/2026).
> **Escopo fechado:** oito ajustes. Não é F7; não há funcionalidade de produto
> nova além do que já existe na F6. Arquitetura, banco (exceto uma tabela de
> metadados de miniatura), fila, contratos e telas são preservados.

## 0. Ponto de partida medido (não presumido)

| Verificação | Resultado |
|---|---|
| HEAD | `71b64b4` "feito fatia 6", `main` limpa |
| `npm test` | 198 testes (192 aprovados, 6 ignorados) |
| `npm run test:e2e` | 57/57 CDP |
| Playwright | `test:e2e:refinamentos` 9/9, `test:e2e:resumos` 7/7 |
| Biblioteca | virtualização com altura em variável CSS (`--altura-linha`), larguras por coluna arrastáveis |
| Preferências | `localStorage['contextflow.biblioteca.visual']` (modo/colunas/larguras) e `.altura` |
| Fila | estados `na-fila \| executando \| concluido \| falhou \| cancelado` |
| Exclusão de histórico | **não existe rota** — só `cancelar` e `repetir` |
| Miniatura | `miniatura_url` = URL remota do yt-dlp (`--skip-download`: nenhuma mídia é baixada) |
| Resumo | texto puro em `<p>`; o Markdown chega cru da IA |

## 1. Feedback de carregamento e processamento

**Problema medido.** `adicionar-link.js` desabilita o botão e escreve
"Enviando para a fila…", mas: (a) não há indicador no próprio botão; (b) ao
fechar a janela o usuário não vê que o trabalho continua; (c) a Biblioteca não
sinaliza que aquele vídeo está sendo processado; (d) a geração de resumo usa o
mesmo texto genérico.

**Decisão.** Um único componente de estado, reutilizado nas três telas:

- Botão de envio com spinner + rótulo de estado (`Enviando…`), `aria-busy`.
- Faixa de atividade na Biblioteca (`#atividade-biblioteca`) mostrando os
  trabalhos ativos: tipo, fase, estado e barra **indeterminada** quando o motor
  não informa progresso. Nunca inventar percentual.
- Importações: distinguir na lista "aguardando na fila" × "em execução" ×
  "concluído" × "falhou" × "cancelado", com progresso real quando existir.
- Resumos: o trabalho `gerar-resumo` aparece com o mesmo vocabulário, na
  Biblioteca e na linha do vídeo (selo "gerando…").
- Sucesso, erro, cancelamento e "tentar novamente" aproveitam `cancelar` e
  `repetir` que já existem.

## 2. Limpeza do histórico de Importações

**Investigação primeiro.** O domínio **não tem** estado "excluído": os cinco
estados são os acima. Não existe rota de remoção de histórico. Portanto:

- **Remover do histórico** (nova operação, escopo deste ajuste) apaga a
  *entrada de fila* (`trabalhos` + tentativas), nunca o vídeo, a transcrição, o
  resumo ou a mídia. Restrita a trabalhos **terminais** (`concluido`, `falhou`,
  `cancelado`); trabalho ativo é recusado com 409.
- Rota: `DELETE /api/trabalhos/historico` com filtro explícito
  (`{ estados: [...], anterioresA?: ISO, tipo? }`) e `GET /api/trabalhos/historico/resumo`
  devolvendo as contagens por categoria para a UI mostrar o que será afetado.
- **Cancelar** = interromper um trabalho ativo; o vídeo já importado fica.
- **Remover da Biblioteca** = apagar o vídeo e, por cascata do banco, suas
  transcrições/resumos/vínculos. É ação diferente, já existente, e continua na
  Biblioteca — não é limpeza de histórico.
- **Duplicados**: o banco deduplica por `youtube_id`, então não há vídeos
  repetidos. O que existe são *entradas de fila repetidas para o mesmo vídeo*
  (reimportações). A UI conta esses casos separadamente e os rotula como tal.
- Toda ação destrutiva pede confirmação com a contagem e o que **não** será
  apagado.
- Consistência após reiniciar: por ser exclusão no banco com transação, o
  estado é o mesmo depois de reiniciar (testado).

## 3. Persistência das preferências de leitura

**Problema.** `mostrarTempos` e `textoCorrido` só vivem no DOM: fechar o painel
já os perde, e recarregar perde tudo.

**Decisão.** Estender o objeto de preferências **existente**
(`contextflow.biblioteca.visual`), sem criar um segundo mecanismo:

```json
{ "modo": "...", "colunas": {...}, "larguras": {...},
  "leitura": { "mostrarTempos": true, "textoCorrido": false },
  "fonteResumo": 13 }
```

Padrões para quem não tem nada salvo: tempos **ligados**, texto corrido
**desligado**, fonte de resumo **13 px** — os mesmos de hoje. Compatível com
objetos antigos (campos ausentes usam o padrão).

## 4. Miniaturas

**Causa raiz medida.** O motor usa `--skip-download` e grava a URL remota do
yt-dlp. Quando o CDN do YouTube responde 403/expira, ou o vídeo é privado, a
imagem não carrega — não há cópia local. O fallback atual só disfarça.

**Decisão.** Buscar e guardar uma cópia local, servida pela própria origem:

- Tabela de metadados `miniaturas` (video_id, arquivo, content_type, origem,
  buscado_em, falha, tentativas). Migração nova, com backup (padrão já usado).
- Rota `GET /api/miniaturas/:videoId` → redireciona/serve o arquivo local; se
  não houver, devolve 404 e a UI usa o fallback discreto.
- Busca sob demanda, uma vez por vídeo, quando a UI pede a imagem e ainda não
  há cópia: `POST /api/miniaturas/:videoId/buscar`. Timeout curto, limite de
  tamanho, sem repetir em loop (tentativas contadas).
- `miniaturaUrl` na API passa a apontar para `/api/miniaturas/:id` quando há
  cópia local, preservando o campo. Sem distorção (a caixa já tem 16/9 e
  `object-fit: cover`), sem salto de layout e sem requisição repetida.

**Limite declarado:** sem rede (ou com o YouTube bloqueado), a miniatura real
não existe; a UI mostra o substituto. Não prometemos miniatura para todo vídeo.

## 5. Markdown nos resumos

**Decisão.** Renderizador próprio, mínimo e **seguro** (sem dependência nova):

- Suporta títulos (`#`…`######`), parágrafos, listas ordenadas e não
  ordenadas, ênfase (`*`/`**`), código inline e em bloco, citações (`>`),
  links e linhas horizontais.
- **Escapa tudo primeiro** e depois aplica a marcação: HTML no texto vira
  texto. Links só com `http`/`https`/`mailto`; `javascript:` é descartado.
  Sem `innerHTML` de conteúdo não processado.
- Tipografia no painel e na linha, respeitando `--fonte-resumo`.
- Copiar usa `textContent` (o texto original, não a marcação).

## 6. Tamanho da fonte do resumo

- Controle na própria Biblioteca (grupo de aparência, junto de Colunas),
  `A−` / `A+` e valor, de 11 a 20 px, padrão 13.
- Escreve `--fonte-resumo` no `.aplicativo`; o resumo da linha e o do painel
  leem a mesma variável. Não mexe na escala global da aplicação.
- Persiste em `fonteResumo` do objeto de preferências (item 3).
- A linha do resumo já usa `line-clamp` calculado pela altura: ao mudar a
  fonte, o cálculo é refeito para não estourar a altura virtual.

## 7. Organização dos controles da Biblioteca

**Problema medido.** A faixa tem 11 botões + seletor numa linha só.

**Decisão — hierarquia, sem remover nada:**

| Grupo | Conteúdo | Apresentação |
|---|---|---|
| Principal | `Adicionar link` | primário, no topo |
| Seleção | `Selecionar visíveis`, contador | aparece com a lista |
| Ações de lote | Reimportar, Gerar resumos, Remover, coleção | **só aparece com seleção ativa**; agrupadas |
| Aparência | Colunas, fonte, modo | agrupadas à direita |
| Secundário raro | `Nova coleção` | menu "Mais" |

Nenhum botão é removido. Estados desabilitados e rótulos são preservados; a
ordem de tabulação segue a visual.

## 8. Miniatura adaptativa conforme a altura da linha

**Problema medido.** `.miniatura` usa `width: clamp(64px, (altura−24)×1,24, 420px)`
e `max-width: 55%`. Com o título ao lado, o espaço horizontal é o limite: acima
de certa altura a imagem para de crescer e a linha fica com vazio vertical.

**Decisão — alternância por *container query*, não por número mágico:**

- A célula `.celula-video` vira container (`container-type: size`).
- **Lado a lado** enquanto `larguraDesejada + respiro + texto mínimo` couber
  na largura real da coluna, onde `larguraDesejada = (altura − 24) × 1,24`
  limitada a 55% da coluna.
- Abaixo disso, **empilhado**: miniatura em cima (limitada pela largura da
  coluna), título abaixo.
- O limite é derivado das medidas reais — se o usuário arrastar a coluna, a
  alternância acompanha. Voltar a altura reduz para o lado a lado
  automaticamente.
- Avaliei `@container` primeiro e **descartei**: `@container` não pode estilizar
  o próprio container, e um breakpoint fixo em px violaria o pedido de derivar
  o limite das dimensões reais.
- Proporção preservada (`aspect-ratio: 16/9` + `object-fit: cover`); nenhuma
  largura fixa; as demais colunas não se movem (a altura da linha não muda).

## 9. Plano de validação

Em `platform/`: `npm test`, `npm run test:e2e`, `npm run test:e2e:refinamentos`,
`npm run test:e2e:resumos`, `npm run verificar`, `npm run build` — todos
repetidos **depois** das mudanças.

Suíte Playwright nova (`testes/e2e/pos-f6.mjs`) com dados descartáveis:

| Grupo | Cobre |
|---|---|
| Carregamento | estados do envio, faixa de atividade, fila × execução, resumo em andamento |
| Limpeza | contagem por categoria, confirmação, recusa de ativo, persistência após reinício |
| Preferências | 4 combinações de transcrição sobrevivem a fechar/reabrir e a recarregar; fonte sobrevive |
| Miniaturas | com cópia local, sem cópia, com falha; sem requisição repetida |
| Markdown | títulos, listas, ênfase, código, citação, link e **HTML/script não executam** |
| Fonte | limites, padrão, persistência, sem estourar a linha |
| Controles | todos os botões continuam alcançáveis; lote só com seleção |
| Miniatura adaptativa | 3 alturas × 3 larguras de coluna, título longo e curto, com e sem imagem |

Mais capturas de evidência em `../Continuidade de Projeto/pos-f6/`.

## 10. O que a execução corrigiu em relação ao plano

Três decisões do plano não sobreviveram à medição no navegador real. Registro
aqui para não serem reintroduzidas por engano:

1. **Alternância por `@container`** — inviável (a regra não se aplica ao próprio
   container). Trocado por cálculo em JS com medidas reais.
2. **Critério extra "altura ≥ 300 empilha"** — empilhava cedo demais: com
   180 px de altura numa coluna de 392 px ainda havia espaço confortável ao
   lado. Removido; sobrou só a conta de espaço.
3. **Texto mínimo de 190 px** — no limite exato (396 > 392), disparava a
   alternância com 180 px. Ajustado para 170 px, medido como o ponto em que o
   título ainda quebra bem.

Também foi corrigido um defeito encontrado pela própria suíte:

- `max-height` em `table-cell` **não tem efeito**. Com fonte 20 px a célula do
  resumo crescia para 146 px numa linha de 136 px. O limite passou para o bloco
  interno (`> .celula-video-texto-resumo`).
- Salvar a fonte apagava as preferências de transcrição (cada módulo gravava o
  objeto inteiro). O módulo de preferências agora **mescla**.
- `Number(null)` é `0`: um `fonteResumo: null` gravado por engano virava 11 px
  em vez do padrão. A leitura exige `typeof === 'number'`.
- Depois de limpar o histórico, a recarga das categorias sobrescrevia a
  mensagem de sucesso por "Nenhum registro selecionado". Corrigido com
  `manterAviso`.

## 11. Correção depois do teste do proprietário (22/11, mesmo dia)

O print do proprietário mostrou que o item 8 **não estava realmente resolvido**:
com a linha muito alta e a coluna de vídeo larga, a miniatura parava num
tamanho fixo, sobrava vazio embaixo e o título continuava ao lado.

**Causa (duas travas somadas):**

1. `width: clamp(64px, (altura−24)×1,24, 420px)` — teto fixo de **420 px**.
2. `max-width: 55%` — em coluna de 690 px, a imagem parava em **380 px**.

E o cálculo do modo lateral comparava `min(desejada, 55%) + gap + texto` com a
largura da coluna: como `55% + 170` sempre cabia, o modo empilhado **nunca era
alcançado** em coluna larga.

**Correção:** o CSS deixa de impor teto e passa a consumir `--miniatura-largura`
escrita pelo JS. O JS decide por espaço real:

```
sobraVertical    = altura − 24
larguraPelaAltura = sobraVertical × 16/9
espacoLateral    = larguraColuna − gap − textoMínimo
lateral   se larguraPelaAltura ≤ espacoLateral
empilhado caso contrário, com largura limitada por (altura − 66) × 16/9
```

**Matriz medida no app (coluna × altura):**

| Coluna | 64 | 136 | 220 | 300 | 420 | 600 |
|---|---|---|---|---|---|---|
| auto (758) | 71×40 L | 199×112 L | 348×196 L | 491×276 L | 629×354 E | 758×426 E |
| 700 (678) | 71×40 L | 199×112 L | 348×196 L | 491×276 L | 629×354 E | 678×381 E |
| 380 (358) | 71×40 L | 124×70 E | 274×154 E | 358×201 E | 358×201 E | 358×201 E |

(L = lateral, E = empilhado). Razão 16:9 em todas; nenhuma imagem ultrapassa a
coluna; título abaixo sempre que empilhado.

**Prova de que o teste pega a regressão:** reintroduzindo a lógica antiga no JS,
o cenário novo falha exatamente nos quatro sintomas relatados (`veio lateral`,
`374px` de largura, `210px` de altura, título ao lado). Com a correção, passa.
O teste Playwright subiu de 12 para **13 cenários**.

**Limite conhecido:** quando o resumo (coluna à direita) é longo, o texto dita a
altura da linha e sobra ~48 px abaixo da imagem. É o `max-height` do bloco de
texto, não um teto da imagem — e a imagem continua proporcional.

## 12. O que não entra

F7, chat/RAG, geração automática ao importar, troca de provedor, redesenho de
telas, alteração do original Python, nova dependência de produção.
