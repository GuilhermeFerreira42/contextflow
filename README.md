# ContextFlow V1

Biblioteca pessoal **local** de vídeos do YouTube: metadados, transcrições com
timestamps, resumos por IA e leitura em planilha de alta densidade.

Aplicativo local para **Windows e Linux** — motor em Node.js + TypeScript com interface
web própria. Monólito modular. Chat sobre conteúdo é V2.

> **Estado:** fundação (F1–F4) e Biblioteca (F5) implementadas, com
> **183 testes automatizados** e **57 cenários E2E em navegador real**.
> A interface foi reformulada (F5-UI) e aguarda homologação humana.
> Detalhes em [`docs/estado-atual.md`](docs/estado-atual.md).

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
| `npm test` | unidade + integração (183 testes) |
| `npm run test:e2e` | interface em navegador real (precisa de Chrome — ver abaixo) |
| `npm run verificar` | fumaça: sobe, confere endpoints e estáticos, derruba |

### E2E (navegador real)

O teste E2E usa Chrome/Chromium via CDP. Aponte o binário:

```bash
CHROME_BIN=/caminho/para/chrome npm run test:e2e
```

## Estrutura

```
contextflow/
├── docs/       documentação canônica: escopo, arquitetura, plano, SPECs, estado
└── platform/   todo o projeto executável (motor + interface + testes + scripts)
```

O protótipo desktop anterior em Python está preservado, sem alterações, na
branch `legado/python-desktop`.

Detalhes de organização e as regras do projeto em
[`docs/00-comece-aqui.md`](docs/00-comece-aqui.md) e
[`docs/07-protocolo-continuidade.md`](docs/07-protocolo-continuidade.md).

## Interface

Capturas do navegador real (5.000 vídeos carregados) em
[`docs/mockups/evidencia/`](docs/mockups/evidencia/) — é o material de
homologação da F5-UI, com um LEIA-ME do que conferir.

## Dados

Banco e artefatos ficam fora do Git, em pasta por sistema operacional
(`%APPDATA%\ContextFlow` no Windows, `~/.local/share/ContextFlow` no Linux),
sobrescrevível por `CONTEXTFLOW_DADOS`.
