# 1️⃣ PHASE\_6\_OVERVIEW.md

## 1\. Objetivo de Negócio

Transformar o **ContextFlow** em uma estação de triagem industrial soberana, capacitando o Analista Solo a processar volumes massivos de dados (vídeos de até 4h+) com inteligência artificial, garantindo que o custo, a escolha do modelo e o isolamento de dados estejam sob controle humano absoluto.

## 2\. Problema Resolvido

1.  **Entropia Arquitetural:** Eliminação da "God Class" (`app_state.py`) que impede a manutenção automatizada por IA.
    
2.  **Alucinação de Contexto:** Garantia de que o resumo do Vídeo A não seja contaminado por dados do Vídeo B.
    
3.  **Insegurança Operacional:** Prevenção de gastos inesperados com APIs e travamentos de sistema por falta de recursos locais (VRAM/RAM).
    
4.  **Ineficiência Analítica:** Transição de uma lista bruta de vídeos para uma grade organizada por insights e tags.
    

## 3\. Métricas Quantificáveis de Sucesso

-   **Performance:** Zero congelamentos (Freezes) da interface principal durante o processamento de IA em background.
    
-   **Precisão de Custo:** Desvio de contagem de tokens inferior a 1% em relação aos tokenizers nativos dos provedores.
    
-   **Integridade:** 100% dos resumos gerados devem ser persistidos no SQLite antes de serem enviados para a camada de visualização (Persistence-First).
    
-   **Manutenibilidade:** Redução do arquivo `app_state.py` para menos de 100 linhas (atuando apenas como fachada/orquestrador).
    

## 4\. Impacto Sistêmico Detalhado

-   **Camada de Dados:** Introdução de tabelas de insights e tags, exigindo migração atômica do banco de dados.
    
-   **Camada de Execução:** Transição de um modelo de execução linear para um modelo de fila assíncrona com slots de concorrência.
    
-   **Camada de Configuração:** O arquivo `credentials.json` passará a armazenar o estado de seleção manual do usuário.
    

## 5\. Análise de Regressão Potencial

-   **Risco de Deadlock:** A separação do estado pode causar condições de corrida se o PubSub não for respeitado.
    
-   **Compatibilidade:** A refatoração do `app_state.py` pode quebrar funcionalidades da Fase 5 (Download/Delete) se a interface de fachada não for mantida.
    

## 6\. Escopo Fechado (Boundary Definition)

### ✅ O que ESTÁ Incluído:

-   Refatoração "Bisturi" do estado global em submódulos (`VideoStore`, `AIManager`, `TaskWorker`).
    
-   Serviço de Descoberta dinâmica de modelos (Ollama Local + Google API).
    
-   Seletor manual de modelos com persistência explícita.
    
-   Motor de resumo assíncrono com limpeza de contexto (Context Sandbox).
    
-   Sistema de Tags (M2M) extraídas dos insights da IA.
    
-   Pop-up de Check-out com estimativa de tokens e tempo.
    

### ❌ O que NÃO Está Incluído:

-   Interface de Chat interativo (Estilo ChatGPT).
    
-   Troca automática de modelos (Fallback).
    
-   Refatoração estética de temas (Fase 7).
    
-   Suporte a RAG ou Busca Vetorial.
    
-   Suporte a múltiplos usuários ou Docker.
    

## 7\. Invariantes (Regras Invioláveis)

1.  **Soberania:** O sistema NUNCA deve alterar o provedor ou modelo sem intervenção manual.
    
2.  **Isolamento:** Cada pedido de resumo deve iniciar com um buffer de memória de IA vazio.
    
3.  **Atomicidade:** Um resumo só é considerado "Existente" após o `COMMIT` no SQLite.
    
4.  **Prioridade de UI:** Tarefas de IA nunca podem ocupar a thread principal do wxPython.
    

## 8\. Riscos Estratégicos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| VRAM Overflow | Crash do App (Ollama) | Semáforo de slot único (1) para modelos locais. |
| Rate Limit (Google) | Falha na Sumarização | Controle de RPM no Worker e aviso de falha amigável. |
| Dívida de Contexto | Alucinação | Instruções de sistema (system_prompt) rígidas e determinísticas. |

## 9\. Critérios Objetivos de Conclusão (Checklist)

-   \[ \] Seletor de modelos popula automaticamente ao abrir as configurações.
    
-   \[ \] Vídeo de 4h processado via Ollama sem travar a interface.
    
-   \[ \] Vídeo de 4h processado via Google sem travar a interface.
    
-   \[ \] Pop-up de Check-out exibe soma correta de tokens da seleção.
    
-   \[ \] Tags do vídeo aparecem na grade após a conclusão do resumo.
    
-   \[ \] `app_state.py` refatorado e validado com testes de integridade.
    

* * *

> **Esta documentação foi estruturada para eliminar ambiguidade operacional.** Qualquer elemento não explicitamente autorizado nesta visão geral deve ser considerado fora de escopo para a Fase 6.
