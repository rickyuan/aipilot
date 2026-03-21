# Cloud Orchestrator — @deskpilot/cloud

Lightweight Express.js server that manages room provisioning, device pairing, session auth, and the TRTC Conversational AI bot lifecycle.

## Key Responsibilities

1. Provision TRTC rooms and generate UserSigs (HMAC-SHA256)
2. Manage device pairing (TOTP-based 6-digit codes)
3. Session management (create, expire, timeout)
4. Create/destroy TRTC Conversational AI bots via REST API
5. Auth via Supabase

## Module Structure

- `src/routes/` — REST API routes
- `src/services/` — Room provisioning, device pairing, bot management
- `src/trtc/` — TRTC server API wrapper (UserSig, room management)
- `src/index.ts` — Express entry point

## TRTC Rules

- UserSig: generated server-side only. SDKAppID and SecretKey in env vars.
- Conversational AI Bot: created via REST API (`CreateAIConversation`), NOT SDK.
- API host: `trtc.tencentcloudapi.com` with region `ap-singapore`.
- Bot userId format: `bot_{roomId}`

## Security

- All route handlers validate input with zod schemas
- UserSig default expiry: 24h
