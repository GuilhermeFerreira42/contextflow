# Matriz de aceite — ContextFlow V1

| # | Cenário | Ação | Resultado verificável |
|---|---|---|---|
| A1 | Vídeo com legendas manuais | Importar URL | título/canal corretos, segmentos ordenados, origem e timestamps persistidos após reiniciar |
| A2 | Vídeo só com legendas automáticas | Importar URL | fallback usado, origem `auto` registrada, texto preservado |
| A3 | Vídeo sem legenda | Importar URL | indisponibilidade explícita; nenhum resumo falso nem tarefa eternamente pendente |
| A4 | Playlist | Importar e repetir | itens únicos por identidade, progresso/erros individuais, sem duplicação |
| A5 | Falha de rede | Simular interrupção | job em estado recuperável; retry não corrompe dados |
| A6 | Cancelamento | Cancelar tarefa em andamento | execução termina seguramente; dados concluídos preservados |
| A7 | Reabertura do app | Salvar e reiniciar | itens, transcrições, resumos e configurações não secretas persistem |
| A8 | Biblioteca grande | Popular fixture, rolar/filtrar | UI responsiva, seleção por ID, linhas coerentes (metas medidas na E0/F5) |
| A9 | Seleção múltipla | Filtrar/ordenar após selecionar | ações atingem somente IDs selecionados, não índices visuais deslocados |
| A10 | Leitura contínua | Expandir, buscar, abrir leitor, voltar | posição, seleção e filtros preservados; texto longo legível |
| A11 | LLM indisponível | Solicitar resumo | erro identificável; transcrição original intacta |
| A12 | Custos e segredos | Trocar provedor, exportar dados e logs | valores sensíveis não expostos; estimativa não apresentada como cobrança certa |
| A13 | Migração | Importar base original sanitizada | identidade, trechos e resumos preservados; rollback documentado |
| A14 | Segurança local | Tentar URL/arquivo fora das regras | rejeição clara, sem acesso arbitrário a paths ou comandos |
| A15 | Sistemas operacionais | Instalar e usar nos dois SOs | comandos reais documentados e testes separados Windows/Linux |

## Status de execução (atualizado a cada fatia)

**Visualização horizontal (base `51ba4a9`, Windows):** Playwright4/4 específicos,
CDP57/57, refinamentos9/9 com5.000 vídeos, pós-F6 13/13, suíte238 (232 aprovados,
seis ignorados), build/typecheck/fumaça aprovados. Controles imediatos, restauros,
seleção/filtros/modo/leitura preservados, navegação/reload/novo contexto e seis
larguras; tabela recupera espaço ao recolher. Desktop/mobile inspecionados.
Apenas frontend de produção; teste da fila estabilizado sem alterar a fila.
Evidências: `../Continuidade de Projeto/painel-visualizacao-51ba4a9/LEIA-ME.md`.

**Recuperação de capas (base `adb6c57`, Windows):** 231 testes aprovados e seis
ignorados (237 total), CDP57/57, Playwright recuperação3/3 e layout4/4,
build/typecheck/fumaça aprovados. Caso real: URL localizada404; JPEG padrão200,
cache recuperado e imagem1280×720 exibida no navegador da aplicação local.
Sem conversão, migração ou alteração de vídeo/transcrição/resumo. Os demais
roteiros completos permanecem como prova anterior, não nova execução. Evidências:
`../Continuidade de Projeto/recuperacao-miniaturas-adb6c57/LEIA-ME.md`.

**Miniatura adaptativa (base `76e57d1`, Windows):** 232 testes, 226 aprovados e
seis ignorados; CDP 57/57; Playwright 4/4 miniatura, 13/13 pós-F6, 9/9
refinamentos e 7/7 resumos. Build/typecheck e nove verificações de fumaça OK.
Regressão nova falhou antes da correção: imagem diminuía ao aumentar a linha.
Depois: crescimento sem recuo, título abaixo e contido, 45 combinações de
altura/largura/conteúdo, seleção, Compacto e reload. Dados descartáveis; capturas
inspecionadas; homologação humana/Linux/serviços reais não executados nesta rodada.
Evidências em `../Continuidade de Projeto/miniatura-adaptativa-76e57d1/`.

**Correção LiteLLM (base `8434a25`):** 198 testes, 192 aprovados e seis ignorados;
7/7 grupos Playwright F6. Conexão real ao LiteLLM local sem chave e listagem de
modelos aprovadas; geração real não solicitada. Proxy controlado comprovou salvar,
testar formulário atual, normalização de endereço, sugestões de modelos, saída
131072, preservação de 401 e reserva de entrada. Sem ampliar o aceite para modelo
real nem repetir os nove grupos de dimensões. Evidências em
`../Continuidade de Projeto/f6-litellm-8434a25/`.

**F6 (22/11/2026, base `9094137`):** 196 testes, 190 aprovados e seis ignorados
no Windows; 57/57 CDP, 9/9 grupos Playwright de refinamentos e 6/6 de resumos.
Build/typecheck e nove verificações de fumaça aprovados. Os 13 testes de
integração F6 cobrem DPAPI real, configuração/reabertura, migração/backup,
histórico/revisões, contratos dos quatro provedores (três protocolos HTTP),
429/5xx/timeout/autenticação, respostas inválidas, cancelamento/retry,
concorrência e recuperação do snapshot ao reabrir o motor. Playwright cobre
configuração, confirmação/custo, lote sem legenda, fila, cópia/histórico,
cancelamento/retry, preservação de resumo e janela estreita.
Provedores são servidores controlados: geração/modelo/conta real não executados.
Evidências: `../Continuidade de Projeto/f6-resumos-9094137/LEIA-ME.md`.

**Dimensões da grade (base `027c7df`):** 9/9 grupos Playwright agora incluem
barra de altura 64–600 px, divisórias arrastáveis, teclado, cancelamento,
persistência e conservação do vídeo ao mudar altura longe do topo. CDP 57/57,
177 testes aprovados e seis ignorados no Windows. Resultados atuais no estado;
as contagens de rodadas anteriores abaixo permanecem históricas.

**Refinamentos após a entrega da Arena (`da4cf1b`):** o proprietário autorizou
implementação pelo Codex. Playwright versionado em `testes/e2e/refinamentos-ui.mjs`
cobre 7 grupos, com cliques reais, dez ciclos da lateral, logo/ícone no topo,
teclado/toque/reload, colunas/espaçadores, três alturas com crescimento efetivo
da miniatura e do resumo, 5.000 vídeos e cinco larguras de janela. Os resultados
atuais e limitações estão no início de `estado-atual.md`; registros abaixo
preservam o alcance das provas anteriores. Homologação humana pendente.

**Referência vigente (21/11/2026):** regressão Windows na base `0fdf6e8`,
documentada em `estado-atual.md`: 177 testes aprovados, 6 ignorados, zero falhas;
57/57 E2E; build/typecheck e fumaça aprovados. Evidências em
`../Continuidade de Projeto/revisao-f5-ui-0fdf6e8/`.
Nenhuma nova suíte foi executada na atualização exclusivamente documental.

Validação real de 19/11/2026, commit F3 `c6b7db5`: **A1 e A3 aprovados com vídeos
reais; A2 aprovado com en-orig explicitamente configurado**, após HTTP 429 da
tradução pt. A7 repetido com reinício real e comparação completa. **A15: suíte
Windows executada** (120 pass, 0 fail, 6 skips), E2E 17/17, build/fumaça OK;
regressão Linux desta sessão não executada. Aceite humano da F3 pendente.
Detalhes, URLs e evidências em `estado-atual.md`. Essa prova real não foi repetida
na revisão F5-UI; a tabela abaixo distingue prova anterior e regressão controlada.

| # | Status | Evidência |
|---|---|---|
| A1 (legenda manual) | ✅ **prova real anterior aprovada; aceite humano pendente** | validação Windows F3 em `validacao-f3-2026-11-19/`, referenciada no estado |
| A2 (legenda automática) | 🟨 **prova real com idioma original; ressalva na tradução pt** | F3 com `en-orig` explicitamente configurado após HTTP 429; não declarar tradução pt aprovada |
| A3 (vídeo sem legenda) | ✅ **prova real anterior aprovada; aceite humano pendente** | F3: transcrição indisponível com motivo e vídeo parcial, sem fingir conteúdo |
| A7 (reabertura do app) | ✅ **executado e aprovado** | processo morto com SIGKILL; outro processo releu os dados; mais `testes/integracao/ingestao.test.ts` reabrindo o arquivo do banco |
| A14 (segurança local) | ✅ **executado e aprovado** (ampliado na F3) | travessia de path bloqueada; `spawn` com `shell:false`; teste de injeção de comando na URL; URL de outro domínio rejeitada |
| A4 (playlist) | ✅ **executado e aprovado** | `testes/e2e` — playlist importada, itens classificados, filtro por playlist (F4) |
| A5 (falha de rede) | ✅ **executado e aprovado** | TLS bloqueado → 503 com mensagem correta; retry e repetição cobertos na F4 |
| A6 (cancelamento) | ✅ **executado e aprovado** | `testes/e2e` e integração: cancelamento pedido, encerramento, estado final |
| A8 (volume) | ✅ **executado e aprovado** | 5.004 vídeos no E2E, DOM com menos de 150 linhas; rolagem até o índice 3.000 sem perder identidade |
| A9 (seleção) | ✅ **executado e aprovado** | seleção por linha, selecionar visíveis, ações em lote, seleção fora do filtro |
| A10 (leitura contínua) | 🟨 **parcial; homologação humana pendente** | resumo na linha e painel com transcrição implementados; capacidades restantes de leitura avançada pertencem à F7 |
| A11, A12 (IA, custos, segredos) | 🟨 **F6 aprovada com provedores HTTP controlados; DPAPI Windows executado** | `resumos-f6.test.ts`, `resumos-f6.mjs`; custos conservadores/ausência de preços e isolamento da chave. Conta/modelo real, Linux e preferências gerais F8 pendentes |
| A13 (migração da base original) | ⬜ não executado | F9 |
| A15 (Windows e Linux) | 🟨 **regressão Windows executada; instalação/entrega V1 ainda pendente** | F6 Windows: 190 aprovados + 6 ignorados, 57 CDP, 15 grupos Playwright; registro anterior Linux: 183/183 e 57/57; Linux não reexecutado nesta revisão |

**Legenda:** ✅ executado e aprovado · 🟨 parcial ou verificado sem prova real · ⬜ não executado

### Aceite da F5-UI (reformulação da interface)

Implementação iniciada em `9e7ce02` e `3db2e48`, seguida pelos commits de
polimento registrados no estado. Regressão Windows da base `0fdf6e8`: 57/57.
O resultado verde não amplia o alcance das asserções existentes: por exemplo,
o teste da barra usa clique programático e mede largura; não prova que o controle
permanece alcançável pelo ponteiro após recolher. O proprietário informou que
a Arena já realizou a revisão posterior; sua entrega adicional ainda não foi
identificada na árvore local. Homologação humana continua separada.

| # | Critério | Status |
|---|---|---|
| U1 | Biblioteca com linhas ampliadas, miniatura e resumo legível na linha | ✅ |
| U2 | Colunas ocultam/exibem e a escolha persiste | ✅ |
| U3 | Modo compacto reduz a altura real da linha | ✅ |
| U4 | Ordenação por título/canal/data pelo cabeçalho | ✅ |
| U5 | Filtros de estado, canal, playlist, coleção e "com resumo" | ✅ |
| U6 | Painel abre com dados completos, resumo e transcrição | ✅ |
| U7 | Fechar o painel preserva busca, filtros e posição | ✅ |
| U8 | Árvore lista canais, playlists, datas e coleções | ✅ |
| U9 | Nó da árvore filtra a Biblioteca | ✅ |
| U10 | Barra lateral recolhe liberando espaço | ✅ largura verificada; acessibilidade do controle e ciclos repetidos não comprovados por esse teste |
| U11 | "Adicionar link" valida a URL antes de chamar o motor | ✅ |
| U12 | Importação feita pela janela aparece em Importações | 🟨 prova específica de envio pela janela não identificada nos 57 cenários; validação de URL coberta; fluxo clássico usa dublê no E2E |
| U13 | Importações e Configurações mantêm todos os recursos | ✅ |
| U14 | Seleção, ações em lote e coleções seguem funcionando | ✅ |
| U15 | Sem regressão na base `0fdf6e8`: 177 testes aprovados, 6 ignorados no Windows; 57/57 E2E | ✅ |
| U16 | Sem erro de script no console em nenhuma tela | ✅ |
| — | **Fidelidade visual aos mockups** | 🟨 **homologação humana pendente** |

### O que a F3 mudou nesta matriz

A1, A2 e A3 têm implementação, testes controlados e prova real anterior no
Windows, com a ressalva de idioma acima. O roteiro em `roteiro-teste-f3.md`
permanece referência para repetição, sem ser apresentado como tarefa nunca
executada. A homologação humana da F3 permanece pendente.

**Natureza:** especificações de comportamento, **não provas já realizadas**. Cada linha
precisa de teste unitário, de integração ou E2E em **navegador real**.
Registrar por linha: `executado / aprovado / falhou / ignorado / não executado`, e manter
**homologação humana separada** da verificação técnica.

> **Ferramenta de E2E:** o projeto usa **CDP direto** (`testes/e2e/executar.mjs`),
> falando com o Chrome/Chromium/Edge já instalado na máquina — **sem Playwright**.
> Isso é deliberado: o ambiente de desenvolvimento não tinha CDN acessível para
> baixar navegador, e depender do download de um browser headless de ~150 MB
> tornaria o teste frágil. O protocolo CDP cobre o que precisamos (DOM, clique,
> digitação, navegação, captura). Se no futuro Playwright for adotado, precisa
> de decisão registrada, porque muda a instalação.
