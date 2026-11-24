# F4 — Resultados mistos e rolagem em Importações

O lote relatado tem 37 concluídos (3 sem legenda) e 93 falhas entre 130
itens. Sua primeira página contém só falhas. O resultado do grupo deve
deixar claro que houve sucessos e manter as falhas disponíveis para repetir.

- Exibir Parcial em grupos finalizados com sucessos e falhas. A barra
  colore as proporções concluída e falha. Cada item usa seu próprio estado.
- Detalhe apresenta contagens por resultado e permite consultar todos,
  concluídos ou falhas pela paginação existente. Filtrar começa na primeira
  página. O estado opcional da API só restringe a consulta dos filhos.
- Se o motor em execução ignorar o parâmetro, a interface confirma o
  estado de cada item e percorre as páginas até reunir os resultados.
  O cursor aponta para o último item exibido quando a página de origem
  ainda contém resultados. Validar também com uma API sem filtro.
- Atualizações periódicas preservam páginas do histórico já carregadas,
  o painel expandido e as posições de rolagem.
- Sem mudança nos estados gravados, políticas de retry ou banco.

Validar no navegador com resultados mistos e primeira página somente com
falhas, e com rolagem do histórico e dos itens durante atualização da fila.
