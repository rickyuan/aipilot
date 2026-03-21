#!/usr/bin/env bash
# End-to-end integration test for DeskPilot
# Tests: Cloud API → PC Agent pairing → command execution
set -euo pipefail

CLOUD_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

echo "========================================"
echo "  DeskPilot End-to-End Integration Test"
echo "========================================"
echo ""

# ── Test 1: Health check ──
info "Test 1: Health check"
HEALTH=$(curl -s "$CLOUD_URL/health")
echo "$HEALTH" | grep -q '"status":"ok"' && pass "Health check" || fail "Health check"

# ── Test 2: Create session ──
info "Test 2: Create session"
SESSION=$(curl -s -X POST "$CLOUD_URL/api/sessions" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"pc-agent-1"}')
SESSION_ID=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['sessionId'])")
ROOM_ID=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['roomId'])")
[ -n "$SESSION_ID" ] && pass "Session created: $SESSION_ID" || fail "Create session"
echo "   Room: $ROOM_ID"

# ── Test 3: Get session ──
info "Test 3: Get session by ID"
GET_SESSION=$(curl -s "$CLOUD_URL/api/sessions/$SESSION_ID")
echo "$GET_SESSION" | grep -q "$SESSION_ID" && pass "Get session" || fail "Get session"

# ── Test 4: Generate pairing code ──
info "Test 4: Generate pairing code"
PAIRING=$(curl -s -X POST "$CLOUD_URL/api/pairing/generate" \
  -H 'Content-Type: application/json' \
  -d '{"pcUserId":"pc-agent-1"}')
PAIRING_CODE=$(echo "$PAIRING" | python3 -c "import sys,json; print(json.load(sys.stdin)['pairingCode'])")
[ ${#PAIRING_CODE} -eq 6 ] && pass "Pairing code generated: $PAIRING_CODE" || fail "Generate pairing code"

# ── Test 5: Verify pairing code ──
info "Test 5: Verify pairing code (mobile side)"
VERIFY=$(curl -s -X POST "$CLOUD_URL/api/pairing/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"pairingCode\":\"$PAIRING_CODE\",\"mobileUserId\":\"mobile-1\"}")
echo "$VERIFY" | grep -q '"Pairing successful"' && pass "Pairing verified" || fail "Verify pairing"
PAIRED_ROOM=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin)['roomId'])")
echo "   Paired room: $PAIRED_ROOM"

# ── Test 6: Verify expired/consumed code fails ──
info "Test 6: Re-use pairing code (should fail)"
REUSE=$(curl -s -X POST "$CLOUD_URL/api/pairing/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"pairingCode\":\"$PAIRING_CODE\",\"mobileUserId\":\"mobile-2\"}")
echo "$REUSE" | grep -q '"error"' && pass "Consumed code rejected" || fail "Code reuse check"

# ── Test 7: Get room config ──
info "Test 7: Get TRTC room config"
ROOM_CFG=$(curl -s "$CLOUD_URL/api/rooms/$PAIRED_ROOM/config?userId=mobile-1")
echo "$ROOM_CFG" | grep -q '"userSig"' && pass "Room config with UserSig" || fail "Get room config"

# ── Test 8: End session ──
info "Test 8: End session"
END=$(curl -s -X POST "$CLOUD_URL/api/sessions/$SESSION_ID/end")
echo "$END" | grep -q '"Session ended"' && pass "Session ended" || fail "End session"

# ── Test 9: Ended session returns 404 ──
info "Test 9: Get ended session (should 404)"
GONE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUD_URL/api/sessions/$SESSION_ID")
[ "$GONE" = "404" ] && pass "Ended session returns 404" || fail "Session 404 check"

echo ""
echo "========================================"
echo -e "  ${GREEN}All tests passed!${NC}"
echo "========================================"
