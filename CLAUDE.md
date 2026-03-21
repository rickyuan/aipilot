# DeskPilot — AI Remote Workspace

Voice-controlled remote desktop for developers. Control your PC from your phone via TRTC real-time communication, with an AI agent that understands natural language and executes coding tasks through Claude Code, VS Code, and shell.

## Architecture Overview

```
[Mobile Client] ←— TRTC A/V Room —→ [PC Agent] ←→ [Claude Code / VS Code / Shell]
                        ↑
              TRTC Conversational AI Bot
              (ASR → NLU → Intent → Action)
```

Three runtime components connected via a single TRTC room:

1. **Mobile Client** (`packages/mobile/`) — React Native + TRTC SDK. Displays PC screen share, captures voice, provides touch overlay for pointer control.
2. **PC Agent** (`packages/pc-agent/`) — Node.js daemon running on the user's workstation. Joins the TRTC room as a participant, publishes screen capture, receives commands from the AI bot, executes them locally.
3. **Cloud Orchestrator** (`packages/cloud/`) — Lightweight server that manages room provisioning, device pairing, session auth, and the TRTC Conversational AI bot lifecycle.

## Tech Stack

- **Language**: TypeScript (strict mode, no `any`)
- **Runtime**: Node.js 20+ (PC Agent, Cloud), React Native 0.76+ (Mobile)
- **Real-time**: TRTC Web SDK (`trtc-sdk-v5`), TRTC Electron SDK (PC screen capture), TRTC Conversational AI API
- **AI/LLM**: Anthropic Claude API (`@anthropic-ai/sdk`), Claude Code CLI
- **Backend**: Express.js (Cloud Orchestrator), Supabase (auth + session store)
- **Build**: pnpm workspaces, turborepo
- **Testing**: vitest (unit), playwright (e2e for web client)
- **Linting**: eslint + prettier, oxlint for fast pre-commit

## Commands

```bash
pnpm dev                  # Start all packages in dev mode (turborepo)
pnpm dev:agent            # Start PC Agent only
pnpm dev:cloud            # Start Cloud Orchestrator only
pnpm dev:mobile           # Start React Native metro bundler
pnpm build                # Production build all packages
pnpm test                 # Run all tests
pnpm test:unit            # Unit tests only (vitest)
pnpm test:e2e             # E2E tests (playwright)
pnpm lint                 # Lint all packages
pnpm lint:fix             # Lint and auto-fix
pnpm typecheck            # TypeScript strict check across all packages
```

## Directory Structure

```
deskpilot/
├── CLAUDE.md                          # This file
├── packages/
│   ├── mobile/                        # React Native mobile client
│   │   ├── src/
│   │   │   ├── screens/               # Screen components
│   │   │   ├── components/            # Shared UI components
│   │   │   ├── hooks/                 # Custom hooks (useTRTC, useVoice, etc.)
│   │   │   ├── services/              # API calls, TRTC wrapper
│   │   │   └── types/                 # TypeScript types
│   │   └── CLAUDE.md                  # Mobile-specific instructions
│   │
│   ├── pc-agent/                      # Node.js PC daemon
│   │   ├── src/
│   │   │   ├── trtc/                  # TRTC room join, screen publish, audio subscribe
│   │   │   ├── executors/             # Command executors (claude-code, vscode, shell, browser)
│   │   │   ├── intent/                # Intent parser — translates AI output to executor calls
│   │   │   ├── security/              # Sandboxing, allowlist, confirmation prompts
│   │   │   └── index.ts               # Daemon entry point
│   │   └── CLAUDE.md                  # PC Agent-specific instructions
│   │
│   ├── cloud/                         # Cloud orchestrator
│   │   ├── src/
│   │   │   ├── routes/                # REST API routes
│   │   │   ├── services/              # Room provisioning, device pairing, bot management
│   │   │   ├── trtc/                  # TRTC server API wrapper (UserSig, room management)
│   │   │   └── index.ts               # Express entry point
│   │   └── CLAUDE.md                  # Cloud-specific instructions
│   │
│   └── shared/                        # Shared types, constants, utilities
│       ├── types/                     # Cross-package TypeScript interfaces
│       │   ├── intent.ts              # Intent classification types
│       │   ├── command.ts             # Command payload types
│       │   ├── session.ts             # Session and device pairing types
│       │   └── trtc.ts                # TRTC room and stream types
│       ├── constants/                 # Shared constants (error codes, event names)
│       └── utils/                     # Pure utility functions
│
├── docs/
│   ├── architecture.md                # Detailed architecture decisions
│   ├── intent-classification.md       # How voice → intent → command works
│   ├── security-model.md             # Threat model, sandboxing, allowlists
│   └── trtc-integration.md           # TRTC SDK usage patterns, UserSig generation
│
└── scripts/
    ├── generate-usersig.ts            # HMAC-SHA256 UserSig generator
    └── setup-dev.sh                   # Dev environment setup
```

## Coding Standards

- TypeScript strict mode everywhere. Never use `any` — use `unknown` and narrow.
- Absolute imports only within each package. No `../../` chains.
- All API route handlers must validate input with `zod` schemas.
- Error handling: wrap all external calls (TRTC API, Claude API, shell exec) in try/catch. Never swallow errors — log with structured context.
- Async/await only. No raw `.then()` chains.
- Functions under 40 lines. Extract early.
- All exported functions must have JSDoc with `@param` and `@returns`.

## TRTC Integration Rules

TRTC is the backbone of this project. Follow these strictly:

- **UserSig generation**: Use HMAC-SHA256 via `packages/cloud/src/trtc/`. Never generate UserSig on the client side. SDKAppID and SecretKey live in env vars only.
- **SDK version**: Use `trtc-sdk-v5` (not v4). API surface is different — don't mix.
- **Room IDs**: Use string room IDs (not numeric). Format: `dp_{userId}_{timestamp}`.
- **Screen sharing on PC Agent**: Use `startScreenCapture()` with `{ encoderConfig: 'screen-1080p' }`. Fallback to `screen-720p` if CPU > 70%.
- **Conversational AI Bot**: Created via REST API (`CreateAIConversation`), not SDK. The bot joins as a virtual user in the TRTC room. Bot userId format: `bot_{roomId}`.
- **Audio routing**: Mobile publishes mic audio. Bot subscribes to mobile audio, processes via ASR. Bot publishes TTS audio back. PC Agent does NOT publish audio unless explicitly requested.
- **Custom messages**: Use `sendCustomMessage()` for command payloads between bot and PC Agent. Message format defined in `shared/types/command.ts`.
- **API host**: Use Singapore endpoint `trtc.tencentcloudapi.com` with region `ap-singapore`.

## Intent Classification

Voice input flows through this pipeline:

```
Voice (mobile mic) → TRTC room → Conversational AI Bot
→ ASR (speech-to-text)
→ NLU (Claude API intent classification)
→ Intent type + parameters
→ Command payload (sent to PC Agent via TRTC custom message)
→ Executor (claude-code | vscode | shell | browser)
→ Result feedback (sent back via custom message → Bot TTS → mobile speaker)
```

Intent types (defined in `shared/types/intent.ts`):

| Intent | Example utterance | Executor |
|--------|------------------|----------|
| `code.create` | "Create a React login component" | claude-code |
| `code.edit` | "Fix the bug on line 42 of app.ts" | claude-code |
| `code.explain` | "Explain what this function does" | claude-code |
| `file.create` | "Create a new file called utils.ts" | shell |
| `file.navigate` | "Open the src/api folder" | vscode |
| `editor.action` | "Run the current file" | vscode |
| `shell.exec` | "Install express with npm" | shell |
| `browser.open` | "Open localhost:3000" | browser |
| `system.status` | "What's running on port 8080" | shell |
| `confirm.yes` | "Yes, go ahead" | (meta) |
| `confirm.no` | "No, cancel that" | (meta) |

## Security Model — CRITICAL

This project executes commands on the user's PC. Security is non-negotiable.

- **NEVER** execute shell commands without checking against the allowlist in `pc-agent/src/security/allowlist.ts`.
- **Destructive operations** (`rm`, `drop`, `delete`, `format`, `kill`) require voice confirmation flow: Bot asks "Are you sure?", waits for `confirm.yes` intent.
- **No sudo/admin commands** unless the user has explicitly enabled elevated mode in config.
- **All commands are logged** to `~/.deskpilot/audit.log` with timestamp, intent, raw utterance, and execution result.
- **Session timeout**: Auto-disconnect after 30 minutes of no voice input.
- **Device pairing**: Uses TOTP-based pairing code. PC shows 6-digit code, user enters on mobile. Pairing expires in 5 minutes.
- **E2E encryption**: TRTC provides transport encryption. Additionally, command payloads are signed with a per-session HMAC key.

When writing security-related code, be extra cautious. If in doubt, add a confirmation step rather than auto-executing.

## Environment Variables

```env
# TRTC (required)
TRTC_SDK_APP_ID=           # Tencent Cloud TRTC SDKAppID
TRTC_SECRET_KEY=           # TRTC SecretKey for UserSig generation

# Anthropic (required)
ANTHROPIC_API_KEY=         # Claude API key for intent classification and code generation

# Supabase (required for cloud)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Optional
DESKPILOT_LOG_LEVEL=info   # debug | info | warn | error
DESKPILOT_AUDIT_DIR=~/.deskpilot/
DESKPILOT_MAX_SESSION_MINUTES=30
```

## Git Conventions

- Branch naming: `feat/`, `fix/`, `refactor/`, `docs/` prefixes
- Commit messages: conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- PR titles follow the same convention
- Always squash merge to main

## Critical Gotchas

1. **TRTC `trtc-sdk-v5` vs `trtc-js-sdk`**: We use v5. The API is completely different (class-based vs functional). Do not reference v4 docs or examples.
2. **UserSig expiry**: Default 24h. If you see `ERR_SIG_EXPIRED`, regenerate. Never hardcode UserSig values.
3. **Conversational AI Bot is a REST API feature**, not an SDK feature. You create/destroy it via server-side HTTP calls, not from the client SDK.
4. **Screen capture on macOS**: Requires Screen Recording permission. The Electron helper must prompt for it on first run. Do not bypass or suppress the OS permission dialog.
5. **Claude Code CLI output**: Streams to stdout. Capture with `child_process.spawn`, not `exec` (which buffers everything). Parse streaming output line by line.
6. **TRTC custom messages have a 32KB limit**. For large payloads (code blocks, file contents), chunk them or use a side channel (Supabase realtime or HTTP).
7. **React Native TRTC SDK**: Use `trtc-react-native` package. It wraps native SDKs. Do NOT try to use the Web SDK in React Native — it won't work.

## When You're Unsure

- Read `docs/architecture.md` for design decisions and tradeoffs.
- Read `docs/security-model.md` before touching anything in `pc-agent/src/security/`.
- Read `docs/trtc-integration.md` for TRTC SDK patterns.
- If a task touches the intent pipeline, read `docs/intent-classification.md` first.
- For TRTC API reference, check https://trtc.io developer docs.
