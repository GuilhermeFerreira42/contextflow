# Evidência visual — F5-UI + F5-QA

Capturas do navegador real (Chrome, 1600×1000 @ DPR 1, ou 390×844 no mobile)
contra uma base local com 5.000 vídeos. Não são montagens: é a tela rodando,
controlada pela Agent Browser via CDP.

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
| `mobile-biblioteca.png` | 390 px: biblioteca sem rolagem horizontal |
| `mobile-gaveta.png` | 390 px: gaveta de navegação aberta |

## O que conferir na homologação

Comparar com `docs/mockups/biblioteca-lista.png` e `biblioteca-planilha.png`:

1. **Densidade** — a planilha começa logo abaixo de uma única linha de ações,
   e seis linhas cabem no primeiro quadro (antes eram cinco, com a barra de
   lote quebrada em duas linhas).
2. **Barra recolhida** — o botão de alternância está visível no topo, logo
   abaixo do símbolo, e leva de volta ao estado expandido. (Este era o defeito
   relatado: o botão ficava 17 px fora do clipe.)
3. **Colunas** — nenhuma espremida; títulos legíveis em duas linhas.
4. **Resumo** — o recorte termina sem cortar palavra no meio, e
   "ver resumo completo" aparece quando há mais texto.
5. **Altura fixa** — abrir o painel não muda a altura da linha (108 px no
   ampliado, 64 px no compacto). É requisito da virtualização.
6. **Mobile** — a 390 px o conteúdo ocupa a largura toda e a navegação fica
   atrás do botão de menu (antes era inalcançável).

## Números medidos

- 5.000 vídeos: 24–28 linhas no DOM, heap 1–3 MB, 20 saltos de rolagem em 3,2 s.
- Altura de linha declarada == real: 108 px e 64 px.
- `npm test` 183/183 · `npm run test:e2e` 62/62.
