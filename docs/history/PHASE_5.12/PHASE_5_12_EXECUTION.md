# 4️⃣ PHASE_5_12_EXECUTION.md: Roteiro Determinístico de Implementação

**Status:** SSoT (Fonte Única de Verdade)
**Função:** Roteiro técnico obrigatório para a inteligência executora.
**Objetivo:** Implementar a governança de insumos e o desbloqueio de limites operacionais.
**Referências:** PHASE_5_12_TECH_SPECS, PHASE_5_12_STRUCTURAL_STANDARDS e Mockup Operacional v2.

--------------------------------------------------------------------------------

### 1. Arquivos que serão modificados

Para garantir a segregação de responsabilidades e a persistência industrial, os seguintes arquivos devem ser alterados ou criados:

• `core/queue_manager.py` (Atualmente implementado dentro de `core/processor.py`): Responsável por substituir o limite fixo de 20 vídeos pela consulta dinâmica ao `ConfigManager`.

• `core/proxy_manager.py`: Responsável por implementar o _hot-reload_ da lista de IPs e a estratégia de rotação (Round-Robin/Aleatório).

• `ui/settings_view.py` (Atualmente `ui/dialog_config.py`): Responsável por implementar a interface de 4 blocos (Controle, Cookies, Rede, Idiomas) conforme o mockup validado.

• `core/config_manager.py`: Responsável por centralizar a lógica de `update_physical_files()` para cookies e proxies.

--------------------------------------------------------------------------------

### 2. Sequência de Implementação

A execução deve seguir esta ordem rigorosa para evitar quebra de dependências:

1. **Criar modelo de proxy:** Expandir a estrutura no `ConfigManager` para suportar `proxy_text` e o modo de rotação.

2. **Criar parser de cookies:** Implementar a sanitização de strings para o formato **Netscape** e a escrita física no arquivo `cookies.txt` na raiz.

3. **Alterar fila:** Modificar o `Processor` para ler `max_queue_warning` e condicionar o protocolo de defesa à flag `auto_defense_enabled`.

4. **Ajustar UI:** Reconstruir a aba "Extração & Defesa" no diálogo de configurações com os 4 blocos lógicos e botões de importação.

5. **Testes:** Ciclo de validação de persistência e comportamento sob erro 429.

--------------------------------------------------------------------------------

### 3. Pseudocódigo Obrigatório

A inteligência executora deve seguir a lógica abaixo para os métodos críticos:

Sincronização de Insumos (`ConfigManager`)

```python
function updatePhysicalFiles():
    # Sincronização de Cookies
    raw_cookies = get_config("inputs", "cookie_text")
    if is_valid_netscape(raw_cookies):
        write_to_file(BASE_DIR/cookies.txt, sanitize(raw_cookies))
    
    # Sincronização de Proxies
    raw_proxies = get_config("inputs", "proxy_text")
    write_to_file(CONFIG_DIR/proxies.txt, sanitize(raw_proxies))
    ProxyManager().hot_reload() # Atualiza em memória instantaneamente
```

Validação de Fila e Defesa (`Processor`)

```python
function processBatch(queue):
    max_warning = config.get("max_queue_warning")
    if queue.size > max_warning:
        if not user_confirmed_risk():
            abort()
            
    try:
        execute_extraction()
    except Error429:
        if config.get("auto_defense_enabled"):
            trigger_cooldown(config.get("cooldown_mins"))
        else:
            log_error_and_continue()
```

--------------------------------------------------------------------------------

### 4. Testes Necessários

Os testes abaixo são mandatórios para a homologação da fase:

• **Upload de Cookie Inválido:** Colar texto aleatório no campo de cookies e verificar se o sistema impede a criação de um arquivo `cookies.txt` corrompido que travaria o `yt-dlp`.

• **Proxy Offline:** Inserir um proxy inválido, ativar a rotação e validar se o sistema reporta o erro no log sem derrubar a aplicação.

• **Fila com 10.000 itens:** Simular a ingestão massiva e confirmar que o `AppState` utiliza o snapshot cache para manter a UI responsiva.

• **Crash durante execução:** Interromper o processo forçadamente e verificar se, ao reiniciar, o sistema recupera o estado de `PENDING` para itens não finalizados.

--------------------------------------------------------------------------------

# ROADMAP DE PREVENÇÃO DE DÍVIDA TÉCNICA

Para garantir que a **Fase 5.12** suporte a expansão para as Fases 7 e 8, a implementação deve prever:

1. **Migrar proxies para serviço isolado:** Preparar o `ProxyManager` para ser consumido por outros serviços além do YouTube (ex: Scanner Local).

2. **Criar rate limiter interno:** Deixar ganchos para controle de requisições por minuto (RPM) por identidade de rede.

3. **Sistema de health check:** Estruturar a UI para exibir a latência real de cada proxy no futuro.

4. **Implementar cache estruturado:** Garantir que a persistência no `credentials.json` suporte migrações de esquema automáticas.

5. **Separar scraping engine do UI core:** Manter o `YouTubeManager` totalmente desacoplado dos componentes `wx`, comunicando-se apenas via `PubSub`.

--------------------------------------------------------------------------------

**Critério de Concluído (DoD):** O roteiro foi seguido, o arquivo `ui/dialog_config.py` reflete o mockup de 4 blocos e o `Processor` opera com limites configuráveis pelo usuário.
