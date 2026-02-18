# PHASE_5_12_OVERVIEW.md: Visão Estratégica e Governança de Extração

**Status:** SSoT (Fonte Única de Verdade)
**Função:** Documento decisório de intenção estratégica e limites de produto para a **Fase 5.12**.
**Referências:** Auditoria de Governança v24, Mockup Operacional v2 e Plano de Saneamento Administrativo.

--------------------------------------------------------------------------------

### 1. Objetivo de Negócio

• **Problema Real:** O **ContextFlow** atingiu estabilidade no núcleo de processamento, mas permanece "administrativamente incompleto" e tecnicamente engessado. Parâmetros críticos de segurança (limite de 20 vídeos) e insumos de rede (cookies/proxies) estão fixos no código ou dependem de manipulação manual de arquivos, gerando fricção e impedindo a escala do **Analista Solo**.

• **Métrica Impactada:** **Autonomia Operacional**. O sucesso desta fase será medido pela redução do tempo de configuração de insumos (cookies/proxies) via interface para menos de 10 segundos e pelo aumento do teto de processamento em lote sem intervenção do desenvolvedor.

### 2. Definição de Soberania

• **O que significa autonomia do usuário:** O analista deixa de ser um passageiro das regras do sistema e assume o papel de **Comandante Operacional**. Ele terá o poder de decidir a agressividade da extração, as identidades de rede utilizadas e a ordem de prioridade de dados.

• **Limites Removidos:**
    ◦ Extinção da "Trava de Segurança" fixa de 20 vídeos na fila.
    ◦ Fim do protocolo de defesa (Cooldown) mandatório e automático; o usuário agora possui o _kill switch_ da proteção.

• **Controle do Sistema:** O sistema mantém a gestão técnica de baixo nível: orquestração do pool de workers (threading), persistência atômica no SQLite e a execução física do "Escudo" baseada nos parâmetros agora fornecidos pelo usuário.

### 3. Escopo Fechado da Fase

**O que ESTÁ incluído:**
• Transformação da tela de configuração em um **Painel de Controle Operacional** dividido em 4 blocos lógicos: Limites/Proteção, Autenticação (Cookies), Rede (Proxies) e Preferências (Idiomas).
• Gestão dinâmica de cookies no formato **Netscape** via colagem ou importação de arquivo.
• Interface para gerenciamento de lista de IPs de proxies com suporte a _hot-reload_.
• Parametrizar tempo de hibernação (Cooldown) e limite de erros 429 permitidos antes da pausa.
• Substituição da entrada manual de idiomas por uma interface visual de reordenação (prioridade).
• Rodapé informativo de status operacional em tempo real (Proteção Ativa, Proxies válidos, etc.).

**O que NÃO está incluído:**
• Integração real com provedores de IA (OpenAI, Gemini, Ollama) — pertencente à Fase 6.
• Controle individual de tokens por IP/Proxy ou sistemas de _Token Bucket_ avançados.
• Análise semântica de transcrições ou geração de tags automáticas.
• Padronização visual total de Modo Escuro (Dark Mode).

### 4. Riscos Estratégicos

• **Abuso de Proxies:** Ao remover a trava de 20 vídeos, o usuário pode sobrecarregar sua lista de proxies, levando ao banimento massivo de sua infraestrutura de rede se os limites forem mal configurados.
• **Risco Legal/Conta:** O uso agressivo de cookies autenticados para contornar restrições pode resultar no banimento da conta do Google utilizada.
• **Bloqueio por Scraping:** Desativar a "Proteção Automática" expõe o IP real do usuário ao erro 429 de forma contínua, podendo causar bloqueios de longo prazo no YouTube.
• **Instabilidade de Memória:** O carregamento de listas gigantescas de proxies na interface pode gerar picos de uso de RAM se não houver sanitização do input.

### 5. Critérios de Conclusão da Fase

A Fase 5.12 será considerada entregue quando:
1. O conteúdo colado no campo de Cookies for convertido com sucesso para um arquivo `cookies.txt` funcional na raiz, permitindo acesso a vídeos restritos.
2. O `Processor` respeitar o novo limite de aviso da fila definido na UI (ex: processar 50 vídeos sem abortar se o limite for 100).
3. O sistema de **Hibernação (Cooldown)** for desativado via checkbox e o sistema continuar processando mesmo após simulação de erro 429.
4. Todas as novas chaves de governança (`max_queue_warning`, `auto_defense_enabled`, etc.) forem persistidas corretamente no arquivo `credentials.json`.
