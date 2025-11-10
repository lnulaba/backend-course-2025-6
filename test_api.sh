#!/bin/bash

# Test script for Inventory Service API
echo "Testing Inventory Service API..."

BASE_URL="http://localhost:3000"

# Test 1: Register new item
echo "1. Testing item registration..."
RESPONSE=$(curl -s -X POST -F "inventory_name=Test Phone" -F "description=iPhone 14" "$BASE_URL/register")
echo "Response: $RESPONSE"

# Test 2: Get all items
echo "2. Testing get all items..."
curl -s "$BASE_URL/inventory" | echo "Response: $(cat)"

# Test 3: Bad request test
echo "3. Testing bad request (missing name)..."
RESPONSE=$(curl -s -X POST -F "description=No name item" "$BASE_URL/register")
echo "Response: $RESPONSE"

# Test 4: Search functionality
echo "4. Testing search..."
RESPONSE=$(curl -s -X POST -d "id=1&has_photo=on" -H "Content-Type: application/x-www-form-urlencoded" "$BASE_URL/search")
echo "Response: $RESPONSE"

# Test 5: Method not allowed
echo "5. Testing method not allowed..."
RESPONSE=$(curl -s -X PATCH "$BASE_URL/inventory")
echo "Response: $RESPONSE"

echo "Testing completed!"
