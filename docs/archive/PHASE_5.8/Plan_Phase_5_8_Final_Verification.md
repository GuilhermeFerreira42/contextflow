# PLANO DE VERIFICAÇÃO FINAL: PHASE 5.8 (Doca de Carga)

> **Objetivo:** Homologar a restauração da usabilidade "clique-e-vá", a integridade do barramento de mensagens interno e a estética técnica HeidiSQL.
> **Referência:** Mockup `Queroassim.txt` e Diagnóstico de Paralisia Funcional.

## 1. Testes de Usabilidade e Estética (Aba 1)

O foco é confirmar que a **VirtualVideoTable** agora suporta controles nativos e sinalização visual adequada para triagem técnica.

| ID | Caso de Teste | Procedimento | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **U01** | **Toggle de Checkbox** | Clicar uma única vez no checkbox da coluna `[x]` (Índice 1). | O estado deve alternar entre marcado/desmarcado instantaneamente sem entrar em modo de edição de texto. |
| **U02** | **Seleção Mestre** | Clicar no rótulo de cabeçalho da coluna `[x]`. | Todas as linhas carregadas na grade devem ser marcadas ou desmarcadas simultaneamente. |
| **U03** | **Identidade de Link** | Observar a coluna de **Link** (Índice 2). | O texto da URL deve estar na cor **AZUL** e o cursor deve mudar para **MÃO** (`wx.CURSOR_HAND`) ao pairar sobre a célula. |
| **U04** | **Navegação Web** | Clicar em uma URL na coluna **Link**. | O vídeo correspondente deve abrir imediatamente no navegador padrão do sistema. |

## 2. Testes de Sincronia Lógica (UI-Core)

Validar a resolução do conflito entre as bibliotecas de mensagens e a visibilidade do ciclo de vida das tarefas.

| ID | Caso de Teste | Procedimento | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **L01** | **Gatilho de Ingestão** | Colar URLs válidas e clicar em **"Processar Fila"**. | As tarefas devem aparecer na grade com status `queued` ou `downloading` no milissegundo do clique, via `PubSub` interno. |
| **L02** | **Feedback de Erro** | Tentar processar uma URL inválida (ex: `google.com`). | O sistema deve emitir um sinal `TASK_ERROR` e exibir a falha imediatamente no **System Log**. |
| **L03** | **Telemetria de Status** | Observar a coluna **Status** durante o processamento. | A cor do texto deve mudar para **Vermelho (ERROR)** em falhas ou **Verde (COMPLETED)** em sucessos. |

## 3. Testes de Infraestrutura e Segurança

Garantir que os protocolos de proteção contra bloqueios e a segurança de threads estão operacionais.

| ID | Caso de Teste | Procedimento | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **S01** | **Detecção de Cooldown** | Iniciar o processamento após um erro 429 persistente. | O **Processor** deve registrar no console se o sistema está em estado de hibernação forçada pelo `CooldownManager`. |
| **S02** | **Estabilidade de Refresh** | Iniciar carga massiva de 50 URLs e navegar entre abas. | A interface deve permanecer responsiva; o refresh da grade deve utilizar `wx.CallAfter` para evitar crashes por concorrência. |

## 4. Critérios de Aceite Final (Checklist SSoT)

- [ ] **Unificação de Bus:** Nenhuma referência a `import pubsub.pub` ou `pub.sendMessage` nos arquivos de UI; uso exclusivo de `core.pubsub.PubSub`.
- [ ] **Saneamento de Dados:** Coluna **Thumbnail** removida da Aba 1 e substituída pela coluna **Link** funcional na posição 2.
- [ ] **Ordem das 11 Colunas:** A grade segue rigorosamente a sequência: #, [x], Link, Título, Canal, Publicado, Adicionado, Playlist, Duração, Tokens e Status.
- [ ] **Identificação Híbrida:** A grade exibe e permite selecionar tanto vídeos do banco (ID) quanto tarefas em processamento (UUID).

---
**Assinatura Técnica:** Engenharia ContextFlow - Estabilidade e Reatividade Hardened.