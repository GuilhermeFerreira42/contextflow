# F4 — Trabalhos persistentes, progresso e recuperação

> **SPEC para revisão, 19/11/2026. Não implementada.** Escrita após a validação
> Windows/YouTube da F3, commit `c6b7db5`. Aceite humano da F3 ainda pendente.
> A autorização desta sessão cobre a redação desta SPEC; implementar requer
> autorização posterior do proprietário. Políticas novas abaixo são propostas
> técnicas para revisão, não decisões de produto já homologadas.

## 1. Objetivo, escopo e exclusões

Importar vídeo, lote de URLs e playlist sem manter a UI esperando a requisição
de ingestão. Persistir intenção, execução e resultado para consultar progresso,
cancelar com segurança e repetir falhas sem duplicar ou apagar conteúdo concluído.

Entra: fila SQLite, execução limitada, progresso por polling, cancelamento
cooperativo com interrupção do subprocesso, retry explícito e recuperação após
queda; playlist com resultado individual. Corresponde a A4–A7 do aceite canônico.

Não entra: IA/resumos (F6), grade/seleção avançada (F5), preferências editáveis
(F8), serviços externos de fila, workers distribuídos, download de mídia,
Whisper, cookies/login, chat/RAG ou exportações. `gerar-resumo` continua declarado
no tipo compartilhado, mas sua criação retorna indisponibilidade até F6.

## 2. Base inspecionada e reuso

- `modulos/trabalhos/servico.ts` declara `criar`, `obter`, `listar`, `cancelar`;
  ainda não há implementação, tabela ou scheduler. Saúde informa `pendente`.
- `Trabalho` já contém ID, tipo, cinco estados, progresso, tentativas, erro e datas.
- Ingestão F3 é síncrona por HTTP; `ExecutorYtdlp` **ainda não recebe AbortSignal**,
  embora a SPEC antiga o antecipasse. É necessário ampliar o contrato real.
- Reusar normalização de URL, identidade única `youtube_id`, metadados/legendas,
  parser de segmentos e unidade transacional `gravarResultadoIngestao`.
- Reusar `Banco`, migrações append-only, HTTP nativo, envelope `Resposta` e CDP.
  Não criar catálogo paralelo: trabalhos referenciam vídeos pelo ID existente.
- F3 comprovada nesta sessão: 120 testes aprovados + 6 skips, 17 E2E e três vídeos
  reais. Houve HTTP 429 para tradução automática pt; en-orig passou. Falha de
  legenda hoje é `indisponivel` com mensagem; F4 precisa preservar código estável
  para diferenciar ausência definitiva de falha recuperável, sem comparar textos.

## 3. Donos e contratos propostos

`trabalhos` possui estados, tentativas, ordem e agregação; `ingestao` possui a
regra de conteúdo; adaptador possui o subprocesso; `persistencia` possui SQL e
transações. A interface solicita ações e renderiza o estado persistido.

Preservar as quatro assinaturas existentes. Adicionar
`repetir(id: string, chaveRequisicao: string): Promise<Trabalho>` e consultas
paginadas para a UI, sem remover `listar(estado?)`. `criar(tipo, escopo)` valida
o escopo por tipo; nunca passa `Record<string, unknown>` direto ao subprocesso.

Escopos fechados:

Adicionar `importar-lote` a `TipoTrabalho` para representar o pai do lote;
preservar os três valores existentes. Pai de playlist continua `importar-playlist`.
Essa extensão dá identidade persistente ao grupo, sem fabricar um vídeo ou playlist.

- Vídeo: `{ url, idiomas?, chaveRequisicao }`.
- Playlist: `{ url, idiomas?, chaveRequisicao }`, apenas URL YouTube com ID de
  playlist validado. URL `watch` com `list` só vira playlist quando a UI solicitar
  explicitamente esse tipo; importar vídeo mantém o comportamento unitário.
- Lote: endpoint aceita `{ urls, idiomas?, chaveRequisicao }`; cria grupo e filhos
  na mesma transação. Valida todas as URLs antes de aceitar, exibe erros por linha;
  nenhuma URL inválida provoca escrita parcial do grupo.

`TrabalhoDetalhado` amplia `Trabalho` com `fase`, `videoId`, `paiId`,
`cancelamentoSolicitado`, `erroCodigo`, `resultado`, contadores de itens e datas
de início/fim. Resultado de vídeo usa `ResultadoIngestao` sem duplicar segmentos.
Conteúdo completo continua em `/api/biblioteca/:id/transcricao`.

Ampliar `importar` com opções internas de execução: `sinal`, callback de fase e
política de retomada; não remover a assinatura atual. Adaptador recebe `sinal?`
em inspeção, download e descoberta de playlist. Cancelamento não pode cair no
catch F3 que transforma falha de legenda em conteúdo indisponível.

## 4. Persistência, fila e concorrência

Migração **002**, sem recriar tabelas F2/F3:

- `trabalhos`: campos atuais + escopo JSON validado, pai/grupo, fase, resultado
  compacto, código/mensagem de erro, solicitação de cancelamento, ordem estável,
  instante de início/fim, geração da tentativa e dono da execução.
- `tentativas_trabalho`: `(trabalho_id, numero)` único, datas, fase final e erro;
  conserva o histórico em vez de sobrescrever a tentativa anterior.
- `requisicoes_trabalho`: chave de idempotência + operação + hash do corpo + alvo;
  chave repetida com corpo diferente é conflito. Registro e enfileiramento atômicos.
- Manifesto de playlist/grupo: posição, youtubeId quando válido, trabalho filho,
  erro de item e término da descoberta; UNIQUE por pai e identidade válida.
  Entrada removida/privada sem ID utilizável conserva posição e erro, sem URL falsa.
- Lease único do executor no banco, com dono, geração e expiração. Não é nova
  fonte de dados: só coordena o scheduler que lê `trabalhos`.
- Campo nullable `codigo_motivo` em transcrições, para ausência versus falha
  recuperável; dados antigos permanecem legíveis e não são reinterpretados por texto.

Claim FIFO por `(criado_em, id)` em transação curta com atualização condicional
`na-fila → executando`; tentativa incrementa **no claim**, não em cada polling.
Processo não mantém fila paralela como fonte da verdade. Rede fora de transação.

Proposta inicial de execução: **2 operações externas simultâneas**, configurável
por variável de ambiente inteira positiva; não é meta de desempenho homologada.
Inspeção, descoberta e download consomem vagas; pai esperando filhos não ocupa
vaga. Operações sobre o mesmo youtubeId são serializadas pelo claim persistido,
inclusive entre grupos, evitando dupla escrita de transcrição.

Somente um scheduler possui lease por banco. Segunda instância pode consultar,
mas não consome. Proposta inicial: renovação a cada 5 s, expiração em 30 s,
valores técnicos testáveis, não SLA. Toda gravação de conteúdo e estado final
confere dono/geração/lease na **mesma transação**; executor antigo não pode escrever
após perder a posse. Estender a unidade F3 com essa guarda, sem SQL no serviço.

## 5. Estados e progresso observável

Manter `na-fila | executando | concluido | falhou | cancelado`.

| Transição | Condição e efeito |
|---|---|
| criação → na-fila | intenção e escopo já commitados antes de responder 202 |
| na-fila → executando | claim exclusivo; abre tentativa e inicia fase |
| executando → concluido | resultado commitado; sucesso pode ser vídeo Parcial por ausência de legenda |
| executando → falhou | erro estável persistido, subprocesso encerrado e temporário limpo |
| na-fila → cancelado | imediato e idempotente, sem executar yt-dlp |
| executando → cancelado | solicitação persistida, aborto observado, processo fechado e limpeza concluída |
| falhou/cancelado → na-fila | somente retry explícito e idempotente |

Fases de vídeo: `aguardando`, `metadados`, `legenda`, `gravacao`, `finalizado`.
Durante operação sem medida real, `progresso=null` e fase textual; não inventar
percentual por cronômetro. Concluído tem 1; cancelado/falhou conserva a última
medida válida. Em grupo, após descoberta finalizada, progresso = itens terminais /
total conhecido; mostrar separadamente sucessos, sem legenda, falhas e cancelados.
Enquanto total é desconhecido, null e contagem descoberta. Vazio concluído: 1.
Retry pode reduzir progresso; a UI mostra a nova tentativa explicitamente.

## 6. Playlist e lote

Descoberta usa yt-dlp por `spawn`, `shell:false`, argumentos separados,
`--flat-playlist --dump-json --skip-download --yes-playlist`, timeout e aborto.
Ler entradas por linha e persistir incrementalmente; não baixar vídeo completo.
Não usar API não oficial nem introduzir chave da YouTube Data API.

Cada identidade válida gera um filho de importação unitária; associação e criação
são atômicas. Manifesto finalizado fica congelado para retry. Se cair durante a
descoberta, reenumerar e reconciliar por identidade, preservando itens já vistos;
até finalizar, a UI informa que a composição ainda pode mudar. Não prometer
snapshot remoto imutável durante uma queda. Falha de descoberta permanece visível.

Filhos duplicados dentro do mesmo grupo são consolidados. Entre grupos podem
existir trabalhos diferentes para o mesmo vídeo, mas nunca execução simultânea;
o seguinte reutiliza conteúdo já concluído. Não sobrescrever transcrição pronta.
Pai agrega filhos sem ocupar vaga: concluído se todos tiveram resultado válido
(incluindo sem legenda), falhou se algum falhou e cancelado se cancelado pelo
usuário. Exibir contadores mesmo quando houver resultado parcial do grupo.

Retry de pai repete somente descoberta incompleta e filhos falhos/cancelados;
concluídos preservados. Não reenumera manifesto finalizado. Nova importação
explícita de playlist pode descobrir novos itens e continua deduplicando vídeos.

## 7. Cancelamento, quedas e retry

Cancelar persiste a intenção antes de sinalizar AbortController. Scheduler verifica
antes do spawn, entre fases e antes da transação final. Adaptador encerra o processo,
aguarda `close`, remove temporário em `finally` e só então confirma cancelado.
Em Windows não depender de SIGTERM cooperativo de script shell. Testar com
subprocesso Node real que bloqueia, sem um skip específico para esse teste novo.

Cancelar grupo para novos filhos e sinaliza filhos não terminais próprios; trabalhos
de outro grupo não são cancelados. Resultados já commitados nunca são apagados.
Na corrida cancelar/concluir, a primeira transação terminal vence: cancelamento
antes da gravação bloqueia conteúdo novo; cancelamento depois da conclusão é no-op.

Na inicialização, depois das migrações e da aquisição segura do lease:
`na-fila` permanece; execução órfã vira `na-fila` com tentativa anterior marcada
interrompida, salvo solicitação de cancelamento, que termina cancelada.
Terminais não voltam à fila automaticamente. Fencing impede resposta tardia de
processo antigo. Conteúdo e conclusão do job são commitados juntos; assim a queda
entre download e gravação não marca conclusão falsa nem exige substituir conteúdo.

Retry é **manual nesta fatia**, sem loop automático que agrave HTTP 429. Mesma
chave de requisição não cria nova tentativa, mesmo se a resposta anterior se perdeu.
Enquanto ativo, repetir é no-op; concluído é no-op. Nova chave em falho/cancelado
reenfileira o mesmo ID. Tentativa anterior preservada; não duplicar vídeo/segmentos.

Retomada de vídeo em erro reutiliza ID e reexecuta fases necessárias. Transcrição
pronta é preservada. Ausência confirmada de legendas é conclusão Parcial, não
falha a repetir automaticamente. Erro externo ao baixar legenda registra falha
recuperável, mantém metadados úteis e permite retry explícito dessa fase. Dados
F3 antigos com motivo sem código exigem tentativa explícita; não adivinhar causa.

## 8. HTTP e interface

| Rota proposta | Resposta e efeito |
|---|---|
| `POST /api/trabalhos` | `{tipo, escopo}` validado; 202 com trabalho persistido e Location |
| `POST /api/ingestao/lote` | grupo persistido e filhos; 202; validação 422 sem gravação parcial |
| `GET /api/trabalhos?estado&cursor&limite` | página por chave estável, sem escopo bruto/segredos |
| `GET /api/trabalhos/:id` | detalhe, contadores, resultado compacto e tentativa atual |
| `GET /api/trabalhos/:id/itens?cursor&limite` | filhos paginados e resultado por item |
| `POST /api/trabalhos/:id/cancelar` | 202 enquanto encerrando, 200 se terminal; idempotente |
| `POST /api/trabalhos/:id/repetir` | chave de requisição obrigatória; 202 na fila ou 200 se no-op |

Usar envelope existente; ampliar o roteador para status/Location explícitos sem
introduzir framework. ID ausente: 404; corpo inválido: 422; chave reutilizada com
outro corpo: 409; tipo futuro: 503. Erros de rede/timeout/autenticação são códigos
persistidos no trabalho, não falha tardia da requisição já aceita com 202.

Preservar `POST /api/ingestao/importar` e seu resultado F3 como compatibilidade:
passa pela mesma fila e aguarda o resultado, sem via paralela que burle limite,
lease ou dedup. A nova UI usa o endpoint assíncrono. Desconectar cliente não
cancela trabalho aceito. Rotas de biblioteca/leitura/diagnóstico continuam válidas.

Importações mostra trabalhos e filhos, fase, tentativa, contadores e erro legível;
botões Cancelar/Repetir refletem estado real. Polling inicial proposto de 1 s
enquanto visível/ativo, pausado quando oculto; recarregar reconstrói tudo pelo banco.
Sem websocket necessário. Atividade global discreta; demais telas navegáveis.
Nenhum controle de resumo aparece funcional antes da F6.

## 9. Segurança, compatibilidade e rollback

Bind local mantido. Validar URL/tipo/idiomas antes de gravar. Rejeitar caminhos,
comandos e argumentos arbitrários no escopo. yt-dlp sempre com array e sem shell;
não persistir stderr cru, links assinados, cookies ou configuração sensível.
Erros públicos traduzidos; logs redigidos conforme regras existentes.

Backup consistente com banco fechado antes da migração; não copiar só `.db` com
WAL ativo. Migração 002 idempotente e transacional, com teste sobre banco F3
preenchido. `reverterPara(1)` remove apenas estruturas/campo F4, conserva vídeos,
transcrições, segmentos, resumos e coleções. Antes de rollback, parar scheduler e
confirmar encerramento de filhos. Histórico de jobs será perdido: registrar esse
efeito e manter backup fora do Git. Reaplicar 002 não altera conteúdo F3.

## 10. Matriz de aceite e evidência prevista

Todos os cenários abaixo são **não executados**: esta é uma SPEC.

| # | Cenário → ação | Resultado observável → prova prevista |
|---|---|---|
| F4.1 | Enfileirar vídeo e navegar | 202 com ID antes da rede; UI continua navegável → HTTP e CDP com executor bloqueado |
| F4.2 | Fechar após aceite e reabrir | job e URL continuam presentes → processos separados e SQLite real |
| F4.3 | Enfileirar mais que o limite | simultaneidade nunca excede limite; mesmo youtubeId serializado → barreiras e contagem de subprocessos |
| F4.4 | Cancelar na fila/em execução | nenhum spawn na fila; execução fecha filho e limpa temporário antes de terminal → Node filho real em Windows/Linux |
| F4.5 | Cancelar junto da gravação | exatamente um resultado terminal; concluídos preservados → barreiras antes/depois de commit |
| F4.6 | Matar motor durante cada fase | recuperação sem duplicar, geração antiga não grava → SIGKILL, novo processo e igualdade de conteúdo |
| F4.7 | Repetir POST/retry com mesma chave | mesmo job, sem tentativa extra; corpo diferente 409 → integração concorrente |
| F4.8 | Rede/429 e retry explícito | erro estável, sem loop automático; retomada preserva ID/conteúdo anterior → dublê + subprocesso e rede real quando possível |
| F4.9 | Playlist com duplicado/privado/sem legenda | itens únicos, erro individual, Parcial honesto e pai correto → fixture e playlist pública real |
| F4.10 | Cair durante descoberta e durante filho | manifesto reconciliado, concluídos mantidos; retry não reenumera snapshot fechado → disco e outro processo |
| F4.11 | Cancelar/repetir pai | só filhos próprios não concluídos afetados; não bloquear vagas → integração e CDP |
| F4.12 | Segunda instância e lease vencido | só dono válido executa/grava; atrasado rejeitado → dois processos reais com fencing |
| F4.13 | Recarregar UI com jobs ativos | fase/erro/contadores reais reconstituídos; sem percentual inventado → CDP |
| F4.14 | Migrar/reverter/reaplicar banco F3 | conteúdo inalterado e nenhum segredo novo → SQLite em disco e comparação |
| F4.15 | Escopo malicioso e tipo futuro | 422/503, sem execução de comando e sem vazamento → integração/processo |
| F4.16 | Regressões F3 | manual/auto/sem legenda, dedup, atomicidade e leitor continuam corretos → suíte, E2E, três vídeos reais |

## 11. Riscos, decisões para revisão e definição de concluído

YouTube pode limitar legenda traduzida (429 já observado); não chamar isso de
ausência definitiva nem esconder a falha. Playlist remota pode mudar durante
descoberta interrompida. Leases exigem fencing testado; não bastam heartbeat e
lista em memória. SQLite síncrono exige transações curtas, nunca espera de rede.

Propostas a revisar: defaults de concorrência/lease/polling, retry manual e
compatibilidade síncrona via a mesma fila. Não mudam escopo canônico; se a revisão
exigir outro comportamento, ajustar esta SPEC antes de implementar.

Concluído somente quando F4.1–F4.16 tiverem resultados registrados, suítes e
instalação aplicáveis passarem, playlist/reinício/cancelamento forem provados no
fluxo real, limitações de SO/rede estiverem declaradas, commit próprio e estado
atualizado existirem, e o proprietário der o aceite humano. Falta de URL privada
ou rede não vira aprovação implícita. Implementação pode ser dividida em fila e
recuperação, depois playlist/UI, cada incremento com prova e commit próprios.

Precedência: `01-escopo-canonico.md` e decisões autorizadas >
`03-arquitetura-e-contratos.md` > esta SPEC > plano mestre.
