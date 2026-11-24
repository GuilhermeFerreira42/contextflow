---
name: investigar-especificar-entregar
description: Conduz evolução e correção de software com investigação baseada em evidências, definição de requisitos, decisões explícitas, especificações verificáveis, plano incremental, implementação autorizada e homologação. Use para planejar, retomar, implementar ou revisar trabalhos em repositórios sem reinventar mecanismos existentes e sem entrar em ciclos de investigação.
---

# Investigar → Especificar → Entregar

## Finalidade e alcance

Método reutilizável para projetos de software de qualquer stack. Transforma ideias, incidentes e propostas em entregas verificáveis, respeitando a arquitetura e os processos do repositório. **Esta skill não é uma autorização para modificar arquivos, instalar software, executar testes com efeitos colaterais, implementar ou publicar.** Cada trabalho possui seu próprio escopo e permissões.

O fluxo completo é **alinhamento inicial → investigação → requisitos e decisões → especificação (SPEC) → planejamento por fatias → implementação autorizada → verificação técnica → homologação e encerramento**. Etapas podem ser agrupadas se simples; não podem ser declaradas concluídas sem evidência ou decisões essenciais. A descoberta de um bloqueio pode exigir voltar uma etapa, mas não reiniciar a investigação inteira.

## Regras permanentes

1. **Autoridade e autorização.** Distinguir pedido de discussão, leitura/investigação, redação de SPEC, alteração documental, implementação, execução de testes, migração e publicação. Não presumir que a autorização de uma etapa autorize as seguintes. Uma solicitação explícita de implementação já é autorização para aquele escopo, salvo restrição expressa; não criar obstáculos artificiais. Antes de ações destrutivas, externas ou irreversíveis, respeitar as aprovações exigidas pelo ambiente e pelo usuário.
2. **Projeto antes de receitas genéricas.** Ler instruções do repositório, documentação canônica relevante, decisões vigentes, código e testes. Não impor pastas, nomes, tecnologias, bancos de dados ou um número fixo de documentos. Adaptar-se à organização real.
3. **Verdade verificável.** Classificar afirmações como **Fato observado**, **Fato documental**, **Hipótese**, **Proposta** ou **Decisão aprovada**. Não tratar relatório anterior como evidência de execução atual. Diferenciar “existe no código”, “foi testado agora”, “funciona em produção” e “foi homologado”.
4. **Reuso e responsabilidade única.** Mapear o caminho ponta a ponta (UI → estado → contratos → backend → persistência → execução). Reaproveitar serviços, testes, convenções e ferramentas já presentes. Evitar segunda fonte de verdade e mecanismos paralelos.
5. **Segurança e integridade antes de conveniência.** Considerar fronteiras de autorização, validação no backend, dados, segredos, isolamento de sessões/projetos, concorrência, cancelamento, rollback, migração, recuperação e operações destrutivas. Não afirmar isolamento/sandbox inexistente.
6. **Pontos de parada.** Investigar até haver evidência suficiente para uma decisão, não até esgotar toda bibliografia possível. Quando a evidência adicional não alteraria a decisão ou a SPEC, parar. Se surgir bloqueio real, formular a menor pergunta decisiva, com recomendação e impactos.
7. **Decisões duráveis.** Registrar escolhas, alternativas rejeitadas, motivos, escopo e consequências. Não reabrir escolha encerrada sem nova evidência, mudança de requisito ou conflito demonstrado. Mudanças propostas na documentação canônica só são aplicadas quando autorizadas.
8. **Entrega incremental.** Quebrar o trabalho em fatias com resultado observável, dependências, aceites e reversibilidade. Não chamar algo de pronto por uma tela bonita, teste verde isolado ou relato não reproduzido.
9. **Separação de memória operacional e produto.** Anotações para continuidade dos agentes não são automaticamente funcionalidades do software. Utilizar o registro/skill de memória do projeto quando existente, sem obrigar diretórios extras, copiar segredos ou confundir memória do agente com dados do aplicativo.

## Entrada mínima e leitura inicial

Identificar a intenção do usuário, o problema, os limites e a entrega solicitada. Se acesso ao repositório estiver disponível, conferir **branch, HEAD, alterações locais, documentos de entrada, decisões e versão do produto** antes de confiar em achados anteriores. Preservar mudanças não commitadas. Se o código não estiver disponível, produzir uma SPEC provisória com hipóteses declaradas, nunca fingir auditoria do repositório.

Uma solicitação pode combinar investigação e SPEC em uma rodada. Isso não inclui automaticamente implementação. Se só uma parte foi solicitada, executar somente essa parte e explicitar o próximo gate.

## Etapa 1 — Investigação delimitada (E0 quando o projeto adotar esse nome)

**Objetivo:** entender o comportamento atual e a diferença para o desejado.

- Identificar o fluxo real de ponta a ponta, componentes e responsáveis por cada dado/ação.
- Levantar contratos, decisões e critérios anteriores que continuam vigentes. Em conflito, verificar precedência e indicar o ponto exato; não substituir silenciosamente a história.
- Verificar quais recursos são funcionais, parciais, demonstrativos, ausentes ou incompatíveis.
- Reproduzir defeitos quando autorizado e viável, com passos, ambiente e resultados. Não modificar dados reais para demonstrar um bug.
- Registrar evidências localizáveis: caminho, símbolo, linha/commit quando possível, teste e estado de execução; explicitar limitações.
- Comparar referências externas somente quando a pergunta justificar, separando padrões adaptáveis de código/dependências a incorporar. Verificar compatibilidade e licenças antes de copiar código.
- Apontar reaproveitamento, lacunas, riscos e *somente* dúvidas que bloqueiam a próxima decisão.

**Gate 1 — Suficiência da investigação:** é possível explicar como o sistema funciona hoje, o que falta e onde mudaria? Caso sim, parar de pesquisar e avançar. Caso não, conduzir investigação focalizada com critério explícito de encerramento. Não iniciar pesquisas semelhantes repetidas sem motivo novo.

## Etapa 2 — Requisitos e decisões com o proprietário

**Objetivo:** definir o comportamento do produto, não decidir detalhes técnicos no escuro.

- Reunir cenários positivos, negativos, bordas e fluxos de usuário; separar requisitos funcionais de não funcionais (segurança, desempenho, custo, acessibilidade, observabilidade, manutenção, disponibilidade).
- Declarar o que *não* será feito agora, inclusive funcionalidades futuras representadas pela UI.
- Separar decisões já tomadas, recomendações técnicas e pontos genuinamente pendentes. Não converter concordância parcial em aprovação de todos os itens.
- Para cada decisão bloqueante, apresentar alternativas viáveis, impacto, risco, recomendação e pergunta objetiva. Preferir uma decisão por vez em diálogo.
- Quando a decisão tiver alcance geral, distinguir padrões, configurações locais, overrides e restrições que não podem ser relaxadas.

**Gate 2 — Requisitos suficientes:** estão fechadas as decisões necessárias para a fatia proposta, sem opções estruturais escondidas? Se não, parar para o responsável decidir. Não exigir decisões de futuras fatias que não afetam a atual.

## Etapa 3 — SPEC técnica verificável

**Objetivo:** transformar decisões em um contrato de implementação e teste.

Uma SPEC deve conter, proporcionalmente ao trabalho:

- Objetivo, motivação, escopo e exclusões.
- Estado atual validado e componentes/contratos a reutilizar.
- Fluxos, entradas/saídas, estados e transições, com propriedade dos dados e fonte da verdade.
- Regras de permissões, limites de acesso, falhas, concorrência, cancelamento e persistência quando pertinentes.
- Compatibilidade, migração e rollback, com preservação de dados e estado anterior.
- Requisitos não funcionais mensuráveis quando viáveis; não inventar limites numéricos sem fundamentação.
- Matriz de aceite: **cenário → ação → resultado observável → teste/evidência esperada**. Incluir cenários negativos, segurança e regressões.
- Dependências, riscos, decisões aprovadas, hipóteses ainda verificáveis e condições de bloqueio.

Marcar explicitamente o que é novo, o que já funciona e o que permanece indisponível. Interfaces não devem prometer uma ação sem backend real. Preferir documentos e modelos que o repositório já usa; não criar burocracia ou artefatos canônicos paralelos.

**Gate 3 — SPEC pronta:** outro desenvolvedor/agente consegue implementar e testar sem inventar política, destino de dados ou comportamento de erro? Os bloqueios de produto foram aprovados? Se não, solicitar decisão ou especificar um spike limitado e não destrutivo.

## Etapa 4 — Planejamento e ordem de fatias

- Dividir por entregas verificáveis e verticais, não apenas por arquivos ou camadas.
- Identificar dependências obrigatórias, opções de reordenação e o menor núcleo que habilita os próximos trabalhos.
- Priorizar riscos de perda de dados, regressão e segurança; uma correção crítica não deve ser mascarada por refazer o layout.
- Para cada fatia: propósito, entradas, módulos impactados, fronteiras que não mudam, critério de pronto, testes, homologação necessária, riscos e reversão.
- Desacoplar UI de infraestrutura futura quando viável; não antecipar implementações de futuras fatias por conveniência.
- Propor sequência e checkpoints claros; não reabrir todo o roadmap se uma mudança local for suficiente.

**Gate 4 — Plano aprovado:** ordem, escopo da próxima fatia e restrições estão autorizados? Caso contrário, entregar o plano e parar. Uma aprovação de plano não equivale a autorização automática para implementar todas as fatias.

## Etapa 5 — Implementação autorizada

- Confirmar a fatia solicitada, branch/HEAD e estado da árvore de trabalho.
- Executar mudanças pequenas, localizadas e rastreáveis, respeitando decisões vigentes e testes de fronteira existentes.
- Preservar dados e compatibilidade. Quando necessário, realizar migração versionada e reversível, com critérios de recuperação.
- Não introduzir bibliotecas, processos, configurações ou abstrações paralelas sem justificativa aprovada.
- Se a realidade contradisser uma decisão essencial da SPEC, parar **somente a parte bloqueada**, documentar a evidência e pedir a decisão pertinente. Não resolver unilateralmente mudanças estruturais.
- Não ampliar automaticamente a autorização para fatias seguintes. Registrar o que foi executado e o que permaneceu fora de escopo.

## Etapa 6 — Verificação técnica e homologação humana

- Executar, quando autorizado e possível, testes unitários, de integração, contrato/fronteira, regressão, E2E e cenários de falha relevantes.
- Distinguir resultados medidos, testes não executados, falhas preexistentes e regressões. Não dizer “testes verdes” se houver falhas sem qualificá-las.
- Provar comportamento real no ambiente-alvo, inclusive foco, estados, seleção, uploads, exclusão, cancelamento, persistência, reinício e concorrência quando pertinentes.
- Verificar ausência de vazamento de permissões/contexto e preservação dos arquivos originais nos cenários relevantes.
- Separar **validação técnica do agente** de **homologação humana**. Se a segunda for exigida, solicitar roteiro simples e deixar status “aguardando homologação” até o aceite efetivo.
- Atualizar decisões e documentação canônica somente conforme a autorização e convenção do projeto.

**Gate final — Encerramento:** só marcar “concluído/homologado” com evidência compatível com a definição de pronto. Caso contrário, declarar exatamente o que falta e quem precisa agir.

## Registro e passagem de contexto entre agentes

Usar o registro de estado já adotado pelo projeto, sem exigir pasta exclusiva desta skill. Ao encerrar uma rodada, registrar de forma concisa:

- **Onde estamos:** objetivo, escopo e estágio/gate, branch e HEAD quando relevante.
- **O que foi verificado:** achados e links/caminhos para evidências, com distinção entre fato, hipótese e não testado.
- **O que foi decidido:** decisões aprovadas e seu alcance, sem misturar sugestões.
- **O que mudou:** arquivos e commits, migrações, testes e riscos, se houve implementação.
- **O que falta:** bloqueios, pendências de aceite e decisões ainda necessárias.
- **Próxima ação autorizada:** primeira ação executável e limite da autorização.

Na transferência Codex ↔ outros agentes, partir do **mesmo estado versionado de referência**, conferir HEAD e árvore de trabalho e ler o registro operacional existente. Não presumir que outra ferramenta possua a mesma memória ou que uma branch com nome igual contenha o mesmo commit. Evidências externas e artefatos volumosos podem ficar fora do Git, com referência rastreável; não guardar segredos.

## Formatos de saída mínimos

**Investigação:** escopo; base inspecionada; achados com evidências; reuso; lacunas; riscos; decisões indispensáveis; recomendação de próximo gate.

**Requisitos/decisões:** fatos; escolhas aprovadas; alternativas e trade-offs; pontos abertos; limites.

**SPEC:** contratos e fluxos; matriz de aceite; dependências; testes; riscos; aprovação pendente.

**Plano:** fatias em ordem; pré-requisitos; gates; aceite de cada entrega; ponto de parada.

**Implementação/handoff:** mudanças efetivas; evidências e testes; estado de homologação; riscos; próximo passo autorizado.

Ser breve em tarefas simples e detalhado nas críticas. Não produzir relatórios extensos apenas para parecer metódico.

## Antipadrões proibidos

- Pesquisa infinita, repetição de estudos sem novo critério ou documentação maior que o problema.
- Inventar fatos do repositório, testes, homologação, licenças ou funcionalidades.
- Confundir aprovação de proposta com aprovação de implementação.
- Converter uma skill operacional dos agentes em funcionalidade do produto sem requisito.
- Reabrir uma decisão fechada sem evidência ou necessidade.
- Esconder erro real com texto de interface, fallback silencioso ou mock.
- Mostrar controles como funcionais sem integração com backend.
- Duplicar catálogo, sessão, configuração, política ou persistência sem necessidade.
- Conceder acesso ampliado por escolher modelo, anexar arquivo ou trocar visualização.
- Alterar dados, histórico, documentação canônica ou arquivos de outros agentes sem autorização.
- Declarar entrega concluída sem teste compatível e aceite exigido.
