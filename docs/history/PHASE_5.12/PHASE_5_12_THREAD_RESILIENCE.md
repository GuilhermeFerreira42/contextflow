Para consolidar o método de **Solução A (Hooks e Logger de Interrupção)** e garantir que a IA executora resolva o problema das threads presas sem gerar dívida técnica, gerei o arquivo abaixo. 

Este documento utiliza a infraestrutura de **SSoT (Fonte Única de Verdade)** e o **Protocolo Zero-Knowledge** já estabelecidos no projeto ContextFlow.

---

# 📄 PHASE_5_12_THREAD_RESILIENCE.md: Saneamento de Resiliência e Cancelamento Atômico

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Implementar o "Kill-Switch" para interrupção imediata de tarefas de rede (Network I/O) no motor `yt-dlp`.  
> **Referência:** Briefing Técnico (Problema 1) e `services/youtube_manager.py`.

---

## 1. Diagnóstico do Problema
O sistema utiliza threads para chamadas síncronas de rede via `yt-dlp`. Quando um cancelamento é solicitado, as threads permanecem em estado de bloqueio (Wait) até que o timeout da rede expire, impossibilitando a limpeza atômica da fila e gerando vazamento de recursos [Briefing Técnico].

## 2. Especificação da Solução (Kill-Switch via Hooks)
A solução consiste em injetar sensores de cancelamento dentro do loop interno do `yt-dlp` através de um logger customizado e hooks de progresso.

### 2.1. Nova Exceção de Controle
No arquivo `services/youtube_manager.py`, deve ser criada uma exceção específica para diferenciar interrupções intencionais de erros reais de rede:
```python
class DownloadCancelledException(Exception):
    """Lançada para abortar imediatamente o processamento do yt-dlp."""
    pass
```

### 2.2. Logger com Sensor de Cancelamento
Deve-se implementar uma classe `InterruptibleLogger` que será passada ao dicionário `ydl_opts`. Este logger deve consultar o `AppState` a cada mensagem recebida.

**Lógica:**
1. O `yt-dlp` envia uma mensagem de debug/info.
2. O logger intercepta a mensagem.
3. O logger verifica `AppState().is_cancel_requested()`.
4. Se verdadeiro, lança `DownloadCancelledException`.

### 2.3. Hook de Progresso
No método `_progress_hook` existente em `YouTubeManager`, deve ser adicionada a mesma verificação no início do processamento de cada pacote de dados.

---

## 3. Roteiro de Implementação (Execução Direta)

### Passo 1: Modificar `services/youtube_manager.py`
1.  **Criar a classe `InterruptibleLogger`** dentro do arquivo.
2.  **Atualizar o método `get_video_metadata`**:
    *   Instanciar o `InterruptibleLogger`.
    *   Incluir `'logger': InterruptibleLogger()` e `'nocheckcertificate': True` no `ydl_opts`.
3.  **Encapsular a execução**:
    *   O comando `ydl.extract_info` deve estar dentro de um bloco `try/except DownloadCancelledException`.

### Passo 2: Modificar `core/processor.py`
1.  **Sincronizar a Flag**: No método de cancelamento global (`clear_queue` ou similar), garanta que `AppState.cancel_requested = True` seja disparado antes de limpar a `queue.Queue`.
2.  **Tratamento no Worker**: No método `_process_task`, adicione um bloco `except DownloadCancelledException` para limpar o status da tarefa sem registrar um erro no banco de dados.

---

## 4. Plano de Validação e Testes (Checklist DoD)

- [ ] **Teste de Interrupção Imediata**: Iniciar extração de uma playlist longa, clicar em "Cancelar" e validar no log se as threads pararam em menos de 2 segundos.
- [ ] **Estabilidade Post-Mortem**: Verificar se, após o cancelamento, é possível iniciar um novo lote de URLs sem reiniciar a aplicação.
- [ ] **Integridade do Banco**: Confirmar que vídeos cancelados não recebem o status `ERROR`, mas sim retornam para `PENDING` ou são removidos conforme a regra de negócio.
- [ ] **Memória RAM**: Validar se o uso de RAM cai para o nível de repouso (< 200MB) após o cancelamento em massa [PRD, 1580].

---

**Diretriz para a IA Executora:** 
> "Não utilize `thread.join()` com timeouts longos. Use a injeção de exceção via Logger/Hook conforme especificado neste documento para forçar o desempilhamento da stack trace da thread de trabalho."