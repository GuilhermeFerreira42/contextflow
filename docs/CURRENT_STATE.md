# CURRENT_STATE — ContextFlow
> Última atualização: Fase 7.1-patch | 2026-04-06 (GRIDFIX-7.1 — Interatividade & Estética da Grade)

## Arquitetura Ativa
- **Padrão**: Fachada Singleton (`AppState`) com delegação para **Gerentes Especializados** (`core/managers/`).
- **Orquestração**: Processamento assíncrono via `ThreadPoolExecutor` (TaskManager).
- **Persistência**: SQLite 3 (`DatabaseHandler`).
- **Integrações**: YT-DLP e YouTube Transcript API para extração de dados.
- **Tema**: Sistema Light/Dark Mode estável com propagação recursiva e inicialização persistida.

## Módulos e Contratos Vigentes
... [Tabela inalterada] ...

## Fluxo Principal
1. **Ingestão**: URLs inseridas na `TabBatch` → `VideoManager` gera UUIDs permanentes.
2. **Extração**: `TaskManager` orquestra `YTManager` → Metadados salvos no DB → Notificação via PubSub.
3. **Análise**: `VirtualTable` em `TabAnalysis` exibe dados → Seletor de modelo na toolbar.
4. **Inteligência**: Usuário seleciona vídeos → "✨ Resumir" → `AIExecutor` processa via Ollama/Google.
5. **Feedback**: PubSub notifica UI → Grid atualiza tags/resumo em tempo real → `SummaryStatusRenderer` fornece feedback visual rico.
6. **Insights**: Resumo persistido → `TagWrapPanel` exibe tags completas -> `DetailPanel` renderiza via WebView com CSS dinâmico (Dark/Light).
7. **Persistência UI**: Temas e larguras de colunas são salvos no `credentials.json` via `ConfigManager`.

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
- **Limitações wxWidgets (Windows)**: `wx.Notebook` tab labels não suportam `ForegroundColour`. `wx.StaticBox` labels podem reter cor nativa dependendo da versão do Windows (tentativa de fix em F6.2d).
- **Consoles**: `ConsolePanel` retém fundo escuro por design intencional.

## Testes Obrigatórios
- `tests/test_ai_governance.py`
- `tests/verify_phase_6_0.py`
- `tests/test_stress_10k.py`
- `tests/verify_theme_propagation.py` (Adicionado F6.2)

## Dependências Externas
| Pacote | Versão | Motivo |
|---|---|---|
| wxPython | 4.2.1+ | Framework de UI cross-platform. |
| yt-dlp | latest | Extração de metadados e áudio do YouTube. |
| tiktoken | latest | Contagem de tokens para modelos OpenAI/Google. |
