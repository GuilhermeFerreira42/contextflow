# F6-B — persistência, fila e acompanhamento

Autorização: pedido do proprietário de 23/11/2026, sobre `6c7fdef`, main limpa.
**Coleções preservadas integralmente**, conforme correção explícita posterior
do proprietário. Não iniciar F7. Preservar paleta/neutros e recursos da Arena.

## Investigação executada

- Comando atual tem1359 caracteres, está no arquivo e na API com conteúdo igual,
  diferente do padrão. Não afirmar perda do arquivo nem substituir esse texto
  por fixtures. A UI ainda depende de Salvar; edição não confirmada se perde no
  reload. Proteger a persistência do comando isoladamente, sem mudar outros campos.
- Adicionar link usa `/api/ingestao/importar`, que espera trabalho terminar;
  trocar o cliente para `/api/trabalhos` existente, sem mudar a rota síncrona.
- Cartão tem nome nowrap e filhos sem min-width0, causando scroll horizontal.
  Recolher deixa aba permanente; fechar só aparece ao terminar. Falta limpar.
- Os dois vídeos parciais persistidos têm motivo de limite429, não falta de
  idioma. Inspeção real do primeiro: áudio es-US,160 faixas automáticas e faixas
  `ar-orig/en-orig/pt-orig/es-orig`. O adaptador tenta um único idioma preferido.

## A — comando personalizado

Salvar comando automaticamente após pausa de750ms e ao sair do campo, quando
já houver configuração válida. Manter Salvar para os outros campos/primeira
configuração. Não criar localStorage/arquivo paralelo de prompt. Usar POST atual
com flag aditiva `somentePrompt:true` e snapshot não secreto para compatibilidade;
no motor novo, ler configuração atual dentro da fila de gravação e alterar só
prompt. Nunca incluir senha/apagar chave em autosave. Coordenar requisições e
edições por revisão, sem resposta atrasada substituir texto. Mostrar salvando,
salvo ou erro real; erro conserva edição. Salvar manual cancela debounce e espera
gravações pendentes. Persistência prometida após confirmação de gravação, não
após matar a página no meio de uma requisição.

## B — adicionar, acompanhar e espaço

- Adicionar vídeo/playlist usa POST de trabalho com tipo/escopo/chave. Fecha
  imediatamente ao receber aceite, sem esperar yt-dlp nem timer. Provisória e
  cartão usam o ID verdadeiro; coleção escolhida continua vinculada quando o
  vídeo existir. Resposta antiga não pode limpar outro envio/janela reaberta.
- Cartão com títulos legíveis/limitados a duas linhas, sem scroll horizontal;
  scroll vertical só se a lista ultrapassar altura disponível. Mais largura
  útil no desktop e adaptação à janela pequena. Cancelar/repetir preservados.
- Limpar finalizados retira apenas concluídos/falhas/cancelados da apresentação,
  sem apagar histórico de Importações ou vídeos. Ativos permanecem. Lista vazia
  esconde cartão. Ocultar/recolher remove cartão inteiro, inclusive cabeçalho;
  não cancela tarefa. Polling não reabre; nova ação explícita pode reabrir.
- Recuperar margens/barras persistentes da Biblioteca: diminuir respiros locais,
  retirar aviso de fila quando todas as provisórias forem reconciliadas, e ocultar cartão
  dispensado. Respeitar altura escolhida e virtualizador; não esticar cinco
  linhas Compactas para preencher artificialmente o vazio. Coleções intactas.

## C — alternativas de legenda

Manter manual antes de automática e preferências existentes como primeira opção.
Ao falhar faixa, tentar alternativa anunciada, priorizando faixa-orig compatível
com idioma de áudio quando disponível; no máximo três tentativas. Após429, só
uma alternativa-orig antes de parar, sem varrer160 traduções. `-orig` não garante
idioma original do vídeo em conteúdos dublados: gravar idioma exato e origem real.
Cancelar interrompe sem nova tentativa. Privado/restrição/autenticação não tem
contorno. Sem Whisper, cookies ou download de áudio/vídeo. Nenhuma legenda vira
pronta sem segmentos válidos; parcial preserva motivo. Temporário por tentativa
e shell:false. Teste injetável do executor, sem dependência nova.

## Aceite

API/reabertura e Playwright: autosave isolado/revisões/erro, novos comandos não
sumirem ao navegar/reload; enqueue202 com executor bloqueado fecha modal, guarda
coleção e mostra progresso; clear/ocultar sem apagar/cancelar; nomes longos sem
scroll horizontal em desktop/mobile. Testes de idiomas: preferido falha, outra
faixa funciona; limite429; cancelamento; vazio/sem faixa. Prova real controlada
nos parciais existentes quando YouTube permitir, sem resumos pagos. Registrar
o que foi executado, evidências externas e commits separados por fatia.

## Resultado executado em 23/11/2026

Implementação e validação concluídas; detalhes e commits em `../estado-atual.md`.
252 testes aprovados, 6 ignorados no Windows, 0 falhas; navegador: 57 CDP e
Playwright 8 resumos, 13 pós-F6, 9 refinamentos, 4 visualização e 9 estabilização.
Build/typecheck e fumaça aprovados. Os dois parciais reais foram reimportados
pela fila com es-orig e agora têm transcrições prontas (223 e 390 segmentos).
Configuração pessoal preservada. Coleções intactas, F7 fora.

Referência primária consultada para 429 em traduções automáticas:
[yt-dlp, issue 13831](https://github.com/yt-dlp/yt-dlp/issues/13831).
A solução limita alternativas e registra o idioma efetivo; não promete
contornar restrições nem interpreta toda faixa-orig como idioma original.
