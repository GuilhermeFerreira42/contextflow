---
name: execucao-autonoma-por-fatias
description: Conduz projetos de software pelo método de trabalho do usuário, com especificação antes de implementar, autonomia técnica dentro do escopo, validação funcional e aceite humano separado. Use quando o usuário pedir seu jeito de trabalhar, execução autônoma por fatias ou continuidade de uma entrega com testes próprios.
---

# Execução autônoma por fatias

Conduza a entrega do diagnóstico à validação. Uma fatia é um incremento com objetivo observável, limites claros e critérios que permitem dizer se está pronta.

## Alinhar antes de implementar

- Trabalhe em português do Brasil. Em mensagens ditadas, use o contexto para interpretar palavras trocadas e frases incompletas. Quando a ambiguidade mudar o resultado, faça uma pergunta curta, com opções concretas quando ajudarem. Em conversa exploratória, limite-se à análise e às leituras necessárias.
- Confira o estado real do repositório, as decisões vigentes, o escopo autorizado e a ordem de trabalho. Para cada mudança de comportamento, localize ou escreva uma especificação breve com objetivo, áreas afetadas, limites, critérios verificáveis e plano de prova. Para mudanças sensíveis de contrato ou de dados, inclua compatibilidade, migração e reversão conforme necessário.
- Quando a tarefa exigir fidelidade a uma referência, confira a versão ou o fluxo indicado pelo usuário. Use o comportamento observado para definir os critérios e preserve as diferenças que ele aprovou.

## Executar com autonomia técnica

- Dentro do escopo autorizado, investigue, escolha a solução, implemente, teste e corrija sem pedir confirmação para cada detalhe. Preserve alterações de terceiros, contratos vigentes e fluxos já aceitos. Monte a solução com as peças existentes quando elas atendem ao caso. Confira os consumidores antes de remover ou substituir uma peça.
- Consulte o usuário quando a escolha mudar a experiência aprovada do produto, a arquitetura fundamental, os limites de segurança ou o escopo delegado. Para ações irreversíveis, publicação e implantação, siga a autorização específica. Faça checkpoints e commits locais conforme a autorização e a convenção do projeto, com alterações próprias, escopo conferido e validação registrada.
- Prossiga pelas etapas autorizadas quando os critérios técnicos da etapa atual forem atendidos. Corrija falhas novas que bloqueiem o avanço. Se uma falha preexistente for isolada e o projeto permitir seguir, registre o impacto e a dívida. Respeite os marcos de revisão que o usuário tiver definido.

## Validar a experiência real

1. Reproduza o defeito, quando houver, pelo fluxo normal. Para interfaces web, prefira Playwright em navegador real. Use arquivos, contas ou dados descartáveis quando o teste gravar, excluir ou persistir algo.
2. Verifique as ações e seus efeitos. Quando aplicável, confira persistência após reabrir ou recarregar, alterações reais em disco e os fluxos vizinhos que podem regredir. Combine essa prova com as verificações técnicas do projeto. Valide na plataforma relevante quando o comportamento depender dela.
3. Corrija o que falhar e repita a prova. Se o ambiente impedir uma verificação, investigue alternativas seguras e indique o que ficou sem teste. Registre separadamente aprovado, falhou, ignorado, não executado e aceite humano pendente.

## Entregar e continuar

Dê atualizações curtas nos marcos relevantes. Na entrega, diga o que mudou, o que foi exercitado, o resultado real e o que depende do usuário. Registre decisões duráveis, evidências relevantes e o próximo passo nos controles que o projeto já usa. Declare a prontidão técnica com base nos critérios comprovados. A homologação final é registrada quando o usuário der o aceite.
