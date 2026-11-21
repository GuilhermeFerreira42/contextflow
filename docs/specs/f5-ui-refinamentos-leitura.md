# SPEC — Refinamentos de leitura e controle da lateral

Status: implementada e validada no Windows; homologação humana pendente.
Alturas e controles deste documento são históricos: a rodada posterior
`f5-ui-dimensoes-grade.md` amplia para 64–600 px com barra deslizante e
acrescenta redimensionamento das larguras.
Implementação autorizada pelo proprietário nesta sessão, sobre `da4cf1b`.
Complementa `f5-ui-correcoes-2026-11-21.md`; não substitui seus resultados históricos.

## Escopo e apresentação

Preservar o grafite (`#080b12`, `#0d111a`, `#111723`), azul (`#0070f3`,
`#4c9aff`), texto claro (`#e8ecf3`) e tipografia local existentes. A grade
continua protagonista, com conteúdo alinhado à esquerda e pelo topo.
Sem redesenho, novas dependências, alteração de banco/contratos ou F6.

- Coluna de seleção estreita em todas as combinações de colunas, inclusive
  com espaçadores da virtualização presentes. Redistribuir espaço entre vídeo
  e resumo, sem colunas virtuais residuais.
- Altura ampliada existente (88–200 px): miniatura cresce proporcionalmente,
  com limite de largura legível, e resumo mostra mais linhas. Compacto mantém
  64 px. CSS e virtualizador compartilham a altura; seleção por ID preservada.
- Recolher no topo junto da marca. Recolhida, a mesma área da logo é botão
  de expansão: logo em repouso, ícone no hover/foco, ativação por clique,
  Enter/Espaço e toque sem hover, sem deslocar a área clicável.
- Preservar a gaveta em janela estreita, navegação, transcrição e miniaturas.

## Prova e critérios

Playwright com cliques reais e banco descartável: comparar seleção/vídeo em
combinações de colunas e larguras; medir três alturas, proporção da miniatura
e texto efetivamente visível; exercitar rolagem com 5.000 vídeos; conferir
seleção e identidade; dez ciclos de lateral, reload, hover/foco, teclado,
toque, navegação e gaveta. Capturas antes/depois fora do Git. Regressão CDP,
testes de unidade/integração, build/typecheck e verificar executados ao final.

Nenhuma migração. Reversão pelo commit desta fatia; preferências anteriores
permanecem compatíveis. Homologação visual humana separada dos testes.

## Causas e correções

- As larguras percentuais de todas as colunas de leitura deixavam sobra que
  o navegador distribuía inclusive à seleção. Agora há uma coluna de leitura
  flexível, com piso conforme as colunas visíveis e redimensionamento da janela.
  Os espaçadores também mantinham `colSpan=8` com colunas ocultas; sincronizados
  com a quantidade real para não criar colunas fantasmas.
- A Biblioteca herdava `max-width:1600px` das telas de leitura. Esse limite
  foi removido só da Biblioteca para aproveitar o espaço liberado pela lateral.
- Miniatura fixa em 138 px e resumo limitado a cinco linhas: imagem passa a
  acompanhar a altura, com proporção 16:9 e limite de 222 px; o teto fixo de
  texto foi removido. Compacto continua com linha de 64 px.
- O controle no rodapé foi movido para a marca. No estado recolhido seu alvo
  estável de 36×36 px exibe logo de 26×26 px, trocada por ícone no hover/foco.
  Estado acessível sincronizado também ao restaurar preferência após reload.
- A ancoragem nativa da rolagem compensava a troca de espaçadores, deslocando
  o índice ao paginar. Desativada somente no viewport virtualizado.
- O seletor `[data-modo]` incluía a raiz depois da inicialização e recebia
  cliques por propagação, redesenhando a grade em ações alheias à troca de modo.
  Eventos e estado dos controles limitados a `button[data-modo]`.

## Resultado medido

Em 88 / 136 / 200 px de linha: miniaturas de 104 / 138,8 / 222 px de largura,
sempre 16:9; resumo visível de 38,4 / 95,9 / 153,5 px (2 / 5 / 8 linhas).
Seleção permanece em 46 px nas combinações exercitadas, com início do vídeo
logo após essa coluna. As provas usam 5.000 vídeos e resumos sintéticos,
sem chamadas ao YouTube ou geração de IA.

Reprodução e resultados completos referenciados em `../estado-atual.md`.
Executar a regressão com `npm run test:e2e:refinamentos` em `platform/`;
`CHROME_BIN` pode escolher o navegador instalado e `CONTEXTFLOW_EVIDENCIAS`
escolhe a pasta de capturas. Sem essas variáveis, usa navegador disponível e
pasta descartável em `testes/.tmp/`. Não requer servidor aberto previamente.
