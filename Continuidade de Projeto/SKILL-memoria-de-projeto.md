---
name: memoria-de-projeto
description: Mantém a memória de trabalho de projetos versionados para retomar tarefas, registrar decisões e fazer passagens de contexto entre sessões ou agentes. Separa o estado que precisa acompanhar o Git das evidências e dos artefatos de recuperação guardados externamente. Use ao iniciar ou retomar trabalho prolongado, organizar anotações de execução ou preparar uma entrega para continuidade.
---

# Memória de projeto

Deixe contexto suficiente para que outra sessão consiga retomar o trabalho com o repositório e o registro de estado. Reutilize os documentos e as convenções do projeto. Aplique esta habilidade à continuidade do desenvolvimento. O armazenamento de memória do produto segue os requisitos próprios do produto.

## Onde guardar cada coisa

- **No Git.** Mantenha o estado atual, as decisões que afetam o trabalho futuro e os passos essenciais para retomar ou reproduzir uma validação. Use referências relativas ao repositório. Quando o projeto ainda não tiver um lugar para isso, comece com `docs/estado-atual.md`. Registre decisões ali e separe-as em outro documento quando o volume justificar.
- **Fora do Git.** Guarde capturas, vídeos, logs extensos, saídas brutas de testes e cópias de recuperação em um local externo acordado. Quando forem relevantes, registre no estado atual o nome do artefato, o que ele demonstra, a revisão correspondente e como encontrá-lo. O resumo versionado precisa continuar compreensível se o artefato ficar indisponível.
- **Acesso.** Mantenha segredos e dados pessoais fora das notas e das referências. Trate evidências externas como material com acesso controlado. Use as permissões e o processo de publicação do projeto para commits, envios e compartilhamentos.

## Retomar

1. Leia as instruções do repositório e localize seu registro de estado. Confira branch, revisão e alterações locais antes de aplicar a próxima ação descrita.
2. Use o registro para reconstruir objetivo, decisões e pendências. Se o código ou o Git divergirem das notas, verifique o que mudou e corrija o registro com os fatos confirmados. Preserve alterações locais do usuário.
3. Consulte evidências externas quando forem necessárias para reproduzir, validar ou recuperar algo. Se uma evidência estiver ausente, registre a lacuna quando ela afetar o próximo passo.

## Registrar um ponto de retomada

Atualize o registro existente quando houver uma mudança relevante, como decisão, validação, bloqueio, entrega ou interrupção. Use apenas os campos úteis para a próxima sessão.

- **Objetivo e escopo.** Trabalho em andamento e limite acordado.
- **Ponto de partida.** Branch e commit de referência, com indicação de mudanças locais pendentes, quando houver.
- **Estado e validação.** O que foi concluído, quais verificações foram executadas, seus resultados e o que ainda depende de teste ou aceite humano.
- **Decisões.** Escolha, motivo e impacto para o próximo trabalho. Aponte para o registro existente quando já houver um.
- **Próxima ação.** Primeiro passo executável e dependências ou bloqueios relevantes.
- **Evidências e recuperação.** Referências úteis e, quando houver um ponto de recuperação, revisão coberta e status da verificação. Registre a restauração como verificada somente após testá-la.

Mantenha uma fonte principal para o estado de cada frente de trabalho. Registre mudanças duráveis ali e remeta ao histórico do Git para os detalhes das alterações. Em outro computador, comece pelo repositório e transfira separadamente apenas os artefatos externos necessários.
