Analise o código completo do sistema e compare integralmente com as especificações da Fase 5.12 descritas neste documento e na documentação da fase. Sua tarefa é validar o que já está implementado, identificar inconsistências entre UI e backend e produzir um checklist técnico objetivo dividido em três categorias: IMPLEMENTADO E FUNCIONAL, IMPLEMENTADO PARCIALMENTE, NÃO IMPLEMENTADO. salve o checkliste na pasta da fase 5.12.

Valide especificamente os seguintes pontos:

Na Aba 1 * [ ] Extração, confirme se o campo de Tempo de Espera está realmente vinculado às variáveis cooldown_mins ou cooldown_secs e se o valor padrão é 3600 segundos. Verifique se a opção “Habilitar Proteção Automática” está conectada à lógica real do Processor e se o gatilho ocorre ao atingir o limite configurável de erros HTTP 429. Confirme se o limite de falhas é persistido no ConfigManager e aplicado dinamicamente.

Valide o mecanismo de proxies no ProxyManager: confirme se há banimento temporário por 3600 segundos ao detectar 429 (para fins de teste vc pode diminuir esse tempo caso necessario), se o hot_reload() está funcional, se o sistema remove temporariamente proxies banidos da lista ativa e se a rotação Aleatória e Round-Robin estão implementadas de fato no backend. Verifique se o modo selecionado na interface realmente altera o comportamento do motor. Caso a UI exiba opções que não impactem o backend, marque como inconsistência.

Confirme se o campo de Aviso de Segurança (Fila) está ligado a max_queue_warning e se existe mecanismo


------

Segue o checklist consolidado das atividades a serem implementadas ou validadas no sistema para conclusão coerente da Fase 5.12 e preparação da Fase 6.

---

## ✅ ABA 1 — EXTRAÇÃO (Regra Alpha + Proxies)

### 🔒 Proteção Automática (Regra Alpha)

* [ ] Garantir campo **“Intervalo de Espera”** vinculado a `cooldown_mins` ou `cooldown_secs`
* [ ] Definir valor padrão como **3600 segundos (60 minutos)**
* [ ] Garantir que o valor seja editável pelo usuário
* [ ] Confirmar persistência no ConfigManager
* [ ] Validar que a proteção só é ativada se:

  * [ ] “Habilitar Proteção Automática” estiver marcado
  * [ ] Limite de Tentativas Falhas for atingido
* [ ] Confirmar que o limite de falhas (HTTP 429) é configurável
* [ ] Garantir que a hibernação realmente pause o processamento
* [ ] Garantir que o sistema retome após o tempo configurado
* [ ] Garantir que a defesa não opere silenciosamente sem refletir na UI

---

### 🌐 Sistema de Proxies

* [ ] Confirmar banimento temporário automático de proxy ao detectar 429
* [ ] Garantir tempo padrão de banimento = 3600 segundos
* [ ] Validar remoção temporária do proxy da lista ativa
* [ ] Confirmar implementação funcional de:

  * [ ] Modo Aleatório
  * [ ] Modo Round-Robin
* [ ] Garantir que a seleção do modo na UI altera o comportamento real do backend
* [ ] Confirmar hot_reload() funcional
* [ ] Garantir sincronização física de `proxies.txt`
* [ ] Implementar indicador visual:

  * [ ] Total de proxies carregados
  * [ ] Proxies ativos
  * [ ] Proxies temporariamente banidos

---

### ⚠️ Aviso de Segurança (Fila)

* [ ] Garantir campo vinculado a `max_queue_warning`
* [ ] Confirmar persistência da configuração
* [ ] Implementar confirmação manual via diálogo quando limite for ultrapassado
* [ ] Garantir que o processamento não continue automaticamente sem aceite
* [ ] Remover qualquer hardcode antigo de limite fixo

---

## 🧠 ABA 2 — CONECTIVIDADE IA (Fase 6)

### 🔑 Provedores

* [ ] Suporte configurável para:

  * [ ] OpenAI
  * [ ] Google Gemini
  * [ ] Anthropic
  * [ ] GROQ
  * [ ] Ollama (local)
* [ ] Persistência segura das chaves
* [ ] Validação de campos obrigatórios por provedor

### 👁 Visualização de API Key

* [ ] Implementar botão Mostrar/Ocultar chave
* [ ] Garantir que não exponha a chave por padrão
* [ ] Evitar falhas de colagem

---

## ⚙️ ABA 3 — ORQUESTRAÇÃO & PERFORMANCE

### ☁️ Limite de Tarefas (Nuvem)

* [ ] Campo configurável (range recomendado: 1–4)
* [ ] Persistência no ConfigManager
* [ ] Aplicação real no motor de processamento
* [ ] Teste validado de paralelismo real

---

### 💻 Limite de Tarefas (Local / Ollama)

* [ ] Forçar valor máximo = 1
* [ ] Bloquear tentativa de aumentar acima de 1
* [ ] Exibir aviso de risco se usuário tentar alterar
* [ ] Garantir que backend respeita essa restrição

---

### 🎨 Grade Dinâmica (Fast Rendering)

* [ ] Implementar toggle funcional
* [ ] Quando ativado:

  * [ ] Miniaturas habilitadas
  * [ ] Tags coloridas habilitadas
* [ ] Quando desativado:

  * [ ] Exibir somente texto
  * [ ] Reduzir uso de RAM
* [ ] Confirmar que não é apenas mudança estética

---

### 💾 Persistência de Fila

* [ ] Salvar estado da fila antes de fechar
* [ ] Restaurar tarefas como PENDING no boot
* [ ] Garantir retomada automática opcional
* [ ] Confirmar sincronização com banco SQLite
* [ ] Garantir que não haja duplicação de tarefas

---

## 🧾 UX OPERACIONAL (Saneamento Visual)

### 🏷 Renomeações obrigatórias

* [ ] “Cooldown” → **Intervalo de Espera**
* [ ] “Erro 429” → **Limite de Tentativas Falhas**
* [ ] “Queue Warning” → **Aviso de Segurança (Fila)**

### 📝 Legendas explicativas obrigatórias

* [ ] Explicação clara abaixo de Intervalo de Espera
* [ ] Explicação clara abaixo de Limite de Tentativas Falhas
* [ ] Explicação clara abaixo de Aviso de Segurança

---

## 🧱 Layout Estrutural (Mockup Validado)

* [ ] Reorganizar Aba 1 em 4 blocos lógicos:

  * [ ] Controle de Limites
  * [ ] Autenticação (Cookies)
  * [ ] Rede e Proxies
  * [ ] Prioridade de Idiomas (drag-and-drop)
* [ ] Garantir que não existam campos decorativos
* [ ] Remover campos não suportados pelo backend:

  * [ ] Máx. Requisições por Minuto
  * [ ] Req. por minuto/IP (se não houver controle real implementado)

---

## 📊 Rodapé Informativo

* [ ] Exibir status da Proteção Automática (ativa/inativa)
* [ ] Mostrar número de proxies restantes no pool
* [ ] Indicar estado de hibernação quando ativo

---

## 🔎 Validação Final da Fase 5.12

* [ ] Confirmar que toda configuração altera comportamento real
* [ ] Garantir ausência de hardcodes residuais
* [ ] Confirmar coerência UI ↔ ConfigManager ↔ Processor
* [ ] Garantir que não existam fluxos paralelos herdados
* [ ] Validar que todas as mudanças são persistentes
* [ ] Garantir que Light Mode esteja consistente e sem heranças visuais antigas

---

## 🔎 Camada operacional e administrativa da Fase 5.12

* [ ] Fixar tamanho inicial do diálogo em 800x600
* [ ] Implementar wx.ScrolledWindow em todas as abas
* [ ] Consolidação formal das 3 abas mestras como requisito estrutural
* [ ] Restaurar explicitamente todos os campos de credenciais na Aba 2
* [ ] Mascaramento real das chaves de API
* [ ] wx.SpinCtrl específico para limite de erros 429
* [ ] Conversão matemática explícita de segundos/minutos no backend
* [ ] Botão “Importar arquivo .txt” para cookies
* [ ] Botão “Restaurar Padrão” para idiomas
* [ ] Retry automático (3x) com backoff linear
* [ ] Reversão automática de PROCESSING → PENDING no boot
* [ ] Persistência explícita em credentials.json via on_save
* [ ] Light Mode absoluto forçado (não apenas verificado)
* [ ] SetMinimumPaneSize(50) em todos os wx.SplitterWindow
* [ ] dc.SetClippingRegion(rect) na grade para evitar overflow
* [ ] Protocolo Zero-Knowledge formal (mediação exclusiva via AppState + PubSub)



---

Quando todos os itens acima estiverem implementados e testados, a Fase 5.12 pode ser considerada tecnicamente concluída.
