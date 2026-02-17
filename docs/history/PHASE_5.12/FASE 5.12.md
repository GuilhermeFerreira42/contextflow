### 🧑 [USUÁRIO]

Pode gerar o plano de ação detalhado para a Fase 5.12?

### 🤖 [IA]

Com base na nossa discussão estratégica, nos requisitos de governança administrativa e no feedback técnico da Fase 5.11, apresento o plano de ação detalhado para a **FASE 5.12: Saneamento Administrativo e Governança de Extração**.

Esta fase é o "último quilômetro" antes de injetarmos a inteligência artificial Multi-LLM (Fase 6), focando em dar a você o controle total sobre os insumos de extração (Cookies e Proxies) e parâmetros de segurança que hoje estão fixos no código **\[PHASE\_5\_12 Discussion, 1137\]**.

\--------------------------------------------------------------------------------

### 📂 Documentação da Fase 5.12

Abaixo, os arquivos que compõem o roteiro técnico para esta etapa:

1\. `PHASE_5_12_OVERVIEW.md`: Visão e Metas

**Objetivo:** Transformar o ContextFlow em uma estação de controle customizável, removendo amarras técnicas (**hardcoded**) e centralizando a gestão de insumos de rede \[1\].

• **Meta 1:** Autonomia para usar os Cookies extraídos (JSON/Netscape) \[4\].

• **Meta 2:** Controle dinâmico da fila e do sistema de defesa (Cooldown).

• **Meta 3:** Refinamento da triagem de legendas por prioridade visual.

2\. `PHASE_5_12_INPUT_MANAGER_SPECS.md`: Central de Cookies e Proxies

**Objetivo:** Implementar a interface de colagem e conversão de insumos no `DialogConfig`.

• **Conversor de Cookies:** O sistema deve aceitar o formato **JSON** (fornecido por você) ou **Netscape** e salvar automaticamente no arquivo `cookies.txt` exigido pelo motor de extração \[4\].

• **Gestor de Proxies:** Área para colar a lista de IPs que alimentará o `ProxyManager`, permitindo ativação/desativação imediata sem deletar o arquivo \[7\].

3\. `PHASE_5_12_ORCHESTRATION_SPECS.md`: Desbloqueio de Limites

**Objetivo:** Substituir as travas fixas por variáveis de configuração persistentes no `credentials.json`\[10\].

• **Limite de Fila:** O bloqueio de segurança para lotes > 20 deve tornar-se editável (ex: "Avisar se fila > X") \[13\]\[14\].

• **Protocolo de Defesa:** Adição de um **Toggle Global** no `DialogConfig` para ligar/desligar o sistema de Cooldown Automático e detecção de erros 429 \[15\].

4\. `PHASE_5_12_EXECUTION.md`: Roteiro de Implementação Passo a Passo

Este roteiro detalha as alterações nos arquivos `core/config_manager.py`, `ui/dialog_config.py`, `core/processor.py` e `services/youtube_manager.py` para integrar as novas funcionalidades de governança.

\--------------------------------------------------------------------------------

### 🛠️ Roteiro de Implementação Técnica (Fase 5.12)

Passo 1: Expansão do Motor de Configuração (`core/config_manager.py`)

Devemos adicionar as seguintes chaves ao dicionário padrão de configurações \[10\]\[18\]:

• `batch_limits`: `{"max_queue_warning": 20, "enforce_proxy_above": 20}`.

• `defense_toggle`: `{"auto_cooldown_enabled": True}`.

• `inputs`: `{"cookie_text": "", "proxy_text": ""}`.

Passo 2: A Nova Aba "Insumos & Defesa" (`ui/dialog_config.py`)

Criação de uma interface robusta contendo \[12\]:

1\. **Campo Multiline para Cookies:** Onde você colará o conteúdo do JSON extraído \[4\].

2\. **Lógica de Persistência:** Ao salvar, o `ConfigManager` deve atualizar o arquivo físico `cookies.txt` e `proxies.txt` no diretório base \[6\].

3\. **Dropdown de Idiomas:** Substituir a string manual por uma lista de "Prioridade de Legendas" (ex: \[PT, EN, ES\]) \[20\]\[23\].

Passo 3: Adaptação do Processor (`core/processor.py`)

O motor de processamento deve deixar de olhar para o número "20" fixo e consultar o `ConfigManager`\[13\]:

• A lógica de `Pre-flight Check` agora lerá as preferências do usuário para decidir se aborta ou apenas avisa sobre o risco de banimento sem proxies \[13\]\[24\].

\--------------------------------------------------------------------------------

### ✅ Definição de Concluído (DoD) para a Fase 5.12

A fase será considerada pronta para a **Fase 6 (IA)** quando:

• \[ \] O usuário puder colar o JSON de cookies na interface e o sistema realizar o download de transcrições restritas com sucesso \[4\].

• \[ \] O sistema de **Cooldown** puder ser desativado manualmente via checkbox para testes rápidos \[17\]\[25\].

• \[ \] O limite de 20 vídeos na fila for ajustado para 50 (ou qualquer valor) via painel e respeitado pelo `Processor`.

• \[ \] A lista de idiomas de legenda for salva e carregada corretamente do JSON de credenciais \[26\].

**Posso gerar o primeiro arquivo de execução (**`PHASE\_5\_12\_EXECUTION.md`**) focado na criação da interface de Cookies e Proxies?**

### 🧑 [USUÁRIO]

gere 1. PHASE\_5\_12\_OVERVIEW.md: Visão e Metas

### 🤖 [IA]

# PHASE 5.12 OVERVIEW: Saneamento Administrativo e Governança de Extração

**Status:** SSoT (Fonte Única de Verdade)**Foco:** Controle de Insumos (Cookies/Proxies), Parametrização de Limites e Defesa Flexível**Referências:** Auditoria 5.11, Especificações de Governança e Feedback v24

\--------------------------------------------------------------------------------

## 1\. Contexto e Visão Geral

O ContextFlow atingiu sua **Maturidade Industrial** com a estabilização da concorrência e da sincronia entre abas. Entretanto, o sistema ainda opera sob regras administrativas rígidas e "hardcoded" (fixas no código), o que limita a autonomia do **Analista Solo**\[1\].

A **Fase 5.12** é o "último quilômetro" de saneamento administrativo. O objetivo é remover as amarras técnicas finais, entregando ao usuário o controle total sobre os insumos de rede (**Cookies e Proxies**) e os parâmetros de segurança que hoje são automáticos e inflexíveis. Esta fase prepara o terreno para a Fase 6, garantindo que a extração de dados seja soberana e adaptável a diferentes cenários de bloqueio\[2\].

\--------------------------------------------------------------------------------

## 2\. Pilares de Implementação

### 2.1. Central de Insumos Dinâmicos (Cookies & Proxies)

Atualmente, o suporte a cookies e proxies depende da manipulação manual de arquivos externos (`cookies.txt` e `proxies.txt`)\[3\]\[4\].

• **Gestão de Cookies:** Implementação de uma área para colagem direta do conteúdo de cookies (suportando o formato **JSON** extraído pelo usuário ou Netscape)\[5\].

• **Conversão Automática:** O sistema deve converter o texto colado no arquivo físico exigido pelo motor `yt-dlp` em tempo de execução\[15\]\[16\].

• **Gestor de IPs:** Interface visual para gerenciar a lista de proxies, permitindo ativar ou desativar o uso de identidades de rede sem deletar as configurações.

### 2.2. Desbloqueio de Limites Operacionais

O sistema possui travas de segurança fixas que impedem o processamento massivo em certas condições.

• **Parametrização da Fila:** Substituição do limite rígido de **20 vídeos** por um campo editável no `ConfigManager`\[1\]\[17\].

• **Governança de Alerta:** O usuário poderá definir o teto de "aviso" antes do início de um lote grande, assumindo o risco operacional de forma consciente.

### 2.3. Antifragilidade Flexível (Toggle de Defesa)

O protocolo de defesa (**Regra Alpha - Cooldown**) é atualmente mandatório e bloqueia o sistema por 1 hora ao detectar erro 429\[18\]\[19\].

• **Toggle Global:** Implementação de controle para ligar/desligar o sistema de hibernação automática e detecção de erros.

• **Modo de Risco:** Permite que o analista force o processamento mesmo sob risco de banimento de IP, essencial para usuários que utilizam proxies rotativos de alta performance.

### 2.4. Refinamento de Triagem de Legendas

Substituição da entrada manual de strings de idioma (ex: "pt,en") por uma interface de prioridade visual.

• **Prioridade Visual:** Lista ordenável onde o usuário define a sequência de busca (Ex: 1º Português Manual, 2º Português Automático, 3º Inglês).

\--------------------------------------------------------------------------------

## 3\. Metas de Sucesso

• **Autonomia:** Capacidade de atualizar os cookies do sistema em < 10 segundos via interface de configurações.

• **Flexibilidade:** Possibilidade de processar lotes de 50+ vídeos sem o bloqueio de segurança "Fila > 20 sem Proxies", se o usuário assim desejar\[17\].

• **Soberania Operacional:** Controle manual sobre o estado de Cooldown, permitindo o reset do bloqueio sem reiniciar a aplicação\[20\].

• **Persistência:** Garantia de que todas as novas preferências de extração sejam salvas no `credentials.json` e respeitadas pelo `Processor`\[21\]\[22\].

\--------------------------------------------------------------------------------

**Critério de Homologação:** A Fase 5.12 será considerada concluída quando o usuário puder colar um novo JSON de cookies, alterar o limite da fila para 50 e desativar o Cooldown preventivo, tudo através do console de governança, com as mudanças refletidas instantaneamente nas operações do motor de extração.

### 🧑 [USUÁRIO]

gere 2. PHASE\_5\_12\_INPUT\_MANAGER\_SPECS.md: Central de Cookies e Proxies

### 🤖 [IA]

# PHASE 5.12 INPUT MANAGER SPECS: Central de Cookies e Proxies

**Status:** SSoT (Fonte Única de Verdade)**Alvos:**`ui/dialog_config.py`, `core/config_manager.py`, `services/youtube_manager.py`**Foco:** Autonomia na Ingestão de Insumos de Rede e Blindagem Anti-Bloqueio

\--------------------------------------------------------------------------------

## 1\. Visão Geral

A **Central de Cookies e Proxies** é o componente de interface e backend responsável por gerenciar as identidades de rede do **ContextFlow**. Ela permite que o usuário insira manualmente os tokens de autenticação (Cookies) e a lista de endereços IP (Proxies) para o "Escudo" do sistema, garantindo o acesso a transcrições restritas e evitando o erro HTTP 429\[1\]\[2\].

## 2\. Gestão de Cookies (O Combustível)

Atualmente, o sistema busca um arquivo físico em `COOKIES_PATH`\[3\]\[4\]. A nova implementação centraliza isso no painel de configurações.

### 2.1. Interface de Entrada

• **Componente:**`wx.TextCtrl` com a flag `wx.TE_MULTILINE` na nova aba **"Extração & Defesa"**\[5\].

• **Formatos Suportados:**

    ◦ **JSON:** Formato extraído de extensões de navegador (ex: EditThisCookie).    ◦ **Netscape:** Formato padrão de arquivos `cookies.txt`.    ◦ **Header String:** String bruta do cabeçalho `Cookie:`.
### 2.2. Lógica de Conversão e Persistência

Ao salvar as configurações, o `ConfigManager` deve processar o texto colado:

1\. **Parse de JSON:** Se o conteúdo iniciar com `[`, o sistema deve iterar sobre a lista de dicionários fornecida pelo usuário\[6\].

2\. **Escrita Física:** O conteúdo deve ser convertido/salvo no arquivo definido em `COOKIES_PATH` (`BASE_DIR/cookies.txt`)\[3\].

3\. **Validação:** O `YouTubeManager` verificará a existência deste arquivo antes de cada extração para injetá-lo no `yt-dlp` via flag `--cookiefile`\[7\]\[8\].

\--------------------------------------------------------------------------------

## 3\. Gestor de Proxies (A Camada de IP)

O sistema utiliza o `ProxyManager` para rotacionar identidades em lotes grandes (> 20 vídeos)\[1\]\[9\].

### 3.1. Interface de Edição

• **Componente:**`wx.TextCtrl` (Multiline) para colagem da lista de proxies (um por linha).

• **Exemplo de Formato:**`http://user:pass@host:port`.

### 3.2. Sincronização com o Core

• **Persistência:** O texto colado é salvo em `PROXY_LIST_PATH` (`config/proxies.txt`)\[3\]\[10\].

• **Ativação Hot-Reload:** Ao salvar o diálogo, o `ProxyManager` deve disparar internamente o método `_load_proxies()` para atualizar a lista em memória sem reiniciar o sistema\[11\].

\--------------------------------------------------------------------------------

## 4\. Especificações da Aba "Extração & Defesa"

A nova aba no `DialogConfig` deve seguir a seguinte estrutura de layout\[2\]\[5\]:

| Grupo | Componente | Descrição Técnica |
| --- | --- | --- |
| Cookies | wx.StaticText | Rótulo: "Colar Cookies (JSON ou Netscape)". |
|   | wx.TextCtrl | Campo de texto alto (mín. 150px) para colagem dos dados[6]. |
| Proxies | wx.StaticText | Rótulo: "Lista de Proxies (Um por linha)". |
|   | wx.TextCtrl | Campo de texto para IPs. |
| Controle | wx.CheckBox | Toggle: "Habilitar Rotação de Proxies" (vinculado a use_proxies)[12]. |
|   | wx.CheckBox | Toggle: "Utilizar Cookies" (vinculado a use_cookies)[12]. |

## 5\. Regras de Negócio e Segurança

1\. **Proteção de Dados:** Embora os dados sejam salvos em texto puro conforme solicitado para facilidade de manutenção, o campo de colagem no diálogo deve ser limpo de espaços em branco acidentais antes de salvar \[PHASE\_5\_12 Discussion\].

2\. **Fallback de Arquivo:** Se o campo de texto estiver vazio no console, o sistema deve remover o arquivo físico `cookies.txt` para evitar que o `yt-dlp` tente usar credenciais expiradas.

3\. **Pre-flight Check:** Antes de iniciar um processamento massivo, o sistema deve verificar se o toggle "Utilizar Cookies" está ativo e se o arquivo físico existe, emitindo um alerta de sistema se necessário\[13\].

\--------------------------------------------------------------------------------

**Critério de Homologação:** O usuário cola o JSON de cookies na interface, clica em SALVAR, e o sistema cria instantaneamente o arquivo `cookies.txt` na pasta raiz, permitindo que o `YouTubeManager` acesse vídeos restritos imediatamente\[8\]\[14\].

### 🧑 [USUÁRIO]

gere 3. PHASE\_5\_12\_ORCHESTRATION\_SPECS.md: Desbloqueio de Limites

### 🤖 [IA]

# PHASE\_5\_12\_ORCHESTRATION\_SPECS: Desbloqueio de Limites e Governança Dinâmica

**Status:** SSoT (Fonte Única de Verdade)**Foco:** Parametrização de Regras de Segurança, Toggle de Antifragilidade e Semântica UX**Alvos:**`core/processor.py`, `core/config_manager.py`, `ui/dialog_config.py`

\--------------------------------------------------------------------------------

## 1\. Visão Geral

Atualmente, o **ContextFlow** opera com travas de segurança rígidas e nomes técnicos que geram fricção cognitiva\[1\]\[2\]. Esta especificação detalha o **desbloqueio dos limites "hardcoded"** (fixos no código), permitindo que o Analista Solo defina o teto operacional do sistema e decida quando ativar ou desativar os protocolos de defesa\[3\]\[4\].

## 2\. Parametrização da Fila (Batch Scaling)

O limite fixo de **20 vídeos** para processamento em lote, anteriormente obrigatório para evitar banimentos, deve se tornar uma variável consultada dinamicamente\[1\]\[5\].

### 2.1. Alterações no `core/processor.py`

• **Remoção de Trava Fixa:** Substituir a verificação manual de `queue.qsize() > 20` pela consulta ao `ConfigManager`\[3\].

• **Lógica de Alerta:** O sistema deve ler o parâmetro `max_queue_warning`. Se a fila exceder este valor, o sistema exibe um aviso, mas permite a continuação se o usuário confirmar a ciência do risco\[6\].

\--------------------------------------------------------------------------------

## 3\. Toggle de Antifragilidade (Kill Switch de Defesa)

Hoje, o controle de erro 429 e o **Cooldown Global** são automáticos e mandatórios\[4\]\[7\]. A Fase 5.12 introduz a soberania do usuário sobre esses mecanismos\[6\].

### 3.1. Especificação Técnica

• **Flag** `auto\_defense\_enabled`**:** Adicionar esta chave ao `ConfigManager`.

• **Interceptação no** `Processor`**:** Antes de disparar o `cooldown.trigger_cooldown()`, o motor deve verificar se a defesa automática está ligada\[4\].

• **Impacto:** Se desativado, o sistema ignorará a contagem de erros 429 e tentará processar a fila continuamente, mesmo sob hostilidade do YouTube\[4\].

\--------------------------------------------------------------------------------

## 4\. Padronização Semântica de UX

Para reduzir o ruído interpretativo, os termos técnicos no `DialogConfig` e nos logs devem ser renomeados para expressões mais amigáveis\[2\]\[6\].

| Termo Técnico Antigo | Nova Nomenclatura UX (Sugerida) |
| --- | --- |
| Cooldown | Intervalo de Espera (Hibernação) |
| Erro HTTP 429 | Limite de Tentativas Falhas |
| Tasks Cloud | Processamento Simultâneo |
| Anti-Jitter | Atraso Humano Preventivo |

\--------------------------------------------------------------------------------

## 5\. Estrutura de Configuração (`credentials.json`)

A aba **"Orquestração"** do painel de controle deve refletir as novas chaves de governança\[10\]\[11\]:

```
{
  "orchestration": {
    "max_cloud_tasks": 2,
    "max_queue_warning": 50,
    "auto_defense_enabled": true,
    "cooldown_duration_mins": 60
  },
  "subtitles": {
    "language_order": "pt,pt-BR,en",
    "fallback_auto": true
  }
}
```
## 6\. Regras de Negócio para Homologação

1\. **Persistência Dinâmica:** Alterar o limite de 20 para 50 na UI deve atualizar o comportamento do `Processor` instantaneamente sem necessidade de reiniciar o software\[1\]\[6\].

2\. **Soberania de Risco:** Ao desativar a "Proteção Automática", o sistema não deve entrar em estado de hibernação (Cooldown) mesmo após múltiplos erros 429 no log\[4\].

3\. **Consistência de Legendas:** O motor de extração deve seguir rigorosamente a lista visual de prioridade de idiomas definida no painel antes de marcar um vídeo com erro de transcrição\[6\]\[12\].

\--------------------------------------------------------------------------------

**Critério de Concluído (DoD):** O sistema não possui mais o número "20" fixo em sua lógica de enfileiramento e permite que o usuário desative manualmente o protocolo de hibernação global\[1\]\[6\].

### 🧑 [USUÁRIO]

4.  PHASE\_5\_12\_EXECUTION.md: Roteiro de Implementação Passo a Passo

### 🤖 [IA]

# PHASE 5.12 EXECUTION: Roteiro de Implementação Passo a Passo

**Status:** SSoT (Fonte Única de Verdade)**Objetivo:** Implementar a Central de Insumos (Cookies/Proxies), o desbloqueio de limites operacionais e a flexibilidade do protocolo de defesa.**Alvos:**`core/config_manager.py`, `ui/dialog_config.py`, `core/processor.py`, `services/youtube_manager.py`, `constants.py`.

\--------------------------------------------------------------------------------

### Passo 1: Expansão do Motor de Configuração

O primeiro passo é preparar o `ConfigManager` para persistir os novos parâmetros de governança e os textos brutos de insumos.

1\. `core/config\_manager.py`:

    ◦ Atualizar o método `_get_default_config()` para incluir as novas chaves\[1\]\[2\]:        ▪ `orchestration`: Adicionar `max_queue_warning` (padrão: 20) e `auto_defense_enabled` (padrão: `True`) \[PHASE\_5\_12\_ORCHESTRATION\_SPECS\].        ▪ `inputs`: Adicionar `cookie_text` e `proxy_text` para armazenar o conteúdo colado pelo usuário \[PHASE\_5\_12\_INPUT\_MANAGER\_SPECS\].    ◦ Implementar um método helper `update_physical_files()` que lê `cookie_text` e `proxy_text` e escreve nos caminhos `COOKIES_PATH` e `PROXY_LIST_PATH` \[2, PHASE\_5\_12\_INPUT\_MANAGER\_SPECS\].
\--------------------------------------------------------------------------------

### Passo 2: Implementação da Aba "Extração & Defesa"

Transformar o `DialogConfig` em uma central de controle de insumos.

1\. `ui/dialog\_config.py`:

    ◦ Adicionar uma nova aba chamada **"Extração & Defesa"** ao `wx.Notebook`\[3\]\[4\].    ◦ **Área de Cookies**: Criar um `wx.StaticText` ("Colar Cookies") e um `wx.TextCtrl` multiline. Vincular ao campo `inputs.cookie_text` \[PHASE\_5\_12\_INPUT\_MANAGER\_SPECS\].    ◦ **Área de Proxies**: Criar um `wx.TextCtrl` multiline vinculado a `inputs.proxy_text` \[PHASE\_5\_12\_INPUT\_MANAGER\_SPECS\].    ◦ **Controles de Risco**:        ▪ Adicionar um `wx.SpinCtrl` para o "Limite de Aviso da Fila" (vinculado a `max_queue_warning`) \[PHASE\_5\_12\_ORCHESTRATION\_SPECS\].        ▪ Adicionar um `wx.CheckBox` para "Habilitar Proteção Automática" (vinculado a `auto_defense_enabled`) \[PHASE\_5\_12\_ORCHESTRATION\_SPECS\].    ◦ **Lógica de Salvamento (**`on\_save`**)**: Ao clicar em SALVAR, chamar `self.config.update_physical_files()` para garantir que o `yt-dlp` encontre os arquivos atualizados \[1000, PHASE\_5\_12\_INPUT\_MANAGER\_SPECS\].
\--------------------------------------------------------------------------------

### Passo 3: Desbloqueio e Flexibilidade no Core

O motor de processamento deve deixar de ser rígido e passar a consultar as preferências do usuário.

1\. `core/processor.py`:

    ◦ **Regra Beta (Fila Grande)**: No método `_process_task`, substituir o valor fixo `20` pela variável `self.config.get("orchestration", "max_queue_warning")` \[58, PHASE\_5\_12\_ORCHESTRATION\_SPECS\].    ◦ **Regra Alpha (Cooldown)**: Antes de invocar `cooldown.trigger_cooldown(3600)`, verificar se `self.config.get("orchestration", "auto_defense_enabled")` é verdadeiro \[60, PHASE\_5\_12\_ORCHESTRATION\_SPECS\].    ◦ **Semântica**: Alterar as mensagens de log para usar os novos termos: "Intervalo de Espera" em vez de "Cooldown" e "Tentativas Falhas" em vez de "Erro 429" \[PHASE\_5\_12\_ORCHESTRATION\_SPECS\].
\--------------------------------------------------------------------------------

### Passo 4: Integração com o Motor de Extração

1\. `services/youtube\_manager.py`:

    ◦ Garantir que a ordem de idiomas no método `get_transcript` seja lida dinamicamente de `self.config.get("subtitles", "language_order")`\[2\].    ◦ O `YouTubeManager` deve verificar a existência de `COOKIES_PATH` antes de cada chamada ao `yt-dlp`\[7\].
\--------------------------------------------------------------------------------

### ✅ Definição de Concluído (DoD)

O saneamento da Fase 5.12 será homologado quando:

• \[ \] **Persistência de Insumos**: O conteúdo colado na interface de Cookies for convertido com sucesso para um arquivo `cookies.txt` funcional na raiz do projeto \[2, PHASE\_5\_12\_INPUT\_MANAGER\_SPECS\].

• \[ \] **Soberania do Usuário**: Ao desativar "Habilitar Proteção Automática", o sistema **não deve** disparar o Cooldown de 1 hora mesmo após um erro 429 \[60, PHASE\_5\_12\_ORCHESTRATION\_SPECS\].

• \[ \] **Escalabilidade Configurável**: Um lote de 30 vídeos puder ser processado sem aborto caso o usuário tenha aumentado o limite de aviso para 50 \[58, PHASE\_5\_12\_ORCHESTRATION\_SPECS\].

• \[ \] **Hot-Reload de Proxies**: A lista de proxies for atualizada em memória imediatamente após o salvamento no diálogo, sem reiniciar o app \[PHASE\_5\_12\_INPUT\_MANAGER\_SPECS\].

### 🧑 [USUÁRIO]

Existem alguns pontos implícitos que não foram explicitamente formalizados como tarefas, mas que são críticos para essa fase e evitam retrabalho estrutural.

Primeiro, persistência de configurações. A prioridade de idiomas, as opções da aba Interface e qualquer toggle (como grade dinâmica) precisam ter definição clara de onde e como são armazenados: arquivo local, banco de dados, cache em memória ou perfil de usuário. Também é necessário definir quando essas configurações são carregadas e como lidam com inconsistências ou versões antigas.

Segundo, estratégia de estado global. Se o painel reativo será implementado na Fase 6, já nesta fase deve-se decidir como o estado da aplicação será gerenciado. Sem isso, a implementação futura pode exigir refatoração pesada. É necessário definir se haverá store centralizado, observadores, eventos ou outro padrão arquitetural consistente.

Terceiro, padronização de componentes UI. Antes de expandir funcionalidades, é prudente definir um pequeno design system interno: padrão de botões, chips de seleção, toggles, espaçamento, tipografia e comportamento de feedback visual. Isso evita divergência visual entre abas.

Quarto, tratamento de performance base. A grade dinâmica foi discutida conceitualmente, mas ainda não foi definido o critério de ativação: quantidade mínima de itens? Limite de renderização? Scroll virtual? Sem esse critério, o toggle vira apenas cosmético.

Quinto, validação de usabilidade mínima. A substituição da digitação manual de idiomas por seleção visual resolve sintaxe, mas ainda precisa considerar:

Ordem inicial padrão.

Possibilidade de idioma customizado.

Limite máximo de idiomas.

Comportamento quando nenhum idioma estiver selecionado.

Sexto, definição de escopo fechado da fase. Ainda não foi formalizado o que explicitamente não será feito agora. Definir fronteiras evita que a fase se expanda indefinidamente.

Se esses pontos forem incorporados, a fase deixa de ser apenas uma melhoria visual e passa a ser uma consolidação estrutural real, preparando o sistema para a Fase 6 sem gerar dívida técnica oculta.

### 🤖 [IA]

Com base nas fontes fornecidas e no histórico de desenvolvimento, sua análise é cirúrgica: para que a **Fase 5.12** seja um alicerce sólido para a **Fase 6**, precisamos formalizar essas definições estruturais. O sistema já possui componentes para lidar com esses pontos, mas eles precisam de uma padronização rigorosa para evitar a dívida técnica mencionada.

Abaixo, detalho como cada um desses seis pontos implícitos deve ser tratado, fundamentado na arquitetura atual do **ContextFlow**:

### 1\. Estratégia de Persistência e Versoneamento

Atualmente, o sistema utiliza uma abordagem híbrida de armazenamento:

• **Arquivo Local (**`config/credentials.json`**):** Gerenciado pelo `ConfigManager` (Singleton), armazena chaves de API, orquestração e preferências de interface\[1\]\[2\]. O método `_merge_config` já está implementado para realizar o "deep merge" de chaves novas, garantindo que versões antigas do arquivo não quebrem ao receber atualizações de sistema\[3\]\[4\].

• **Banco de Dados SQLite (**`system\_config`**):** Utilizado para estados que precisam de persistência rígida entre reinicializações, como o tempo restante do **Cooldown Global**\[5\].

• **Definição para a 5.12:** Todas as novas configurações (cookies, proxies e limites de fila) devem ser persistidas no `credentials.json` para manter a transparência ao usuário\[8\]\[9\].

### 2\. Gestão de Estado Global (SSoT)

O sistema já opera sob o princípio da **Single Source of Truth (SSoT)** através do **Singleton** `AppState`\[10\]\[11\].

• **Padrão Arquitetural:** A comunicação entre o motor de processamento e a interface ocorre exclusivamente via **Observer Pattern** (método `register_observer`) e barramento de eventos **PubSub**\[12\]\[13\].

• **Preparação para a Fase 6:** Esta infraestrutura já é "reativa" o suficiente para suportar os painéis analíticos futuros, pois qualquer mutação no `AppState` (como a chegada de um resumo) notifica automaticamente as abas registradas\[14\]\[15\].

### 3\. Padronização de Componentes UI (Design System Interno)

Para evitar a divergência visual entre a "Doca de Carga" (técnica) e o "Cockpit" (moderno), o sistema utiliza constantes centralizadas:

• **Cores e Estilos:** Centralizados em `constants.py` (`COLOR_BG`, `COLOR_FG`, `COLOR_ACCENT`)\[16\]\[17\].

• **Renderizadores Seguros:** O uso do `SafeTextRenderer` com clipping obrigatório (`dc.SetClippingRegion`) deve ser o padrão para todos os componentes de texto, eliminando o overflow de células\[18\]\[19\].

• **Feedback Visual:** O uso de **Gauges** para esforço e **Logs Coloridos** (Vermelho para erro, Azul para sistema) deve ser aplicado uniformemente em todas as novas interfaces de configuração\[20\]\[21\].

### 4\. Critério de Ativação da Grade Dinâmica

Embora a `VirtualVideoTable` suporte 10.000 itens com latência zero, o toggle de "Grade Dinâmica" nas configurações precisa de uma definição clara\[22\]\[23\]:

• **Definição sugerida:** A virtualização é **sempre-ativa** para o conteúdo da grade (carregamento sob demanda)\[24\]\[25\]. O toggle visual deve referir-se apenas ao comportamento de **Rich Rendering** (miniaturas e tags coloridas), que pode ser desativado para economizar RAM em máquinas com menos de 4GB\[26\]\[27\].

### 5\. Validação de Usabilidade para Idiomas

A substituição da entrada manual por seleção visual deve seguir este protocolo:

• **Ordem e Fallback:** A ordem definida pelo usuário será a prioridade de busca; se nenhuma for selecionada, o sistema deve assumir o padrão `pt,pt-BR,en`\[3\].

• **Customização:** Deve permitir a adição de códigos ISO (ex: 'es', 'fr') para casos específicos\[28\]\[29\].

• **Tratamento de Vazio:** Se nenhum idioma estiver ativo, o sistema deve tentar baixar a legenda "gerada automaticamente" em qualquer idioma disponível para evitar falha total de processamento\[30\]\[31\].

### 6\. Definição de Escopo Fechado (Fronteiras da Fase 5.12)

Para evitar a expansão indefinida, o escopo da Fase 5.12 fica restrito ao **Saneamento Administrativo**:

• **O que será feito:** Gestão visual de Cookies/Proxies, parametrização do limite de fila (> 20), toggle de desativação de defesas e padronização de nomenclaturas técnicas\[32\]\[33\].

• **O que NÃO será feito:** Nenhuma lógica real de IA, chamadas a APIs de resumo ou integração de novos provedores LLM; estes pertencem exclusivamente à **Fase 6**\[34\]\[35\].

**A adoção formal destes pontos transforma a Fase 5.12 em uma consolidação estrutural, garantindo que o sistema esteja administrativamente pronto para receber a "inteligência" na fase seguinte.**

### 🧑 [USUÁRIO]

gere a documentacao dessa coisas para eu colocar na pasta da fase informe quais arquivos ou arquivo sera gerado para isse documentacao faltante

### 🤖 [IA]

Com base na necessidade de formalizar os pontos críticos discutidos — que garantem a solidez estrutural e evitam o retrabalho antes da Fase 6 — a documentação da **Fase 5.12 (Saneamento Administrativo e Governança de Extração)** será composta por **4 arquivos principais**.

O arquivo novo e fundamental que consolida as "coisas que estavam faltando" (pontos implícitos) é o `PHASE\_5\_12\_STRUCTURAL\_STANDARDS.md`.

Abaixo, listo os arquivos que devem ser colocados na pasta da fase e gero o conteúdo do documento de padrões estruturais.

\--------------------------------------------------------------------------------

### 📂 Lista de Arquivos para a Pasta da Fase 5.12

1\. `PHASE\_5\_12\_OVERVIEW.md`: Visão estratégica sobre a soberania de extração e autonomia do usuário.

2\. `PHASE\_5\_12\_TECH\_SPECS.md`: Especificações técnicas para a gestão de Cookies (JSON/Netscape), lista de Proxies e o desbloqueio de limites da fila\[1\]\[2\].

3\. `PHASE\_5\_12\_STRUCTURAL\_STANDARDS.md`: (Gerado abaixo) Formalização da persistência, estado global, Design System e escopo fechado.

4\. `PHASE\_5\_12\_EXECUTION.md`: Roteiro passo a passo de implementação nos arquivos `core` e `ui`.

\--------------------------------------------------------------------------------

### 📄 Documento: `docs/history/PHASE_5.12/PHASE_5_12_STRUCTURAL_STANDARDS.md`

```
# PHASE 5.12 STRUCTURAL STANDARDS: Padrões e Requisitos Implícitos

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Formalizar as bases arquiteturais para evitar dívida técnica e garantir a prontidão para a Fase 6.
> **Referências:** Auditoria Estratégica v24 e Arquitetura ContextFlow.

---

## 1. Estratégia de Persistência e Versionamento
Para garantir que as preferências do usuário sobrevivam a atualizações e reinicializações, adotamos um modelo híbrido:

*   **Configurações de UI e Orquestração:** Devem ser armazenadas no `config/credentials.json` gerenciado pelo `ConfigManager` [3].
*   **Versionamento (Deep Merge):** O sistema deve utilizar o método `_merge_config` para integrar chaves novas sem corromper as existentes, permitindo a evolução do software sem perda de dados do usuário [4, 5].
*   **Estados Operacionais:** Dados voláteis de execução (como o timer de Cooldown) permanecem na tabela `system_config` do SQLite para garantir persistência rígida [6, 7].

## 2. Gestão de Estado Global (SSoT)
O ContextFlow opera sob o princípio da **Fonte Única de Verdade (Single Source of Truth)**.

*   **Store Centralizado:** O `AppState` (Singleton) é o único detentor do estado da aplicação em memória [8].
*   **Comunicação Reativa:** A sincronia entre o motor de processamento e a interface ocorre exclusivamente via **PubSub** (eventos assíncronos) ou **Observer Pattern** [9, 10].
*   **Integridade Concorrente:** Mutações de estado devem ocorrer obrigatoriamente sob o controle do `RLock` interno para evitar condições de corrida durante o processamento em lote [11, 12].

## 3. Design System Interno (Componentização UI)
Para manter a coerência visual entre a Aba 1 (Técnica) e a Aba 2 (Moderna), os componentes devem seguir estas constantes:

*   **Cores:** Utilização mandatória de `COLOR_BG` (Branco) e `COLOR_FG` (Cinza Escuro) para Tema Claro [13, 14].
*   **Tipografia:** Fonte padrão do sistema (Segoe UI/Roboto) com renderização segura via `dc.SetClippingRegion` para evitar overflow de texto [15, 16].
*   **Feedback Visual:** Uso de `wx.Gauge` para indicar esforço e logs coloridos (Azul para Info, Vermelho para Erro) para reduzir a carga cognitiva [17, 18].

## 4. Performance e Grade Dinâmica
Embora a virtualização seja sempre ativa para a escala de 10.000 itens, o comportamento visual é parametrizável:

*   **Critério de Ativação:** O toggle de "Grade Dinâmica" nas configurações controla exclusivamente o **Rich Rendering** (miniaturas e tags). Se desativado, o sistema prioriza economia de RAM (< 150MB), mantendo apenas texto bruto [19, 20].
*   **Throttling:** Updates na grade analítica devem respeitar o intervalo de 250ms (debouncing) para não degradar a performance durante extrações massivas [21, 22].

## 5. Protocolo de Usabilidade para Idiomas
A seleção visual de idiomas substitui a entrada manual para garantir integridade sintática:

*   **Ordem de Busca:** A sequência na interface define a prioridade de download no `YouTubeManager` [4].
*   **Fallback Automático:** Caso nenhum idioma manual seja encontrado, o sistema deve tentar obrigatoriamente as legendas "auto-geradas" antes de reportar erro [23, 24].

## 6. Escopo Fechado (Fronteiras da Fase 5.12)
Para evitar o "Feature Creep", definimos o que **NÃO** pertence a esta fase:

*   **IA Real:** Nenhuma chamada a provedores de resumo ou modelos locais (Fase 6) [25].
*   **Análise Semântica:** Tags manuais ou busca vetorial (Fase 7) [26].
*   **Modo Escuro:** Padronização estética final (Fase Final).
```
\--------------------------------------------------------------------------------

### Próximos Passos

Com este documento de padrões finalizado, as bases para a **Fase 5.12** estão formalizadas. Agora, o sistema tem definições claras sobre como salvar dados e como se comportar visualmente\[3\]\[4\].

**Deseja que eu gere agora o arquivo** `PHASE\_5\_12\_EXECUTION.md` **com o roteiro passo a passo para você aplicar estas mudanças no código?**

### 🧑 [USUÁRIO]

gere

1.  PHASE\_5\_12\_OVERVIEW.md: Visão estratégica sobre a soberania de extração e autonomia do usuário.

### 🤖 [IA]

# PHASE 5.12 OVERVIEW: Saneamento Administrativo e Governança de Extração

**Status:** SSoT (Fonte Única de Verdade)\[1\]**Foco:** Soberania de Extração, Autonomia do Usuário e Controle de Insumos de Rede\[2\]\[3\]**Referências:** Auditoria de Governança v24 e Feedback de Usabilidade Administrativa\[2\]\[4\]

\--------------------------------------------------------------------------------

## 1\. Contexto e Visão Geral

O **ContextFlow** atingiu sua **Maturidade Industrial (Fase 5.10)** com um núcleo estável, processamento assíncrono blindado e grades virtuais capazes de suportar 10.000 itens\[5\]\[6\]. Entretanto, o sistema é atualmente definido como **"administrativamente incompleto"**, operando sob regras operacionais rígidas e parâmetros fixos no código (_hardcoded_) que limitam a flexibilidade do **Analista Solo**\[3\]\[7\].

A **Fase 5.12** atua como o saneamento final da infraestrutura de rede. O objetivo estratégico é transferir o controle dos protocolos de defesa e dos insumos de extração (como os cookies e proxies) das entranhas do backend diretamente para a interface de governança do usuário\[2\]\[8\]. Esta fase é o pré-requisito obrigatório para a **Fase 6 (Orquestração Multi-LLM)**, garantindo que o "combustível" de dados seja soberano e ininterrupto\[9\].

\--------------------------------------------------------------------------------

## 2\. Pilares de Implementação

### 2.1. Soberania de Insumos (Cookies & Proxies)

Atualmente, o suporte a identidades de rede depende de manipulação manual de arquivos físicos (`cookies.txt` e `proxies.txt`)\[10\]\[11\].

• **Central de Insumos:** Implementação de uma área de colagem direta no `DialogConfig` para os cookies extraídos do navegador (suportando os formatos **JSON**, Netscape ou Header String)\[11\]\[12\].

• **Gestão de IPs:** Criação de interface visual para gerenciar a lista de proxies, permitindo ativar ou desativar a rotação de identidades sem a necessidade de deletar arquivos de configuração\[13\]\[14\].

### 2.2. Desbloqueio de Limites Operacionais (Scaling)

O sistema possui travas de segurança estáticas que impedem o processamento massivo sob certas condições\[7\]\[10\].

• **Parametrização da Fila:** Substituição do limite fixo de **20 vídeos** por um campo configurável no `ConfigManager`, permitindo que o usuário defina o teto de aviso de segurança conforme sua infraestrutura de proxies\[7\]\[15\].

• **Governança de Alerta:** O sistema passará a consultar o parâmetro `max_queue_warning` para decidir quando exibir avisos de risco de banimento\[7\].

### 2.3. Antifragilidade Flexível (Toggle de Defesa)

O protocolo de defesa (**Regra Alpha - Cooldown**) é hoje mandatório e automático, suspendendo o sistema ao detectar erros 429\[9\]\[16\].

• **Toggle Global:** Implementação de um controle (_kill switch_) para ligar ou desligar o sistema de hibernação automática\[9\]\[15\].

• **Gestão de Risco:** Permite que o analista assuma o risco operacional de processar sem pausas, essencial para o uso de proxies rotativos de alta performance\[9\].

### 2.4. Refinamento Semântico e de Usabilidade

Para reduzir o ruído interpretativo, os termos técnicos serão traduzidos para uma linguagem administrativa clara\[17\].

• **Padronização:** Termos como "Cooldown" e "Erro 429" serão renomeados na interface para **"Intervalo de Espera"** e **"Limite de Tentativas Falhas"**\[8\]\[17\].

• **Prioridade de Idiomas:** Migração da entrada textual manual para uma **seleção visual ordenável** (drag-and-drop), garantindo integridade sintática na busca por transcrições\[18\]\[19\].

\--------------------------------------------------------------------------------

## 3\. Metas de Sucesso

• **Autonomia:** Capacidade de atualizar os cookies do sistema via interface em menos de 10 segundos\[11\].

• **Escalabilidade:** Possibilidade de processar lotes superiores a 20 vídeos sem bloqueios arbitrários do software\[7\].

• **Soberania Operacional:** Controle total sobre o estado do "Freio" (Cooldown), permitindo o reset manual das defesas sem reiniciar a aplicação\[8\]\[9\].

• **Persistência Industrial:** Garantia de que todos os novos insumos colados sejam convertidos e salvos corretamente no `credentials.json` e nos arquivos físicos de suporte (`cookies.txt`)\[2\]\[11\].

\--------------------------------------------------------------------------------

**Critério de Homologação:** A Fase 5.12 será considerada concluída quando o usuário puder colar o JSON de cookies extraído, ajustar o limite da fila para 50 e desativar a defesa automática, com todas as mudanças sendo respeitadas instantaneamente pelo motor de extração\[3\]\[8\].

### 🧑 [USUÁRIO]

2.  PHASE\_5\_12\_TECH\_SPECS.md: Especificações técnicas para a gestão de Cookies (JSON/Netscape), lista de Proxies e o desbloqueio de limites da fila.

### 🤖 [IA]

# PHASE 5.12 TECH SPECS: Gestão de Insumos e Governança de Extração

**Status:** SSoT (Fonte Única de Verdade)**Alvos:**`ui/dialog_config.py`, `core/config_manager.py`, `core/processor.py`, `services/youtube_manager.py`**Foco:** Autonomia na Ingestão de Insumos de Rede e Blindagem Flexível

Esta especificação técnica detalha a transição do **ContextFlow** de um sistema com regras fixas (_hardcoded_) para uma estação de controle onde o usuário gerencia identidades de rede (Cookies/Proxies) e limites operacionais\[1\]\[2\].

\--------------------------------------------------------------------------------

## 1\. Gestão Dinâmica de Cookies (O Combustível)

O sistema deve permitir a inserção de cookies para evitar erros de "Transcrição indisponível" e contornar restrições de idade\[3\].

### 1.1. Interface e Persistência

• **Input UI:** Campo `wx.TextCtrl` (multiline) na nova aba "Extração & Segurança" do `DialogConfig`\[2\].

• **Formatos Suportados:** O sistema deve aceitar **JSON** (conforme extraído de extensões de navegador) ou formato **Netscape**\[3\].

• **Processamento de Salvamento:**

    1. Ao salvar, o `ConfigManager` armazena o texto bruto na chave `inputs.cookie_text` do `credentials.json`.    2. **Conversão Automática:** Se o texto for detectado como JSON, o sistema deve convertê-lo internamente para o formato compatível com o `yt-dlp` e salvá-lo fisicamente em `COOKIES_PATH` (`BASE_DIR/cookies.txt`)\[4\]\[5\].
\--------------------------------------------------------------------------------

## 2\. Gestor de Proxies (O Escudo de Rede)

Atualmente, a lista de proxies é lida de um arquivo estático. A Fase 5.12 integra essa gestão à interface visual\[6\].

### 2.1. Funcionalidades Técnicas

• **Editor de IPs:** Área de texto para colagem da lista de proxies (um por linha).

• **Hot-Reload:** Ao salvar as configurações, o sistema deve invocar o método `ProxyManager._load_proxies()` para atualizar a lista em memória sem necessidade de reiniciar a aplicação\[7\]\[8\].

• **Toggle de Ativação:** Flag `use_proxies` no `credentials.json` para ligar/desligar a rotação sem limpar a lista de IPs inserida\[9\]\[10\].

\--------------------------------------------------------------------------------

## 3\. Desbloqueio de Limites da Fila (Batch Scaling)

A trava de segurança que limita o processamento automático será parametrizada para dar soberania ao Analista Solo\[11\].

### 3.1. Parametrização do Processor (`core/processor.py`)

• **Remoção de Constante:** O valor fixo de **20 vídeos** para bloqueio sem proxy será substituído pela variável `max_queue_warning`\[12\]\[13\].

• **Lógica de Alerta:**

    ◦ Se `queue.qsize() > max_queue_warning`, o sistema exibe um aviso de risco de banimento de IP.    ◦ O processamento só inicia após confirmação explícita do usuário na UI.
\--------------------------------------------------------------------------------

## 4\. Toggle de Antifragilidade (Kill Switch de Defesa)

O sistema de **Cooldown** (Regra Alpha) passará a ser opcional, permitindo que usuários com proxies de alta performance ignorem a hibernação automática\[14\].

### 4.1. Interceptação de Erros 429

• **Flag** `auto\_defense\_enabled`**:** Nova chave no `ConfigManager` (padrão: `True`)\[2\].

• **Fluxo de Decisão:** No `Processor._process_task`, antes de chamar `cooldown.trigger_cooldown(3600)`, o sistema verificará se a defesa está ativa\[15\]\[16\].

• Se desativada, o erro 429 será logado em vermelho, mas o sistema tentará o próximo item da fila imediatamente em vez de hibernar por 1 hora\[14\].

\--------------------------------------------------------------------------------

## 5\. Estrutura de Configuração Atualizada (`credentials.json`)

As novas chaves de governança serão integradas à estrutura existente\[9\]\[17\]:

```
{
  "orchestration": {
    "max_cloud_tasks": 2,
    "max_queue_warning": 50,
    "auto_defense_enabled": true
  },
  "extraction_defense": {
    "use_cookies": true,
    "use_proxies": false,
    "cooldown_mins": 60
  },
  "inputs": {
    "cookie_text": "[JSON_DATA_HERE]",
    "proxy_text": "http://user:pass@ip:port\n..."
  }
}
```
## 6\. Regras de Negócio para Homologação

1\. **Integridade de Caminhos:** O arquivo `cookies.txt` deve ser gerado no `BASE_DIR` sempre que o campo de texto no diálogo for preenchido e salvo\[4\]\[18\].

2\. **Soberania de Risco:** Ao desativar "Habilitar Proteção Automática", o motor de processamento **não deve** entrar em modo de espera, mesmo recebendo múltiplos erros 429 do YouTube\[14\].

3\. **Padronização Semântica:** Os labels na UI devem usar termos amigáveis: "Intervalo de Espera" em vez de Cooldown e "Tentativas Falhas" em vez de Erro 429\[19\].

\--------------------------------------------------------------------------------

**Critério de Concluído (DoD):** O usuário pode colar um JSON de cookies e uma lista de proxies na interface, salvar e ver os arquivos físicos sendo atualizados instantaneamente, com o `Processor` respeitando os novos limites definidos sem travamentos.

### 🧑 [USUÁRIO]

3.  PHASE\_5\_12\_STRUCTURAL\_STANDARDS.md: (Gerado abaixo) Formalização da persistência, estado global, Design System e escopo fechado.

### 🤖 [IA]

# PHASE 5.12 STRUCTURAL STANDARDS: Padrões e Requisitos Implícitos

**Status:** SSoT (Fonte Única de Verdade)**Objetivo:** Formalizar as bases arquiteturais para evitar dívida técnica e garantir a prontidão do sistema para a injeção de inteligência na Fase 6\[1\].**Referências:** Auditoria de Governança v24, `constants.py` e `app_state.py`.

\--------------------------------------------------------------------------------

## 1\. Estratégia de Persistência e Versionamento

Para garantir que as preferências do usuário e insumos de rede (cookies/proxies) sobrevivam a atualizações, o sistema adota um modelo híbrido de armazenamento:

• **Configurações de UI e Orquestração:** São armazenadas no arquivo `config/credentials.json`\[2\]. O `ConfigManager` deve utilizar obrigatoriamente o método `_merge_config` ao carregar o arquivo para integrar chaves novas sem corromper as existentes, permitindo a evolução do software sem perda de dados\[3\].

• **Versionamento de Insumos:** Ao salvar novos cookies ou proxies via interface, o sistema deve limpar espaços em branco acidentais e atualizar os arquivos físicos `cookies.txt` e `proxies.txt` no diretório raiz para consumo imediato pelo motor de extração\[4\].

• **Estados Operacionais:** Dados voláteis de execução (como o timer de hibernação) permanecem na tabela `system_config` do SQLite para garantir persistência rígida entre reinicializações do app\[7\].

## 2\. Gestão de Estado Global (SSoT)

O **ContextFlow** opera sob o princípio da **Single Source of Truth (SSoT)** através do Singleton `AppState`\[10\]\[11\].

• **Store Centralizado:** O `AppState` é o único detentor do estado da aplicação em memória, gerenciando a unificação de tarefas ativas e vídeos persistidos sob um `RLock` para garantir a segurança entre threads\[10\].

• **Comunicação Reativa:** A sincronia entre o motor de processamento (`Processor`) e a interface de usuário ocorre exclusivamente via **PubSub** (eventos assíncronos) ou **Observer Pattern**\[14\].

• **Mandato wx.CallAfter:** Toda notificação de estado que resulte em mutação de componentes gráficos deve ser envelopada em `wx.CallAfter`, delegando a execução para a MainThread e prevenindo crashes fatais\[17\].

## 3\. Design System Interno e Padronização UI

Para manter a coerência visual entre as abas e reduzir a fricção cognitiva, os componentes devem seguir estas regras:

• **Cores e Estilos:** Utilização mandatória de `COLOR_BG` (Branco), `COLOR_FG` (Cinza Escuro) e `COLOR_ACCENT` (Azul) conforme definido em `constants.py` para o Tema Claro\[4\].

• **Renderização Segura (Fim do Overflow):** O uso do `SafeTextRenderer` com a chamada `dc.SetClippingRegion(rect)` é obrigatório em todas as colunas de texto da grade virtual para impedir que conteúdos longos (como na coluna "Adicionado") vazem para células vizinhas\[22\].

• **Nomenclatura Administrativa:** Termos técnicos devem ser substituídos por termos amigáveis: **"Intervalo de Espera"** (em vez de Cooldown) e **"Limite de Tentativas Falhas"** (em vez de Erro 429)\[25\]\[26\].

## 4\. Performance e Performance Base

Embora a virtualização de grade suporte 10.000 itens com latência zero, o comportamento visual é parametrizável para proteção de hardware\[21\]\[27\].

• **Critério de Grade Dinâmica:** O toggle de "Grade Dinâmica" nas configurações controla exclusivamente o **Rich Rendering** (miniaturas e pílulas de tags). Se desativado, o sistema prioriza economia de RAM, mantendo apenas a renderização de texto bruto via `SafeTextRenderer`\[28\]\[29\].

• **Throttling:** Updates na grade analítica (Aba 2) devem respeitar o intervalo de debouncing de **250ms** (Restart-on-Event) para não degradar a performance durante extrações massivas na Aba 1\[30\].

## 5\. Definição de Escopo Fechado (Fronteiras da Fase 5.12)

Para evitar a expansão indefinida do projeto, as seguintes fronteiras são estabelecidas:

• **O que será feito:** Gestão visual de Cookies/Proxies, parametrização do limite de fila (substituindo o valor fixo 20), toggle de ativação de defesas e padronização semântica\[25\]\[33\].

• **O que NÃO será feito:** Nenhuma lógica real de IA, chamadas a APIs de resumo ou integração de novos provedores LLM (Anthropic, Gemini, etc.); estes pertencem exclusivamente à **Fase 6**\[1\].

\--------------------------------------------------------------------------------

**Critério de Homologação:** A estrutura da Fase 5.12 será considerada concluída quando o sistema for capaz de persistir a prioridade de idiomas e o limite configurado da fila no arquivo JSON, respeitando o Design System de Tema Claro sem vazamentos visuais nas células\[33\]\[36\].

### 🧑 [USUÁRIO]

4.  PHASE\_5\_12\_EXECUTION.md: Roteiro passo a passo de implementação nos arquivos core e ui.

### 🤖 [IA]

# PHASE 5.12 EXECUTION: Roteiro de Implementação Passo a Passo

**Status:** SSoT (Fonte Única de Verdade)**Objetivo:** Implementar a Central de Insumos (Cookies/Proxies), desbloquear limites operacionais da fila e parametrizar os protocolos de defesa.**Alvos:**`core/config_manager.py`, `ui/dialog_config.py`, `core/processor.py`, `services/youtube_manager.py`, `constants.py`.

\--------------------------------------------------------------------------------

### Passo 1: Expansão do Modelo de Configuração (`core/config_manager.py`)

O `ConfigManager` deve evoluir para suportar a persistência de textos brutos de insumos e novas chaves de governança\[1\].

1\. **Atualizar** `\_get\_default\_config`**:**

    ◦ **Seção** `orchestration`**:** Adicionar `max_queue_warning` (padrão: 20) e `auto_defense_enabled` (padrão: `True`) \[PHASE\_5\_12\_TECH\_SPECS\].    ◦ **Seção** `inputs` **(Nova):** Adicionar `cookie_text` e `proxy_text` para armazenar o conteúdo colado pelo usuário \[PHASE\_5\_12\_TECH\_SPECS\].
2\. **Implementar** `update\_physical\_files()`**:**

    ◦ Este método deve ler `self._config['inputs']['cookie_text']` e salvar no caminho `COOKIES_PATH`.    ◦ Deve ler `self._config['inputs']['proxy_text']` e salvar em `PROXY_LIST_PATH` \[PHASE\_5\_12\_STRUCTURAL\_STANDARDS\].    ◦ **Lógica de Conversão:** Se o `cookie_text` começar com `[` (JSON), o sistema deve validá-lo antes de escrever no arquivo físico \[PHASE\_5\_12\_TECH\_SPECS\].
\--------------------------------------------------------------------------------

### Passo 2: Saneamento de Limites no Core (`core/processor.py`)

Remover a rigidez do sistema, permitindo que o usuário assuma o controle do risco operacional\[2\]\[3\].

1\. **Desbloqueio da Fila:** No método `_process_task`, substituir a verificação fixa de `20` itens pela variável dinâmica `self.config.get("orchestration", "max_queue_warning")` \[PHASE\_5\_12\_TECH\_SPECS\].

2\. **Kill Switch de Defesa:** Antes de invocar `cooldown.trigger_cooldown()`, verificar a flag `self.config.get("orchestration", "auto_defense_enabled")`. Se for `False`, logar o erro 429 mas **não** suspender o sistema \[PHASE\_5\_12\_TECH\_SPECS\].

3\. **Padronização Semântica:** Alterar as strings de log de "Cooldown" para **"Intervalo de Espera (Hibernação)"** e "Erro 429" para **"Limite de Tentativas Falhas"**\[4\].

\--------------------------------------------------------------------------------

### Passo 3: Implementação da Interface de Governança (`ui/dialog_config.py`)

Transformar o console de configuração em uma central administrativa completa\[5\].

1\. **Aba "Extração & Segurança":**

    ◦ **Área de Cookies:**`wx.StaticText` ("Colar Cookies JSON/Netscape") + `wx.TextCtrl` (Multiline, altura mín. 150px). Vincular a `inputs.cookie_text` \[PHASE\_5\_12\_TECH\_SPECS\].    ◦ **Área de Proxies:**`wx.TextCtrl` (Multiline) vinculado a `inputs.proxy_text`.    ◦ **Controles de Risco:**        ▪ `wx.SpinCtrl` para o limite de aviso da fila (vinculado a `max_queue_warning`).        ▪ `wx.CheckBox` para "Habilitar Proteção Automática (Cooldown)" \[PHASE\_5\_12\_TECH\_SPECS\].
2\. **Aba "Interface":**

    ◦ Implementar a **Prioridade de Idiomas** como uma lista visual ou `wx.TextCtrl` com hint claro, vinculado a `subtitles.language_order`\[6\].
3\. **Lógica de Persistência (**`on\_save`**):**

    ◦ Após o salvamento do JSON, chamar obrigatoriamente `self.config.update_physical_files()` para que o motor de extração use os novos cookies/proxies imediatamente \[PHASE\_5\_12\_TECH\_SPECS\].
\--------------------------------------------------------------------------------

### Passo 4: Integração do Motor de Extração (`services/youtube_manager.py`)

Garantir que os novos insumos cheguem ao `yt-dlp` de forma transparente.

1\. **Check de Cookies:** Antes de cada extração em `get_video_metadata` ou `get_transcript`, verificar se o arquivo `COOKIES_PATH` existe e injetá-lo via flag `--cookiefile`\[7\]\[8\].

2\. **Hot-Reload de Proxies:** Garantir que o `ProxyManager` recarregue a lista de IPs sempre que o arquivo físico for atualizado pelo `ConfigManager` \[PHASE\_5\_12\_TECH\_SPECS\].

\--------------------------------------------------------------------------------

### ✅ Definição de Concluído (DoD)

A implementação será considerada bem-sucedida quando:

• \[ \] O usuário puder colar o JSON de cookies na interface e processar vídeos restritos sem intervenção manual em arquivos\[9\].

• \[ \] A desativação da "Proteção Automática" permitir que o sistema receba erros 429 sem entrar em hibernação \[PHASE\_5\_12\_TECH\_SPECS\].

• \[ \] O limite da fila for alterado para 50 na UI e respeitado pelo `Processor` sem travar o início do lote.

• \[ \] O **Design System** (clipping de células) for mantido em todas as novas áreas de texto para evitar overflow \[PHASE\_5\_12\_STRUCTURAL\_STANDARDS\].


