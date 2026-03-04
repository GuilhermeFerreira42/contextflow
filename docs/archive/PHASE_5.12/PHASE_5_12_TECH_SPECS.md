# PHASE_5_12_TECH_SPECS.md: Especificações Técnicas e Governança de Extração

**Status:** SSoT (Fonte Única de Verdade)
**Função:** Contrato técnico imutável para a inteligência executora.
**Referências:** Auditoria de Governança v24, `core/config_manager.py` e Mockup Operacional v2.

--------------------------------------------------------------------------------

## 1. Arquitetura Técnica da Solução

A solução baseia-se na centralização da gestão de insumos no `ConfigManager` e na parametrização de limites no `Processor`.

• **Persistência de Cookies:**
    ◦ **Fonte UI:** Armazenado na chave `inputs.cookie_text` dentro do arquivo `config/credentials.json`.
    ◦ **Alvo Físico:** Sincronizado e persistido no diretório raiz do projeto como `BASE_DIR/cookies.txt` para consumo pelo motor `yt-dlp`.

• **Armazenamento de Proxies:**
    ◦ **Fonte UI:** Armazenado na chave `inputs.proxy_text` no `config/credentials.json`.
    ◦ **Alvo Físico:** Persistido em `config/proxies.txt`.

• **Configuração da Fila:** O sistema abandona a trava física de 20 itens e passa a consultar o parâmetro dinâmico `max_queue_warning`.

--------------------------------------------------------------------------------

## 2. Modelo de Dados

### 2.1. Cookies

O sistema deve aceitar a entrada bruta do usuário e realizar o processamento interno antes da escrita física.

• **Formatos Aceitos:**
    1. **Netscape:** Formato tabular padrão de arquivos `.txt`.
    2. **JSON:** Lista de objetos provenientes de extensões de exportação.

• **Validação e Sanitização:**
    ◦ **Obrigatória:** Remoção de espaços em branco acidentais e linhas vazias no início/fim do conteúdo colado.
    ◦ **Tratamento de Expiração:** O sistema deve alertar na UI se o campo `expires` de um cookie essencial (como `SID`) estiver no passado.
    ◦ **Fallback:** Se o campo de texto estiver vazio no console, o arquivo físico `cookies.txt` deve ser removido para evitar o uso de credenciais expiradas pelo `yt-dlp`.

### 2.2. Proxies

• **Formato Aceito:** `http://user:pass@host:port` ou `socks5://host:port` (um por linha).
• **Teste de Conectividade:** Implementar função de "ping HTTP" leve através de cada IP para validar a integridade antes do salvamento.
• **Estratégia de Rotação:**
    ◦ **Aleatório (Padrão):** Seleção via `random.choice` do pool em memória.
    ◦ **Round-Robin (Sequencial):** Alternância em ordem de lista para distribuir a carga uniformemente.

--------------------------------------------------------------------------------

## 3. Fila (Queue Orchestration)

• **Estrutura Atual:** Fila baseada em `queue.Queue` gerenciada pelo `Processor`.
• **Alteração Necessária:** Substituir a verificação manual `> 20` por uma consulta ao `ConfigManager` via `self.config.get("orchestration", "max_queue_warning")`.
• **Comportamento de Limite:**
    ◦ Ao atingir o gatilho, o sistema interrompe o enfileiramento e exige confirmação manual na UI sob o rótulo **"Aviso de Segurança (Lote Massivo)"**.

• **Persistência e Estado:**
    ◦ O status das tarefas deve ser salvo na tabela `videos` do SQLite a cada transição de estado (`PENDING`, `PROCESSING`, `COMPLETED`, `ERROR`).
    ◦ **Recuperação em Crash:** Ao reiniciar, itens marcados como `PROCESSING` devem reverter para `PENDING` para permitir a retomada.
    ◦ **Retry Strategy:** Até 3 tentativas falhas com "backoff linear" antes de marcar como `FAILED_PERMANENT`.

--------------------------------------------------------------------------------

## 4. Segurança (Mandatório)

• **Validação contra Injeção:** Campos de texto brutos para cookies e proxies devem ser sanitizados para impedir injeção de comandos de shell durante a passagem de argumentos para o `yt-dlp`.
• **Sanitização de Arquivos:** O `ConfigManager` deve garantir que a escrita nos arquivos físicos utilize encoding `utf-8` e não permita a criação de arquivos fora dos caminhos `COOKIES_PATH` e `PROXY_LIST_PATH` (Prevenção de Path Traversal).
• **Limite de Tamanho:** Restringir o campo de colagem a um máximo de 1MB de texto para evitar negação de serviço local (DoS) e estouro de memória na UI.
• **Prevenção SSRF:** Validar se os endereços de proxy fornecidos seguem padrões de URI válidos, proibindo endereços de loopback interno (`127.0.0.1`) a menos que explicitamente autorizado.

--------------------------------------------------------------------------------

## 5. Performance

• **Concorrência de Proxies:** Suporte a até 4 proxies simultâneos ativos no pool para evitar contenção de I/O de rede.
• **Tarefas Concorrentes:**
    ◦ **Nuvem (OpenAI/Gemini):** Parametrizável entre 1 e 4 workers.
    ◦ **Local (Ollama):** Trava mandatória em **1 tarefa** para proteção de hardware.
• **Gargalo Atual:** Contenção de bloqueio (`Lock Contention`) no `AppState` durante escritas massivas de metadados em lotes de 5.000+ vídeos. A solução deve focar em minimizar o tempo de retenção do `RLock` através de snapshots rápidos.

--------------------------------------------------------------------------------

**Critério de Homologação Final:** O sistema deve persistir as novas configurações no JSON, gerar os arquivos físicos correspondentes e o `Processor` deve operar sob o novo teto de fila sem intervenção manual de código.
