**Assunto: Resolução do Conflito de Mensageria UI-Core**

#### 1. Diagnóstico da Falha
O sistema apresentou paralisia funcional devido a um **conflito de infraestrutura de sinais** [provided text]. Enquanto a interface (`ui/tab_batch.py`) utiliza a biblioteca externa `pubsub.pub` para enviar mensagens, o motor de processamento (`core/processor.py`) está sintonizado em uma classe customizada interna chamada `PubSub`. 

#### 2. Requisito de Correção
*   **Ação:** Migrar a `TabBatch` para o barramento oficial do projeto.
*   **Implementação:** Substituir `import pubsub` por `from core.pubsub import PubSub` em todos os componentes de UI.
*   **Protocolo de Disparo:** O método `on_click_process` deve utilizar obrigatoriamente `PubSub.publish('REQUEST_BATCH_PROCESSING', raw_text=text)` para ser captado pelo assinante no `Processor` [37, provided text].
