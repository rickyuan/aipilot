#!/usr/bin/env bash
# Dev environment setup for DeskPilot
set -euo pipefail

echo "🔧 Setting up DeskPilot development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install it first."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required. Run: npm install -g pnpm"; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ is required. Current version: $(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v)"
echo "✅ pnpm $(pnpm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Check for .env file
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Copying from .env.example..."
  cp .env.example .env
  echo "📝 Please fill in your environment variables in .env"
fi

echo ""
echo "✅ Setup complete! Available commands:"
echo "   pnpm dev        — Start all packages in dev mode"
echo "   pnpm dev:agent  — Start PC Agent only"
echo "   pnpm dev:cloud  — Start Cloud Orchestrator only"
echo "   pnpm dev:mobile — Start React Native metro bundler"
