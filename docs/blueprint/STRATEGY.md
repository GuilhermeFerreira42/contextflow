# STRATEGY: Utilidade Pessoal e Baixa Manutenção

## 1. O Objetivo Único
O ContextFlow deve ser a ferramenta definitiva para o **Analista Solo**.
Não almejamos ser um SaaS multiusuário. O objetivo é servir **VOCÊ** por anos.

## 2. KPI de Longevidade
*   **Escalabilidade Pessoal:** O sistema deve aguentar sua biblioteca crescer até 10.000 vídeos sem ficar lento.
*   **Consumo de Recursos:** Manter RAM < 200MB em repouso.
*   **Zero Config:** Abrir e usar. Sem docker, sem servidores complexos.

## 3. Confiabilidade de Extração
A utilidade da ferramenta é zero se ela não baixa o conteúdo.
*   **Prioridade 1:** Manter `yt-dlp` atualizado.
*   **Prioridade 2:** Suporte a Cookies (browser) para evitar bloqueios.
*   **Prioridade 3:** Fallbacks silenciosos (se falhar legenda oficial, tenta a gerada, se falhar, tenta OCR futura).

## 4. O Analista Pragmático
O Analista quer **posse** dos dados.
*   O dado está no seu HD (SQLite), não na nuvem de ninguém.
*   A exportação (ZIP/Markdown) é a funcionalidade mais importante após a triagem.
