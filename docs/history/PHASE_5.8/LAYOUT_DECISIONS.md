# DECISÕES DE LAYOUT: DOCA DE CARGA (Aba 1)

## Contexto
Durante a Fase 5.8, decidimos divergir da estética rica da Aba 2 para favorecer a performance e a densidade técnica na Aba 1 (Ingestão).

## Regras Pétreas
1. **Padrão HeidiSQL**: A Aba 1 deve se comportar como uma ferramenta de administração de banco de dados. Estática, previsível e densa.
2. **Interdição de Splitters**: Não é permitido o uso de `wx.SplitterWindow` na Aba 1. A grade e o input devem dividir o espaço vertical via sizers sem redimensionamento manual pelo usuário no meio da aba.
3. **Métrica de Densidade**:
   - Sem thumbnails (poupando 30% de memória vertical).
   - Altura de linha padrão (25px).
   - 11 colunas permanentes (ver checklist DoD).

## Racional
A Doca de Carga é onde o usuário cola milhares de URLs. Qualquer complexidade visual (thumbnails, splitters aninhados) degradaria a experiência de colagem e scroll massivo.
