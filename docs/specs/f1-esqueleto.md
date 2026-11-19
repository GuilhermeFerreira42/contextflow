# SPEC F1 — Esqueleto modular

**Status:** implementada e verificada tecnicamente. **Homologação humana: pendente.**

## Objetivo

Ter um aplicativo Node.js + TypeScript que **sobe localmente**, serve a interface web e
expõe contratos estáveis, com scripts reproduzíveis e testes reais. A F1 **não** entrega
features de produto: ela entrega o esqueleto correto sobre o qual F2–F9 serão construídas.

## Escopo

- Monólito modular com fronteiras explícitas: `nucleo`, `modulos/*`, `integracoes`,
  `compartilhado`, `interface`.
- Servidor HTTP local: API sob `/api/` e interface na mesma porta (uma origem, sem CORS).
- Envelope de resposta único (`{ok:true,dados}` / `{ok:false,erro:{codigo,mensagem}}`).
- Tratamento de erro por código estável; nenhum detalhe interno/caminho na resposta.
- Log com redação de segredos.
- Static file server com proteção contra path traversal.
- Tema grafite escuro com detalhe azul e as 4 telas de navegação.
- Ferramental: `dev`, `build`, `start`, `typecheck`, `test`, `test:e2e`, `verificar`.

## Fora do escopo da F1

Persistência real, yt-dlp, fila, IA, edição de configuração, exportação, autenticação
(é aplicação local com bind em `127.0.0.1`).

## Decisões técnicas tomadas

| Decisão | Motivo | Consequência |
|---|---|---|
| **Sem framework HTTP** (`node:http` + roteador próprio) | conjunto de rotas pequeno e conhecido; menos dependência para instalar em Windows e Linux | o roteador é testado; se crescer muito, reavaliar na SPEC da fatia correspondente |
| **Type stripping nativo do Node 22** em dev e teste | roda TypeScript sem etapa de build; ciclo curto | exige `erasableSyntaxOnly` — sem enums/namespaces/parameter properties (o compilador bloqueia) |
| Imports escritos com extensão **`.ts`** no fonte | é o que o loader nativo resolve | `rewriteRelativeImportExtensions` reescreve para `.js` no build; há teste garantindo |
| Interface em **HTML/CSS/JS sem framework** | V1 é local e a densidade vem de virtualização, não de framework | sem etapa de build no frontend; E2E via CDP valida o comportamento real |
| **Dependências mínimas** (só TypeScript/@types em dev) | instalação reprodutível nos dois SOs | nada de bundler; se necessário, avaliar na fatia que precisar |
| Bind padrão **127.0.0.1** | aplicação local; expor remoto exigiria decisão e autenticação | — |
| Pasta de dados por SO (`%APPDATA%` / `$XDG_DATA_HOME`) | nada de caminho absoluto de máquina de dev | sobrescrevível por `CONTEXTFLOW_DADOS` |

## Contratos entregues

| Endpoint | Retorno |
|---|---|
| `GET /api/saude` | versão, ambiente, plataforma, node, pasta de dados e **estado real de cada módulo** |
| `GET /api/biblioteca?busca&estado&canalId&cursor&limite` | `{itens, proximoCursor, total}` com cursor por ID (não por índice) |
| `GET /api/biblioteca/:id` | vídeo ou `nao_encontrado` |
| `GET /api/configuracoes` | preferências não secretas |
| `POST /api/ingestao/validar` | valida e normaliza URL do YouTube; rejeita domínio externo com `validacao` |

## Matriz de aceite da F1

| Cenário | Ação | Resultado observável | Evidência |
|---|---|---|---|
| Motor sobe | `npm run dev` | log `motor pronto` e porta escutando | `testes/integracao/api.test.ts` |
| Interface servida | abrir `/` | HTML com `ContextFlow` e as 4 telas | integração + E2E |
| Estado honesto | abrir `/` | selo "Motor conectado" e módulos pendentes nomeados | E2E "a tela mostra o motor conectado" |
| Biblioteca vazia | abrir Biblioteca | mensagem explícita, sem dado inventado | E2E |
| Validação de URL | enviar `youtu.be/…` | URL normalizada exibida | E2E + integração |
| URL externa | enviar `exemplo.com` | rejeição clara | E2E + integração |
| Segurança | pedir `../etc/passwd` | conteúdo é o index; nada vaza | unit. `estatico` + integração |
| Segredo no log | logar `{apiKey}` | sai `[redigido]` | unit. `registro` |
| Build | `npm run build` | `dist/**/*.js` com imports `.js` | `testes/build.test.ts` |
| Regressão de página | abrir tela e navegar | sem erro de script | E2E |

## Riscos residuais

- A interface ainda não tem virtualização real: a tabela desenha todos os itens da página
  (limite 100). Virtualização é escopo de **F5**, não desta fatia.
- Verificação em **Windows não executada** (ambiente Linux). Comandos são multiplataforma,
  mas isso é alegação, não prova — a prova é da F9.
