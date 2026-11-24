# F6 — Resumo na importação e acompanhamento após recarga

- O checkbox do modal autoriza uma geração de IA para um vídeo e avisa sobre
  cobrança. Começa desmarcado. Playlists continuam disponíveis para importação.
- A fila captura a configuração de resumo ao aceitar o pedido, sem guardar
  chave. Ao concluir a importação, grava o pedido de resumo na mesma transação
  e com a mesma guarda de execução. Sem transcrição, informa que não gerou.
  Reutiliza trabalhos ativos e resumos prontos da mesma revisão. A geração
  manual mantém sua confirmação de estimativa.
- Reabrir a página consulta a fila SQLite. A aba guarda os IDs seguidos,
  a decisão de ocultar o cartão e os dados para reconciliar as linhas
  provisórias e o destino de coleção. F5 não inicia, cancela nem repete
  trabalhos. Configurações não exibe o cartão sobre os controles.
- O proprietário confirmou que a geração funcionou depois de atualizar
  a página. O tratamento de respostas do provedor permanece como em `a8d6aad`.
- Sem migração. Reverter o código conserva conteúdo e trabalhos de resumo
  já criados. Pedidos de importação novos com a opção precisam do motor novo
  para executar a etapa automática.

Validar importação opt-in, deduplicação, ausência de legenda e acompanhamento
após recarregar com servidor controlado.
