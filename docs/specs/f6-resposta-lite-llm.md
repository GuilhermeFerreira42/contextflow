# F6 — Respostas sem texto no LiteLLM

A captura de 24/11/2026 mostra HTTP 200 no proxy e falha de extração no
ContextFlow. O corpo da resposta original não está disponível. A correção
cobre formatos de texto compatíveis e respostas vazias transitórias.

- No adaptador compatível, aceitar texto em string ou em blocos explícitos
  de texto de `choices[0].message.content`. Raciocínio não é texto final.
- Repetir somente a chamada atual quando houver uma mensagem de conclusão
  com conteúdo vazio em um retorno compatível. Usar o teto existente de
  três tentativas por chamada, compartilhado com erros HTTP e de rede,
  já contemplado pela estimativa. A espera continua cancelável.
- Limite de saída, filtro, recusa, chamada de ferramenta e formato
  inválido encerram com erro identificável, sem repetir. Se o vazio
  persistir, informar que a resposta HTTP foi aceita sem texto final.
- Sem migração, configuração nova ou gravação de corpos de resposta.
  Reverter o commit restaura o comportamento anterior.

Validar com respostas controladas: texto em blocos, vazio seguido de
sucesso, vazio persistente, cancelamento na espera, falhas definitivas e
teto compartilhado. Executar a regressão do motor. O caso original exige
nova execução autorizada pelo proprietário na interface.
