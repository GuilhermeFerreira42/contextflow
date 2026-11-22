# Correção F6-A — miniatura e título na Biblioteca

Status: implementada e validada no Windows; homologação humana pendente.

Autorização: o proprietário trouxe o comando enviado à Arena como contexto e
pediu corrigir o item 8 ainda insatisfatório. Base `76e57d1`, `main` limpa.
Preservar os outros sete ajustes, a F6 e as preferências. Não iniciar F7.

## Investigação e comportamento exigido

A base já remove o teto antigo de 420 px e tenta empilhar pela largura da coluna.
Os testes existentes alargam o cabeçalho/preferências diretamente, e verificam
que o texto desceu, sem exigir que todo o título/subtexto continue visível.
A regra usa reserva fixa de 66 px para texto e troca de layout mesmo quando
empilhar oferece uma imagem menor que o estado lateral. Reproduzir com os
controles reais; distinguir os defeitos atuais de eventual captura anterior.

Na linha baixa, manter imagem à esquerda e título ao lado. Conforme altura e
largura mudarem, comparar a imagem que cabe em cada disposição: usar o empilhado
quando liberar mais espaço útil. O título fica inteiramente abaixo da imagem,
com altura medida no DOM (inclusive quebra de linha e subtexto), sem reserva
fixa que corte conteúdo. Miniatura mantém 16:9, contida na coluna, sem teto em
pixels; só pode parar de crescer ao encontrar o limite geométrico da coluna.
Ao aumentar altura, a troca de disposição não deve diminuir a imagem; reduzir
altura ou alargar coluna pode restaurar o lateral. Compacto permanece lateral.

## Mudança e prova

Alterar somente medição em `biblioteca.js` e CSS da célula. Usar a altura da linha
existente e largura renderizada; agrupar leituras/escritas para evitar medição
por pixel de arraste. Sem nova preferência, dependência, backend ou migração.
Rollback: reverter o commit de frontend/testes, sem tocar dados.

Playwright real com dados descartáveis: arrastar coluna, ajustar slider por
teclado, percorrer alturas e larguras, título longo/curto, miniatura/fallback,
voltar ao Compacto, reload e seleção preservada. Exigir medidas de imagem,
posição do título, proporção, limites da célula/linha e crescimento monotônico.
Capturas e logs fora do Git. Rodar pós-F6, refinamentos/volume, CDP, testes,
build e fumaça; registrar o que não for executado.

## Evidência e fechamento

Antes: subir linha de 296 para 304 px reduziu a largura da imagem de 484 para
423 px, no primeiro grupo de Playwright. Depois: quatro grupos aprovados,
incluindo 45 combinações de altura/largura/conteúdo, retorno lateral e reload.
Texto é medido sem compressão pelo limite de altura, e depois a célula volta a
respeitar a linha antes da pintura. A largura mínima legível do texto é relativa
à fonte e cede em colunas estreitas, mantendo a miniatura visível.
Imagem de 905×509 em coluna 1100/linha 600; ao encontrar a largura da coluna,
o crescimento para naturalmente. Demais resultados e limites em `estado-atual.md`.
