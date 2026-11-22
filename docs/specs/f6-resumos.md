# SPEC F6 — Resumos por IA

Status: implementada e testada com provedores HTTP controlados no Windows;
geração em provedor real e aceite humano pendentes. Execução autorizada pelo
proprietário ao pedir avançar à próxima fatia, sobre `9094137`.
Este texto fecha e substitui o rascunho `d9ef6a6` após conferir
o código real. Não altera o escopo V1 nem inicia F7/F8 como fatias completas.

## Entrega

Configurar OpenAI, Anthropic, Ollama ou endpoint OpenAI compatível; estimar e
confirmar geração individual/lote pela fila persistente; acompanhar progresso,
cancelar/repetir, ler/copiar resultados e consultar histórico. Sem nova aba:
Configurações, Biblioteca, painel de leitura e Importações existentes.

## Decisões de implementação

### Correção autorizada — LiteLLM local e saída longa (22/11/2026)

Relato e captura do proprietário: endpoint de escuta `0.0.0.0:4000` rejeitado,
proxy sem chave impedido de testar, saída limitada a 8192 e a um terço do contexto.
Consulta GET real em loopback confirmou modelos no LiteLLM, sem autenticação;
nenhuma geração foi solicitada. Normalizar somente host de escuta IPv4
`0.0.0.0` para `127.0.0.1`, preservando porta/caminho. HTTP remoto continua proibido.
OpenAI compatível admite chave opcional; se o proxy exigir, seu 401/403 continua
explícito. OpenAI/Anthropic oficiais continuam exigindo chave. Testar conexão
salva primeiro o formulário atual e consulta modelos, sem gerar; exibe nomes e
preenche sugestões de modelo, sem escolher silenciosamente. Saída configurável
até 1.000.000 de tokens, limitada ao contexto informado e à reserva de entrada
(prompt UTF-8 + 1024); limite real depende do modelo. Resposta JSON até 32 MB.
Sem migração. Validar salvar/testar/gerar sem chave com proxy controlado,
autenticação recusada, limites altos e regressão Playwright. Chamada real de
geração não faz parte dessa prova de conexão.
Referência do contrato compatível: https://docs.litellm.ai/docs/simple_proxy .

- Clientes HTTP nativos sem SDK/dependência de produção. OpenAI Chat Completions,
  Anthropic Messages e Ollama `/api/chat`, sem streaming nesta entrega (opcional
  no rascunho). Modelos informados pelo usuário, sem catálogo/preço embutido que
  envelheça: limites e preços opcionais são configuráveis.
- HTTPS obrigatório para endpoints remotos; HTTP só em loopback; sem credenciais,
  query ou fragmento na URL e sem seguir redirects. Chave vinculada ao provedor
  e endpoint, nunca reaproveitada silenciosamente ao trocar destino.
- Configuração não secreta em `ia/config.json`, segredos separados em
  `ia/secrets.json`, fora do Git e do backup SQLite. Windows: DPAPI CurrentUser,
  entrada por stdin de subprocesso com argumentos constantes, sem shell; Linux:
  diretório 0700 e arquivo 0600. Chave nunca em resposta, log ou localStorage.
  Não alterar credenciais pessoais para testar: usar apenas fixtures descartáveis.
- Versão visível do prompt mais fingerprint imutável da configuração/metadados;
  hash SHA-256 de idioma/origem/segmentos identifica a transcrição. O trabalho
  guarda snapshot durável da fonte/configuração sem chave; mudar configuração
  durante execução não troca o modelo/prompt/fonte de um trabalho já aceito.
- Migração **005**, pois 004 já existe: acrescentar revisão à PK de `resumos`
  (mesmas dez colunas preservam leitores/importações antigas), manter triggers
  da projeção `tem_resumo`, guardar auditoria de execuções/uso separadamente.
  Resultado pronto nunca é apagado por uma falha de outra revisão.
- Reutilizar resumo pronto da mesma entrada; requisições idempotentes e trabalhos
  ativos deduplicados. Novas fontes/prompts/configurações geram versão distinta.
  Leitura principal prefere o pronto mais recente; histórico permanece acessível.
- Estimativa conservadora por bytes UTF-8, explicitamente aproximada; preços
  opcionais por milhão de tokens. Sem preço, custo desconhecido, não zero.
  Estimativa prevê map/reduce, saída e até três tentativas por chamada. Confirmação
  explícita antes de enfileirar; fingerprint invalida estimativa se a entrada mudar.
- Textos longos divididos com limites de contexto, resumos parciais e redução
  até caber no pedido final. Limitar quantidade de chamadas; se não reduzir,
  falhar claramente, nunca truncar a fonte silenciosamente.
- Concorrência da fila F4 e limite configurável de IA (Ollama padrão 1). 429/5xx/
  timeout: até três tentativas HTTP com espera crescente e cancelável. A fila
  mantém seus estados reais (`falhou`, não um estado `erro` inexistente).
  401/403/entrada inválida não têm retry automático. Repetir manual reutiliza a
  mesma tarefa/snapshot; interromper a aplicação permite recuperação pela lease.
- Resultado e conclusão do trabalho gravados na mesma transação, com fencing.
  Cancelamento fecha HTTP, não grava parcial como pronto; falha/cancelamento
  atualiza só a versão pertinente. Snapshot de uso conserva tokens informados
  pelo provedor; custo permanece estimativa, não comprovante de cobrança.

## API

GET `/api/resumos/provedores`, GET/POST `/api/resumos/configuracao` (POST aceita
chave somente para gravar); POST `/api/resumos/testar` (consulta de modelos,
sem geração); POST `/api/resumos/estimar` (videoIds); POST `/api/resumos/gerar`
(videoIds, assinaturaEstimativa, confirmarCusto, chaveRequisicao); GET
`/api/resumos/:videoId` (histórico e auditoria sem segredos). A rota de leitura
`/api/biblioteca/:id/resumo` continua compatível. `/api/trabalhos` delega
`gerar-resumo` ao mesmo serviço, sem caminho que dispense a confirmação.

## Interface

Configurações contém formulário de provedor/modelo/endpoint, chave de senha,
prompt/versão, contexto/saída/concorrência e preços opcionais; mostrar se existe
chave, nunca preencher a salva. Biblioteca oferece Gerar resumos para seleção;
painel oferece Gerar resumo para o vídeo. Janela exibe estimativa, avisos e
confirmação; itens sem transcrição ficam explícitos e não são enfileirados.
Importações mostra trabalhos, fases, cancelamento e retry existentes. Resumo
salvo fica na grade/painel, com cópia/histórico e aviso de revisão desatualizada.
A opção de gerar automaticamente ao importar permanece indisponível até haver
fluxo de estimativa/consentimento compatível: não gerar despesas silenciosas.

## Matriz de validação

1. Migração preserva dados/projeções e guarda backup antes de tocar base existente.
   Rollback recusa perder revisões ou trabalhos F6: usar backup anterior nesse caso.
2. Configuração/segredo sobrevivem restart; API, logs, banco e backup não contêm
   a chave; DPAPI real no Windows e permissões POSIX quando o SO permitir executar.
3. Contratos dos três protocolos exercitados com servidor HTTP local controlado,
   incluindo auth, 429, 5xx, timeout, resposta inválida e ausência de texto.
4. Estimar/confirmar individual/lote, pular transcrição ausente, idempotência,
   snapshots, versão nova, histórico, input alterado entre estimativa/confirmação.
5. Cancelamento/lease/fencing/retry, map-reduce e uso do provedor comprovados;
   parcial não vira pronto, resumo anterior permanece após falha/reimportação.
6. Navegador real: configurar fixture, estimar, confirmar, acompanhar fila, ler,
   copiar/histórico, cancelar e repetir. Regressões CDP/Playwright da grade e suítes.
7. Registrar execução real versus fixture. APIs pagas reais/Ollama real somente
   se disponíveis/autorizadas; sem chave não inventar homologação externa nem
   solicitar segredo no chat. Aceite humano e limites permanecem explícitos.

Referências de contrato consultadas: OpenAI Chat API
https://developers.openai.com/api/reference/resources/chat ; Anthropic Messages
https://platform.claude.com/docs/en/api/messages ; Ollama Chat
https://docs.ollama.com/api/chat .
