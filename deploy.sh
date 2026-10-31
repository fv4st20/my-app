#!/bin/bash
echo "🚀 Building Swiss Knife Hub..."

# Base install
npm install

# Build all sub-apps
apps=("neon-orbit" "star_locator" "chem-lab" "chill-hub" "shape-wars" "sonic-soccer" "nond_ex" "alien-echo" "pirate-fishing")

for app in "${apps[@]}"; do
  echo "📦 Building $app..."
  cd "$app" || exit
  npm install
  npm run build
  cd ..
done

echo "✅ Build complete!"
echo "🔄 Restarting PM2 process..."
pm2 restart swiss-knife-hub || pm2 start ecosystem.config.cjs --env production
