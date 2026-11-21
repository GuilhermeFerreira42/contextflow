# Evidência visual — F5-UI + F5-QA

Capturas do navegador real (Chrome headless, 1440×900, ou 390×844 no mobile)
contra uma base local com 6 vídeos e 4 resumos. Não são montagens: é a tela
rodando, controlada por Playwright.

Estas capturas foram refeitas em 21/11/2026, depois da revisão de layout e uso:
as anteriores ainda mostravam os defeitos corrigidos em `c5fa1a9` (selo
duplicado, colunas desencontradas, última coluna cortada).

| Arquivo | O que mostra |
|---|---|
| `biblioteca-implementada.png` | Biblioteca, modo ampliado, barra expandida |
| `barra-recolhida.png` | Biblioteca com a barra recolhida: conteúdo usa o espaço liberado |
| `biblioteca-com-resumos.png` | Filtro "com resumo": recorte e "ver resumo completo" |
| `painel-leitura.png` | Painel de leitura com o resumo inteiro |
| `adicionar-link.png` | Janela "Adicionar link" |
| `importacoes.png` | Importações, com estado vazio orientando o próximo passo |
| `configuracoes.png` | Configurações: valores reais e "Não definido" em itálico |
| `modo-compacto.png` | Densidade compacta (linhas de 64 px) |
| `mobile-biblioteca.png` | 390 px: conteúdo na largura toda, tabela rola na horizontal |
| `mobile-gaveta.png` | 390 px: gaveta de navegação aberta |

## O que conferir na homologação

Comparar com `docs/mockups/biblioteca-lista.png` e `biblioteca-planilha.png`:

1. **Densidade** — a planilha começa logo abaixo de uma única linha de ações,
   e as seis linhas cabem no primeiro quadro. A barra tem 33 px sem seleção
   (era 68 px, com cinco botões desabilitados).
2. **Barra recolhida** — o botão de alternância está visível no topo, logo
   abaixo do símbolo, e leva de volta ao estado expandido. (Este era o defeito
   relatado: o botão ficava 17 px fora do clipe.)
3. **Colunas** — nenhuma espremida nem cortada; títulos legíveis em duas
   linhas e o texto de cada célula alinhado pela primeira linha (desvio medido
   de 5 px, era 33 px).
4. **Resumo** — o recorte termina sem cortar palavra no meio, e
   "ver resumo completo" aparece quando há mais texto.
5. **Altura fixa** — abrir o painel não muda a altura da linha (108 px no
   ampliado, 64 px no compacto). É requisito da virtualização.
6. **Mobile** — a 390 px o conteúdo ocupa a largura toda e a navegação fica
   atrás do botão de menu (antes era inalcançável).

## Números medidos

- 5.000 vídeos: 24–28 linhas no DOM, heap 1–3 MB, 20 saltos de rolagem em 3,2 s.
- Altura de linha declarada == real: 108 px e 64 px.
- Transbordo horizontal: 0 px em 1440, 1280, 980 e 420 px.
- `npm test` 183/183 · `npm run test:e2e` 62/62.
