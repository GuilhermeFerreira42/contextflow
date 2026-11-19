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
| A7 (reabertura do app) | ✅ **executado e aprovado** | processo morto com SIGKILL; outro processo releu os dados |
| A14 (segurança local) | ✅ **executado e aprovado** (parcial) | travessia de path bloqueada; falta validação de arquivos/paths na F3 |
| A1–A6, A8–A13, A15 | ⬜ não executado | dependem de F3–F9 |

**Natureza:** especificações de comportamento, **não provas já realizadas**. Cada linha
precisa de teste unitário, de integração ou E2E (preferir **Playwright** para UI real).
Registrar por linha: `executado / aprovado / falhou / ignorado / não executado`, e manter
**homologação humana separada** da verificação técnica.
