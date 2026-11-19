# ContextFlow V1

Biblioteca pessoal **local** de vídeos do YouTube: metadados, transcrições com
timestamps, resumos por IA e leitura em planilha de alta densidade.

Aplicativo local para **Windows e Linux** — motor em Node.js + TypeScript com interface
web própria. Monólito modular. Chat sobre conteúdo é V2.

> **Estado:** F1 (esqueleto modular) concluída tecnicamente, com
> **38 testes automatizados** e **10 cenários E2E em navegador real**.
> Homologação humana pendente. Detalhes em [`docs/estado-atual.md`](docs/estado-atual.md).

## Como rodar

```bash
cd platform
npm install
npm run dev        # http://127.0.0.1:4780
```

Abre no navegador: Biblioteca, Leitura, Importações e Configurações.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (TypeScript direto, sem build) |
| `npm start` | executa a partir do build (`npm run build` antes) |
| `npm run build` | typecheck + compila para `dist/` |
| `npm test` | unidade + integração (38 testes) |
| `npm run test:e2e` | interface em navegador real (precisa de Chrome — ver abaixo) |
| `npm run verificar` | fumaça: sobe, confere endpoints e estáticos, derruba |

### E2E (navegador real)

O teste E2E usa Chrome/Chromium via CDP. Aponte o binário:

```bash
CHROME_BIN=/caminho/para/chrome npm run test:e2e
```

## Estrutura

```
contextflow2/
├── docs/       documentação canônica: escopo, arquitetura, plano, SPECs, estado
└── platform/   todo o projeto executável (motor + interface + testes + scripts)
```

Detalhes de organização e as regras do projeto em
[`docs/00-comece-aqui.md`](docs/00-comece-aqui.md) e
[`docs/07-protocolo-continuidade.md`](docs/07-protocolo-continuidade.md).

## Dados

Banco e artefatos ficam fora do Git, em pasta por sistema operacional
(`%APPDATA%\ContextFlow` no Windows, `~/.local/share/ContextFlow` no Linux),
sobrescrevível por `CONTEXTFLOW_DADOS`.
