# F6-A — painel horizontal de Visualização

Status: implementado; novo Playwright4/4, CDP57/57, refinamentos9/9, pós-F6
13/13, suíte238 (232 aprovados,seis ignorados), build/fumaça aprovados no Windows.
Capturas desktop/mobile inspecionadas; homologação humana pendente.

Autorização: pedido detalhado do proprietário em 22/11/2026, após relato de
prompt/capa. Base `51ba4a9`, main limpa. Mockup separado não veio anexado;
composição textual é a referência disponível. Não iniciar F7.

## Entrega exclusivamente de frontend

Um único botão Visualização à direita da barra da Biblioteca, junto de
Ampliado/Compacto. Seleção e ações existentes continuam à esquerda. Reutilizar
`abrir-colunas`/`painel-colunas` e todos os controles atuais, sem segundo botão
Colunas nem cópias de slider/fonte.

Painel recolhido inicialmente, imediatamente antes da tabela. Cabeçalho:
Visualização, Restaurar padrões e Fechar. Corpo em três grupos horizontais:
Colunas visíveis (checkboxes e restaurar larguras), Altura das linhas
(slider64–600, valor, padrão136), Fonte do resumo (A−,valor,A+,padrão13).
Resumo11–20px, larguras e modos conservam os limites vigentes. Efeito imediato;
nenhum Aplicar. Ajuda longa fica em descrição acessível, não ocupando altura.

Layout compacto com divisórias discretas; grupos reorganizados por largura
efetiva do painel (três, dois e um), sem transbordo horizontal. Região da tabela
flexível deve diminuir ao abrir e recuperar altura ao recolher. Preservar janela
virtual, âncora de rolagem/seleção e scroll horizontal interno da tabela.

Restaurar padrões geral repõe colunas, larguras, altura e fonte deste painel;
preserva modo Ampliado/Compacto escolhido na barra, filtros, seleção, ordenação
e preferências da transcrição. Descrever escopo no título acessível do botão.
Restauros individuais continuam disponíveis. Persistência existente nas chaves
visuais/altura, sem armazenamento paralelo, campo novo ou mudança de backend.

Disclosure acessível: aria-expanded/controls, fechar devolve foco ao botão;
Escape dentro da região fecha; teclado mantém os controles existentes.
Aberto/fechado pode conservar o estado ao navegar na mesma página; após reload
começa recolhido, conservando todos os valores salvos.

## Validação

Playwright com dados descartáveis: abertura/fechar/Escape/reabrir, teclado,
checkboxes, slider, valores/padrões, fonte, arrastar larguras, persistência após
navegação/reload e novo contexto com o armazenamento salvo. Restauro geral
preserva modo/filtros/seleção/leitura; tabela recupera espaço ao fechar. Conferir
1440/1280/1024/768/390/320px, três/dois/um grupos, ausência de sobreposição e
capturas inspecionadas em desktop/mobile. CDP e refinamentos/volume para
regressão. Build/fumaça; testes funcionais anteriores já verdes na base.
Sem migração; rollback reverte frontend, mantendo preferências/dados.

Durante a regressão, corrigida uma asserção temporal de teste da fila: a
persistência é observada antes da chamada externa, sem exigir que o cliente leia
o202 antes de qualquer execução. Produção/backend/contratos não foram alterados.
