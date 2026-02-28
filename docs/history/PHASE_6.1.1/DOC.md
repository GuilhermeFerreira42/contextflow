# PHASE_6_1_1_FINAL_SPEC.md

## Governança Financeira, Seleção LLM e Robustez Operacional — Especificação Definitiva

---

# 1. PRINCÍPIOS NÃO NEGOCIÁVEIS

1. Nenhuma chamada de IA ocorre sem verificação de orçamento.
2. Nenhuma operação de IA deixa de ser registrada em armazenamento transacional.
3. Nenhuma informação financeira exibida na UI pode divergir do ledger persistido.
4. Nenhum componente pode definir cor diretamente.
5. Nenhum fallback depende de decisão manual.
6. Nenhum estado concorrente pode gerar inconsistência visual ou contábil.

---

# 2. ARQUITETURA FINANCEIRA DEFINITIVA

## 2.1 Persistência Obrigatória: SQLite

É proibido uso de JSON como ledger primário.

### Banco: `billing.db`

### Tabela: `billing_events`

```sql
CREATE TABLE billing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    request_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    tokens_prompt INTEGER NOT NULL,
    tokens_completion INTEGER NOT NULL,
    price_prompt_per_1k REAL NOT NULL,
    price_completion_per_1k REAL NOT NULL,
    price_version TEXT NOT NULL,
    cost_usd REAL NOT NULL,
    status TEXT NOT NULL, -- success | failed | fallback_success | blocked_budget
    error_code TEXT,
    latency_ms INTEGER
);

CREATE INDEX idx_timestamp ON billing_events(timestamp);
CREATE INDEX idx_request_id ON billing_events(request_id);
CREATE INDEX idx_provider_model ON billing_events(provider, model_id);
```

---

# 3. COST ENGINE

## 3.1 Input Contratual

```python
@dataclass(frozen=True)
class SummaryMeta:
    request_id: str
    provider: str
    model_id: str
    tokens_prompt: int
    tokens_completion: int
    latency_ms: int
```

Objeto imutável. Nenhuma mutação posterior é permitida.

---

## 3.2 Cálculo Determinístico

```
cost_prompt = (tokens_prompt / 1000) * price_prompt_per_1k
cost_completion = (tokens_completion / 1000) * price_completion_per_1k
total_cost = round(cost_prompt + cost_completion, 8)
```

### Regras

* Arredondamento fixo em 8 casas.
* Preço capturado no momento da execução.
* `price_version` = hash SHA256 do ai_prices.json.

---

# 4. BUDGET GUARD (CONTROLE PREVENTIVO)

## 4.1 Configuração

```json
{
  "daily_budget_usd": 5.00,
  "hard_block": true
}
```

---

## 4.2 Regra de Bloqueio

Antes da execução:

```
estimated_cost = estimate(meta)

if (today_total + estimated_cost) > daily_budget:
    status = "blocked_budget"
    registrar no ledger
    abortar execução
```

Sem exceção.

---

# 5. HEALTH CHECK E VALIDAÇÃO LLM

## 5.1 Estados Formais

* NOT_CONFIGURED
* CONFIGURED
* VALIDATING
* VALIDATED
* ERROR
* RATE_LIMIT_COOLDOWN
* FALLBACK_ACTIVE
* BLOCKED_BUDGET

---

## 5.2 Política de Health Check

* Executado apenas no primeiro uso.
* TTL mínimo: 30 minutos.
* Nunca executado em paralelo para o mesmo provider.
* Erros 401/402 → ERROR.
* Erros 429 → RATE_LIMIT_COOLDOWN com backoff exponencial.

---

# 6. FALLBACK AUTOMÁTICO

## 6.1 Ordenação Obrigatória

Modelos ordenados por:

1. Menor custo médio por 1k tokens.
2. Latência média histórica.
3. Prioridade configurada manualmente.

---

## 6.2 Política

Se erro 429 ou 5xx:

1. Selecionar próximo modelo elegível.
2. Registrar evento:

   * status = fallback_success
   * error_code original
3. Atualizar TelemetryStrip com indicador de fallback.

Sem sugestão manual.

---

# 7. TELEMETRY STRIP — CONTRATO DEFINITIVO

## 7.1 Fonte Única de Verdade

UI só consome:

```python
@dataclass(frozen=True)
class TelemetrySnapshot:
    request_id: str
    model_id: str
    cost_operation: float
    cost_session_total: float
    daily_budget: float
    burn_rate_rolling_avg: float
    fallback_used: bool
```

Proibido calcular valores na UI.

---

## 7.2 Burn Rate

Cálculo:

```
rolling_avg = média móvel das últimas 20 operações
burn_rate_diário = rolling_avg * média diária de execuções
```

Jamais exibir “estimado” sem modelo explícito.

---

# 8. THEME MANAGER — PADRÃO IRREVERSÍVEL

## 8.1 Proibição Absoluta

É proibido:

* `wx.Colour(...)`
* Hexadecimais diretos
* SetBackgroundColour fora do ThemeManager

---

## 8.2 Interface

```python
class ThemeManager:

    def panel_bg(self) -> wx.Colour
    def text_main(self) -> wx.Colour
    def accent(self) -> wx.Colour
    def telemetry_bg(self) -> wx.Colour
    def status_ok(self) -> wx.Colour
    def status_err(self) -> wx.Colour
    def get_markdown_css(self) -> str
```

---

## 8.3 Aplicação Obrigatória

Todos componentes devem receber ThemeManager via injeção de dependência.

Sem instância global implícita.

---

# 9. CONCORRÊNCIA E CONSISTÊNCIA

## 9.1 Request Correlation

Toda requisição possui:

```
request_id = UUID4
```

Ledger, fallback, telemetria e resposta são vinculados exclusivamente por `request_id`.

---

## 9.2 Garantia de Ordem

A UI só atualiza se:

```
snapshot.request_id == active_request_id
```

Previne mistura de modelo A com modelo B.

---

# 10. TESTES OBRIGATÓRIOS

## 10.1 Stress de Ledger

* 1.000 operações simuladas concorrentes.
* Verificar ausência de deadlock.
* Verificar consistência de soma total.

---

## 10.2 Teste de Corrupção

Simular:

* Interrupção durante commit.
* Encerramento abrupto.
* Banco parcialmente bloqueado.

Sistema deve:

* Recuperar automaticamente.
* Não perder registros já commitados.

---

## 10.3 Teste de Budget

* Definir orçamento mínimo.
* Disparar requisição superior.
* Confirmar bloqueio.
* Confirmar registro `blocked_budget`.

---

# 11. ROTINA DE MANUTENÇÃO

## 11.1 Compactação

* Arquivar eventos > 90 dias.
* Exportar para CSV.
* Manter banco operacional leve.

---

# 12. CRITÉRIOS FINAIS DE ACEITE

1. Nenhuma requisição sem registro.
2. Nenhum custo exibido divergente do ledger.
3. Nenhuma chamada executada acima do orçamento.
4. Nenhum fallback manual.
5. Nenhuma cor hardcoded.
6. Nenhuma race condition reproduzível em teste.

---

# VEREDICTO FINAL

Com:

* Persistência transacional (SQLite),
* Versionamento de preço,
* Bloqueio preventivo,
* Fallback determinístico,
* Snapshot imutável,
* Injeção formal de tema,
* Testes de concorrência reais,

A margem para dívida técnica estrutural na Fase 6.1.1 torna-se mínima e controlável.

Qualquer implementação fora deste contrato reintroduz risco financeiro, inconsistência contábil e fragilidade arquitetural.
