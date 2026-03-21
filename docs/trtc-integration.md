# TRTC Integration

TRTC SDK usage patterns and UserSig generation for DeskPilot.

## SDK Versions

- **PC Agent**: `trtc-sdk-v5` (Electron SDK) — class-based API
- **Mobile**: `trtc-react-native` — native SDK wrapper
- **Cloud**: REST API only (no SDK) — for bot lifecycle management

**IMPORTANT**: We use v5, NOT v4. The APIs are completely different. Do not reference v4 docs.

## UserSig Generation

- Server-side only (HMAC-SHA256)
- SDKAppID and SecretKey in environment variables
- Default expiry: 24 hours
- Implementation: `packages/cloud/src/trtc/usersig.ts`

## Room ID Format

String room IDs: `dp_{userId}_{timestamp}`

## Bot Management

Conversational AI bots are created via REST API (`CreateAIConversation`), not SDK.
Bot userId format: `bot_{roomId}`

## API Endpoint

Singapore: `trtc.tencentcloudapi.com` (region: `ap-singapore`)

<!-- TODO: Document detailed SDK usage patterns, error handling, reconnection logic -->
