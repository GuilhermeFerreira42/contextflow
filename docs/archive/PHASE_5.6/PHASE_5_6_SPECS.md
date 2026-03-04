# FASE 5.6: ESPECIFICAÇÕES TÉCNICAS (SPECS)

Documento de nível de implementação para desenvolvedores. Define *como* construir os contratos e fluxos.

## 1. Blindagem da Extração (`services/youtube_manager.py`)

### 1.1. Persistência de Cookies
*   **Requisito:** O `yt-dlp` deve usar cookies exportados do navegador para reduzir a chance de 429.
*   **Imp:** Adicionar suporte a arquivo `cookies.txt` na pasta `data/`. Passar `--cookies data/cookies.txt` se o arquivo existir.

### 1.2. Rotação de Identidade e Proxy (Blindagem Real)
*   **Requisito:** Evitar fingerprinting estático e bloqueio de IP.
*   **Imp (User-Agent):** Criar lista de User-Agents em `constants.py`.
*   **Imp (Proxy Pool - Infraestrutura):**
    *   Suporte a `PROXY_LIST` (lista de strings) ou `PROXY_ROTATOR_URL` em `config/settings.json`.
    *   Lógica de Rotação: Ao receber 429, **banir temporariamente** o IP do proxy atual e tentar o próximo da lista.
    *   **Invariante:** Se `BatchSize > 20`, o sistema deve ter acesso a múltiplos IPs. Proxy único não é suficiente.
*   **Imp (Jitter):** Adicionar `Sleep(Random(min, max))` entre downloads.
*   **Imp (Pre-flight Check - Obrigatório):**
    *   Antes de processar qualquer lote, executar `validate_infrastructure()`.
    *   Testar conexão com Proxy e API de IA (ping leve).
    *   **Bloqueio:** Se falhar, o botão "Processar" deve permanecer desabilitado ou exibir Modal de Erro Bloqueante. O usuário NÃO pode iniciar lote cego.

### 1.3. Instrumentação de Erros
*   **Requisito:** Capturar 429 distintamente de outros erros.
*   **Imp:** Wrap do `YoutubeDL.extract_info` em try/except que faz parse da string de erro. Procurar "Too Many Requests" ou "HTTP Error 429".

## 2. Governança de IA (`core/ai_governance.py` - NOVO)

### 2.1. Token Engine
*   **Lib:** Usar `tiktoken`.
*   **Modelo:** Usar encoding `cl100k_base` (padrão GPT-4) para estimativas.
*   **Margem de Erro:** Adicionar +5% de buffer na estimativa de input para segurança.

### 2.2. Calculadora de Custo (Dinâmica & Manutenção Zero)
*   **Fonte de Preço:** ARQUIVO EXTERNO `config/ai_prices.json`.
*   **Estratégia de Atualização:**
    1.  **Auto-Update:** Ao iniciar, o sistema consulta um endpoint leve (github raw ou jsonbin) para baixar `ai_prices.json` mais recente (se user permitir).
    2.  **Fallback Manual:** Usuário pode editar `config/ai_prices.json` manualmente.
    3.  **Invariante (TTL):** Se `last_updated > 30 days`, exibir alerta "Risco de Estimativa Imprecisa" na UI.
    4.  **Fallback Estático (Offline Protocol):** Se o download falhar E o arquivo local não existir/estiver corrompido, usar dicionário `STATIC_PRICING_FALLBACK` em `constants.py` (valores conservadores/altos) e emitir alerta "Modo de Segurança Financeira".
    5.  **Invariante:** O sistema nunca para por falta de preço, mas avisa que está "voando por instrumentos".

### 2.3. Cache de Duas Camadas (Hash vs Contexto)
*   **Problema:** Normalização excessiva destrói contexto (pontuação), mas falta de normalização invalida cache (espaços).
*   **Solução (Split Strategy):**
    1.  **Key Generation (Hash Assinatura):** Usa texto agressivamente normalizado.
    2.  **Payload Generation (Contexto):** O texto enviado para a LLM (Prompt) deve ser o **original**.
    3.  **Algoritmo de Normalização (Stopword Strip):**
        *   Lower + No-Accent.
        *   Remover Stopwords comuns (pt/en): `de`, `a`, `o`, `que`, `and`, `the`, `is`, etc.
        *   Remover não-alfanuméricos.
        *   Justificativa: "O vídeo de teste" e "Video teste" devem bater o mesmo cache.
*   **Algoritmo:**
    *   `HashKey = SHA256(VideoID + Normalize(Text) + PromptVer)`
    *   `LLMPrompt = OriginalText + SystemPrompt`

## 3. Instrumentação & Métricas (`core/metrics.py` - NOVO)

### 3.1. Time To Insight (TTI)
*   **Definição:** `Timestamp(Resultado Exibido) - Timestamp(Clique Usuário)`.
*   **Log:** Salvar em arquivo `metrics.json` ou tabela de log.

### 3.2. Pontos de Coleta
*   `services/youtube_manager.py`: Registrar sucesso/falha e duração do download.
*   `core/processor.py`: Registrar tempo total de fila.

### 3.3. Dashboard de Solvência (Rodapé)
*   **Requisito:** O usuário precisa ver o custo sem abrir menus.
*   **Imp:** Adicionar status permanente na barra inferior (Status Bar).
    *   Format: `Gasto (Jan): $ 4.20 | Tokens: 145k`
    *   Fonte: `SELECT SUM(actual_cost) FROM ai_usage_log WHERE billing_period = CurrentMonth`.

## 4. Estrutura de Arquivos Proposta

```text
contextflow/
├── core/
│   ├── ai_governance.py    # [NOVO] Lógica de custo e cache
│   └── metrics.py          # [NOVO] Coletor de dados
├── docs/
│   ├── PHASE_5_6_SPECS.md  # [ESTE ARQUIVO]
│   └── ...
└── services/
    └── llm_service.py      # [NOVO] Wrapper da API (OpenAI/DeepSeek)
```
