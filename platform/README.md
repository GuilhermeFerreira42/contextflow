# platform/ — projeto executável

Tudo o que é necessário para **desenvolver, testar, construir e executar** o ContextFlow V1
vive aqui. A documentação canônica fica em `../docs/`.

## Requisitos

- **Node.js ≥ 22.5** — usa `--experimental-strip-types` (TypeScript direto em dev/testes) e
  **`node:sqlite`** (banco nativo). Sem etapa de build obrigatória para rodar em dev.
  A versão mínima é exigida porque `node:sqlite` só existe a partir daí.

> **Zero dependências de produção.** O banco é o `node:sqlite` embutido no Node, escolhido
> justamente para que `npm install` não precise de toolchain C++ nem compilar nada — nem no
> Windows, nem atrás de proxy. Instalação medida: **0,38 s**.
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
