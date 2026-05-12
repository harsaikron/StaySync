#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║   StaySync — First-time setup                               ║
# ║   Run once before ./start.sh                                ║
# ╚══════════════════════════════════════════════════════════════╝

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  StaySync — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Backend dependencies
echo ""
echo "▶ Installing backend dependencies..."
cd "$ROOT"
npm install
echo "✅ Backend dependencies installed"

# Portal dependencies
echo ""
echo "▶ Installing portal dependencies..."
cd "$ROOT/portal"
npm install
echo "✅ Portal dependencies installed"
cd "$ROOT"

# Ollama + Gemma 4
echo ""
if command -v ollama &>/dev/null; then
  echo "✅ Ollama found: $(ollama --version 2>/dev/null || echo 'installed')"
  echo "▶ Pulling Gemma 4 model (gemma4:e4b)..."
  echo "   This is ~3GB — will take a few minutes on first run"
  ollama pull gemma4:e4b
  echo "✅ Gemma 4 model ready"
else
  echo "⚠️  Ollama not installed."
  echo ""
  echo "   To enable Gemma 4 AI analysis:"
  echo "   1. Download Ollama: https://ollama.com"
  echo "   2. Run: ollama pull gemma4:e4b"
  echo ""
  echo "   StaySync will still work without it — AI analysis will be skipped"
fi

# Create uploads dir
mkdir -p "$ROOT/uploads"
echo "✅ Uploads directory ready"

# Copy env if not present
if [ ! -f "$ROOT/portal/.env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > "$ROOT/portal/.env.local"
  echo "✅ Portal .env.local created"
fi

# Make start.sh executable
chmod +x "$ROOT/start.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ✅ Setup complete!"
echo ""
echo "  Run StaySync with:"
echo "     ./start.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
