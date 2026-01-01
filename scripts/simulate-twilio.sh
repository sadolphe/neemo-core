#!/bin/bash

# Configuration
URL="https://neemo-core.vercel.app/api/webhook/whatsapp"
FROM="whatsapp:+212661000000" # Remplacez par votre numéro si besoin pour tester la DB

echo "🚀 Test 1: Ping..."
curl -X POST "$URL" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "Body=ping&From=$FROM&NumMedia=0"
echo -e "\n"

echo "🚀 Test 2: Message Texte (Ouvrir)..."
curl -X POST "$URL" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "Body=ouvrir&From=$FROM&NumMedia=0"
echo -e "\n"

echo "✅ Tests terminés."
