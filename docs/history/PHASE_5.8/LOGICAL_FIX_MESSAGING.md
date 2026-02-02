# MESSAGING BUS SYNC (Phase 5.8)

## Overview
As of Phase 5.8, ContextFlow has achieved a Single Source of Truth for its messaging infrastructure by migrating all components to the internal `PubSub` bus.

## Changes
- **AppWindow**: Removed `import pubsub.pub`. Integrated `PubSub.subscribe` for global progress and error signals.
- **TabBatch**: Migrated "PROCESSAR FILA" trigger to `PubSub.publish('REQUEST_BATCH_PROCESSING', raw_text=...)`.
- **Processor**: Subscribed to `REQUEST_BATCH_PROCESSING` and unified `TASK_ERROR` reporting.
- **Protocol**: Argument naming is now standardized (e.g., `raw_text` for string inputs) across all publishers and subscribers to prevent silent failures.

## Benefits
- **Stability**: Prevents `NameError` or library conflict during runtime.
- **Traceability**: All system events flow through a single, predictable channel.
- **Decoupling**: UI tabs and Core services communicate via intent without direct object references.
