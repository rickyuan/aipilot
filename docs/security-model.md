# Security Model

Threat model, sandboxing, and allowlists for DeskPilot.

## Principles

1. **Least privilege**: Only execute commands on the allowlist.
2. **Confirmation for destructive ops**: `rm`, `kill`, etc. require voice confirmation.
3. **No sudo by default**: Elevated mode must be explicitly enabled.
4. **Audit everything**: All commands logged to `~/.deskpilot/audit.log`.
5. **Session isolation**: Per-session HMAC keys for command signing.
6. **Time-bounded sessions**: Auto-disconnect after 30 min of inactivity.

## Threat Model

<!-- TODO: Document threat vectors and mitigations -->

## Allowlist

See `packages/pc-agent/src/security/allowlist.ts`.
