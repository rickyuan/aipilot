# Mobile Client — @deskpilot/mobile

React Native mobile client. Displays PC screen share, captures voice, provides touch overlay for pointer control.

## Key Responsibilities

1. Display the PC's screen share stream from TRTC
2. Capture microphone audio and publish to the TRTC room
3. Touch overlay for pointer/gesture control on the shared screen
4. Device pairing flow (enter 6-digit code)
5. Display status and feedback from the AI bot

## Module Structure

- `src/screens/` — Screen components
- `src/components/` — Shared UI components
- `src/hooks/` — Custom hooks (useTRTC, useVoice, etc.)
- `src/services/` — API calls, TRTC wrapper
- `src/types/` — TypeScript types

## TRTC Notes

- Use `trtc-react-native` package (native SDK wrapper)
- Do NOT use the Web SDK (`trtc-sdk-v5`) in React Native — it won't work
- Mobile publishes mic audio only. Subscribes to PC screen + bot TTS audio.
