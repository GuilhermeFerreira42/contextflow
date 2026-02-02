# PHASE 5.8 LOGICAL SYNC: Sincronia de Barramento de Mensagens

> **Status:** Fonte Única de Verdade (SSoT)
> **Assunto:** Unificação do Sistema de Mensagens e Reconexão UI-Processor
> **Data:** 02 de Fevereiro de 2026

## 1. Diagnóstico da "Paralisia Funcional"
Identificou-se que a falha no processamento de URLs na Aba 1 não era visual, mas infraestrutural. O sistema sofria de um "descompasso de rádio": componentes de interface como a `AppWindow` tentavam enviar sinais através da biblioteca externa `pubsub.pub`, enquanto o motor de processamento (`Processor`) estava sintonizado exclusivamente na classe interna `core.pubsub.PubSub`. 

## 2. Unificação do Barramento de Mensagens
Para garantir a integridade da comunicação, foi decretada a purga total de bibliotecas de mensagens externas nos arquivos de interface.

*   **Padrão de Importação:** Substituição obrigatória de `import pubsub` por `from core.pubsub import PubSub`.
*   **Protocolo de Disparo:** Toda solicitação de processamento massivo deve utilizar o método `PubSub.publish('REQUEST_BATCH_PROCESSING', raw_text=...)`.
*   **Tratamento de Argumentos:** Devido ao uso de `**kwargs` no barramento interno, a conexão entre o sinal enviado pela `TabBatch` e o método receptor no `Processor` foi ajustada para garantir que os nomes dos argumentos coincidam perfeitamente, eliminando falhas silenciosas.

## 3. Reconexão do Motor de Processamento
A "Doca de Carga" técnica foi reativada através da subscrição explícita do `Processor` no barramento global.

1.  **Subscrição:** No momento da inicialização, o `Processor` inscreve o método `add_urls` no tópico `'REQUEST_BATCH_PROCESSING'`.
2.  **Ciclo de Vida da Tarefa:** Para cada URL válida recebida, o processador agora emite obrigatoriamente o evento `'TASK_QUEUED'`, permitindo que a interface registre o item na grade no milissegundo da ingestão.
3.  **Feedback de Validação:** Caso uma URL seja considerada inválida pelo Regex do YouTube, o sistema não mais ignora a entrada; ele publica um `'TASK_ERROR'` para fornecer feedback imediato no log de sistema.

## 4. Governança e Infraestrutura
A sincronia lógica também abrange o respeito ao estado de proteção do sistema. O `Processor` foi instruído a consultar o `CooldownManager` antes de iniciar qualquer ciclo de trabalho no `_worker_loop`. Se o sistema detectar um bloqueio persistente de IP (Erro 429) no SQLite, ele reportará o estado de hibernação no console de log em vez de simplesmente ignorar a fila.

---
**Assinatura Técnica:** Engenharia ContextFlow - Estabilidade em Primeiro Lugar.