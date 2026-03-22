📄 PHASE_5_12_REFINAMENTO_E_FECHAMENTO.md (VERSÃO CONSOLIDADA V30)
Status: SSoT (Fonte Única de Verdade)
Base Técnica: Código v30 (Blindagem e Threading)
Objetivo: Saneamento administrativo final, implementação do Kill-Switch de rede e simplificação do fluxo de cancelamento.

--------------------------------------------------------------------------------
1. Simplificação do Fluxo de Cancelamento (Estratégia de Limpeza)
Para reduzir a complexidade e evitar vazamentos de estado visual observados em versões anteriores, o sistema adotará a Estratégia de Purga:
• Remoção de Pendentes: Ao disparar o comando de cancelamento (REQUEST_CANCEL_ALL), todos os itens que não atingiram o status COMPLETED devem ser removidos do buffer ativo da UI e da task_queue. [Conversa]
• Visão Pós-Cancelamento: A grade deve exibir apenas o que foi concluído com sucesso. Itens incompletos não devem permanecer visíveis como "cancelados" para evitar ruído. [Conversa]
• Fechamento da Barra de Progresso: O sinal ALL_TASKS_STOPPED deve forçar a ocultação imediata do wx.Gauge e o reset do status no rodapé. [Conversa, 33]
• Lógica de Reentrada: Caso o usuário deseje os itens faltantes, ele deve reinserir a URL. O sistema utilizará a lógica de Upsert do banco de dados para ignorar o que já foi baixado e processar apenas o restante.
2. Resiliência de Threads (O Kill-Switch)
O maior gargalo de sincronia ocorre quando o yt-dlp fica preso em chamadas de rede. Implementar o mecanismo de interrupção atômica:
• InterruptibleLogger: No youtube_manager.py, o logger deve consultar AppState.is_cancel_requested() em cada mensagem. Se positivo, lançar DownloadCancelledException.
• Saneamento de Metadados: Corrigir o erro AttributeError no tratamento de transcrições, validando se o objeto retornado por list_transcripts é nulo antes de processar. [Conversa]
3. Consolidação e Acessibilidade de UI
O diálogo de configurações deve ser o "Console de Governança" final, organizado em 3 Abas Mestras:
Aba 1: Extração & Segurança (Prioridade Operacional)
• 4 Blocos Lógicos: 1. Limites (Fila, Erros 429), 2. Cookies (Netscape), 3. Rede (Proxies), 4. Idiomas (Reordenação visual).
• Ajuste Semântico: "Cooldown" → Intervalo de Espera | "Erro 429" → Limite de Tentativas Falhas.
• Botão Cancelar: Deve estar vinculado ao método clear_queue do Processor.
Aba 2: Conectividade IA (As Chaves)
• Campos de API: Restaurar campos para OpenAI, Gemini, Anthropic e GROQ (com "Q"). [1821, Conversa]
• Eye Toggle: Implementar o botão de "olho" para alternar visibilidade das chaves sem causar "flickering" na interface.
4. Rodapé de Observabilidade
Implementar o rodapé informativo no diálogo de configurações para exibir em tempo real:
• Status do Escudo: (Ativo/Inativo com tempo restante).
• Status de Rede: (Número de proxies válidos/carregados).
• Status de Cookies: (OK ou Vazio).

--------------------------------------------------------------------------------
✅ Checklist de Homologação (DoD)
• [ ] Cancelamento Imediato: Ao cancelar, itens incompletos somem da grade e o Gauge desaparece em < 2s.
• [ ] Persistência Atômica: O botão "Salvar" gera fisicamente os arquivos cookies.txt e proxies.txt na raiz se os campos não estiverem vazios.
• [ ] Protocolo Zero-Knowledge: Nenhuma aba de configuração importa classes das abas de processamento ou análise.

--------------------------------------------------------------------------------
Assinatura Técnica: Engenharia ContextFlow - Protocolo de Estabilidade v30 Aplicado.
