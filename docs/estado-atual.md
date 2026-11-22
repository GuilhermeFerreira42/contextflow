# Estado de retomada — ContextFlow V1

> Atualizado ao fim de cada sessão. É o **primeiro** arquivo a ler, depois de
> `00-comece-aqui.md`. O que está abaixo da linha "Histórico" é registro, não
> estado vigente.

## Estado vigente — 22/11/2026 — correção da miniatura adaptativa

Branch `main`; base `76e57d1`, árvore limpa antes deste pedido. O proprietário
trouxe a entrega atualizada da Arena e pediu corrigir miniatura/título (item 8),
usando o comando pós-F6 e a captura como contexto. Os demais sete ajustes foram
preservados. SPEC prévia: `specs/f6a-miniatura-adaptativa.md`. F7 não iniciada.

**Investigação:** a base recebida já retirava o antigo teto de 420 px, e seu
cenário de linha 600/coluna 700 já empilhava. Ainda havia uma falha reproduzida
com controles reais: subir a linha de 296 para 304 px fazia a imagem encolher
de 484 para 423 px ao empilhar. A troca usava uma reserva fixa de 66 px e não
comparava a imagem possível em cada disposição. Não atribuir a captura antiga
ao comportamento integral do HEAD recebido nem declarar o teste antigo suficiente.

**Correção:** `biblioteca.js` compara os espaços viáveis lateral/empilhado;
mede título e subtexto na largura da coluna, reservando sua altura natural.
Agrupa medidas/escritas na janela virtual e retira o limite de altura apenas
durante a medição, sem pintar o estado intermediário. Essa retirada evita medir
texto comprimido em zero nas linhas mínimas. O empilhado só é escolhido quando
permite imagem maior; Compacto permanece lateral. CSS mantém 16:9 e padding,
sem teto fixo de imagem ou reserva fixa para o texto. Nenhuma mudança de banco,
backend, preferências, dependências ou dados pessoais.

**Prova executada no Windows, Node v22.12.0, dados descartáveis:**

| Comando | Resultado, saída 0 |
|---|---|
| `npm test` | 232 testes: 226 aprovados, seis ignorados, zero falhas |
| `npm run test:e2e:miniatura` | 4/4 novos grupos Playwright; imagem crescente, título abaixo/sem sobreposição, arraste/slider reais, larguras 180–1100, alturas 64/136/600, título longo/curto, fallback, Compacto, seleção e reload |
| `npm run test:e2e:pos-f6` | 13 cenários, zero falhas |
| `npm run test:e2e:refinamentos` | 9/9, incluindo 5.000 vídeos e conservação da posição/seleção ao mudar altura |
| `npm run test:e2e:resumos` | 7/7, provedor HTTP controlado |
| `npm run test:e2e` | 57/57 CDP |
| `npm run build` | typecheck e build aprovados |
| `npm run verificar` | nove verificações OK, TUDO OK |

Com linha 600 px e coluna 1100 px, mediu-se imagem **905×509 px**, título abaixo
e bloco inteiro dentro da linha. Coluna 700 usa **678×381 px**: depois de atingir
a largura útil da coluna, a imagem precisa parar de crescer para manter 16:9.
Isso é limite geométrico, não teto artificial. Captura após reload inspecionada
visualmente. O novo teste falhou antes da correção pela diminuição da imagem.

O roteiro pós-F6 tinha caminho Linux escolhido sem conferir existência; agora
seleciona um executável existente também no Windows. Seu limite fixo de imagem
maior que 120 px numa linha de 200 foi substituído pela ausência de sobreposição:
nessa coluna, imagem maior cortaria o título/subtexto. A matriz nova exige
crescimento, proporção e limites reais, sem relaxar esses critérios.

Evidências fora do Git em `../Continuidade de Projeto/miniatura-adaptativa-76e57d1/`:
`LEIA-ME.md`, logs finais, `antes/` e `depois/` (capturas e `medidas.json`). Logs
intermediários com falha são diagnóstico, não resultado final.
Não executados: nova regressão Linux, YouTube/LLM reais, alteração do banco pessoal
ou homologação humana. O texto de contexto relata F6 funcionando em uso real;
isso é relato do proprietário, não uma nova geração real nesta rodada.

**Próxima ação:** conferir visualmente na instalação do proprietário após
recarregar a página (ou reconstruir/reiniciar se estiver usando `dist/`), incluindo
seu par altura/largura. Preservar os oito ajustes e não iniciar F7 por inferência.
O commit desta correção contém este registro; consultar `git log -1`.

## Entrega anterior recebida — F6-A da Arena (histórico)

**Branch de trabalho:** `arena/735d302d-contextflow` (a partir de `e11a748d`).
Base local antes desta rodada: `71b64b4`. F7 **não iniciada**, por instrução.

Os oito ajustes pedidos no comando pós-F6 foram implementados com SPEC prévia
em `docs/specs/f6a-ajustes-pos-f6.md`. Nenhum módulo funcional foi reescrito;
uma migração nova (6) entrou só para metadados de cache de miniatura.

| # | Ajuste | Onde |
|---|---|---|
| 1 | Feedback de carregamento | `adicionar-link.js` (estado do botão, `aria-busy`, trava de clique repetido), faixa `#atividade-biblioteca` em `aplicacao.js` |
| 2 | Limpeza do histórico | `DELETE /api/trabalhos/historico` + `GET .../historico/resumo`; painel em Importações |
| 3 | Preferências de leitura | `js/preferencias-leitura.js`, usado pelo painel e pela Biblioteca |
| 4 | Miniaturas | migração 6, `modulos/miniaturas/`, `integracoes/miniaturas.ts`, `GET/POST /api/miniaturas/:id` |
| 5 | Markdown nos resumos | `js/markdown.js` (renderizador próprio, sem HTML), linha e painel |
| 6 | Fonte do resumo | `#diminuir-fonte`/`#aumentar-fonte`/`#restaurar-fonte`, 11–20 px, `--fonte-resumo` |
| 7 | Organização dos controles | grupos seleção / lote / aparência, sem remover botão |
| 8 | Miniatura adaptativa | `data-layout` das medidas reais; sem teto fixo de 420px/55%; lateral ↔ empilhado |

**Decisões que precisam sobreviver à retomada:**

- Limpar histórico **não apaga vídeo, transcrição, resumo nem coleção** — só a
  entrada de fila. Trabalho ativo é recusado (422). O estado "excluído" não
  existe no domínio e não foi inventado.
- "Duplicado" no histórico significa *reimportação da mesma origem*, contada
  por `trabalhos` + `youtube_id`; não é vídeo duplicado (o banco deduplica).
- Miniaturas: o motor continua com `--skip-download`. O que mudou é que a
  **capa** é baixada uma vez, guardada em `<dados>/miniaturas/` e servida por
  `/api/miniaturas/:id`. Sem rede/CDN, o substituto continua sendo a resposta.
- Markdown é conteúdo não confiável: o renderizador nunca usa `innerHTML`.
  HTML do resumo aparece como texto; `javascript:`/`data:` são descartados.
- O layout da miniatura é decidido por medida (`largura da coluna` ×
  `largura que a imagem quer ocupar`), não por breakpoint de tela.

### Correção do item 8 depois do teste do proprietário

O primeiro teste no navegador não reproduziu o cenário real: a coluna de vídeo
estava estreita. Com linha alta e coluna larga, a miniatura parava em 420px
(teto do `clamp`) e, como `55% + gap + texto` sempre cabia, o modo empilhado
nunca era alcançado — sobrava vazio e o título ficava ao lado.

Corrigido: o CSS não impõe mais teto (consome `--miniatura-largura` do JS) e o
JS compara o espaço vertical real com o lateral. Medido: 71→199→348→491→629→758
de largura conforme a linha cresce, empilhando quando o lado a lado limitaria.
O cenário Playwright novo falha com a lógica antiga nos quatro sintomas
relatados e passa com a correção (13 cenários no total).

**Validação desta rodada (Linux, comandos executados e saída 0):**
`npm test` **232 testes, 232 aprovados** (198 anteriores + 34 novos);
Playwright pós-F6 **13/13**; CDP **57/57**; refinamentos **9/9**; resumos F6
**7/7**; `npm run build` e `npm run verificar` (nove OK/TUDO OK) aprovados.
Um teste de integração externo (cache de miniaturas com CDN dublê e limpeza de
histórico com reinício) também passa: 9/9.

**Pendências de homologação (Windows/proprietário):** repetir a matriz acima
na máquina do proprietário; conferir em rede real de YouTube se a cópia local
da capa aparece após a primeira falha de CDN; validar a limpeza de histórico
com o banco pessoal (o teste usa dados descartáveis). O defeito de abertura do
sistema relatado antes **continua sem homologação** e não foi tratado aqui.

---

## Estado anterior — 22/11/2026 — F6

### Correção vigente — LiteLLM local e limites de saída

Base `8434a25`, `main` limpa antes do pedido do proprietário. A captura mostrou
endpoint `http://0.0.0.0:4000`, chave vazia e saída 8192/contexto 16384.
Havia três bloqueios do aplicativo: endereço de escuta rejeitado, exigência de
chave mesmo em proxy sem autenticação e teto de saída 8192/um terço do contexto.

Correção conforme adendo da SPEC F6: normalizar `0.0.0.0` para `127.0.0.1`,
permitir chave opcional em OpenAI compatível, salvar formulário atual antes do
teste de conexão, listar/sugerir modelos e avisar se o nome não consta. OpenAI e
Anthropic oficiais seguem exigindo chave; proxy com autenticação ainda devolve
401/403. HTTP remoto segue rejeitado. Não adicionar `/v1` automaticamente:
preservar o caminho da base informada, compatível com a raiz do LiteLLM consultado.

Saída de 128 a 1.000.000 tokens na UI/API, limitada ao contexto com reserva
`bytes UTF-8 do prompt + 1024` para entrada/margem. Não garante que o modelo
aceite esse valor: usar seus limites reais. Resposta HTTP limitada a 32 MB para
acomodar saídas longas. Sem migração, dependência nova ou mudança nas chaves salvas.

**Prova real executada:** cliente corrigido consultou `/models` no LiteLLM do
PC em loopback, sem chave, e confirmou a lista/modelo `meu-pool`; configuração
em memória com contexto 200000/saída 131072 aceita. Nenhuma geração real foi
solicitada nem configuração pessoal foi substituída. O app já aberto precisa
ser reiniciado e a página recarregada para carregar o backend/JS corrigidos.

Validação desta rodada: `npm test` 198 testes, **192 aprovados, seis ignorados,
zero falhas**; Playwright F6 **7/7** (novo cenário LiteLLM sem chave, normalização,
modelo ausente, sugestões, salvar/testar formulário, reload e geração controlada
com saída 131072). Dois novos testes de integração comprovam limites e auth.
Regressão CDP **57/57**, build/typecheck aprovados e fumaça **nove OK/TUDO OK**;
todos os comandos desta rodada encerraram com saída 0.
Os nove grupos de refinamentos da grade passaram na entrega `8434a25`; não
foram repetidos nesta correção de configuração. Evidências desta rodada em
`../Continuidade de Projeto/f6-litellm-8434a25/`; conexão real separada da geração
com proxy controlado. Geração no LiteLLM real e Linux continuam não executados.

Configuração confirmada para retomar: provedor OpenAI compatível, endpoint
`http://127.0.0.1:4000`, modelo `meu-pool` (ou outro nome listado pelo proxy),
chave vazia no proxy atual sem auth. Clicar Salvar e testar conexão. Informar
contexto/saída conforme o limite real do modelo, sem inferir capacidade do alias.

### Entrega inicial F6 — registro de `8434a25`

**F6 implementada e validada tecnicamente com provedores HTTP controlados no
Windows. Geração em conta/modelo real e homologação humana não executadas.**
Branch `main`; base `9094137` (dimensões da grade já commitadas). A entrega F6
é o commit que contém este registro; localizar com `git log -1` após o commit.

**Autorização:** o proprietário pediu comitar e avançar à próxima fatia, seguido
de continuar. Isso autoriza a F6 e supera a proibição anterior dessa fase.
SPEC fechada antes do código: `specs/f6-resumos.md`, substituindo o rascunho antigo.
Não houve implementação de F7/F8 como fatias completas nem alteração do original
Python. Layout, barra de altura e divisórias redimensionáveis preservados.

### Entrega e decisões

- Configurações de OpenAI, Anthropic, Ollama e OpenAI compatível: modelo,
  endpoint, prompt/versão, contexto/saída, concorrência, timeout e preços opcionais.
  HTTP nativo, sem dependência de produção nova. HTTPS remoto, HTTP só loopback;
  chave vinculada ao provedor/endpoint; redirects proibidos.
- Credencial separada em `ia/secrets.json`, sob a pasta de dados; DPAPI
  CurrentUser no Windows (executado com chave sintética). Configuração comum em
  `ia/config.json`. API não devolve chave, navegador não a persiste. POSIX usa
  0700/0600; essa execução Linux não foi realizada. Segredos/bancos pessoais
  não foram lidos nem adicionados ao Git.
- Seleção na Biblioteca ou vídeo no painel → estimativa conservadora → confirmação
  → fila persistente F4. Sem transcrição: motivo explícito, sem geração fictícia.
  Sem preços: custo desconhecido, não zero. Estimativa inclui até três tentativas
  por chamada; não representa fatura. Mudança de conteúdo/configuração invalida
  confirmação antiga. Geração automática ao importar continua desabilitada,
  orientando usar a Biblioteca para confirmar custos.
- Migração 005, com backup automático antes da alteração: versões/revisões
  preservadas em `resumos`; fonte/configuração imutáveis por trabalho em
  `resumos_execucoes`, sem chave. Resultado/conclusão sob fencing da fila.
  Rollback recusa perda de histórico/trabalhos F6: restaurar o backup anterior.
- Texto longo: divisão por orçamento conservador UTF-8, resumos parciais e
  consolidação com limite de chamadas; falha explícita se não reduzir. HTTP429,
  5xx, rede/timeout: até três tentativas canceláveis; 401/403 não retentam
  automaticamente. Retry manual conserva fonte/modelo aprovados. Reabertura
  recupera snapshot persistido; chamadas podem repetir após interrupção.
- Grade/painel mostram resultado; histórico, cópia e revisão desatualizada.
  Falha nova preserva resumo anterior. Prévia é invalidada após término, evitando
  resumo antigo na grade até reload. Preferências em janela estreita agora
  quebram linhas, sem cortar caminhos/prompt. Configuração geral F8 segue pendente.

### Evidência executada

Windows, Node v22.12.0; dados descartáveis e provedores locais de teste.

| Comando | Resultado real |
|---|---|
| `npm test` | 196 testes: 190 aprovados, seis ignorados, zero falhas; saída 0 |
| `npm run test:e2e` | 57/57 cenários CDP; saída 0 |
| `npm run test:e2e:refinamentos` | 9/9 grupos Playwright; saída 0 |
| `npm run test:e2e:resumos` | 6/6 grupos Playwright F6; saída 0 |
| `npm run build` | typecheck e compilação aprovados; saída 0 |
| `npm run verificar` | nove verificações OK, TUDO OK; saída 0 |

Os 13 testes F6 de integração exercitam contratos HTTP, DPAPI, migração/backup,
confirmação/idempotência, revisão/histórico, map/reduce, timeout/429/5xx/401,
resposta inválida, cancelamento/backoff/retry, concorrência e reabertura do motor.
Playwright usa navegador real com servidor HTTP controlado, **não um LLM real**.
Capturas de estimativa e Configurações estreita também inspecionadas visualmente.
Regressão mantém os 5.000 vídeos sintéticos e controles de dimensão.

Correções durante validação: o teste antigo de migração F5 tinha duas contagens
fixas incompatíveis com a nova migração; ajustadas para as migrações pendentes.
Agregação de filhos da fila limitada a playlist/lote, evitando tratar geração
como importação pai; versão pronta mais recente ganha prioridade na leitura.
Mensagens de cancelamento agora se referem a trabalho, também válidas para IA;
o teste de fencing verifica o código de domínio em vez do gênero da mensagem.
Falha intermediária e resultados finais estão separados nos logs.

Evidências fora do Git: `../Continuidade de Projeto/f6-resumos-9094137/`.
`LEIA-ME.md` identifica logs finais e capturas. Não foi necessário instalar
dependências novas. Não executados: chamadas reais OpenAI/Anthropic/compatível,
modelo Ollama real (sem ambiente/credenciais configurados para esta validação),
regressão Linux, novo YouTube real e homologação humana. Não equivalem a teste
aprovado; continuidade técnica da F6 não encerra esses aceites.

**Próxima ação:** homologar manualmente a interface e, nas Configurações locais,
configurar um provedor/modelo real, testar conexão e gerar um resumo após conferir
estimativa; nunca compartilhar chave no chat. Depois, fechar SPEC da F7 antes
de implementá-la. F7/F8/F9 não foram iniciadas nesta entrega.

## Histórico — estado de 21/11/2026 (superado pelo registro acima)

**F5-UI (reformulação da interface) implementada, testada e commitada.
Homologação humana pendente.** A F6 (IA para resumos) está somente especificada
e é a próxima na sequência do plano, mas o proprietário determinou que
**não** fosse iniciada nesta etapa.

### Rodada vigente — altura deslizante e larguras redimensionáveis

Pedido explícito do proprietário sobre `main`, base `027c7df`, árvore limpa.
Implementação pelo Codex, limitada a dimensões da grade; F6 não iniciada.
SPEC: `specs/f5-ui-dimensoes-grade.md`.

- Altura ampliada de **64 a 600 px**, passo de 1 px, por barra deslizante no
  painel Colunas; padrão 136 px restaurável. Compacto mantém 64 px. Miniatura
  e quantidade de resumo acompanham altura e largura disponíveis.
- Divisórias arrastáveis nos cabeçalhos de dados, com captura de ponteiro,
  setas/Home/End pelo teclado, Escape para cancelar e duplo clique para restaurar
  uma coluna. Botão Restaurar larguras para voltar ao dimensionamento automático.
  Seleção permanece fixa em 46 px. Larguras salvas no objeto de preferências
  visuais existente, compatível com valores anteriores e com colunas ocultas.
- Módulo novo `redimensionamento-colunas.js` cuida apenas dos controles;
  Biblioteca continua dona das medidas/preferências. Sem dependências novas,
  alteração de banco, backend ou conteúdo. Após medidas manuais, a tabela
  respeita essas medidas e pode rolar horizontalmente dentro do viewport.
- Ajustar altura longe do topo mantém o vídeo/posição lógica e a seleção.
  Para isso, os espaçadores da tabela agora atualizam altura da linha e célula,
  e a âncora é preservada durante o reflow. Dados estreitos não esticam as linhas.

**Verificações executadas no Windows (Node v22.12.0):**

| Comando | Resultado |
|---|---|
| `npm test` | 183 testes: 177 aprovados, 6 ignorados, zero falhas; saída 0 |
| `npm run test:e2e` | 57/57 cenários CDP; saída 0 |
| `npm run test:e2e:refinamentos` | 9/9 grupos Playwright; saída 0 |
| `npm run build` | build e typecheck aprovados; saída 0 |
| `npm run verificar` | nove verificações OK, TUDO OK; saída 0 |

Playwright exercitou ponteiro e teclado na barra, extremos 64/600, padrão,
arraste de colunas, limites 80/1200 de apoio, Escape, reload, ocultar/restaurar,
duplo clique, ordenação após resize, leitura e navegação. Rolagem com 5.000
vídeos conservou o vídeo 3.000 no recorte ao alternar alturas, incluindo
64→600 e 600→64. Fixture: 1/5/29 linhas visíveis de resumo em 64/136/600 px,
com imagem proporcional. Dados sintéticos, sem banco pessoal ou serviços externos.

Evidências: `../Continuidade de Projeto/dimensoes-grade-027c7df/`:
`playwright-final.log`, `npm-e2e-final.log`, `npm-test.log`, `npm-build.log`,
`npm-verificar.log`; capturas em `capturas/`. Logs de diagnóstico e `falha-*`
são tentativas intermediárias, não resultado final. Não executados: YouTube real,
provedores de IA e regressão Linux. Nenhuma nova instalação necessária.

**Próxima ação:** homologação humana do controle deslizante e das divisórias.
Outras funcionalidades e F6 exigem nova autorização. Rodadas abaixo são histórico.

### Rodada anterior — refinamentos sobre a entrega atualizada da Arena

**Autorização:** após trazer o repositório atualizado, o proprietário pediu ao
Codex que implementasse os refinamentos combinados. Esse pedido substitui,
para esta tarefa, a atuação apenas documental anterior. F6 continua fora.

Base conferida: `main`, `da4cf1b` (sobre `ef51be9`), sem alterações locais
preexistentes. A entrega da Arena agora está presente, inclusive opções de
transcrição, tratamento de miniaturas, gaveta e controle de altura. Foi
preservada; os ajustes atuais complementam essa entrega.

**O que mudou e por quê:**
- Seleção fixa em 46 px e vídeo logo a seguir: corrigidas as larguras da
  tabela e o `colSpan` dos espaçadores, que ainda declarava oito colunas
  mesmo quando várias estavam ocultas. Uma coluna de leitura absorve a sobra.
- Altura de 88–200 px realmente amplia a leitura: miniaturas de 104–222 px
  de largura, sempre 16:9; resumo cresce de duas para oito linhas visíveis.
  Compacto permanece com 64 px de altura. Nada foi alterado no conteúdo salvo.
- Recolher voltou ao topo junto da marca. Recolhida, a logo é o alvo de
  expansão (36×36 px); hover/foco troca a logo pelo ícone, sem deslocamento.
  Clique, Enter, Espaço, toque e restauração após reload exercitados.
- Corrigido o deslocamento de rolagem por ancoragem nativa no viewport
  virtualizado; teste alcança o vídeo 3.000 em três alturas, preservando seleção.
- Eventos de modo limitados aos botões: o seletor anterior também capturava
  a raiz e redesenhava a grade ao receber cliques de outros controles.

**Validação executada no Windows, Node v22.12.0:**

| Comando | Resultado |
|---|---|
| `npm install` | saída 0; 12 pacotes auditados, zero vulnerabilidades |
| `npm test` | saída 0; 183 testes, 177 aprovados, 6 ignorados, zero falhas |
| `npm run test:e2e` | saída 0; 57/57 cenários CDP |
| `npm run test:e2e:refinamentos` | saída 0; 7/7 grupos Playwright, cliques reais, teclado e toque |
| `npm run verificar` | saída 0; nove verificações aprovadas, `TUDO OK` |
| `npm run build` | saída 0; inclui typecheck sem erros |

Playwright cobre seleção/colunas/espaçadores, crescimento de imagem/texto em
88/136/200 px, compacto, dez ciclos de lateral e reload, hover/foco, rolagem
com 5.000 vídeos, navegação nas três telas, larguras 390/768/960/1366/1920 px,
estados aberto/recolhido no desktop, gaveta e toque. Zero exceções JavaScript.
As falhas iniciais reproduzidas e as capturas comparativas ficam fora do Git em
`../Continuidade de Projeto/refinamentos-ui-da4cf1b/`. Provas finais:
`playwright-final.log`, `npm-e2e-final.log`, `npm-test.log`, `npm-build.log`,
`npm-verificar.log` e capturas em `depois/`. A primeira reprodução conserva
as falhas que motivaram esta fatia; não representa o resultado após as correções.

SPEC: `specs/f5-ui-refinamentos-leitura.md`. Teste Playwright versionado em
`platform/testes/e2e/refinamentos-ui.mjs`, com servidor e banco descartáveis.
Nenhuma dependência nova, migração ou alteração de backend. O banco pessoal
não foi usado. Não executados nesta rodada: YouTube real, provedores de IA e
regressão Linux; fixtures não são prova desses serviços.

**Próxima ação:** homologação visual humana destes refinamentos. Não iniciar
F6 nem outras funcionalidades sem nova autorização. Registros abaixo são
históricos das rodadas anteriores e não redefinem este limite.

### Registro anterior — atualização documental de 21/11/2026

**Novo pedido preparado para a Arena:** o proprietário solicitou um arquivo
de texto para encaminhar, com correções da barra lateral que não reabre,
responsividade/largura, altura ajustável no modo Ampliado, colunas, miniaturas
e duas opções independentes de transcrição (tempos e texto corrido). O arquivo
está na raiz da pasta entregue: `../PEDIDO-PARA-ARENA-CORRECOES-INTERFACE.txt`.
As três imagens fornecidas foram copiadas para
`../Continuidade de Projeto/pedido-correcao-ui-2026-11-21/`.
Playwright em navegador real foi solicitado explicitamente para validar essa
tarefa, complementando a suíte CDP existente. A Arena deve escrever a SPEC
antes de implementar, trabalhar dentro da pasta entregue e seguir suas skills.
**Status:** pedido redigido para envio pelo proprietário; não enviado pelo
Codex, não implementado e não validado. F6 continua fora do escopo.

- **Pedido atual:** manter documentação e continuidade conforme o estado real.
  Codex atua como parceiro de raciocínio; comandos de implementação serão
  preparados com o proprietário para a Arena. Não refazer a revisão visual
  enviada apenas como contexto e não iniciar F6.
- **Relato do proprietário:** a Arena já concluiu a revisão visual/funcional
  descrita no texto anexado, incluindo o pedido de corrigir a barra lateral.
  Isso registra o relato, sem transformar o texto do pedido em evidência de aceite.
- **Fato local:** branch `main`, base desta atualização `2c98678`; não há nova
  alteração local em `platform/` nem commit adicional da Arena identificado
  nesta retomada. A regressão disponível é a da base `0fdf6e8`, abaixo.
  A conclusão da Arena não foi homologada nem revalidada aqui.
- **Correções documentais:** README atualizado de F1 para F5-UI; navegação de
  três telas e decisão SQLite/sem ORM reconciliadas com decisões já registradas;
  arquitetura física, matriz de aceite e limite da F6 alinhados. Nenhuma nova
  funcionalidade ou mudança de escopo foi decidida.
- **Limites da prova:** os 57 E2E não comprovam o acesso real ao botão da barra
  após recolher, pois o teste usa `.click()` programático. A tentativa posterior
  com Agent Browser foi interrompida após o esclarecimento do proprietário e
  seus comandos de reprodução falharam; não comprova defeito nem correção.
  Detalhes em `../Continuidade de Projeto/qualidade-ui-2026-11-21/LEIA-ME.md`.
- **Validação desta alteração documental:** conferência de referências locais,
  confronto com código e logs existentes, `git diff --check`. Suítes não
  reexecutadas: nenhum código, teste, dependência ou contrato foi alterado.
- **Alterações preexistentes preservadas:** ZIP removido da raiz do Git;
  `LEIA-ME.md`, `ESTADO-DA-ENTREGA-19-11-2026.md` e `iniciar.bat` avulsos,
  não versionados. A orientação vigente está nos documentos versionados.
- **Próxima ação:** incorporar a revisão e o relatório da Arena quando
  disponíveis, identificando commit, cenários e evidências; então preparar
  juntos o próximo comando de implementação. Homologação humana pendente.

| Fase | Situação | Commit | Evidência |
|---|---|---|---|
| F1 — fundação | homologada | `9fb9f32` | 38/38 na época |
| F2 — persistência | homologada | — | migrações 001–003 |
| F3 — ingestão real | corrigida no Windows, **aceite humano pendente** | `c6b7db5` | teste real com YouTube |
| F4 — fila persistente | implementada e testada | `5a13b3c` | SIGKILL, lease, fencing |
| F5 — Biblioteca | implementada e testada | `7b58f32` | virtualização, filtros, lote, coleções |
| **F5-UI** — reformulação | **implementada, aguardando homologação** | `9e7ce02`, `3db2e48`, `909843a`, `6d571c3`, `0b9a9bd`, `978401d` | **57/57 E2E** |
| F6 — IA para resumos | especificada, **não implementada** | `d9ef6a6` (spec) | — |

### Revisão local — Windows, base `0fdf6e8`

Repositório conferido em `Desktop/projeto/contextflow2`, branch `main`.
Revisão documental e regressão executadas após a reformulação; nenhum código
do produto ou layout foi alterado nesta revisão. F6 permanece sem implementação.

| Comando executado | Resultado real (Node v22.12.0, Windows) |
|---|---|
| `npm install` | saída 0; dependências atualizadas, 10 pacotes auditados, zero vulnerabilidades |
| `npm test` | saída 0; 183 testes: 177 aprovados, 6 ignorados, zero falhas |
| `npm run test:e2e` | saída 0; 57/57 cenários aprovados em navegador real |
| `npm run verificar` | saída 0; nove verificações OK, `TUDO OK` |
| `npm run build` | saída 0; inclui `npm run typecheck`, sem erros |

Os seis testes ignorados usam scripts de shell/shebang incompatíveis com Windows;
não são seis aprovações. Volume exercitado no E2E: 5.004 vídeos, 23 linhas no DOM;
120 quadros com mediana 16,7 ms, p95 16,8 ms e máximo de 27 linhas.
Dados descartáveis em `platform/testes/.tmp`, sem uso do banco pessoal.

Evidências externas: `../Continuidade de Projeto/revisao-f5-ui-0fdf6e8/`
contém os cinco logs completos e capturas geradas pela suíte. São provas da
revisão indicada, não de futuras alterações. Importações contra YouTube real
**não executadas nesta revisão**: a regressão usa processos/fixtures controlados;
a prova anterior da F3 não foi repetida. Homologações humanas continuam pendentes.

**Divergências encontradas na retomada:**
- `LEIA-ME.md` avulso, não versionado, aponta para `~/contextflow/`, caminho
  inexistente nesta máquina. Não seguir esse redirecionamento nem alterar o
  original Python em `Desktop/contextflow`. O arquivo foi preservado.
- A pasta de continuidade só continha evidências anteriores à F5-UI; a revisão
  acima e o índice externo agora identificam a base atual.
- Na revisão anterior, o escopo canônico enumerava quatro telas e banco/ORM a definir; a SPEC
  F5-UI e a implementação usam três telas, leitura integrada e SQLite já decidido.
  Divergência reconciliada na atualização documental atual com as decisões
  já registradas, sem retirar capacidades de leitura previstas para V1.
- A descrição antiga das capturas em `docs/mockups/evidencia/` afirma 5.000
  vídeos e 1.667 resumos, mas `biblioteca-com-resumos.png` exibe seis resultados.
  Essa captura não comprova o volume anunciado. O volume foi comprovado
  separadamente no E2E desta revisão; as métricas históricas de 1.667 resumos
  não foram reproduzidas.

As próximas ações vigentes estão no início deste documento. F6 não deve ser
iniciada; a sequência do plano mestre não constitui nova autorização.

### Registro anterior — Linux, Node v22

```
npm test          183/183
npm run test:e2e   57/57
npm run verificar TUDO OK
npm run build     OK
npm run typecheck  0 erros
npm run build      OK
```

Os antigos 157 testes e 26 cenários do Windows correspondem à F4, não à
suíte atual. A contagem Windows desta revisão está registrada acima.

### O que a F5-UI mudou

Reformulação centrada na Biblioteca, a partir dos dois mockups do proprietário
(guardados em `docs/mockups/`, com as capturas PNG). A spec está em
`docs/specs/f5-ui-reformulacao.md`.

- **Biblioteca** vira a área de trabalho: linhas de 136 px com miniatura de
  148×83 e **resumo legível na própria linha**, com limite de linhas e "ver
  mais". Alterna para 64 px no modo compacto.
- **Colunas configuráveis** (canal, duração, adicionado, estado, resumo,
  estado do resumo), persistidas em `localStorage`. Colunas são distintas de
  filtros e de ordenação — o painel diz isso explicitamente.
- **Painel sobreposto** de leitura, aberto só por botão explícito na miniatura
  (nunca ao selecionar linha). Traz título, miniatura, canal, duração, datas,
  coleções, link original, resumo completo e transcrição com timestamps
  clicáveis. Fechar devolve ao mesmo contexto.
- **Árvore lateral** (Canais, Playlists, Data de importação, Minhas coleções)
  com contadores e seleção que filtra pelas mesmas rotas. A barra recolhe de
  256 px para 56 px.
- **Janela "Adicionar link"** com validação local e envio para a importação
  que já existia — não há segundo mecanismo.
- **A tela "Leitura" deixou de existir** como aba: foi absorvida pela linha e
  pelo painel. `#leitura` redireciona para `#biblioteca`, para link antigo
  não quebrar.

### Adições ao backend (todas aditivas)

| Rota / campo | Por quê |
|---|---|
| `GET /api/biblioteca/:id/resumo` | a interface precisa **exibir** resumo; o contrato só expunha `temResumo`. Leitura pura: a F6 é quem escreve. |
| `GET /api/biblioteca/meses` | agrupar por mês no banco; derivar de uma página de 500 itens daria contagem errada. |
| `importadoDe` / `importadoAte` em `GET /api/biblioteca` | recorte real por data para a árvore. Quem não passa continua vendo tudo. |

### Defeitos encontrados e corrigidos nesta etapa

1. **Interface destruída no working tree.** A entrega anterior do Codex
   removeu 24 elementos que o JS consome e a própria tag
   `<script type="module" src="/js/aplicacao.js">`. Medido: 5/27 cenários E2E.
   As alterações foram descartadas e a árvore voltou a verde.
2. **Virtualizador calculando a janela errada.** A altura da linha estava
   copiada em JS (168 px) e no CSS (136 px). As duas fontes divergiram e a
   lista pulava ao rolar. A altura agora é **lida da variável CSS**
   `--altura-linha`.
3. **Janela limitada pelo total da consulta**, não pela quantidade já
   paginada: o render pedia índices inexistentes e a lista embaralhava.
4. **`hidden` sem efeito** em elementos com `display: grid/flex` declarado —
   o painel e a janela apareciam por cima da tela. Regra `[hidden]` global.
5. **Canal duplicado** na linha e resumo aparecendo em duas colunas ao mesmo
   tempo. Cada informação tem um lugar só.

### Pendências conhecidas

- **Homologação humana da F5-UI** e da F3 (teste real de YouTube no Windows).
- F6 (resumos por IA) especificada, não implementada. O botão "Gerar resumo"
  aparece **desabilitado com o motivo visível**.
- Drag-and-drop na árvore: deliberadamente fora (futuro).
- Os mockups em HTML usam Tailwind via CDN e **não abrem sem rede**; os PNG
  são a referência confiável e foram gerados compilando o Tailwind localmente.

## Comandos (a partir de `platform/`)

| Comando | Para quê |
|---|---|
| `npm install` | dependências de desenvolvimento |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + `dist` |
| `npm start` | execução do build |
| `npm test` | unidade + integração (183; 6 ignorados no Windows) |
| `npm run test:e2e` | navegador real via CDP (57) |
| `npm run verificar` | fumaça de endpoints e estáticos |
| `npm run typecheck` | só tipos |

`CONTEXTFLOW_PORTA`, `CONTEXTFLOW_HOST`, `CONTEXTFLOW_DADOS` e
`CONTEXTFLOW_YTDLP` controlam o motor. Ver `docs/03-arquitetura-e-contratos.md`
e `platform/src/motor/src/nucleo/configuracao.ts`.

## Rodada de 21/11/2026 — correções pontuais pedidas pelo proprietário

**Implementadas e validadas tecnicamente. Homologação humana pendente.**
SPEC: `docs/specs/f5-ui-correcoes-2026-11-21.md`. Pedido de origem:
`Continuidade de Projeto/PEDIDO-PARA-ARENA-CORRECOES-INTERFACE.txt`.

| # | Defeito | Causa raiz | Correção |
|---|---|---|---|
| 1 | Barra recolhe e não reabre | botão dentro de `.marca` era empurrado para x=49 numa barra de 56 px, fora da área visível; rótulo era texto solto, impossível de ocultar | botão no pé da barra, visível nos dois estados, com `aria-expanded`; rótulo em `<span>` |
| 2 | Faixa morta à direita | `.tela` com `max-width` sem centralização | `margin-inline: auto` |
| 3 | Sem ajuste de altura | não existia | controle no painel de colunas, 88–200 px, fonte única na variável CSS |
| 4 | "Resumo" aparecia desmarcado; vazio de 218 px | `resumo-estado` ausente da lista de colunas ocultas; `table-layout: fixed` distribuía a sobra no checkbox | seletor incluído; `.col-selecao` com largura fixa; piso da tabela acompanha as colunas visíveis |
| 5 | Transcrição em faixa estreita | coluna de tempo fixa, sem leitura contínua | duas opções independentes; nada do conteúdo muda |
| 6 | Miniatura quebrada | sem tratamento de `error` | fallback com proporção preservada na lista e no painel |
| 7 | **Achado na validação:** sem navegação abaixo de 900 px | CSS previa `data-barra-mobile`, nada o definia; não havia botão | botão de menu, véu, Esc e fechamento ao escolher a tela |

**Números desta máquina (Linux, Node v22.22.3):**

```
npm test            183/183
npm run test:e2e     57/57
npm run verificar    TUDO OK
npm run typecheck    0 erros
npm run build        OK
```

Mais 6 suítes Playwright desta tarefa (barra, transcrição, altura, miniatura,
gaveta, responsividade geral) — todas OK. O detalhamento está na SPEC §3–§4.

**Ressalvas registradas:** as miniaturas foram exercitadas com respostas
controladas por `page.route` (dublê), não contra o YouTube real; a importação
real segue não executada nesta máquina; a homologação visual é do proprietário.

Playwright entrou como **dependência de desenvolvimento** (`1.56.1`), a pedido
explícito do proprietário. Não há dependência nova de produção.

## Histórico

### Sessões anteriores a 21/11/2026

Base documental: ZIP `ContextFlow_Pacote_Execucao_V1 (1).zip` (18/11/2026).
O projeto original em `../contextflow/` permanece **intacto e somente
leitura** — nenhuma escrita foi feita nele.

| Fase | Commit | O que entregou |
|---|---|---|
| F1 | `9fb9f32` | monólito modular, contratos, servidor HTTP, UI mínima |
| F2 | — | SQLite com `node:sqlite`, migrações 001–003 |
| F3 | `c6b7db5` | yt-dlp, transcrições com tempo, leitor |
| F4 | `5a13b3c` | fila persistente, lease, fencing, retry, playlist |
| F5 | `7b58f32` | Biblioteca com virtualização, filtros, lote, coleções |
| F6 | `d9ef6a6` | apenas a especificação |

Ambiente do proprietário: Windows/PowerShell, Node v22.12.0, yt-dlp 2026.03.17,
Chrome real via CDP. Nenhum login, cookie, chave ou token foi usado nas
validações.

**Decisões que continuam valendo:** monólito modular; `node:sqlite` (o
`better-sqlite3` não instala em árvore limpa); sem etapa de build no frontend
(JS puro em módulos ES servido pelo motor); sem Whisper na V1; chat/RAG só na
V2.
