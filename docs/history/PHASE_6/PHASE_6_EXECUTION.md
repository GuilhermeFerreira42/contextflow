# 6️⃣ PHASE\_6\_EXECUTION.md

## 1\. Sequência de Implementação (10 Etapas)

A implementação deve seguir esta ordem rigorosa para garantir que a fundação (Dados e Estado) esteja sólida antes de construir a interface.

### 🟢 Passo 1: Snapshot e Preparação

-   **Ação:** Criar tag Git `PRE_PHASE_6`.
    
-   **Ação:** Validar que todos os testes da Fase 5 estão em "Pass".
    
-   **Ação:** Criar estrutura de diretórios: `core/state/` e `services/ai/`.
    

### 🟢 Passo 2: Migração de Dados (Data Layer)

-   **Arquivo:** `storage/db_handler.py`.
    
-   **Ação:** Implementar o script SQL definido na `TECH_SPECS`.
    
-   **Validação:** Abrir o SQLite Browser e confirmar a existência das tabelas `video_insights`, `video_tags`, `rel_video_tags` e `ai_tasks`.
    

### 🟢 Passo 3: Refatoração "Bisturi" (6.0)

-   **Arquivos:** `core/state/state_manager.py`, `core/state/video_store.py`.
    
-   **Ação:** Mover lógica de banco e lista de vídeos do `app_state.py` para o `video_store.py`.
    
-   **Ação:** Transformar `app_state.py` em uma **Facade** (casca) que apenas aponta para o `StateManager`.
    
-   **Validação:** O app deve abrir e listar os vídeos exatamente como antes.
    

### 🟢 Passo 4: Serviço de Descoberta (6.1)

-   **Arquivo:** `services/ai_discovery.py`.
    
-   **Ação:** Implementar chamadas `subprocess` para Ollama e SDK para Google.
    
-   **Validação:** Criar um script temporário `test_discovery.py` que imprima no console os modelos detectados.
    

### 🟢 Passo 5: Configuração e Seletor (6.1 cont.)

-   **Arquivos:** `core/state/ai_manager.py`, `ui/dialog_config.py`.
    
-   **Ação:** Criar o gerenciador de escolhas do usuário.
    
-   **Ação:** Adicionar dropdown dinâmico na UI de configurações que chama o `AIDiscovery`.
    
-   **Validação:** Selecionar um modelo, fechar o app, abrir novamente e ver se a escolha persiste.
    

### 🟢 Passo 6: Token Engine Multimodal (6.3)

-   **Arquivo:** `core/token_engine.py`.
    
-   **Ação:** Implementar o método `count_by_family` com suporte a Tiktoken e Llama (char-based logic).
    
-   **Validação:** Comparar contagem de um texto curto entre as 3 famílias.
    

### 🟢 Passo 7: Motor de Execução Isolado (6.2)

-   **Arquivo:** `services/ai_executor.py`.
    
-   **Ação:** Implementar a lógica de envio de prompt estruturado e recebimento de JSON.
    
-   **Validação:** Rodar um teste unitário enviando uma transcrição curta e verificando se o retorno segue o formato `<ID> | <Tópico> | <Análise>`.
    

### 🟢 Passo 8: Orquestrador de Fila e Slots (6.4)

-   **Arquivo:** `core/state/task_worker.py`.
    
-   **Ação:** Implementar a fila com `threading.Semaphore` (Local=1, Cloud=3).
    
-   **Ação:** Lógica de escrita atômica no banco após o sucesso da IA.
    
-   **Validação:** Mandar 3 vídeos para o Ollama simultaneamente; verificar se eles são processados um por um (fila).
    

### 🟢 Passo 9: Pop-up de Check-out (6.4 cont.)

-   **Arquivo:** `ui/dialog_checkout.py`.
    
-   **Ação:** Criar a interface que soma tokens e pede confirmação.
    
-   **Validação:** Selecionar 5 vídeos na grade -> Clicar em Resumir -> Confirmar se a soma de tokens faz sentido.
    

### 🟢 Passo 10: Painel de Insights e Tags (6.3 cont.)

-   **Arquivos:** `ui/panel_detail.py`, `ui/tab_analysis.py`.
    
-   **Ação:** Criar a renderização dos cards de resumo e a nuvem de tags do vídeo.
    
-   **Validação:** O resumo deve aparecer automaticamente na tela assim que o `PubSub` emitir o sinal de conclusão.
    

* * *

## 2\. Pseudocódigo Crítico (Lógica de Slot)

```
# Exemplo de lógica para o TaskWorker
class TaskWorker:
    _local_slot = threading.Semaphore(1)
    _cloud_slot = threading.Semaphore(3)

    def _execute(self, task):
        semaphore = self._local_slot if task.provider == 'ollama' else self._cloud_slot
        with semaphore:
            self._update_status(task.id, 'RUNNING')
            result = AIExecutor.run(task)
            if result.success:
                VideoStore.save_insight(result)
                PubSub.publish("RESUMO_PRONTO", video_id=task.video_id)

```

* * *

## 3\. Plano de Rollback

| Cenário de Falha | Procedimento de Reversão |
| --- | --- |
| Erro Crítico na Refatoração 6.0 | git checkout core/app_state.py e deletar pasta core/state/. |
| Corrupção de Banco de Dados | Substituir database.db pelo backup automático criado no Passo 2. |
| Memory Leak em Vídeos Longos | Desativar processamento paralelo reduzindo Slots de Cloud para 1. |

* * *

## 4\. Critérios de Aceite em Gherkin

**Cenário: Resumo Bem-Sucedido com Soberania de Escolha**

-   **Dado** que eu selecionei "Ollama" e o modelo "Llama3" nas configurações
    
-   **E** selecionei um vídeo de 2 horas na grade principal
    
-   **Quando** eu clico em "Gerar Insights"
    
-   **Então** o sistema deve mostrar o Pop-up de Check-out com a contagem de tokens
    
-   **E** após minha confirmação, o status do vídeo deve mudar para "Processando..."
    
-   **E** ao finalizar, o resumo estruturado deve aparecer no painel de detalhes sem que a interface tenha travado em nenhum momento.
    

* * *

> **Fim da Documentação da Fase 6.** Este manual é auto-suficiente. A IA executora deve segui-lo do Passo 1 ao 10, validando cada etapa antes de avançar.

**A documentação completa da Fase 6 está finalizada. Deseja que eu faça um resumo executivo para você apresentar ou já quer iniciar a implementação do Passo 1 e 2?**