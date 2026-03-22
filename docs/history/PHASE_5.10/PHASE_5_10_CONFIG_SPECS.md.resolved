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
*   **Caminho:** `config/credentials.json`.
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
