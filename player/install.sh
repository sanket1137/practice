#!/bin/bash
#
# CCMS Player - One-Line Remote Installer for Raspberry Pi 5
# ===========================================================
#
# Run this single command on your Raspberry Pi 5:
#
#   curl -sSL https://your-server.com/install.sh | sudo bash -s -- --screen-id YOUR_ID --api-key YOUR_KEY --server https://your-server.com
#
# Or with wget:
#
#   wget -qO- https://your-server.com/install.sh | sudo bash -s -- --screen-id YOUR_ID --api-key YOUR_KEY --server https://your-server.com
#
# For interactive setup (will prompt for values):
#
#   curl -sSL https://your-server.com/install.sh | sudo bash
#

REPO_URL="https://raw.githubusercontent.com/YOUR_REPO/main/player"
SETUP_SCRIPT="setup-raspberry-pi.sh"

# Download and execute the full setup script
curl -sSL "${REPO_URL}/${SETUP_SCRIPT}" | sudo bash -s -- "$@"
