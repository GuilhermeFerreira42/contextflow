# PHASE 5.9: Restauração do Cockpit Analítico (Aba 2)

> **Status:** SSoT (Fonte Única de Verdade)
> **Foco:** Recuperação da Identidade Visual Moderna e Layout Master-Detail
> **Referência:** Mockup v6.0 (_mockup.html.txt)

## 1. Contexto e Diagnóstico
Após a consolidação da infraestrutura técnica na Fase 5.8, a **Aba 2 (Cockpit Analítico)** encontra-se funcionalmente estável, mas esteticamente "árida". O objetivo desta fase é reincorporar os elementos visuais de alta fidelidade que tornavam a versão 5.5 superior para a triagem de conteúdo, como **thumbnails inline** e resumos rápidos.

Esta fase serve como a ponte final para a **Fase 6**, preparando o terreno físico (esqueleto de UI) para receber a inteligência artificial sem necessidade de novas quebras estruturais.

## 2. Rationale da Restauração Moderna
Enquanto a Aba 1 é otimizada para a "brutalidade" da ingestão massiva, a Aba 2 é projetada para o **conforto do Analista Solo**.

*   **Identidade Tailwind/Moderno:** Diferente do "Cinza Windows", a Aba 2 utilizará renderização rica via `wx.GraphicsContext` para pílulas de tags e imagens com cantos arredondados.
*   **Layout Master-Detail (Splitter):** Implementação obrigatória do `wx.SplitterWindow` horizontal para permitir que o usuário analise a lista (Master) e o conteúdo (Detail) simultaneamente.
*   **Performance Garantida:** A restauração visual não pode comprometer a meta de **latência de célula < 0.1ms** e o suporte a 10.000 vídeos, utilizando o motor virtual desenvolvido na 5.7.

## 3. Objetivos Funcionais da 5.9
*   **Visualização de Mídia:** Restaurar a renderização de miniaturas (80x45) na grade usando um **LRU Cache** para evitar travamentos de scroll.
*   **Triagem por Tags:** Preparar a coluna de "Tags Detectadas" que exibirá chips coloridos para categorização rápida de assuntos.
*   **Lógica Smart Show:** O painel inferior de detalhes deve iniciar oculto e expandir-se apenas quando um vídeo for selecionado, preservando a área útil da tela.

## 4. Governança e Isolamento
A Aba 2 continuará operando sob o **Protocolo Zero-Knowledge**, sendo terminantemente proibida de importar componentes da Aba 1. Toda a atualização de dados continuará sendo mediada exclusivamente pelo **AppState** e pelo barramento **PubSub**.
