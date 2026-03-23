# 4️⃣ PHASE\_6\_STRUCTURAL\_STANDARDS.md

## 1\. Padrões Arquiteturais Adotados (Golden Rules)

Para garantir a estabilidade e a manutenibilidade, a implementação deve seguir rigorosamente estes padrões:

-   **Strategy Pattern (Provedores de IA):** A comunicação com Ollama e Google deve ser encapsulada em classes que herdam de uma interface comum. A troca de provedor não deve alterar a lógica do chamador.
    
-   **Observer Pattern (PubSub):** A UI nunca deve consultar o estado da tarefa ativamente. Ela deve reagir a eventos disparados pelo `TaskWorker` via `pubsub.py`.
    
-   **Facade (StateManager):** O arquivo `core/state/state_manager.py` deve servir como o único ponto de entrada para a UI acessar os submódulos de estado, protegendo a complexidade interna.
    
-   **Command Pattern (Tasks):** Cada pedido de resumo deve ser encapsulado como um objeto de tarefa imutável dentro da fila.
    

## 2\. Regras de Modularização e Acoplamento

A separação de preocupações é a prioridade número um para evitar a "marreta" da IA.

-   **Tamanho de Arquivo:** Nenhum novo arquivo criado na Fase 6 deve exceder **200 linhas de código**. Se exceder, deve ser fragmentado.
    
-   **Direção de Importação Proibida:**
    
    -   Arquivos em `core/state/` **não podem** importar nada de `ui/`.
        
    -   Arquivos em `services/` **não podem** importar nada de `core/state/` (devem ser stateless, recebendo dados por parâmetros).
        
    -   A UI só pode importar a `Facade` (`StateManager/AppState`), nunca os submódulos diretamente.
        
-   **Encapsulamento de Estado:** Atributos de estado devem ser preferencialmente privados (prefixo `_`) e expostos via propriedades (getters).
    

## 3\. Design Patterns PROIBIDOS

Está terminantemente proibida a introdução dos seguintes padrões, sob pena de invalidação da sub-fase:

-   **Singleton Global Descontrolado:** Não instanciar novos Singletons fora do que já existe no sistema de estado.
    
-   **Active Record:** O modelo de dados (SQL) não deve conter lógica de negócio (IA).
    
-   **Hardcoded Configuration:** Proibido injetar chaves de API ou nomes de modelos diretamente no código. Use `config_manager.py`.
    

## 4\. Estratégia de Threading e Concorrência

Como o `wxPython` não é thread-safe, as seguintes regras são imutáveis:

-   **Isolamento de Worker:** Toda chamada de IA deve ocorrer em uma `threading.Thread` gerenciada pelo `TaskWorker`.
    
-   **UI Updates:** Qualquer alteração em elementos visuais (labels, progress bars, grid) oriunda de uma thread de IA **DEVE** ser encapsulada em `wx.CallAfter(self.metodo, dados)`.
    
-   **Locking:** O uso de `threading.Lock` ou `threading.RLock` é obrigatório ao acessar ou modificar a fila de tarefas compartilhada.
    

## 5\. Estratégia Formal de Logging e Auditoria

-   **Nível de Log:** Erros de API devem ser registrados como `logging.ERROR` com o traceback completo.
    
-   **Sanitização:** É proibido logar o conteúdo completo das transcrições ou chaves de API. Registre apenas IDs de vídeo e nomes de modelos.
    
-   **Auditoria de Tokens:** Cada execução concluída deve gerar uma entrada no log com `tokens_in`, `tokens_out` e `latency_ms`.
    

## 6\. Mecanismo de Enforcement (Detecção de Violação)

A IA executora deve rodar o script de verificação após cada implementação:

-   **Check de Integridade:** `python scripts/verification/verify_integrity.py`.
    
-   **Check de Imports:** Validar se houve introdução de imports circulares.
    
-   **Check de Tamanho:** Validar se `app_state.py` reduziu de tamanho conforme o planejado.
    

## 7\. Escopo Congelado (Alterações Proibidas)

Não é permitido à IA executora realizar as seguintes ações, mesmo que pareçam "melhorias":

-   Alterar a lógica de download do `yt-dlp`.
    
-   Mudar o esquema de cores atual (reservado para Fase 7).
    
-   Refatorar a `VirtualVideoTable` na `ui/`.
    
-   Adicionar bibliotecas externas não listadas nas dependências (ex: LangChain é PROIBIDO; use chamadas diretas).
    

* * *

> **Esta documentação foi estruturada para eliminar ambiguidade operacional.** Qualquer desvio dos padrões acima resultará em Rollback imediato da sub-fase para garantir a estabilidade do núcleo industrial do ContextFlow.

