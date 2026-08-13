#!/bin/bash

# Gradle Sync Script for Android Project
# This script syncs gradle dependencies

echo "========================================="
echo "Gradle Sync - Android Project"
echo "========================================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

echo "Project directory: $(pwd)"
echo ""

# Check for gradlew
if [ ! -f "./gradlew" ]; then
    echo "Error: gradlew script not found!"
    exit 1
fi

echo "Running gradle sync..."
echo "========================================"
echo ""

# Run gradle sync
./gradlew clean build --refresh-dependencies

echo ""
echo "========================================"
if [ $? -eq 0 ]; then
    echo "✓ Gradle sync completed successfully!"
else
    echo "✗ Gradle sync failed. Please check the output above."
    exit 1
fi
echo "========================================"

