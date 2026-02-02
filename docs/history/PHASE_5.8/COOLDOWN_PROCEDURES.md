# COOLDOWN PROCEDURES & SAFETY RESET

## Background
ContextFlow implements a **Global Cooldown** (Rule Alpha) to protect user infrastructure from YouTube 429 (Too Many Requests) bans. This state is persisted in the SQLite database.

## Mechanisms
1. **Detection**: The `Processor` detects '429' in error messages and triggers the `CooldownManager`.
2. **Persistence**: `global_cooldown_until` is stored in the `system_config` table.
3. **Visibility**: The `Processor` worker loop now logs `SYSTEM COOLDOWN ACTIVE` every 10 seconds when cooling down, informing the user of the wait time.

## Safety Reset (Emergency Procedure)
A "Reset Safety" button has been added to **Aba 1 (Doca de Carga)**.
- **Function**: Invokes `CooldownManager.clear_cooldown()`.
- **Usage**: Used to resume testing immediately after an IP ban or during development.
- **Effect**: Clears the DB setting and allows the `Processor` to resume task execution on the next tick.

## Warnings
> [!CAUTION]
> Excessive use of Reset Safety without changing Proxies or waiting may lead to a permanent IP ban from YouTube.
