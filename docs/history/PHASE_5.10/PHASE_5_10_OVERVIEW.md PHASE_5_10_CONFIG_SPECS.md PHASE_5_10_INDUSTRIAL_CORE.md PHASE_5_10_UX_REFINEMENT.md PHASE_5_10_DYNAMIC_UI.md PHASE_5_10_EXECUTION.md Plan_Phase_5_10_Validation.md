Com base no seu direcionamento, o melhor caminho para as credenciais é utilizar um arquivo **JSON** dentro da pasta de configurações (`CONFIG_DIR`). Essa abordagem é mais prática para o "Analista Solo", pois permite ajustes manuais rápidos se necessário, seguindo o padrão já usado para o preçário da IA (`ai_prices.json`).

Como o arquivo anterior de **OVERVIEW** não detalhava a persistência em JSON sem criptografia, eu o gerei novamente para incluir essas definições como a nova **Fonte Única de Verdade (SSoT)**.

Abaixo, apresento a lista atualizada dos **7 arquivos** da documentação e o primeiro arquivo refeito:

### 📂 Lista de Arquivos - Fase 5.10
1.  **`PHASE_5_10_OVERVIEW.md`**: Visão estratégica e definições de persistência (JSON).
2.  **`PHASE_5_10_CONFIG_SPECS.md`**: Especificações do Painel (Campos, Chaves e Orquestração).
3.  **`PHASE_5_10_INDUSTRIAL_CORE.md`**: Detalhamento do ThreadPoolExecutor e Cache de Snapshot.
4.  **`PHASE_5_10_UX_REFINEMENT.md`**: Roteiro para Loading Gauges, Undo/Snackbar e Logs Coloridos.
5.  **`PHASE_5_10_DYNAMIC_UI.md`**: Especificação do Color-Coding de Tags e Toggle de Triagem.
6.  **`PHASE_5_10_EXECUTION.md`**: Roteiro de implementação passo a passo.
7.  **`Plan_Phase_5_10_Validation.md`**: Testes de estresse de 10k e validação de fricção.

---

### 📄 Arquivo 1: `docs/history/PHASE_5.10/PHASE_5_10_OVERVIEW.md`

```markdown
# PHASE 5.10: Console de Governança, Estabilidade Industrial e UX Sem Fricção

> **Status:** SSoT (Fonte Única de Verdade)
> **Foco:** Persistência de Credenciais (JSON), Estabilidade de Core e Polimento UX
> **Referências:** Auditoria 360º, Relatório QA2 e Diretrizes de Persistência

## 1. Contexto e Visão Geral
A Fase 5.10 é o alicerce final para a injeção da Inteligência Artificial (Fase 6). O objetivo é transformar o ContextFlow em uma estação de trabalho robusta, centralizando o controle de chaves de API, orquestrando a carga de processamento para proteger o hardware do usuário e eliminando gargalos visuais que prejudicam a produtividade em escala.

## 2. Pilares de Implementação

### 2.1. Central de Credenciais e Persistência
*   **Armazenamento em JSON:** Todas as chaves de API (Google, OpenAI, Grok) e configurações do Ollama serão salvas no arquivo `config/credentials.json`.
*   **Sem Criptografia:** Seguindo o requisito de simplicidade e transparência para o usuário, as informações serão persistidas em texto puro [User Query].
*   **Governança de IA:** Preparação de adaptadores para diferentes provedores, garantindo que o sistema de auditoria (O Cofre) continue funcional para além do `tiktoken`.

### 2.2. Estabilidade Industrial (Core)
*   **Worker Pool Controlado:** Substituição do modelo de threads avulsas por um `ThreadPoolExecutor` com limites dinâmicos.
*   **Cache de Snapshot:** Implementação de cache de memória no AppState para unificação de dados, garantindo que refreshes da grade em bibliotecas de 10k itens sejam instantâneos.

### 2.3. UX Sem Fricção e Visibilidade (Interface)
*   **Indicador de Esforço:** Feedback visual via `wx.Gauge` durante a resolução de URLs para reduzir a ansiedade de carga.
*   **Logs Técnicos Coloridos:** Coloração sintática (Erros em Vermelho, Avisos em Laranja, Info em Azul) para triagem técnica imediata no `ConsolePanel`.
*   **Jornada Fluida:** Substituição de modais obstrutivos pelo padrão **Undo/Snackbar** em exclusões e introdução do **Modo de Triagem (Toggle)** para estabilizar o layout do visualizador.

### 2.4. Estética Premium
*   **Color-Coding de Tags:** Evolução visual das tags para cores baseadas no conteúdo, facilitando a identificação rápida.

## 3. Metas de Sucesso
*   Persistência total de configurações entre sessões através de arquivo JSON.
*   Zero travamentos de interface durante processamento pesado via Ollama (Local).
*   Redução de 40% no overhead de processamento da UI em grandes bibliotecas.
```

**Este arquivo contempla agora as definições de salvamento em JSON e a ausência de criptografia. Deseja que eu gere o próximo arquivo, `PHASE_5_10_CONFIG_SPECS.md`, detalhando os campos do painel e como o JSON será estruturado?**

---

### Q14
PHASE_5_10_CONFIG_SPECS.md: Especificações do Painel (Campos, Chaves e Orquestração).
### A14
# PHASE 5.10 CONFIG SPECS: Especificações do Painel de Controle

> **Status:** SSoT (Fonte Única de Verdade)
> **Alvo:** `ui/dialog_config.py` e `config/credentials.json`
> **Objetivo:** Centralizar a gestão de credenciais, orquestração de concorrência e preferências de triagem.

---

## 1. Visão Geral do Console
O Painel de Configurações será o centro nervoso do **ContextFlow**, permitindo que o "Analista Solo" gerencie seus recursos computacionais e financeiros. O acesso será feito através de um ícone de engrenagem (**⚙️**) posicionado na Toolbar superior da `AppWindow`.

## 2. Abas e Campos do Painel

### 2.1. Aba: Conectividade de IA (Credenciais)
Esta aba gerencia o acesso aos provedores de inteligência artificial.
*   **OpenAI API Key:** Campo de texto com máscara (`sk-••••`).
*   **Google Gemini API Key:** Campo de texto para chaves do Google AI Studio.
*   **Grok (xAI) API Key:** Campo de texto para integração com o modelo da xAI.
*   **Ollama (Local):**
    *   **Endpoint URL:** Padrão `http://localhost:11434`.
    *   **Model Name:** Campo para definir o modelo local ativo (ex: `llama3`, `phi3`).
*   **Provedor Ativo:** Menu *dropdown* para selecionar qual IA será disparada pelos gatilhos "Resumir".

### 2.2. Aba: Orquestração (Concorrência)
Controla o esforço do sistema para proteger o hardware e o banco de dados.
*   **Limite de Tarefas (Nuvem):** Ajustável entre 1 e 4 (Default: 2). Define o tamanho do pool para chamadas de API externas.
*   **Limite de Tarefas (Local/Ollama):** Ajustável entre 1 e 2 (Default: 1). **Recomendação brutal:** Manter em 1 para evitar sequestro total de CPU/GPU.
*   **Persistência de Fila:** Toggle para permitir que o sistema retome tarefas pendentes ao reiniciar.

### 2.3. Aba: Fluxo e UX (Triagem)
Define comportamentos de interface para reduzir fricção e instabilidade visual.
*   **Modo de Triagem:** 
    *   **Automático (Smart Show):** Expande o visualizador ao clicar.
    *   **Manual (Pro):** O visualizador só abre com duplo clique ou Enter, evitando *jitter* de layout na navegação rápida.
*   **Color-Coding de Tags:** Ativar/Desativar cores dinâmicas nas pílulas de tags.
*   **Notificações (Snackbar):** Ativar feedback de "Desfazer" para exclusões.

### 2.4. Aba: Segurança e "Escudo"
Controle manual sobre os protocolos de defesa.
*   **Estado de Cooldown:** Exibe o tempo restante de hibernação.
*   **Botão 'Reset Safety':** Limpa o bloqueio global no SQLite instantaneamente.
*   **Proxy Status:** Toggle para ativar/desativar o uso de `proxies.txt` sem deletar o arquivo.

## 3. Especificação de Persistência (JSON)

Conforme diretriz estratégica, os dados serão salvos em texto puro para facilidade de manutenção pelo usuário.
*   **Caminho:** `config/credentials.json` [Conversa anterior].
*   **Estrutura esperada:**
```json
{
  "api_keys": {
    "openai": "sk-...",
    "gemini": "...",
    "grok": "..."
  },
  "ollama": {
    "endpoint": "http://localhost:11434",
    "model": "llama3"
  },
  "orchestration": {
    "active_provider": "openai",
    "max_cloud_tasks": 2,
    "max_local_tasks": 1
  },
  "ux_preferences": {
    "triage_mode": "manual",
    "dynamic_tags": true,
    "undo_enabled": true
  }
}
```

## 4. Governança e Adaptação de IA
O sistema de **Governança de IA (O Cofre)** deve ser expandido. Como o `tiktoken` é nativo apenas para OpenAI, a implementação desta fase exige:
1.  **Adaptadores de Tokenização:** Implementar métodos de estimativa aproximada para Gemini e Grok para manter a integridade dos logs financeiros.
2.  **Mascaramento de Interface:** Chaves de API nunca devem ser exibidas em texto claro na UI após o primeiro input, sendo substituídas por caracteres de proteção.

---

**Critério de Homologação:** O painel deve ser capaz de salvar e carregar todas as configurações do arquivo JSON sem exigir o reinício da aplicação para aplicar limites de concorrência simples.

---

### Q15
PHASE_5_10_INDUSTRIAL_CORE.md: Detalhamento do ThreadPoolExecutor e Cache de Snapshot.
### A15
# PHASE 5.10 INDUSTRIAL CORE: Worker Pool e Otimização de Snapshot

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Performance Extrema, Estabilidade de Escrita e Eficiência de CPU  
> **Alvos:** `core/processor.py` e `core/app_state.py`

---

## 1. Orquestração de Concorrência: ThreadPoolExecutor

Identificou-se que o sistema atual sofre com a **criação indiscriminada de threads** no `Processor` para cada resolução de URL e persistência de dados. Sob carga massiva (ex: ingestão de playlists), isso resulta em picos de CPU e erros de **"Database is locked"** no SQLite devido a conexões simultâneas descontroladas.

### 1.1. Migração para Worker Pool
O modelo de threads avulsas (`threading.Thread`) será substituído por um **`ThreadPoolExecutor`** fixo no arquivo `core/processor.py`.
*   **Capacidade de Workers:** O pool terá um tamanho base controlado (ex: 4 workers) para operações de rede e I/O.
*   **Limites Dinâmicos (Cloud vs Local):** O executor deverá respeitar os limites configurados no `credentials.json` [PHASE_5_10_CONFIG_SPECS].
    *   **API de Nuvem:** Suporte a até 4 tarefas simultâneas para maximizar o throughput de rede.
    *   **Ollama (Local):** Trava mandatória em **1 tarefa**, impedindo que modelos de IA locais sequestrem 100% da CPU/GPU e congelem a interface do usuário.

### 1.2. Proteção de I/O de Banco de Dados
Todas as operações de escrita disparadas pelo `AppState` (como o `_persist_video_worker`) serão centralizadas no Pool de Workers. Isso garante uma fila sequencial de persistência, eliminando condições de corrida (Race Conditions) e travamentos de arquivo no SQLite.

---

## 2. Otimização de Estado: Snapshot Caching

Atualmente, o método `get_unified_data` reconstrói, filtra UUIDs e ordena a lista completa (O(n log n)) em **cada chamada** disparada pelo timer de 250ms da UI. Em bibliotecas de 10.000 itens, esse custo computacional gera latência visual e overhead desnecessário.

### 2.1. Implementação do Cache de Snapshot
O `AppState` passará a manter uma versão **"Unificada e Ordenada"** persistente em memória RAM.
*   **Lógica de Invalidação (Dirty Flag):** O cache só será reconstruído quando houver uma mutação real de estado (eventos `VIDEO_ADDED`, `VIDEOS_DELETED` ou `VIDEO_PROMOTED`).
*   **Leitura Instantânea:** Chamadas subsequentes de `get_unified_data` retornarão apenas a referência ao snapshot já processado.
*   **Impacto:** Redução esperada de **40% na latência** de resposta da interface em bibliotecas massivas.

---

## 3. Diretrizes de Thread-Safety e Reatividade

### 3.1. Governança de Lock
O uso de **`threading.RLock`** permanece mandatório para proteger as mutações no dicionário `_videos` e no novo Cache de Snapshot. O bloqueio deve ser breve, cobrindo apenas a atualização da memória e a sinalização de "sujeira" (dirty flag) no cache.

### 3.2. Sincronia de UI (wx.CallAfter)
Garante-se que todas as notificações do `AppState` enviadas aos observadores da interface continuem utilizando **`wx.CallAfter`**. Isso delega a execução para a thread principal, prevenindo crashes por manipulação gráfica em threads de background.

---

## 4. Especificações Técnicas de Implementação

| Recurso | Arquivo | Ação Técnica |
| :--- | :--- | :--- |
| **Worker Pool** | `processor.py` | Instanciar `concurrent.futures.ThreadPoolExecutor` com limites dinâmicos. |
| **Dirty Flag** | `app_state.py` | Adicionar boolean `_cache_dirty` e variável `_snapshot_cache`. |
| **Lazy Update** | `app_state.py` | Modificar `get_unified_data` para retornar o cache se `not _cache_dirty`. |
| **Sync DB** | `db_handler.py` | Garantir que o Handler suporte acesso via Workers de thread curta. |

---
**Critério de Homologação:** O sistema deve processar um lote de 50 vídeos reais via Ollama (simulado) enquanto mantém o scroll da grade de 10.000 itens em **60 FPS**, sem apresentar erros de banco de dados bloqueado no console.

---

### Q16
PHASE_5_10_UX_REFINEMENT.md: Roteiro para Loading Gauges, Undo/Snackbar e Logs Coloridos.
### A16
# PHASE 5.10 UX REFINEMENT: Roteiro de Polimento e Feedback Visual

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Visibilidade de Processo, Redução de Fricção e Diagnóstico Ágil  
> **Alvos:** `ui/tab_batch.py`, `ui/panel_console.py`, `ui/app_window.py`

---

## 1. Indicador de Esforço: Loading Gauge

Atualmente, ao clicar em "PROCESSAR FILA", o usuário enfrenta um vácuo de feedback até que os itens comecem a brotar na grade. Para reduzir a ansiedade de carga, será implementada uma sinalização de progresso imediata na **Doca de Carga (Aba 1)**.

*   **Componente:** Inserção de um `wx.Gauge` (barra de progresso) logo abaixo do botão de processamento na `ui/tab_batch.py`.
*   **Lógica de Ativação:**
    *   O gauge inicia em modo "indeterminado" (pulsação) assim que o botão é clicado.
    *   Ao iniciar a resolução assíncrona de URLs no `Processor`, o sistema publica o total de linhas detectadas.
    *   O gauge torna-se "determinado", atualizando-se a cada URL validada ou vídeo de playlist enfileirado.
*   **Feedback de Término:** O gauge desaparece ou reseta após o processamento da lista de input, cedendo espaço para a telemetria da grade virtual.

---

## 2. Jornada Sem Fricção: Padrão Undo (Snackbar)

A exclusão massiva de vídeos atualmente é interrompida por diálogos modais (`wx.MessageDialog`) que exigem cliques extras e quebram o fluxo de triagem rápida.

*   **Substituição de Modal:** O aviso de confirmação "Tem certeza?" será desativado para exclusões de rotina.
*   **Implementação do Snackbar:**
    *   Ao clicar em "Excluir", os itens são removidos visualmente da grade e movidos para um buffer temporário de memória no `AppState`.
    *   Uma pequena barra horizontal (Snackbar) aparece na base da `AppWindow` com a mensagem: **"X vídeos movidos para a lixeira. [DESFAZER]"**.
    *   **Timer de Persistência:** Se o botão "Desfazer" não for clicado em 5 segundos, o `AppState` dispara a deleção física definitiva no SQLite.
*   **Impacto:** Permite que o analista limpe centenas de itens com fluidez, mantendo a segurança da reversibilidade.

---

## 3. Diagnóstico Visual: Logs Coloridos

O console de log atual é monocromático, dificultando a triagem de falhas técnicas entre o fluxo constante de informações de sistema.

*   **Coloração Sintática (Semantic Logging):**
    *   **INFO / SYSTEM:** Mensagens em **Azul (#3182CE)** para indicar progresso normal.
    *   **WARNING:** Mensagens em **Laranja (#DD6B20)** para alertas de Cooldown ou limites de token.
    *   **ERROR:** Mensagens em **Vermelho (#E53E3E)** para falhas de rede (429) ou erros de API.
*   **Implementação Técnica:**
    *   Refatoração do `WxLogHandler` em `ui/panel_console.py` para utilizar `wx.TextAttr`.
    *   Uso de `txt_log.SetDefaultStyle` antes de cada inserção, garantindo que o estilo não vaze para a próxima linha.
*   **Benefício:** Identificação instantânea de bloqueios do YouTube ou erros de crédito de IA sem leitura exaustiva do texto.

---

## 4. Estética de Triagem: Tags Dinâmicas (Color-Coding)

Para elevar a interface ao nível SaaS Premium, as pílulas de tags na Aba 2 deixarão de ser puramente cinzas.

*   **Algoritmo de Cor:** Implementação de uma função hash que gera uma cor de fundo (com 20% de opacidade) baseada no nome da tag (estilo GitHub/Notion).
*   **Renderização:** O `ChipTagRenderer` em `ui/virtual_table.py` aplicará essas cores dinamicamente, facilitando a triagem visual de temas (ex: tags de 'Finanças' sempre em tons verdes, 'Liderança' em azuis).

---

## 5. Matriz de Implementação UX

| Recurso | Arquivo | Componente wx | Evento/Trigger |
| :--- | :--- | :--- | :--- |
| **Loading Gauge** | `tab_batch.py` | `wx.Gauge` | `on_click_process` |
| **Undo Bar** | `app_window.py` | `wx.InfoBar` | `VIDEOS_DELETED` (PubSub) |
| **Logs Coloridos** | `panel_console.py` | `RichTextCtrl` | `WxLogHandler.emit` |
| **Tags Pro** | `virtual_table.py` | `ChipTagRenderer` | `OnPaint` |

---
**Critério de Homologação:** O usuário deve ser capaz de excluir um vídeo por engano e recuperá-lo via Snackbar, além de identificar visualmente um erro de rede no console através da cor vermelha, sem precisar ler a mensagem técnica.

---

### Q17
PHASE_5_10_DYNAMIC_UI.md: Especificação do Color-Coding de Tags e Toggle de Triagem.
### A17
# PHASE 5.10 DYNAMIC UI: Estética e Controle de Triagem

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Identidade Visual Moderna, Redução de Cansaço Cognitivo e Estabilidade de Layout  
> **Alvos:** `ui/virtual_table.py` (ChipTagRenderer) e `ui/tab_analysis.py`

---

## 1. Color-Coding Dinâmico de Tags

Atualmente, o `ChipTagRenderer` utiliza uma paleta monocromática cinza (#230, 230, 230), o que gera monotonia visual e falha em transmitir categorização rápida. A solução proposta visa elevar o ContextFlow ao patamar de um **SaaS de alto nível** (estilo GitHub/Notion).

### 1.1. Especificação do Algoritmo
*   **Geração de Cor por Hash:** Implementar uma função helper que gere uma cor de fundo baseada no `hash` do nome da tag.
*   **Paleta Pastel (Light Mode):** Para garantir a legibilidade do texto escuro, as cores geradas devem ter baixa opacidade (aprox. 20%) ou serem tons pastel.
*   **Consistência:** A mesma tag (ex: "Liderança") deve ter sempre a mesma cor em qualquer parte do sistema.

### 1.2. Renderização no `ChipTagRenderer`
*   **Geometria:** Pílulas com raio de canto de 10px.
*   **Contraste:** O texto da tag deve permanecer em cinza escuro ou preto para garantir acessibilidade sobre o fundo colorido suave.

---

## 2. Toggle de Modo de Triagem (Estabilidade de Layout)

A lógica atual de expansão automática ("Smart Show") pode ser intrusiva durante a navegação rápida por teclado, causando saltos indesejados no layout (*jitter*).

### 2.1. Modos Operacionais
O usuário poderá alternar entre dois comportamentos através de um novo ícone na toolbar da Aba 2:

1.  **Modo Automático (Smart Show):** Comportamento atual. O visualizador expande (`SplitHorizontally`) assim que um vídeo com conteúdo é selecionado.
2.  **Modo Manual (Modo Pro):** O painel permanece estático (Unsplit). O visualizador só expande se o usuário realizar um **clique duplo** na linha ou pressionar **Enter**.

### 2.2. Implementação na Toolbar
*   **Ícone:** Um ícone de "Raio" (⚡) ou "Olho" (👁️) para sinalizar a visualização automática ativa/desativa.
*   **Persistência:** O estado do modo de triagem deve ser salvo no arquivo `config/credentials.json` para ser respeitado no próximo boot.

---

## 3. Matriz de Alterações Técnicas

| Recurso | Arquivo | Ação Técnica | Impacto Esperado |
| :--- | :--- | :--- | :--- |
| **Hash Color** | `ui/virtual_table.py` | Implementar `_get_tag_color(tag_name)` baseada em hash MD5/SHA. | Aumento da velocidade de triagem visual. |
| **Triage Logic** | `ui/tab_analysis.py` | Adicionar condicional `if config.triage_mode == 'auto'` no `on_select_video`. | Navegação estável e fluida por teclado. |
| **Toolbar UI** | `ui/tab_analysis.py` | Inserir botão de toggle (Checkable Tool) na barra analítica. | Maior controle do usuário sobre a interface. |

---

## 4. Benefício de Experiência (UX)

*   **Redução de Fricção:** O analista pode "zapear" por centenas de vídeos usando as setas do teclado sem que a tela fique "pulando", ativando a leitura apenas quando encontrar um item de real interesse.
*   **Triagem Inteligente:** A diferenciação por cores nas tags permite que o cérebro identifique temas (ex: verde para Finanças, azul para Tecnologia) antes mesmo de ler o texto, acelerando o fluxo de trabalho massivo.

---
**Critério de Homologação:** Ao desativar o "Modo Automático", o painel inferior deve permanecer oculto durante a navegação por setas. Ao reativá-lo, o painel deve abrir instantaneamente ao encontrar um vídeo com resumo. As tags de nomes diferentes devem exibir cores de fundo distintas e consistentes.

---

### Q18
PHASE_5_10_EXECUTION.md: Roteiro de implementação passo a passo.
### A18
# PHASE 5.10 EXECUTION: Roteiro de Implementação Passo a Passo

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Implementar a infraestrutura de governança, o motor de concorrência industrial e o polimento de UX conforme planejado.  
> **Alvos:** `core/processor.py`, `core/app_state.py`, `ui/app_window.py`, `ui/tab_batch.py`, `ui/virtual_table.py`

Este roteiro detalha a sequência lógica para transformar as especificações da Fase 5.10 em código funcional, garantindo estabilidade sistêmica e performance extrema.

---

### Passo 1: Estabilização do Motor e Estado (Industrial Core)

O foco inicial é o saneamento da concorrência para evitar travamentos de hardware e do banco de dados.

1.  **`core/app_state.py`:**
    *   Implementar a variável `_snapshot_cache` e o booleano `_cache_dirty`.
    *   Refatorar `get_unified_data` para utilizar o cache, reconstruindo-o apenas se `_cache_dirty` for verdadeiro **[PHASE_5_10_INDUSTRIAL_CORE]**.
    *   Garantir que todos os métodos de mutação (`add_video`, `delete_videos`, `promote_task`) ativem a flag de sujeira (`_cache_dirty = True`) sob lock **[PHASE_5_10_INDUSTRIAL_CORE]**.

2.  **`core/processor.py`:**
    *   Importar `concurrent.futures.ThreadPoolExecutor`.
    *   Substituir a criação manual de `threading.Thread` por submissões ao pool.
    *   Configurar o limite de workers dinamicamente com base no `credentials.json` (respeitando o teto de 1 worker para Ollama/Local) **[PHASE_5_10_INDUSTRIAL_CORE]**.

---

### Passo 2: Persistência e Gestão de Configurações

Centralização das chaves de API e preferências de interface em arquivo JSON transparente.

1.  **`core/config_manager.py` (NOVO):**
    *   Criar classe para ler e salvar o arquivo `config/credentials.json`.
    *   Implementar a estrutura de dicionário com seções: `api_keys`, `ollama`, `orchestration` e `ux_preferences` **[PHASE_5_10_CONFIG_SPECS]**.
    *   Garantir que as chaves sejam persistidas em texto puro, conforme requisito de simplicidade **[PHASE_5_10_OVERVIEW]**.

2.  **`ui/dialog_config.py` (NOVO):**
    *   Criar diálogo multi-aba (Notebook) para gestão visual destas configurações.
    *   Implementar mascaramento de chaves de API (`sk-••••`) após o input **[PHASE_5_10_CONFIG_SPECS]**.

---

### Passo 3: Refinamento de UX e Visibilidade

Transformar o feedback passivo em telemetria ativa.

1.  **`ui/tab_batch.py`:**
    *   Inserir o componente `wx.Gauge` logo abaixo do botão de processamento.
    *   Vincular o gauge aos eventos `TASK_QUEUED` e `METADATA_FETCHED` via PubSub para progresso determinado **[PHASE_5_10_UX_REFINEMENT]**.

2.  **`ui/panel_console.py`:**
    *   Refatorar o `WxLogHandler` para aplicar cores sintáticas: Vermelho (Erro), Laranja (Warning) e Azul (Info/System) no `RichTextCtrl` **[PHASE_5_10_UX_REFINEMENT]**.

3.  **`ui/app_window.py`:**
    *   Adicionar ícone de engrenagem (⚙️) na Toolbar superior para acesso rápido às configurações.
    *   Implementar o componente `wx.InfoBar` (Snackbar) para gerenciar a lógica de **Undo** em deleções massivas de 5 segundos **[PHASE_5_10_UX_REFINEMENT]**.

---

### Passo 4: Dinamismo de Interface (Estética SaaS)

Elevar a percepção de qualidade do produto através de microinterações.

1.  **`ui/virtual_table.py`:**
    *   Implementar a função `_get_tag_color(tag_name)` usando hash para gerar fundos coloridos consistentes **[PHASE_5_10_DYNAMIC_UI]**.
    *   Atualizar o `ChipTagRenderer` para aplicar estas cores dinâmicas com opacidade de 20% **[PHASE_5_10_DYNAMIC_UI]**.
    *   Implementar formatação de milhares com pontos na coluna de tokens (ex: `1.500.000`) **[PHASE_5_10_OVERVIEW]**.

2.  **`ui/tab_analysis.py`:**
    *   Adicionar botão de Toggle (Ícone de Raio/Olho) na toolbar para alternar entre o **Modo de Triagem Automático** e **Manual** (Smart Show) **[PHASE_5_10_DYNAMIC_UI]**.

---

### ✅ Definição de Concluído (DoD)

O saneamento da Fase 5.10 será considerado homologado quando:
- [ ] Credenciais de Google, OpenAI e Grok forem salvas e carregadas com sucesso via JSON **[PHASE_5_10_CONFIG_SPECS]**.
- [ ] O processamento via Ollama não causar jitter na UI devido ao limite de 1 worker no pool **[PHASE_5_10_INDUSTRIAL_CORE]**.
- [ ] Erros técnicos forem identificados instantaneamente no console pela cor vermelha **[PHASE_5_10_UX_REFINEMENT]**.
- [ ] O scroll de 10.000 itens se mantiver estável em 60 FPS com tags coloridas dinamicamente **[PHASE_5_10_DYNAMIC_UI]**.

---

### Q19
Plan_Phase_5_10_Validation.md: Testes de estresse de 10k e validação de fricção.
### A19
# PLANO DE VALIDAÇÃO: PHASE 5.10 (Estresse e UX sem Fricção)

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Validar a estabilidade do motor de concorrência, a eficiência do cache de snapshot para 10.000 itens e a eliminação de fricções na jornada do usuário.  
> **Referências:** Auditoria 360º, RNFs de Estresse e Protocolo QA2.

---

## 1. Testes de Estabilidade Industrial e Performance (10k)

O sistema deve operar em alta densidade técnica sem degradação de recursos ou travamentos de banco de dados.

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **P01** | **Escalabilidade 10k** | Carregar biblioteca de 10.000 itens e realizar scroll rápido. | **60 FPS** estáveis; latência de célula < 0.1ms. |
| **P02** | **Cache de Snapshot** | Realizar mutações (adição/deleção) e medir o tempo de TTI. | Resposta da interface em **< 50ms** mesmo em bibliotecas massivas. |
| **P03** | **Worker Pool (CPU)** | Iniciar ingestão massiva (ex: playlist 200 vids) via ThreadPoolExecutor. | Uso de CPU reduzido em 15%; **zero erros** de "Database is locked". |
| **P04** | **Gestão de RAM** | Monitorar consumo durante scroll de 10k itens com LRU Cache ativo. | RAM mantida estritamente **< 250MB**. |

---

## 2. Validação de Fricção e UX (Jornada do Usuário)

O foco é a redução da carga cognitiva e a fluidez operacional do "Analista Solo".

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **U01** | **Jornada de Exclusão (Undo)** | Selecionar 20 vídeos e clicar em excluir. | **Zero modais obstrutivos**; Snackbar com botão "Desfazer" visível por 5s. |
| **U02** | **Modo de Triagem (Toggle)** | Ativar "Modo Manual" e navegar por setas no Cockpit. | Splitter permanece estático; **zero jitter** de layout durante navegação rápida. |
| **U03** | **Feedback de Esforço** | Colar lista de URLs e clicar em "Processar Fila". | **Loading Gauge** exibe progresso imediato da resolução das URLs. |
| **U04** | **Diagnóstico Visual (Logs)** | Provocar um erro 429 ou falha de rede. | Mensagem de erro aparece instantaneamente em **Vermelho** no console. |
| **U05** | **Triagem de Tags** | Observar a coluna de Tags em diferentes temas. | Cores de fundo derivam do hash do nome; legibilidade absoluta sobre fundo branco. |

---

## 3. Validação de Governança e Configurações

Garantir que os limites impostos protegem o capital e o hardware do usuário.

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **G01** | **Persistência JSON** | Salvar chaves de API, fechar e reabrir o sistema. | Credenciais e limites de concorrência carregados corretamente de `credentials.json`. |
| **G02** | **Teto de Concorrência** | Configurar limite de 1 worker para Ollama (Local). | O sistema processa apenas um vídeo por vez, evitando o congelamento da UI. |
| **G03** | **Integridade Financeira** | Deletar um vídeo que já possui log de custo no banco. | O registro na `ai_usage_log` **permanece intacto** para auditoria. |

---

## 4. Critérios de Homologação (Definition of Done)

A **Fase 5.10** será considerada concluída para a entrada da **Fase 6** (IA Real) se:
1.  **Zero Bloqueios:** Nenhuma operação simultânea resultou em erro de escrita no SQLite.
2.  **Fluidez Tátil:** A exclusão massiva não exige mais do que um clique (padrão Undo).
3.  **Transparência Técnica:** O usuário consegue identificar falhas apenas pela cor do log sem ler a mensagem técnica.
4.  **Consistência Visual:** O sistema inicia 100% em fundo branco, sem "flashes" escuros na Aba 3.

---
**Assinatura Técnica:** Engenharia ContextFlow - Estabilidade Industrial Validada.