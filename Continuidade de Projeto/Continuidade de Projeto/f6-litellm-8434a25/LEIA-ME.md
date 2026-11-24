# Correção F6 — LiteLLM local — 22/11/2026

Base 8434a25; Windows, Node v22.12.0. Consultar estado canônico em
../contextflow2/docs/estado-atual.md e o adendo da SPEC F6.

Resultados executados, saída 0:
- npm-test.log: 198 testes, 192 aprovados, seis ignorados, zero falhas.
- playwright-f6.log: 7/7 grupos em navegador real com proxy HTTP controlado.
  Inclui salvar/testar formulário atual, modelo ausente e sugestões, normalização
  de 0.0.0.0 para loopback, chave vazia, saída 131072, reload e geração controlada.
- cdp.log: 57/57 cenários de regressão.
- build.log: compilação e typecheck.
- verificar.log: nove verificações, TUDO OK.
- litellm-real-conexao.log: cliente corrigido consultou /models no LiteLLM real
  local, sem chave, confirmou modelo listado e não solicitou geração.
- capturas/: provas do navegador; litellm-saida-longa.png inspecionada visualmente.

Não executados: geração no LiteLLM real, APIs pagas, Linux e nova rodada dos
nove grupos de dimensões (estes passaram na entrega 8434a25).
Nenhuma chave real, banco pessoal ou configuração pessoal foi copiado/alterado.
O ContextFlow já aberto precisa reiniciar; recarregar a página depois.

Commit final 1c7ccae; main limpa após commit.
