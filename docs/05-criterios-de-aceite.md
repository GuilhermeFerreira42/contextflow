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

| # | Status | Evidência |
|---|---|---|
| A1 (legenda manual) | 🟨 **verificado tecnicamente; prova real pendente** | `testes/integracao/ingestao.test.ts` (dublê) + `rotas-ingestao.test.ts`; falta importar um vídeo real |
| A2 (legenda automática) | 🟨 **verificado tecnicamente; prova real pendente** | `testes/integracao/ingestao.test.ts` — caso "usa legenda automática quando não há manual" |
| A3 (vídeo sem legenda) | 🟨 **verificado tecnicamente; prova real pendente** | `estado = indisponivel` + motivo + vídeo `parcial`; testado em unidade e rota |
| A7 (reabertura do app) | ✅ **executado e aprovado** | processo morto com SIGKILL; outro processo releu os dados; mais `testes/integracao/ingestao.test.ts` reabrindo o arquivo do banco |
| A14 (segurança local) | ✅ **executado e aprovado** (ampliado na F3) | travessia de path bloqueada; `spawn` com `shell:false`; teste de injeção de comando na URL; URL de outro domínio rejeitada |
| A4 (playlist) | ⬜ não executado | F4 |
| A5 (falha de rede) | 🟨 **parcial** — erro traduzido e estado recuperável | teste real: TLS bloqueado → 503 com mensagem correta e vídeo em `erro`; retry é F4 |
| A6 (cancelamento) | ⬜ não executado | F4 |
| A8, A9, A10 (volume, seleção, leitura contínua) | ⬜ não executado | F5–F7 |
| A11, A12 (IA, custos, segredos) | ⬜ não executado | F6–F8 |
| A13 (migração da base original) | ⬜ não executado | F9 |
| A15 (Windows e Linux) | 🟨 **Windows: app roda; suíte não executada lá** | F3 rodou em Windows pelo proprietário (`npm run dev`); falta rodar `npm test` no Windows |

**Legenda:** ✅ executado e aprovado · 🟨 parcial ou verificado sem prova real · ⬜ não executado

### O que a F3 mudou nesta matriz

A1, A2 e A3 deixaram de ser intenção e passaram a ter código e teste. O que
ainda falta **não é implementação**: é a prova contra o YouTube real, que este
ambiente não alcança. O roteiro está em `docs/roteiro-teste-f3.md` e é a
primeira tarefa do Codex na máquina do proprietário.

**Natureza:** especificações de comportamento, **não provas já realizadas**. Cada linha
precisa de teste unitário, de integração ou E2E (preferir **Playwright** para UI real).
Registrar por linha: `executado / aprovado / falhou / ignorado / não executado`, e manter
**homologação humana separada** da verificação técnica.
