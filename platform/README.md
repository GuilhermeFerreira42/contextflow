# platform/ — projeto executável

Tudo o que é necessário para **desenvolver, testar, construir e executar** o ContextFlow V1
vive aqui. A documentação canônica fica em `../docs/`.

## Requisitos

- **Node.js ≥ 22** (usa `--experimental-strip-types` para rodar TypeScript direto em dev e
  testes; nada de etapa de build obrigatória para rodar em dev).
- **npm ≥ 10** (workspaces).
- Linux ou Windows.

## Comandos

```bash
npm install            # instala dependências (workspaces)
npm run dev            # servidor de desenvolvimento com reload
npm start              # executa a partir do build
npm run build          # typecheck + gera dist/
npm run typecheck      # só checagem de tipos
npm test               # testes de unidade e integração (node:test)
npm run test:e2e       # testes de UI em navegador real (Playwright)
npm run verificar      # fumaça: sobe o motor, checa endpoints, derruba
```

## Estrutura

```
src/
├── compartilhado/   # tipos e contratos — usado por motor e interface
├── motor/           # API HTTP + regras de negócio (Node.js)
│   ├── nucleo/      # bootstrap, config, logging, erros
│   ├── modulos/     # biblioteca, ingestao, trabalhos, resumos, configuracao
│   ├── persistencia/
│   └── integracoes/ # yt-dlp, provedores de IA
├── interface/       # frontend web local servido pelo motor
scripts/             # dev, build, start, verificação
testes/              # unidade, integração, E2E
```

## Dados

O banco e os artefatos ficam em uma pasta de dados **fora do Git**, configurável por
variável de ambiente (`CONTEXTFLOW_DADOS`) e com padrão por sistema operacional. Ver
`docs/specs/` para o contrato vigente e `docs/estado-atual.md` para o que já está pronto.
