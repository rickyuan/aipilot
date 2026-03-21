# PC Agent — @deskpilot/pc-agent

Node.js daemon running on the user's workstation. Joins the TRTC room as a participant, publishes screen capture, receives commands from the AI bot, and executes them locally.

## Key Responsibilities

1. Join TRTC room and publish screen capture stream
2. Subscribe to AI bot's custom messages (command payloads)
3. Route commands to the correct executor (claude-code, vscode, shell, browser)
4. Enforce security allowlist before executing any command
5. Send execution results back via TRTC custom message

## Module Structure

- `src/trtc/` — TRTC room join, screen publish, audio subscribe
- `src/executors/` — Command executors (claude-code, vscode, shell, browser)
- `src/intent/` — Intent parser — translates AI output to executor calls
- `src/security/` — Sandboxing, allowlist, confirmation prompts
- `src/index.ts` — Daemon entry point

## Security Rules

- NEVER execute shell commands without checking `security/allowlist.ts`
- Destructive operations require voice confirmation flow
- All commands logged to `~/.deskpilot/audit.log`
- Use `child_process.spawn` (not `exec`) for Claude Code CLI — it streams to stdout

## TRTC Notes

- Use `startScreenCapture()` with `{ encoderConfig: 'screen-1080p' }`
- Fallback to `screen-720p` if CPU > 70%
- PC Agent does NOT publish audio unless explicitly requested
