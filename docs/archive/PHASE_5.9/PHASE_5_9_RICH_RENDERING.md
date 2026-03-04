# PHASE 5.9 RICH RENDERING: Motor de Renderização Rica (Aba 2)

> **Status:** SSoT (Fonte Única de Verdade)
> **Componente:** `ui/virtual_table.py` / `ui/tab_analysis.py`
> **Objetivo:** Renderização de alta fidelidade para 10.000+ itens com latência zero.
> **Referência:** Mockup v6.0 (_mockup.html.txt)

## 1. Arquitetura de Renderização Customizada

Para atingir o visual **Moderno/Tailwind** solicitado sem violar a meta de **latência de célula < 0.1ms**, a Aba 2 abandonará o desenho simples de texto em favor de renderizadores baseados em `wx.GraphicsContext`. Diferente do `wx.DC` tradicional, este motor garante suporte a **antialiasing** e transparências, essenciais para bordas arredondadas e pílulas de tags.

## 2. Gerenciamento de Mídia: LRU Cache de Thumbnails

O maior gargalo técnico identificado é o carregamento de imagens durante o scroll rápido. Para evitar que o software trave ao rolar por milhares de vídeos, implementaremos um **LRU Cache (Least Recently Used)**.

*   **Capacidade do Cache:** Limite estrito de **50 Bitmaps** em RAM para manter o consumo global abaixo de **250MB**.
*   **Carregamento Assíncrono:** A `VirtualVideoTable` não deve buscar a imagem no disco durante o evento `OnPaint`. Se a imagem não estiver no cache, o sistema deve:
    1.  Desenhar um **Placeholder escuro** com ícone de "carregando".
    2.  Disparar uma **thread secundária** para carregar e redimensionar (80x45) a imagem do `THUMBNAILS_DIR`.
    3.  Usar `wx.CallAfter` para atualizar a célula assim que o Bitmap estiver pronto.

## 3. Especificações dos Renderers

### 3.1. Thumbnail Renderer (Preview)
*   **Dimensões:** 80x45 pixels (proporção 16:9).
*   **Estética:** Cantos arredondados (Radius: 4px) e borda sutil de 1px em `COLOR_BORDER`.
*   **Performance:** Uso de `wx.GraphicsBitmap` para desenho acelerado por hardware.

### 3.2. Chip Renderer (Context Tags)
As tags detectadas pela IA (ex: "Liderança", "Finanças") serão desenhadas como **pílulas visuais** na coluna 5.
*   **Geometria:** Retângulos arredondados com preenchimento colorido de baixa opacidade.
*   **Tipografia:** Fonte sem serifa (Segoe UI/Roboto), tamanho 8pt, cor branca.
*   **Lógica de Exibição:** Limite de até 3 chips visíveis na grade para preservar a limpeza visual; tags excedentes serão indicadas por um "+N" [Specs v5.9].

### 3.3. RichText Renderer (Título/Canal)
A coluna de título deve exibir dois níveis de informação em uma única célula:
*   **Título:** Texto principal em **Negrito**, cor `COLOR_FG`.
*   **Canal:** Subtexto em *Itálico*, cor cinza (#888888), posicionado logo abaixo do título.

## 4. Protocolo de Performance e Memória

1.  **Just-in-Time Drawing:** O motor virtual só processará o desenho das linhas que estão dentro da janela de visualização do usuário.
2.  **Throttling de Update:** Atualizações visuais em células de progresso ou status são limitadas a **5 vezes por segundo (200ms)** para economizar ciclos de CPU.
3.  **Mandato Cleanup:** Implementação obrigatória do método `Cleanup()` para destruir Bitmaps órfãos e liberar memória ao trocar de aba ou fechar a aplicação.

## 5. Regras de Estilo (Design System)

| Elemento | Constante / Valor | Justificativa |
| :--- | :--- | :--- |
| **Fundo de Linha** | `COLOR_BG` | Consistência com Dark Theme. |
| **Hover State** | BG + 5% Claridade | Feedback visual de interatividade. |
| **Selection State** | Barra lateral 3px `COLOR_ACCENT` | Identidade Moderna/Tailwind. |
| **Links** | `wx.BLUE` + Cursor Hand | Affordance de clicabilidade. |

---
**Critério de Aceite:** O scroll na Aba 2 deve permanecer estável em **60 FPS** com miniaturas ativas, e a ocupação de RAM não deve exceder **250MB** durante o processamento massivo de 10.000 itens.
