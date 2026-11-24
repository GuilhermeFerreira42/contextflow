# ContextFlow — entrada para agentes

Este arquivo é um roteiro de retomada, não uma cópia do estado do projeto.
Antes de propor ou executar mudanças, leia as referências abaixo. Instruções
atuais do proprietário prevalecem sobre registros históricos.

## 1. Contextualização obrigatória

Leia nesta ordem, a partir da raiz deste repositório:

1. [Mapa e regras](docs/00-comece-aqui.md).
2. [Escopo canônico V1/V2](docs/01-escopo-canonico.md).
3. [Estado atual](docs/estado-atual.md): use o estado vigente no início;
   seções históricas não são tarefas pendentes nem provas da revisão atual.
4. [Protocolo de continuidade](docs/07-protocolo-continuidade.md).
5. [Plano mestre](docs/04-plano-mestre.md) e
   [critérios de aceite](docs/05-criterios-de-aceite.md).
6. [Arquitetura e contratos](docs/03-arquitetura-e-contratos.md) e
   [arquitetura da interface](docs/06b-arquitetura-da-interface.md).
7. A SPEC pertinente em `docs/specs/`, conforme a tarefa autorizada.

O [handoff inicial](docs/handoff-codex.md) contém contexto histórico e
orientações de ambiente. Não repetir a primeira tarefa antiga nem iniciar uma
fatia por causa da numeração: verificar o que já foi antecipado e validado.

## 2. Skills do projeto

Os procedimentos ficam ao lado do repositório. Leia os três:

- [Investigar, especificar e entregar](../SKILL-investigar-especificar-entregar.md).
- [Execução por fatias](../SKILL-execucao-autonoma-por-fatias.md).
- [Memória de projeto](../SKILL-memoria-de-projeto.md).

Leia também as skills aplicáveis à tarefa disponíveis no ambiente executor.
Se uma referência estiver ausente, registre a ausência; não invente seu conteúdo.

## 3. Continuidade e portabilidade

O [LEIA-ME da continuidade](../Continuidade%20de%20Projeto/LEIA-ME.md)
aponta para os registros operacionais e evidências. Essa pasta é irmã deste
repositório; preserve essa relação ao transferir o projeto de computador.
Os caminhos absolutos antigos descrevem outras máquinas: resolva os caminhos
no ambiente atual, sem depender de um usuário, unidade ou sistema específico.

`docs/estado-atual.md` é a fonte principal de retomada. A continuidade externa
guarda logs, capturas e artefatos; sua ausência não apaga os resultados e
limitações registrados no estado, mas impede alegar que evidências ausentes
foram inspecionadas. Dados pessoais do aplicativo ficam fora do repositório
e não são transferidos automaticamente junto do código.

## 4. Antes de executar e ao concluir

- Conferir `git status --short --branch` e `git log --oneline -5`; preservar
  mudanças locais e confrontar documentação com código e evidências.
- Identificar a próxima ação autorizada. Discussão não autoriza implementação;
  não ampliar escopo nem avançar fatias por inferência. Coleções permanecem
  preservadas até nova decisão explícita do proprietário.
- O projeto original Python, chamado `contextflow/`, é somente leitura:
  nunca alterar, mover ou apagar. O executável deste projeto está em `platform/`.
- Reutilizar os estados, componentes e contratos existentes. Escrever a SPEC
  pertinente antes de implementar, conforme o protocolo.
- Executar comandos de instalação, testes e build em `platform/`, consultando
  seus scripts. Para interface, validar em navegador real; distinguir testes
  com provedores controlados de uso real de serviços externos.
- Não declarar pronto sem evidência executada. Registrar falhas, skips e
  verificações não executadas, com os motivos. Aceite humano é separado.
- Nunca versionar segredos, tokens, cookies, configurações privadas ou bancos
  pessoais. Usar dados descartáveis nos testes.
- Uma fatia por commit, descrevendo o que foi validado. Atualizar
  `docs/estado-atual.md` e a continuidade ao concluir o trabalho; evidências
  volumosas ficam fora do Git. Respeitar eventuais limites explícitos do pedido.
