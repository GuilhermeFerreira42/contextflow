# F4 — Expansão dos itens em Importações

Na tabela de trabalhos, os itens de lote e playlist ficam dentro da
célula Ações e fazem a linha crescer sem ganhar largura.

- Um botão Itens abre e fecha uma linha abaixo do trabalho, ocupando
  toda a tabela. A linha principal, as ações e o cabeçalho ficam intactos.
- Preservar itens carregados e botão Mais itens no polling. Usar a
  paginação existente, rolagem na lista e atalho para recolher após a lista.
  Exibir estados e falhas com títulos legíveis.
- Em telas estreitas, o conteúdo acompanha a área visível da tabela.
  A preferência de colunas da Biblioteca não esconde Estado em Importações.
  O cartão flutuante fica fora da tela de Importações para liberar as ações.
- Sem alteração de fila, API ou banco.

Validar no navegador um lote de 130 itens, com atualização, paginação,
fechamento e largura estreita, e a expansão de uma playlist.
