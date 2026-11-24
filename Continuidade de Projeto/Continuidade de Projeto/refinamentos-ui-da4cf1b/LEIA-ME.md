# Refinamentos de interface — base da4cf1b

Pedido atual: o proprietário trouxe o repositório atualizado e autorizou o
Codex a implementar os ajustes de grade, leitura ampliada e lateral no topo.
SPEC: contextflow2/docs/specs/f5-ui-refinamentos-leitura.md.
Estado principal: contextflow2/docs/estado-atual.md.

## Evidência final

- npm-install.log: saída 0, 12 pacotes auditados, zero vulnerabilidades.
- npm-test.log: saída 0, 183 testes, 177 aprovados, 6 ignorados no Windows.
- npm-e2e-final.log: saída 0, 57/57 cenários CDP.
- playwright-final.log: resultado final dos 7 grupos Playwright.
- npm-verificar.log: saída 0, nove verificações OK.
- npm-build.log: saída 0, incluindo typecheck.
- depois/altura-88.png, altura-136.png e altura-200.png: crescimento efetivo
  da imagem e do resumo; dados sintéticos, sem IA ou YouTube real.
- depois/lateral-recolhida.png e lateral-hover.png: logo e controle no topo.
- depois/janela-*.png: cinco larguras; conferir o log para o alcance das provas.

Miniatura: 104 / 138,8 / 222 px em linhas de 88 / 136 / 200 px.
Texto de resumo visível: 38,4 / 95,9 / 153,5 px (2 / 5 / 8 linhas).
Seleção: 46 px. Logo: 26x26 dentro de alvo clicável de 36x36 px.

## Histórico de reprodução

playwright-antes.log e antes/ conservam falhas observadas antes da correção
(colSpan residual, miniatura fixa/teto de texto e controle no rodapé).
playwright-depois.log e imagens falha-*.png registram tentativas intermediárias;
não devem ser confundidos com a execução final. Houve correção da ancoragem
nativa da rolagem e aperfeiçoamento das esperas e da prova de teclado (Tab real,
pois focus() após clique não ativa necessariamente :focus-visible no Chrome).
Não inferir o resultado final a partir de um nome de captura antiga.

## Limites e retomada

Servidores e navegadores de teste usam bancos descartáveis em testes/.tmp,
sem banco pessoal. YouTube real, IA e regressão Linux não executados.
Nenhuma mudança de backend ou banco; nenhuma dependência nova.
Homologação visual humana pendente. F6 não autorizada.
Reprodução: em platform/, npm run test:e2e:refinamentos.
O commit da fatia é identificado no git log; este diretório se refere à base
indicada e às alterações próprias dessa fatia, não a versões futuras.
