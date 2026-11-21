# Evidência visual — F5-UI

Capturas feitas no navegador real (Chrome headless, 1600×1000, DPR 1) contra
uma base local com **5.000 vídeos** e **1.667 resumos**. Não são montagens nem
recortes do mockup: é a tela rodando.

| Arquivo | O que mostra |
|---|---|
| `biblioteca-implementada.png` | Biblioteca com 5.000 vídeos, modo ampliado |
| `biblioteca-com-resumos.png` | Filtro "com resumo" (1.667 vídeos): coluna de conteúdo com recorte e "ver resumo completo" |
| `painel-leitura.png` | Painel de leitura com o resumo inteiro |
| `adicionar-link.png` | Janela "Adicionar link" |
| `importacoes.png` | Tela de importações |
| `configuracoes.png` | Tela de configurações |
| `modo-compacto.png` | Modo compacto (linhas de 64 px) |

## O que conferir na homologação

Comparar com `docs/mockups/biblioteca-lista.png` e `biblioteca-planilha.png`:

1. **Densidade** — cabeçalho, barra de ações e linhas ocupam a mesma faixa
   vertical do mockup.
2. **Colunas** — nenhuma coluna espremida; títulos legíveis em duas linhas.
3. **Resumo** — o recorte termina sem cortar palavra no meio e o
   "ver resumo completo" aparece quando há mais texto.
4. **Altura fixa** — ao abrir o painel, a linha continua com a mesma altura
   (136 px no ampliado, 64 px no compacto). Isto é requisito da virtualização,
   não preferência.
5. **Cores** — fundo `rgb(8,11,18)`, azul de destaque e verde de "Pronto"
   batem com o mockup.

## Números medidos

- 5.000 vídeos: 24–28 linhas no DOM, heap 1–3 MB, 20 saltos de rolagem em 3,2 s.
- 1.667 vídeos com resumo: 24 linhas, 23 resumos carregados, 2 MB de heap.
- `npm test` 183/183 · `npm run test:e2e` 57/57.
