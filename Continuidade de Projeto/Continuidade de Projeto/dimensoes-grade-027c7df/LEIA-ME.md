# Dimensões da grade — base 027c7df

O proprietário pediu ao Codex uma faixa maior de altura com barra deslizante
e larguras de colunas arrastáveis. SPEC: docs/specs/f5-ui-dimensoes-grade.md.
Estado canônico: contextflow2/docs/estado-atual.md.

## Resultado

Ampliado 64–600 px, padrão 136, compacto 64. Arrastar a barra em Colunas.
Arrastar divisórias de cabeçalhos de dados para larguras manuais. Setas e
Home/End disponíveis; Escape cancela; duplo clique restaura uma coluna;
Restaurar larguras limpa todas as medidas manuais. Seleção permanece em 46 px.
Altura e larguras persistem no navegador. Nenhum banco pessoal foi usado.

## Provas executadas

- npm-test.log: saída 0, 177 aprovados, 6 ignorados, zero falhas, 183 no total.
- npm-e2e-final.log: saída 0, 57/57 cenários CDP.
- playwright-final.log: saída 0, 9/9 grupos Playwright com ponteiro/teclado.
- npm-build.log: saída 0, inclui typecheck.
- npm-verificar.log: saída 0, nove verificações, TUDO OK.
- capturas/altura-64.png, altura-136.png e altura-600.png: leitura proporcional.
- capturas/colunas-redimensionadas.png: larguras manuais na grade.

Fixture com 5.000 vídeos e resumos sintéticos: 1/5/29 linhas de resumo visíveis
em 64/136/600 px; miniaturas 16:9 limitadas pela largura da célula.
Mudanças 64→600, 136→600 e 600→64 preservaram o vídeo 3.000 no recorte,
conservando seleção. Reload, colunas ocultas, restauração, Escape e ordenação
após resize exercitados. A suíte também preserva cobertura da lateral e gaveta.

## Histórico e limites

playwright.log, debug-ancora*.log, debug/ e capturas/falha-* são provas
intermediárias de diagnóstico. Não representam o resultado final. O problema
extremo de altura foi corrigido sincronizando também as linhas dos espaçadores
e preservando a âncora lógica durante o reflow. Código de debug foi removido.

Não executados: YouTube real, IA e regressão Linux. Dados sintéticos não são
prova desses serviços. Sem dependências novas, alteração de banco ou backend.
Homologação visual humana pendente. F6 continua fora do escopo.
O commit desta fatia aparece no git log, sobre a base indicada no título.
