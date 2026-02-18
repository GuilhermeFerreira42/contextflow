### 🧑 **用户**

# IMPLEMENTAÇÃO DE ELITE

## O que cada arquivo DEVE conter

* * *

# 1️⃣ PHASE\_5\_12\_OVERVIEW.md

## Função Arquitetural

Documento de intenção estratégica + limites de produto.

Não é técnico. É decisório.

## Estrutura Obrigatória

### 1\. Objetivo de Negócio

-   Problema real que a fase resolve.
-   Métrica impactada.

### 2\. Definição de Soberania

-   O que significa autonomia do usuário?
-   Quais limites estão sendo removidos?
-   O que continua sob controle do sistema?

### 3\. Escopo Fechado da Fase

Lista explícita:

-   Inclui
-   Não inclui

Sem isso, a fase expande sozinha.

### 4\. Riscos Estratégicos

-   Abuso de proxies
-   Risco legal
-   Bloqueio por scraping agressivo
-   Aumento de custo operacional

### 5\. Critérios de Conclusão da Fase

Definir quando a fase é considerada entregue. Sem isso, ela nunca termina.

* * *

Gere o arquivo PHASE\_5\_12\_OVERVIEW.md obedecendo rigorosamente à estrutura obrigatória definida no protocolo arquitetural da fase 5.12.

### 🤖 **助手**

# PHASE\_5\_12\_OVERVIEW.md: Visão Estratégica e Governança de Extração

**Status:** SSoT (Fonte Única de Verdade)**Função:** Documento decisório de intenção estratégica e limites de produto para a **Fase 5.12**.**Referências:** Auditoria de Governança v24, Mockup Operacional v2 e Plano de Saneamento Administrativo\[1\].

\--------------------------------------------------------------------------------

### 1\. Objetivo de Negócio

• **Problema Real:** O **ContextFlow** atingiu estabilidade no núcleo de processamento, mas permanece "administrativamente incompleto" e tecnicamente engessado\[4\]\[5\]. Parâmetros críticos de segurança (limite de 20 vídeos) e insumos de rede (cookies/proxies) estão fixos no código ou dependem de manipulação manual de arquivos, gerando fricção e impedindo a escala do **Analista Solo**\[4\].

• **Métrica Impactada:****Autonomia Operacional**. O sucesso desta fase será medido pela redução do tempo de configuração de insumos (cookies/proxies) via interface para menos de 10 segundos e pelo aumento do teto de processamento em lote sem intervenção do desenvolvedor\[8\]\[9\].

### 2\. Definição de Soberania

• **O que significa autonomia do usuário:** O analista deixa de ser um passageiro das regras do sistema e assume o papel de **Comandante Operacional**\[2\]\[10\]. Ele terá o poder de decidir a agressividade da extração, as identidades de rede utilizadas e a ordem de prioridade de dados\[11\]\[12\].

• **Limites Removidos:**

    ◦ Extinção da "Trava de Segurança" fixa de 20 vídeos na fila\[13\]\[14\].    ◦ Fim do protocolo de defesa (Cooldown) mandatório e automático; o usuário agora possui o _kill switch_ da proteção\[15\]\[16\].
• **Controle do Sistema:** O sistema mantém a gestão técnica de baixo nível: orquestração do pool de workers (threading), persistência atômica no SQLite e a execução física do "Escudo" baseada nos parâmetros agora fornecidos pelo usuário\[17\].

### 3\. Escopo Fechado da Fase

**O que ESTÁ incluído:**

• Transformação da tela de configuração em um **Painel de Controle Operacional** dividido em 4 blocos lógicos: Limites/Proteção, Autenticação (Cookies), Rede (Proxies) e Preferências (Idiomas)\[3\]\[20\].

• Gestão dinâmica de cookies no formato **Netscape** via colagem ou importação de arquivo\[21\]\[22\].

• Interface para gerenciamento de lista de IPs de proxies com suporte a _hot-reload_\[23\]\[24\].

• Parametrizar tempo de hibernação (Cooldown) e limite de erros 429 permitidos antes da pausa\[25\]\[26\].

• Substituição da entrada manual de idiomas por uma interface visual de reordenação (prioridade)\[12\]\[19\].

• Rodapé informativo de status operacional em tempo real (Proteção Ativa, Proxies válidos, etc.)\[27\]\[28\].

**O que NÃO está incluído:**

• Integração real com provedores de IA (OpenAI, Gemini, Ollama) — pertencente à Fase 6\[29\]\[30\].

• Controle individual de tokens por IP/Proxy ou sistemas de _Token Bucket_ avançados\[3\]\[31\].

• Análise semântica de transcrições ou geração de tags automáticas\[30\]\[32\].

• Padronização visual total de Modo Escuro (Dark Mode)\[33\].

### 4\. Riscos Estratégicos

• **Abuso de Proxies:** Ao remover a trava de 20 vídeos, o usuário pode sobrecarregar sua lista de proxies, levando ao banimento massivo de sua infraestrutura de rede se os limites forem mal configurados\[15\]\[34\].

• **Risco Legal/Conta:** O uso agressivo de cookies autenticados para contornar restrições pode resultar no banimento da conta do Google utilizada\[15\].

• **Bloqueio por Scraping:** Desativar a "Proteção Automática" expõe o IP real do usuário ao erro 429 de forma contínua, podendo causar bloqueios de longo prazo no YouTube\[16\]\[35\].

• **Instabilidade de Memória:** O carregamento de listas gigantescas de proxies na interface pode gerar picos de uso de RAM se não houver sanitização do input\[36\].

### 5\. Critérios de Conclusão da Fase

A Fase 5.12 será considerada entregue quando:

1\. O conteúdo colado no campo de Cookies for convertido com sucesso para um arquivo `cookies.txt` funcional na raiz, permitindo acesso a vídeos restritos\[37\]\[38\].

2\. O `Processor` respeitar o novo limite de aviso da fila definido na UI (ex: processar 50 vídeos sem abortar se o limite for 100)\[39\]\[40\].

3\. O sistema de **Hibernação (Cooldown)** for desativado via checkbox e o sistema continuar processando mesmo após simulação de erro 429\[39\]\[40\].

4\. Todas as novas chaves de governança (`max_queue_warning`, `auto_defense_enabled`, etc.) forem persistidas corretamente no arquivo `credentials.json`\[25\]\[26\].

### 🧑 **用户**

# IMPLEMENTAÇÃO DE ELITE

## O que cada arquivo DEVE conter

* * *

# 2️⃣ PHASE\_5\_12\_TECH\_SPECS.md

## Função Arquitetural

Contrato técnico imutável.

Aqui a IA executora não pode interpretar.

* * *

## Estrutura Obrigatória

### 1\. Arquitetura Técnica da Solução

-   Onde cookies serão persistidos?
-   Onde proxies serão armazenados?
-   Fila passa a ser ilimitada ou configurável?

Definir diretórios reais.

* * *

### 2\. Modelo de Dados

#### Cookies

Formato aceito:

-   JSON
-   Netscape

Estrutura interna normalizada:

```
{
  "domain": "",
  "name": "",
  "value": "",
  "path": "",
  "expires": "",
  "secure": true,
  "httpOnly": false
}
```

Definir:

-   Validação obrigatória
-   Sanitização
-   Tratamento de expiração

* * *

#### Proxies

Formato aceito:

-   [http://user:pass@host:port](https://www.google.com)
-   socks5://host:port

Regras:

-   Teste de conectividade
-   Timeout máximo
-   Estratégia de rotação (round robin, aleatório, sticky?)

* * *

### 3\. Fila

-   Estrutura atual da fila
-   Alteração necessária
-   Limite antigo
-   Novo comportamento

Definir:

-   Persistência da fila
-   Estado em caso de crash
-   Estratégia de retry

* * *

### 4\. Segurança (Obrigatório)

-   Validação contra injeção
-   Sanitização de arquivos
-   Limite de tamanho
-   Prevenção contra SSRF via proxy

Sem isso, vira vulnerabilidade.

* * *

### 5\. Performance

-   Quantos proxies simultâneos?
-   Quantas tasks concorrentes?
-   Qual é o gargalo atual?

* * *

Gere o arquivo PHASE\_5\_12\_TECH\_SPECS.md obedecendo rigorosamente à estrutura obrigatória definida no protocolo arquitetural da fase 5.12.

### 🤖 **助手**

# PHASE\_5\_12\_TECH\_SPECS.md: Especificações Técnicas e Governança de Extração

**Status:** SSoT (Fonte Única de Verdade)**Função:** Contrato técnico imutável para a inteligência executora.**Referências:** Auditoria de Governança v24, `core/config_manager.py` e Mockup Operacional v2.

\--------------------------------------------------------------------------------

## 1\. Arquitetura Técnica da Solução

A solução baseia-se na centralização da gestão de insumos no `ConfigManager` e na parametrização de limites no `Processor`\[1\].

• **Persistência de Cookies:**

    ◦ **Fonte UI:** Armazenado na chave `inputs.cookie_text` dentro do arquivo `config/credentials.json`\[2\].    ◦ **Alvo Físico:** Sincronizado e persistido no diretório raiz do projeto como `BASE_DIR/cookies.txt` para consumo pelo motor `yt-dlp`\[2\]\[3\].
• **Armazenamento de Proxies:**

    ◦ **Fonte UI:** Armazenado na chave `inputs.proxy_text` no `config/credentials.json`\[2\].    ◦ **Alvo Físico:** Persistido em `config/proxies.txt`\[2\]\[4\].
• **Configuração da Fila:** O sistema abandona a trava física de 20 itens e passa a consultar o parâmetro dinâmico `max_queue_warning`\[5\]\[6\].

\--------------------------------------------------------------------------------

## 2\. Modelo de Dados

### 2.1. Cookies

O sistema deve aceitar a entrada bruta do usuário e realizar o processamento interno antes da escrita física\[3\]\[7\].

• **Formatos Aceitos:**

    1. **Netscape:** Formato tabular padrão de arquivos `.txt`.    2. **JSON:** Lista de objetos provenientes de extensões de exportação\[7\]\[8\].
• **Estrutura Interna Normalizada (JSON):**

• **Validação e Sanitização:**

    ◦ **Obrigatória:** Remoção de espaços em branco acidentais e linhas vazias no início/fim do conteúdo colado\[9\]\[10\].    ◦ **Tratamento de Expiração:** O sistema deve alertar na UI se o campo `expires` de um cookie essencial (como `SID`) estiver no passado.    ◦ **Fallback:** Se o campo de texto estiver vazio no console, o arquivo físico `cookies.txt` deve ser removido para evitar o uso de credenciais expiradas pelo `yt-dlp`\[11\].
### 2.2. Proxies

• **Formato Aceito:**`http://user:pass@host:port` ou `socks5://host:port` (um por linha)\[4\].

• **Teste de Conectividade:** Implementar função de "ping HTTP" leve através de cada IP para validar a integridade antes do salvamento\[12\].

• **Estratégia de Rotação:**

    ◦ **Aleatório (Padrão):** Seleção via `random.choice` do pool em memória\[13\].    ◦ **Round-Robin (Sequencial):** Alternância em ordem de lista para distribuir a carga uniformemente\[12\].
\--------------------------------------------------------------------------------

## 3\. Fila (Queue Orchestration)

• **Estrutura Atual:** Fila baseada em `queue.Queue` gerenciada pelo `Processor`\[14\].

• **Alteração Necessária:** Substituir a verificação manual `> 20` por uma consulta ao `ConfigManager` via `self.config.get("orchestration", "max_queue_warning")`\[6\]\[15\].

• **Comportamento de Limite:**

    ◦ Ao atingir o gatilho, o sistema interrompe o enfileiramento e exige confirmação manual na UI sob o rótulo **"Aviso de Segurança (Lote Massivo)"**\[5\]\[16\].
• **Persistência e Estado:**

    ◦ O status das tarefas deve ser salvo na tabela `videos` do SQLite a cada transição de estado (`PENDING`, `PROCESSING`, `COMPLETED`, `ERROR`)\[17\]\[18\].    ◦ **Recuperação em Crash:** Ao reiniciar, itens marcados como `PROCESSING` devem reverter para `PENDING` para permitir a retomada\[17\]\[19\].    ◦ **Retry Strategy:** Até 3 tentativas falhas com "backoff linear" antes de marcar como `FAILED_PERMANENT`\[20\]\[21\].
\--------------------------------------------------------------------------------

## 4\. Segurança (Mandatório)

• **Validação contra Injeção:** Campos de texto brutos para cookies e proxies devem ser sanitizados para impedir injeção de comandos de shell durante a passagem de argumentos para o `yt-dlp`\[9\].

• **Sanitização de Arquivos:** O `ConfigManager` deve garantir que a escrita nos arquivos físicos utilize encoding `utf-8` e não permita a criação de arquivos fora dos caminhos `COOKIES_PATH` e `PROXY_LIST_PATH` (Prevenção de Path Traversal)\[2\]\[22\].

• **Limite de Tamanho:** Restringir o campo de colagem a um máximo de 1MB de texto para evitar negação de serviço local (DoS) e estouro de memória na UI\[23\].

• **Prevenção SSRF:** Validar se os endereços de proxy fornecidos seguem padrões de URI válidos, proibindo endereços de loopback interno (`127.0.0.1`) a menos que explicitamente autorizado\[24\].

\--------------------------------------------------------------------------------

## 5\. Performance

• **Concorrência de Proxies:** Suporte a até 4 proxies simultâneos ativos no pool para evitar contenção de I/O de rede\[25\]\[26\].

• **Tarefas Concorrentes:**

    ◦ **Nuvem (OpenAI/Gemini):** Parametrizável entre 1 e 4 workers\[27\]\[28\].    ◦ **Local (Ollama):** Trava mandatória em **1 tarefa** para proteção de hardware\[27\]\[29\].
• **Gargalo Atual:** Contenção de bloqueio (`Lock Contention`) no `AppState` durante escritas massivas de metadados em lotes de 5.000+ vídeos\[30\]\[31\]. A solução deve focar em minimizar o tempo de retenção do `RLock` através de snapshots rápidos\[32\]\[33\].

\--------------------------------------------------------------------------------

**Critério de Homologação Final:** O sistema deve persistir as novas configurações no JSON, gerar os arquivos físicos correspondentes e o `Processor` deve operar sob o novo teto de fila sem intervenção manual de código\[34\]\[35\].

### 🧑 **用户**

# IMPLEMENTAÇÃO DE ELITE

## O que cada arquivo DEVE conter

* * *

# 3️⃣ PHASE\_5\_12\_STRUCTURAL\_STANDARDS.md

## Função Arquitetural

Blindar o projeto contra caos estrutural.

* * *

## Estrutura Obrigatória

### 1\. Padrão de Persistência

-   Arquivo local?
-   SQLite?
-   Banco relacional?

Definir:

-   Quem pode escrever
-   Quem pode ler
-   Quando é salvo

* * *

### 2\. Estado Global

-   Existe store central?
-   Singleton?
-   Event Bus?

Definir claramente:

-   Quem altera estado
-   Quem apenas consome

* * *

### 3\. Design System

-   Tokens visuais
-   Componentes reutilizáveis
-   Padrão de botões
-   Estados (loading, error, disabled)

Sem isso, UI vira Frankenstein.

* * *

### 4\. Escopo Congelado

Declaração explícita:

> Nenhuma funcionalidade adicional será adicionada nesta fase.

Isso impede expansão invisível.

Gere o arquivo PHASE\_5\_12\_STRUCTURAL\_STANDARDS.md obedecendo rigorosamente à estrutura obrigatória definida no protocolo arquitetural da fase 5.12.

### 🤖 **助手**

# PHASE 5.12 STRUCTURAL STANDARDS: Blindagem Arquitetural e Governança

**Status:** SSoT (Fonte Única de Verdade)**Função:** Blindar o projeto contra caos estrutural e garantir a prontidão para a Fase 6.**Referências:** Auditoria de Governança v24, `app_state.py`, `constants.py`.

\--------------------------------------------------------------------------------

## 1\. Padrão de Persistência

Para garantir a integridade dos dados e a sobrevivência das configurações do usuário, o sistema adota um **modelo híbrido de persistência**\[1\].

• **Configurações e Insumos (JSON):**

    ◦ **Arquivo:**`config/credentials.json`\[1\]\[2\].    ◦ **Quem escreve:** Exclusivamente o `ConfigManager` através de métodos atômicos\[2\].    ◦ **Quem lê:** Qualquer componente via Singleton do `ConfigManager`\[1\].    ◦ **Quando é salvo:** No gatilho do botão "SALVAR" do diálogo de configurações, disparando o método `update_physical_files()` para sincronizar cookies e proxies físicos\[3\]\[4\].
• **Dados Operacionais e Histórico (SQLite):**

    ◦ **Arquivo:**`contextflow.db` (tabelas `videos`, `system_config`, `ai_usage_log`)\[5\]\[6\].    ◦ **Quem escreve:**`DatabaseHandler` sob demanda do `Processor` ou mutações do `AppState`\[6\].    ◦ **Quando é salvo:** Instantaneamente em cada transição de estado de tarefa ou detecção de erro\[3\].
## 2\. Estado Global (SSoT)

O gerenciamento de estado obedece ao princípio da **Fonte Única de Verdade** para evitar inconsistências entre as abas independentes\[5\]\[7\].

• **Store Central:** Singleton `AppState`\[5\]\[7\].

• **Thread Safety:** Todas as mutações de estado (adição, deleção ou promoção de tarefas) devem ocorrer sob a proteção do `threading.RLock` interno\[7\]\[8\].

• **Quem altera estado:** O `Processor` (resultados de extração) e o `AppWindow` (deleções/configurações)\[8\].

• **Quem apenas consome:** As abas de interface (`TabBatch`, `TabAnalysis`), que recebem atualizações exclusivamente via **PubSub** ou **Observer Pattern**\[7\]\[9\].

• **Segurança de UI:** Atualizações gráficas disparadas por mudanças de estado devem ser obrigatoriamente envelopadas em `wx.CallAfter`\[10\].

## 3\. Design System Interno

Para evitar a criação de uma "Interface Frankenstein", todos os novos componentes da Fase 5.12 devem seguir rigorosamente estes tokens\[10\]\[11\]:

• **Tokens Visuais (Light Mode):** Mandatory use of `COLOR_BG` (Branco), `COLOR_FG` (Cinza Escuro) e `COLOR_ACCENT` (Azul)\[10\]\[11\].

• **Renderizadores de Grade:** Uso obrigatório de `SafeTextRenderer` com a chamada `dc.SetClippingRegion(rect)` para eliminar o vazamento de texto entre células\[11\]\[12\].

• **Feedback Visual:**

    ◦ **Loading/Esforço:** Utilização de `wx.Gauge` para progresso determinado\[11\].    ◦ **Semântica de Logs:** Azul para Sistema/Informação, Laranja para Avisos e Vermelho para Erros/Falhas\[11\].
• **Padronização de Nomenclatura:** Substituição de termos técnicos por operacionais amigáveis: "Intervalo de Espera" (Cooldown), "Limite de Tentativas Falhas" (Erro 429) e "Processamento Simultâneo" (Tasks)\[12\]\[13\].

## 4\. Escopo Congelado

Conforme determinação de governança administrativa, os limites desta fase são imutáveis\[14\]\[15\].

**Nenhuma funcionalidade adicional de inteligência artificial ou análise semântica será adicionada nesta fase.**

• **Incluído:** Gestão visual de Cookies/Proxies, parametrização de limites de fila, toggle de defesa e unificação de temas\[14\]\[15\].

• **Interditado:** Chamadas a APIs de resumo (OpenAI, Gemini), integração de modelos locais (Ollama), tags automáticas ou busca vetorial\[15\]\[16\].

\--------------------------------------------------------------------------------

**Critério de Homologação:** A estrutura da Fase 5.12 será considerada concluída quando o sistema for capaz de persistir a prioridade de idiomas e os insumos de rede no arquivo JSON, respeitando o isolamento entre abas e o Design System sem vazamentos visuais\[17\]\[18\].

### 🧑 **用户**

# IMPLEMENTAÇÃO DE ELITE

## O que cada arquivo DEVE conter

* * *

# 4️⃣ PHASE\_5\_12\_EXECUTION.md

## Função Arquitetural

Roteiro determinístico de implementação.

Se este documento for bem escrito, a IA executora apenas copia a lógica.

* * *

## Estrutura Obrigatória

### 1\. Arquivos que serão modificados

Lista exata:

-   core/queue\_manager.py
-   core/proxy\_manager.py
-   ui/settings\_view.py

* * *

### 2\. Sequência de Implementação

Ordem exata:

1.  Criar modelo de proxy
2.  Criar parser de cookies
3.  Alterar fila
4.  Ajustar UI
5.  Testes

Sem ordem, a execução quebra dependências.

* * *

### 3\. Pseudocódigo Obrigatório

Exemplo:

```
function loadProxies():
    read file
    validate each proxy
    test connectivity
    store valid proxies
```

* * *

### 4\. Testes Necessários

-   Upload cookie inválido
-   Proxy offline
-   Fila com 10.000 itens
-   Crash durante execução

* * *

# ROADMAP DE PREVENÇÃO DE DÍVIDA TÉCNICA

Se essa fase for expandir no futuro:

-   Migrar proxies para serviço isolado
-   Criar rate limiter interno
-   Criar sistema de health check
-   Implementar cache estruturado
-   Separar scraping engine do UI core

Se não prever isso agora, a refatoração virá na fase 7 ou 8.

* * *

Gere o arquivo PHASE\_5\_12\_EXECUTION.md obedecendo rigorosamente à estrutura obrigatória definida no protocolo arquitetural da fase 5.12.

### 🤖 **助手**

# 4️⃣ PHASE\_5\_12\_EXECUTION.md: Roteiro Determinístico de Implementação

**Status:** SSoT (Fonte Única de Verdade)**Função:** Roteiro técnico obrigatório para a inteligência executora.**Objetivo:** Implementar a governança de insumos e o desbloqueio de limites operacionais.**Referências:** PHASE\_5\_12\_TECH\_SPECS, PHASE\_5\_12\_STRUCTURAL\_STANDARDS e Mockup Operacional v2.

\--------------------------------------------------------------------------------

### 1\. Arquivos que serão modificados

Para garantir a segregação de responsabilidades e a persistência industrial, os seguintes arquivos devem ser alterados ou criados:

• `core/queue\_manager.py` (Atualmente implementado dentro de `core/processor.py`): Responsável por substituir o limite fixo de 20 vídeos pela consulta dinâmica ao `ConfigManager`\[1\]\[2\].

• `core/proxy\_manager.py`: Responsável por implementar o _hot-reload_ da lista de IPs e a estratégia de rotação (Round-Robin/Aleatório) \[3\]\[4\].

• `ui/settings\_view.py` (Atualmente `ui/dialog_config.py`): Responsável por implementar a interface de 4 blocos (Controle, Cookies, Rede, Idiomas) conforme o mockup validado \[5\]\[6\].

• `core/config\_manager.py`: Responsável por centralizar a lógica de `update_physical_files()` para cookies e proxies \[7\].

\--------------------------------------------------------------------------------

### 2\. Sequência de Implementação

A execução deve seguir esta ordem rigorosa para evitar quebra de dependências:

1\. **Criar modelo de proxy:** Expandir a estrutura no `ConfigManager` para suportar `proxy_text` e o modo de rotação \[3\]\[7\].

2\. **Criar parser de cookies:** Implementar a sanitização de strings para o formato **Netscape** e a escrita física no arquivo `cookies.txt` na raiz \[7\]\[8\].

3\. **Alterar fila:** Modificar o `Processor` para ler `max_queue_warning` e condicionar o protocolo de defesa à flag `auto_defense_enabled`\[1\]\[2\].

4\. **Ajustar UI:** Reconstruir a aba "Extração & Defesa" no diálogo de configurações com os 4 blocos lógicos e botões de importação \[6\].

5\. **Testes:** Ciclo de validação de persistência e comportamento sob erro 429 \[9\].

\--------------------------------------------------------------------------------

### 3\. Pseudocódigo Obrigatório

A inteligência executora deve seguir a lógica abaixo para os métodos críticos:

Sincronização de Insumos (`ConfigManager`)

```
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

```
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
\--------------------------------------------------------------------------------

### 4\. Testes Necessários

Os testes abaixo são mandatórios para a homologação da fase:

• **Upload de Cookie Inválido:** Colar texto aleatório no campo de cookies e verificar se o sistema impede a criação de um arquivo `cookies.txt` corrompido que travaria o `yt-dlp`\[8\].

• **Proxy Offline:** Inserir um proxy inválido, ativar a rotação e validar se o sistema reporta o erro no log sem derrubar a aplicação \[3\].

• **Fila com 10.000 itens:** Simular a ingestão massiva e confirmar que o `AppState` utiliza o snapshot cache para manter a UI responsiva \[5\]\[10\].

• **Crash durante execução:** Interromper o processo forçadamente e verificar se, ao reiniciar, o sistema recupera o estado de `PENDING` para itens não finalizados \[1\].

\--------------------------------------------------------------------------------

# ROADMAP DE PREVENÇÃO DE DÍVIDA TÉCNICA

Para garantir que a **Fase 5.12** suporte a expansão para as Fases 7 e 8, a implementação deve prever:

1\. **Migrar proxies para serviço isolado:** Preparar o `ProxyManager` para ser consumido por outros serviços além do YouTube (ex: Scanner Local).

2\. **Criar rate limiter interno:** Deixar ganchos para controle de requisições por minuto (RPM) por identidade de rede.

3\. **Sistema de health check:** Estruturar a UI para exibir a latência real de cada proxy no futuro.

4\. **Implementar cache estruturado:** Garantir que a persistência no `credentials.json` suporte migrações de esquema automáticas.

5\. **Separar scraping engine do UI core:** Manter o `YouTubeManager` totalmente desacoplado dos componentes `wx`, comunicando-se apenas via `PubSub`\[10\].

\--------------------------------------------------------------------------------

**Critério de Concluído (DoD):** O roteiro foi seguido, o arquivo `ui/dialog_config.py` reflete o mockup de 4 blocos e o `Processor` opera com limites configuráveis pelo usuário.

A criação destes arquivos documentais conclui o planejamento da Fase 5.12. **Deseja que eu gere agora o comando de gatilho final para você enviar para a IA executora iniciar a codificação?**

