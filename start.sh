#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║   StaySync — Gemma 4 for Good Hackathon                     ║
# ║   One command to run everything locally                      ║
# ╚══════════════════════════════════════════════════════════════╝

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID="" PORTAL_PID=""

cleanup() {
  echo ""
  echo "⏹  Stopping StaySync..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$PORTAL_PID"  ] && kill "$PORTAL_PID"  2>/dev/null
  pkill -f "ollama serve" 2>/dev/null || true
  echo "✅ Stopped. Goodbye!"
  exit 0
}
trap cleanup INT TERM

clear
echo ""
echo "  ███████╗████████╗ █████╗ ██╗   ██╗███████╗██╗   ██╗███╗   ██╗ ██████╗"
echo "  ██╔════╝╚══██╔══╝██╔══██╗╚██╗ ██╔╝██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝"
echo "  ███████╗   ██║   ███████║ ╚████╔╝ ███████╗ ╚████╔╝ ██╔██╗ ██║██║     "
echo "  ╚════██║   ██║   ██╔══██║  ╚██╔╝  ╚════██║  ╚██╔╝  ██║╚██╗██║██║     "
echo "  ███████║   ██║   ██║  ██║   ██║   ███████║   ██║   ██║ ╚████║╚██████╗"
echo "  ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝"
echo ""
echo "  Dementia Care Intelligence — Powered by Gemma 4"
echo "  Kaggle × Google DeepMind — Gemma 4 for Good Hackathon"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Ollama / Gemma 4 ──────────────────────────────────────────
echo "▶ [1/3] Checking Gemma 4 (Ollama)..."
if command -v ollama &>/dev/null; then
  if ! pgrep -x ollama &>/dev/null; then
    echo "   Starting Ollama..."
    ollama serve &>/tmp/staysync-ollama.log &
    sleep 2
  fi
  # Check if model is pulled
  if ollama list 2>/dev/null | grep -q "gemma4"; then
    echo "   ✅ Gemma 4 is ready"
  else
    echo "   ⬇  Pulling gemma4:e4b (first time — may take a few minutes)..."
    ollama pull gemma4:e4b
    echo "   ✅ Gemma 4 pulled and ready"
  fi
else
  echo "   ⚠️  Ollama not installed — AI analysis will be skipped"
  echo "      Install: https://ollama.com  then run: ollama pull gemma4:e4b"
fi

echo ""

# ── 2. Backend (Node.js / Express / SQLite) ──────────────────────
echo "▶ [2/3] Starting backend..."
cd "$ROOT"
if [ ! -d "node_modules" ]; then
  echo "   Installing backend dependencies..."
  npm install --silent
fi

# Find Mac's local IP for ESP32 hint
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.x.x")

node server.js &
BACKEND_PID=$!
sleep 1

if kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "   ✅ Backend running on http://localhost:3001"
  echo "   📡 ESP32 SERVER_URL = http://${LOCAL_IP}:3001"
else
  echo "   ❌ Backend failed to start — check for port conflicts"
  exit 1
fi

echo ""

# ── 3. Portal (Next.js) ──────────────────────────────────────────
echo "▶ [3/3] Starting portal..."
cd "$ROOT/portal"
if [ ! -d "node_modules" ]; then
  echo "   Installing portal dependencies..."
  npm install --silent
fi

npm run dev > /tmp/staysync-portal.log 2>&1 &
PORTAL_PID=$!
sleep 4

if kill -0 "$PORTAL_PID" 2>/dev/null; then
  echo "   ✅ Portal running on http://localhost:3000"
else
  echo "   ❌ Portal failed to start — check /tmp/staysync-portal.log"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  🌐 Portal   →  http://localhost:3000"
echo "  🔧 Backend  →  http://localhost:3001"
echo "  🤖 Gemma 4  →  http://localhost:11434"
echo ""
echo "  📡 ESP32-CAM  →  set SERVER_URL = http://${LOCAL_IP}:3001"
echo ""
echo "  Opening portal in browser..."
open "http://localhost:3000" 2>/dev/null || true
echo ""
echo "  Press Ctrl+C to stop everything"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait
