# PHASE 5.10 DYNAMIC UI: Estética e Controle de Triagem

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Identidade Visual Moderna, Redução de Cansaço Cognitivo e Estabilidade de Layout  
> **Alvos:** `ui/virtual_table.py` (ChipTagRenderer) e `ui/tab_analysis.py`

---

## 1. Color-Coding Dinâmico de Tags

Atualmente, o `ChipTagRenderer` utiliza uma paleta monocromática cinza (#230, 230, 230), o que gera monotonia visual e falha em transmitir categorização rápida. A solução proposta visa elevar o ContextFlow ao patamar de um **SaaS de alto nível** (estilo GitHub/Notion).

### 1.1. Especificação do Algoritmo
*   **Geração de Cor por Hash:** Implementar uma função helper que gere uma cor de fundo baseada no `hash` do nome da tag.
*   **Paleta Pastel (Light Mode):** Para garantir a legibilidade do texto escuro, as cores geradas devem ter baixa opacidade (aprox. 20%) ou serem tons pastel.
*   **Consistência:** A mesma tag (ex: "Liderança") deve ter sempre a mesma cor em qualquer parte do sistema.

### 1.2. Renderização no `ChipTagRenderer`
*   **Geometria:** Pílulas com raio de canto de 10px.
*   **Contraste:** O texto da tag deve permanecer em cinza escuro ou preto para garantir acessibilidade sobre o fundo colorido suave.

---

## 2. Toggle de Modo de Triagem (Estabilidade de Layout)

A lógica atual de expansão automática ("Smart Show") pode ser intrusiva durante a navegação rápida por teclado, causando saltos indesejados no layout (*jitter*).

### 2.1. Modos Operacionais
O usuário poderá alternar entre dois comportamentos através de um novo ícone na toolbar da Aba 2:

1.  **Modo Automático (Smart Show):** Comportamento atual. O visualizador expande (`SplitHorizontally`) assim que um vídeo com conteúdo é selecionado.
2.  **Modo Manual (Modo Pro):** O painel permanece estático (Unsplit). O visualizador só expande se o usuário realizar um **clique duplo** na linha ou pressionar **Enter**.

### 2.2. Implementação na Toolbar
*   **Ícone:** Um ícone de "Raio" (⚡) ou "Olho" (👁️) para sinalizar a visualização automática ativa/desativa.
*   **Persistência:** O estado do modo de triagem deve ser salvo no arquivo `config/credentials.json` para ser respeitado no próximo boot.

---

## 3. Matriz de Alterações Técnicas

| Recurso | Arquivo | Ação Técnica | Impacto Esperado |
| :--- | :--- | :--- | :--- |
| **Hash Color** | `ui/virtual_table.py` | Implementar `_get_tag_color(tag_name)` baseada em hash MD5/SHA. | Aumento da velocidade de triagem visual. |
| **Triage Logic** | `ui/tab_analysis.py` | Adicionar condicional `if config.triage_mode == 'auto'` no `on_select_video`. | Navegação estável e fluida por teclado. |
| **Toolbar UI** | `ui/tab_analysis.py` | Inserir botão de toggle (Checkable Tool) na barra analítica. | Maior controle do usuário sobre a interface. |

---

## 4. Benefício de Experiência (UX)

*   **Redução de Fricção:** O analista pode "zapear" por centenas de vídeos usando as setas do teclado sem que a tela fique "pulando", ativando a leitura apenas quando encontrar um item de real interesse.
*   **Triagem Inteligente:** A diferenciação por cores nas tags permite que o cérebro identifique temas (ex: verde para Finanças, azul para Tecnologia) antes mesmo de ler o texto, acelerando o fluxo de trabalho massivo.

---
**Critério de Homologação:** Ao desativar o "Modo Automático", o painel inferior deve permanecer oculto durante a navegação por setas. Ao reativá-lo, o painel deve abrir instantaneamente ao encontrar um vídeo com resumo. As tags de nomes diferentes devem exibir cores de fundo distintas e consistentes.
