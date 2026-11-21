# SPEC — Altura por barra deslizante e colunas redimensionáveis

Implementação solicitada pelo proprietário sobre `027c7df`.
Status: implementada e validada no Windows; homologação humana pendente.

- Ampliado passa de 88–200 para **64–600 px**, passo de 1 px, com controle
  nativo `range`, valor acessível e restauração para 136 px. Compacto mantém 64 px.
  Miniatura e resumo aproveitam a altura respeitando a largura disponível.
- Alterar altura preserva o item/posição lógica na janela virtual e a seleção;
  CSS e virtualizador continuam usando a mesma variável.
- Divisórias nos cabeçalhos de dados permitem arrastar com ponteiro/toque.
  Seleção permanece fixa em 46 px. Limites: vídeo 180–1200 px, resumo 160–1200 px,
  demais dados 80–1200 px. Teclado: setas (10 px), Shift+setas (50 px), Home/End.
  Duplo clique restaura a largura da coluna; botão restaura todas as larguras.
- Larguras são preferências locais, salvas com as opções visuais existentes;
  sobreviver a reload e ocultar/restaurar colunas. Preferências antigas compatíveis.
- Colunas de leitura sem tamanho manual absorvem espaço livre. Se ambas forem
  dimensionadas manualmente, respeitar as larguras escolhidas; a tabela pode ser
  menor que o viewport ou rolar horizontalmente dentro dele. Nunca ampliar a seleção.
- Arrastar divisória não ordena, seleciona nem abre o leitor. Ordenação pelo
  botão do cabeçalho permanece. Captura de ponteiro e cancelamento seguros.

Identidade grafite/azul e fontes locais preservadas; sem banco, backend, novas
dependências ou F6. Reversão pelo commit desta fatia, preferências locais extras
podem ser ignoradas pela versão anterior.

Validação: Playwright com arrastes reais, teclado, extremos 64/600, três alturas,
5000 vídeos, posição/seleção, larguras mínima/máxima, reload, colunas ocultas,
ordenação após resize, restauração e ausência de transbordo da página. Regressão
CDP, suíte existente, build e fumaça; logs/capturas fora do Git e estado atualizado.

## Resultado e uso

Em Biblioteca → Colunas, arrastar a barra de altura ou usar Home/End/setas.
Arrastar a divisória à direita do cabeçalho para redimensionar; setas ajustam
a divisória focada, duplo clique restaura uma coluna, Restaurar larguras limpa
todas as medidas manuais. Escape cancela um arraste. Preferências persistem
em `contextflow.biblioteca.altura` e no campo `larguras` do objeto visual existente.

Em 64/136/600 px, o fixture mediu 1/5/29 linhas de resumo; a miniatura respeita
proporção 16:9 e até 55% da célula/420 px, conforme espaço da coluna. Linhas
baixas ocultam metadados secundários e textos de apoio são truncados para não
ditar altura mínima da tabela. Os espaçadores têm altura explícita na linha e
na célula, sem o teto dos dados; uma âncora lógica atravessa o reflow para manter
o mesmo vídeo ao mudar drasticamente a altura.

Playwright: 9/9 grupos, incluindo arrastes reais, teclado, Escape, extremos,
persistência/reload, colunas ocultas, restauração, ordenação e rolagem com
5.000 vídeos. Unidade/integração: 177 aprovados, 6 ignorados no Windows; CDP:
57/57. Build/typecheck e verificar aprovados. Evidências e limites no estado.
