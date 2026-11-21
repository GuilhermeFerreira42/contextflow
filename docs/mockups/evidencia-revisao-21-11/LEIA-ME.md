# Evidência visual — revisão da interface de 21/11/2026

Capturas do Chrome real (Playwright) contra a base local com 6 vídeos,
4 resumos e 1 coleção ("Fundamentos"). **Não são montagens**: é a tela
rodando, dirigida por script.

Estas capturas são do estado **posterior** às correções `c5fa1a9`,
`d22750a`, `de13751` e `5df05bc`. Elas não mostram os defeitos que
motivaram a revisão — para esses, ver a seção "antes → depois".

## O que cada captura prova

| Arquivo | O que demonstra |
|---|---|
| `01-biblioteca.png` | Biblioteca, modo ampliado, barra expandida: 7 colunas alinhadas |
| `02-filtros-abertos.png` | Painel de filtros aberto sobre a lista |
| `03-busca-ativa.png` | Busca com resultado único e o botão de limpar visível |
| `04-limpo.png` | Estado depois de limpar: lista completa restaurada |
| `05-colunas.png` | Painel de colunas: 5 opções, as que existem de fato |
| `06-selecionado.png` | Seleção de lote: só as ações possíveis ficam habilitadas |
| `07-painel-leitura.png` | Painel de leitura com o resumo inteiro |
| `08-compacto.png` | Modo compacto: título em duas linhas, miniatura visível |
| `09-configuracoes.png` | Configurações com valores reais |
| `09-importacoes.png` | Importações com estado vazio orientando o próximo passo |
| `10-adicionar-link.png` | Janela "Adicionar link" |
| `11-nova-colecao.png` | Criação de coleção |
| `12-barra-recolhida.png` | Barra recolhida: conteúdo usa o espaço liberado |
| `13-arvore.png` | Árvore de organização com contagens por nó |
| `14-tablet.png` | 1024 px: layout intermediário, sem transbordo |
| `15-estreito.png` | 768 px: tabela rola na horizontal, sombra indica o corte |
| `16-mobile.png` | 390 px: conteúdo na largura toda, gaveta fechada |
| `18-final.png` | Estado final da revisão em tela cheia |
| `20-880px-gaveta-corrigida.png` | **A prova do defeito crítico**: 880 px com a barra marcada como recolhida. Antes desta correção o conteúdo ficava numa tira de 56 px; aqui ele ocupa a largura inteira. |
| `99-estado-atual.png` | Estado no fechamento da rodada |

## Antes → depois

As capturas do estado com defeito ficam **fora do repositório**, em
`Arquivo/auditoria-historico/` e `Arquivo/_capturas-antes-da-revisao/`.
Elas existem como prova de que o defeito era real e foi reproduzido, não
como estado atual do produto.

| Defeito | Prova de antes | Correção |
|---|---|---|
| Conteúdo numa tira de ~56 px ao abrir | `combo.png` | `d22750a`, `de13751` |
| Correção que não chegava por cache | `preview-1366.png` | `de13751` (`no-store` + `?v=`) |
| Duas colunas de situação, uma sem título | `mistura.png` | `5df05bc` |
| Selo "Pronto" duplicado na linha | `f1.png`, `_capturas-antes-da-revisao/` | `c5fa1a9` |
| Coluna "Transcrição" e ids crus do YouTube | `f1.png` | `c5fa1a9` |

## Como reconferir

A partir de `platform/`, com o app no ar (`npm run dev`):

```bash
npm test           # 183/183
npm run test:e2e   # 63/63
```

O cenário E2E "Mobile: barra recolhida salva não espreme o conteúdo ao
abrir" é o que protege a correção crítica: ele força a barra recolhida,
navega e mede a largura do conteúdo. Ele **falha** no CSS anterior
(`conteúdo=56px de 390px`) e passa no atual.
