# Correções de interface — rodada de 21/11/2026

Material desta tarefa, **fora do Git** (regra da pasta). Referência:
`contextflow2` HEAD `ef51be9`, branch `main`, mais as alterações desta rodada.

## O que foi corrigido

Ver `contextflow2/docs/specs/f5-ui-correcoes-2026-11-21.md` §1 — tabela
defeito → causa raiz → correção. Sete itens, incluindo um **não relatado**
achado na validação: abaixo de 900 px não havia como abrir a navegação.

## Capturas (antes → depois)

| Arquivo | O que mostra |
|---|---|
| `01-expandida-antes.png` | Barra expandida, antes das correções |
| `02-recolhida-antes.png` | **O defeito principal**: barra recolhida sem botão de reabrir e com textos cortados |
| `03-prova-hipotese.png` | Injeção de CSS confirmando a causa (ícones limpos) antes de implementar |
| `10-barra-recolhida-depois.png` | Recolhida corrigida: ícones centralizados, controle de expandir no pé |
| `11-expandida-depois.png` | Expandida corrigida: rótulos completos |
| `12-barra-recolhida-zoom.png` | Recorte da barra recolhida para inspeção fina |
| `20-colunas-todas-ocultas.png` | Todas as colunas desmarcadas: sem "Resumo" fantasma, sem vazio de 218 px |
| `30-transcricao-tempos.png` | Transcrição padrão (tempos visíveis, um trecho por linha) |
| `31-transcricao-corrida.png` | Texto corrido: prosa contínua aproveitando a largura |
| `40-altura-linhas.png` | Controle de altura das linhas em uso |
| `41-altura-88-prova.png` | Prova intermediária a 88 px |
| `42-altura-88-real.png` | 88 px pelo caminho real: todas as linhas uniformes |
| `50-miniatura-fallback.png` | Miniatura com falha: espaço reservado, proporção mantida |
| `60-mobile-fechado.png` | 390 px com o novo botão de menu |
| `61-mobile-gaveta.png` | 390 px com a gaveta aberta |

## Scripts de validação (Playwright)

Rodam de `contextflow2/platform/` (precisam do `playwright` do projeto):

```
cp ../../Continuidade\ de\ Projeto/arena-correcoes-2026-11-21/*.mjs testes/.tmp/
LD_LIBRARY_PATH=$HOME/.cache/cdp/al2023/lib node testes/.tmp/valida-barra.mjs
```

| Script | Cobre |
|---|---|
| `repro-barra.mjs` | **Reprodução do defeito original** (antes da correção) |
| `valida-barra.mjs` | 10 ciclos, recarregar, teclado, 3 telas |
| `valida-transcricao.mjs` | 4 combinações, texto preservado, contexto da Biblioteca |
| `valida-altura.mjs` | passos, limites, compacto, seleção, rolagem |
| `valida-miniatura.mjs` | válida, ausente, 404, painel |
| `valida-gaveta.mjs` | abrir/fechar, véu, Esc, navegação em 3 larguras |
| `valida-geral.mjs` | 22 combinações responsivas + fluxos existentes |

## Números reais

```
npm test            183/183
npm run test:e2e     57/57
npm run verificar    TUDO OK
npm run typecheck    0 erros
npm run build        OK
```

## O que NÃO foi provado

- Importação real do YouTube: o ambiente bloqueia o domínio.
- Miniaturas: exercitadas com `page.route` (dublê), **não** contra o YouTube.
- Homologação visual: é do proprietário.
