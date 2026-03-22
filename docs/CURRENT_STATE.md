# CURRENT_STATE — ContextFlow
> Última atualização: Fase 6.0 | 2026-03-22

## Arquitetura Ativa
- **Padrão**: Fachada Singleton (`AppState`) com delegação para **Gerentes Especializados** (`core/managers/`).
- **Orquestração**: Processamento assíncrono via `ThreadPoolExecutor` (TaskManager).
- **Persistência**: SQLite 3 (`DatabaseHandler`).
- **Integrações**: YT-DLP e YouTube Transcript API para extração de dados.

## Módulos e Contratos Vigentes
| Módulo | Arquivo | Contrato Público | Desde |
|---|---|---|---|
| AppState | `core/app_state.py` | `get_video(id)`, `add_or_update_video(data)`, `delete_videos(ids)`, `register_observer(cb)` | F1 |
| VideoManager | `core/managers/video_manager.py` | `get_all_videos() -> List`, `promote_task_to_video(uuid, data)`, `delete_videos(ids)` | F6.0 |
| TaskManager | `core/managers/task_manager.py` | `submit_task(id, func, *args)`, `is_cancelled() -> bool`, `atomic_kill_switch()` | F6.0 |
| FinanceManager | `core/managers/finance_manager.py` | `log_transaction(amount, type)`, `get_balance() -> float` | F6.0 |
| ThemeManager | `core/managers/theme_manager.py` | `get_colors() -> Dict`, `apply_theme(parent)` | F6.0 |
| AI Governance | `core/ai_governance.py` | `TokenCounter.count_tokens(text)`, `AICostCalculator.estimate_cost(prompt, completion)` | F5.6 |
| Cooldown | `core/cooldown_manager.py` | `trigger_cooldown(duration)`, `is_cooling_down() -> bool` | F5.12 |
| Proxy Manager | `core/proxy_manager.py` | `get_next_proxy() -> str`, `report_failure(proxy_url)` | F5.12 |
| YT Manager | `services/youtube_manager.py` | `get_metadata(url) -> Dict`, `get_transcript(video_id) -> str` | F1 |
| AI Discovery | `services/ai_discovery.py` | `list_available_models(provider) -> List` | F6.0 |
| AI Executor | `services/ai_executor.py` | `execute_summary(video_id) -> Future` | F6.0 |
| DB Handler | `storage/db_handler.py` | `add_video_entry(data)`, `get_all_videos()`, `set_setting(k, v)` | F1 |
| VirtualTable | `ui/virtual_table.py` | `VirtualVideoTable(parent)`, `SetItemCount(count)`, `RefreshRows()` | F5.5 |

## Fluxo Principal
1. **Ingestão**: URLs inseridas na `TabBatch` -> `VideoManager` gera UUIDs permanentes.
2. **Extração**: `TaskManager` orquestra `YTManager` -> Metadados salvos no DB -> Notificação via PubSub.
3. **Análise**: `VirtualTable` em `TabAnalysis` exibe dados -> Clique em "Sumarizar" -> `AIExecutor` acionado.
4. **Inteligência**: `AIExecutor` processa via Ollama/Google -> `FinanceManager` registra métricas de tokens.
5. **Insights**: Resumo persistido -> `DetailPanel` renderiza via Markdown reativamente.

## Invariantes Globais (nunca violar)
1. UUIDs são imutáveis após a primeira ingestão do vídeo.
2. Toda modificação de estado deve ser persistida no SQLite antes de atualizar o cache em memória.
3. Nenhuma chamada de rede ou processamento pesado pode ocorrer na Main Thread da UI.
4. O `AppState` deve garantir que observadores de UI sejam notificados via `wx.CallAfter`.
5. O `FinanceManager` é o único autoritário para balanço de tokens e custos de API.
6. A `VirtualVideoTable` não armazena dados, apenas mapeia o `VideoManager` via índices.
7. O `TaskManager` deve garantir que o Kill-Switch interrompa todas as workers de download.
8. Deletar um vídeo deve limpar fisicamente o registro no DB e o cache de thumbnails.

## Restrições Técnicas Ativas
- **Pool de Threads**: Máximo de 4 workers concorrentes para download de metadados.
- **Cache de Tokens**: `tiktoken` (cl100k_base) usado para estimativa GPT.
- **SQLite**: Limite de 5000 vídeos para garantir performance de busca instantânea.

## Testes Obrigatórios
- `tests/test_ai_governance.py`
- `tests/verify_phase_6_0.py`
- `tests/test_stress_10k.py`

## Dependências Externas
| Pacote | Versão | Motivo |
|---|---|---|
| wxPython | 4.2.1+ | Framework de UI cross-platform. |
| yt-dlp | latest | Extração de metadados e áudio do YouTube. |
| tiktoken | latest | Contagem de tokens para modelos OpenAI/Google. |
