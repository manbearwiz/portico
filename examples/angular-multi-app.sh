#!/bin/bash

# Example: Using portico with Angular CLI
# This script demonstrates how to start multiple Angular apps with unique ports

echo "🏛️ Starting Angular microfrontends with Portico..."

# Array of app directories
apps=(
  "apps/shell"
  "apps/auth"
  "apps/dashboard" 
  "apps/profile"
)

# Start each app with its unique port
for app in "${apps[@]}"; do
  if [ -d "$app" ]; then
    echo "Starting $app..."
    cd "$app"
    
    # Get the port for this app
    port=$(npx portico)
    echo "📍 $app will run on port $port"
    
    # Start the Angular dev server in background
    ng serve --port=$port --host=0.0.0.0 &
    
    cd - > /dev/null
  else
    echo "⚠️  Directory $app not found"
  fi
done

echo "✅ All apps started! Check the output above for port assignments."
echo "💡 Tip: Each app will always use the same port based on its package.json name."
