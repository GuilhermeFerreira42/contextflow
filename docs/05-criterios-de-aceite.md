# Matriz inicial de aceite — adaptar por SPEC

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

Atualização de 19/11/2026, commit F3 `c6b7db5`: **A1 e A3 aprovados com vídeos
reais; A2 aprovado com en-orig explicitamente configurado**, após HTTP 429 da
tradução pt. A7 repetido com reinício real e comparação completa. **A15: suíte
Windows executada** (120 pass, 0 fail, 6 skips), E2E 17/17, build/fumaça OK;
regressão Linux desta sessão não executada. Aceite humano da F3 pendente.
Detalhes, URLs e evidências em `estado-atual.md`. A tabela abaixo preserva a
situação da entrega F3 original, anterior a essa validação.

| # | Status | Evidência |
|---|---|---|
| A1 (legenda manual) | 🟨 **verificado tecnicamente; prova real pendente** | `testes/integracao/ingestao.test.ts` (dublê) + `rotas-ingestao.test.ts`; falta importar um vídeo real |
| A2 (legenda automática) | 🟨 **verificado tecnicamente; prova real pendente** | `testes/integracao/ingestao.test.ts` — caso "usa legenda automática quando não há manual" |
| A3 (vídeo sem legenda) | 🟨 **verificado tecnicamente; prova real pendente** | `estado = indisponivel` + motivo + vídeo `parcial`; testado em unidade e rota |
| A7 (reabertura do app) | ✅ **executado e aprovado** | processo morto com SIGKILL; outro processo releu os dados; mais `testes/integracao/ingestao.test.ts` reabrindo o arquivo do banco |
| A14 (segurança local) | ✅ **executado e aprovado** (ampliado na F3) | travessia de path bloqueada; `spawn` com `shell:false`; teste de injeção de comando na URL; URL de outro domínio rejeitada |
| A4 (playlist) | ✅ **executado e aprovado** | `testes/e2e` — playlist importada, itens classificados, filtro por playlist (F4) |
| A5 (falha de rede) | ✅ **executado e aprovado** | TLS bloqueado → 503 com mensagem correta; retry e repetição cobertos na F4 |
| A6 (cancelamento) | ✅ **executado e aprovado** | `testes/e2e` e integração: cancelamento pedido, encerramento, estado final |
| A8 (volume) | ✅ **executado e aprovado** | 5.004 vídeos no E2E, DOM com menos de 150 linhas; rolagem até o índice 3.000 sem perder identidade |
| A9 (seleção) | ✅ **executado e aprovado** | seleção por linha, selecionar visíveis, ações em lote, seleção fora do filtro |
| A10 (leitura contínua) | 🟨 **implementada; homologação humana pendente** | resumo na linha + painel sobreposto com transcrição; a fluidez contínua de rolagem longa é avaliação do proprietário |
| A11, A12 (IA, custos, segredos) | ⬜ não executado | F6–F8 |
| A13 (migração da base original) | ⬜ não executado | F9 |
| A15 (Windows e Linux) | 🟨 **Windows: app roda; suíte não executada lá** | F3 rodou em Windows pelo proprietário (`npm run dev`); falta rodar `npm test` no Windows |

**Legenda:** ✅ executado e aprovado · 🟨 parcial ou verificado sem prova real · ⬜ não executado

### Aceite da F5-UI (reformulação da interface)

Executado em 21/11/2026, commits `9e7ce02` e `3db2e48`. Todos os itens abaixo
têm cenário automatizado em `testes/e2e/` — menos os marcados como visuais,
que dependem de homologação humana por natureza.

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
| U10 | Barra lateral recolhe liberando espaço | ✅ — **corrigida na F5-QA**: recolher era passagem só de ida (botão saía do clipe) |
| U11 | "Adicionar link" valida a URL antes de chamar o motor | ✅ |
| U12 | Importação feita pela janela aparece em Importações | 🟨 depende de yt-dlp alcançar o YouTube (bloqueado neste ambiente) |
| U13 | Importações e Configurações mantêm todos os recursos | ✅ |
| U14 | Seleção, ações em lote e coleções seguem funcionando | ✅ |
| U15 | Sem regressão: `npm test` e E2E | ✅ — 183/183 e 62/62 na F5-QA |
| U16 | Sem erro de script no console em nenhuma tela | ✅ |
| — | **Fidelidade visual aos mockups** | 🟨 **homologação humana pendente** |

### Critérios da F5-QA (revisão de qualidade)

Acrescentados na revisão. Todos verificados no navegador real, não por leitura
de código.

| # | Critério | Situação |
|---|---|---|
| Q1 | A barra lateral recolhe e expande repetidamente (3 ciclos medidos) | ✅ |
| Q2 | O botão de alternância é clicável nos dois estados — provado com `elementFromPoint` | ✅ |
| Q3 | Nada vaza da coluna de 56 px (contagem de elementos fora do retângulo = 0) | ✅ |
| Q4 | O conteúdo acompanha a barra: `conteudo.x === larguraDaBarra` nos dois estados | ✅ |
| Q5 | A preferência de barra sobrevive ao recarregamento e continua expansível | ✅ |
| Q6 | Transição sem sobreposição (12 amostras durante os 200 ms) | ✅ |
| Q7 | Abaixo de 900 px existe gaveta: abre, tem véu, fecha com ESC, devolve foco | ✅ |
| Q8 | Página nunca rola na horizontal; a tabela rola dentro do quadro | ✅ |
| Q9 | Texto legível: nenhum par abaixo de 4,5:1 (exceto artefato medido à parte em 7,95:1) | ✅ |
| Q10 | Foco visível em todos os controles (outline 2 px) | ✅ |
| Q11 | Altura declarada da linha == altura real (108 px nos dois casos) | ✅ |
| Q12 | Miniatura quebrada vira preenchimento, nunca ícone de imagem partida | ✅ |
| Q13 | Painéis sobrepostos não saem da tela em 1600, 1024 e 390 px | ✅ |
| Q14 | Janela Adicionar link: abre, recusa URL fora do YouTube, ESC/X fecham, foco volta ao gatilho | ✅ |
| Q15 | Estado vazio da fila orienta o próximo passo | ✅ |

### O que a F3 mudou nesta matriz

A1, A2 e A3 deixaram de ser intenção e passaram a ter código e teste. O que
ainda falta **não é implementação**: é a prova contra o YouTube real, que este
ambiente não alcança. O roteiro está em `docs/roteiro-teste-f3.md` e é a
primeira tarefa do Codex na máquina do proprietário.

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
