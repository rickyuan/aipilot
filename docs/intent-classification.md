# Intent Classification

How voice → intent → command works in DeskPilot.

## Pipeline

```
Voice (mobile mic) → TRTC room → Conversational AI Bot
→ ASR (speech-to-text)
→ NLU (Claude API intent classification)
→ Intent type + parameters
→ Command payload (sent to PC Agent via TRTC custom message)
→ Executor (claude-code | vscode | shell | browser)
→ Result feedback (sent back via custom message → Bot TTS → mobile speaker)
```

## Intent Types

See `packages/shared/src/types/intent.ts` for the full list.

<!-- TODO: Document classification prompt, confidence thresholds, and fallback behavior -->
