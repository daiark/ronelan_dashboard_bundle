#!/bin/bash
# Auto-detect network configuration and deploy to Pi
# Usage: ./scripts/detect-and-deploy.sh [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/config.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
fi

echo -e "${BLUE}=== Network Auto-Detection ===${NC}"

# Detect laptop IP (prefer non-localhost, non-docker interface)
LAPTOP_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '172.17' | head -n1)
if [[ -z "$LAPTOP_IP" ]]; then
    echo -e "${RED}Error: Could not detect laptop IP${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Laptop IP: $LAPTOP_IP"

# Check if Pi is reachable at configured hostname
PI_HOST=$(grep "^PI_HOST=" "$CONFIG_FILE" | cut -d'=' -f2)
PI_USER=$(grep "^PI_USER=" "$CONFIG_FILE" | cut -d'=' -f2)
SSH_KEY=$(grep "^SSH_KEY=" "$CONFIG_FILE" | cut -d'=' -f2 | sed "s|~|$HOME|")

echo -e "${BLUE}Testing Pi connectivity...${NC}"
if timeout 3 ping -c 1 "$PI_HOST" &>/dev/null; then
    PI_IP=$(getent hosts "$PI_HOST" | awk '{print $1}')
    if [[ -z "$PI_IP" ]]; then
        PI_IP=$(ping -c 1 "$PI_HOST" | grep -oP '\(\K[\d.]+(?=\))')
    fi
    echo -e "${GREEN}✓${NC} Pi reachable: $PI_HOST ($PI_IP)"
else
    echo -e "${YELLOW}⚠${NC}  Pi not reachable at $PI_HOST"
    echo -e "${YELLOW}   Trying to find Pi on network...${NC}"
    
    # Try common hostnames
    for host in cncpi.local cncpi raspberrypi.local; do
        if timeout 2 ping -c 1 "$host" &>/dev/null; then
            PI_HOST="$host"
            PI_IP=$(getent hosts "$host" | awk '{print $1}')
            echo -e "${GREEN}✓${NC} Found Pi at: $PI_HOST ($PI_IP)"
            break
        fi
    done
    
    if ! timeout 2 ping -c 1 "$PI_HOST" &>/dev/null; then
        echo -e "${RED}Error: Cannot reach Pi. Please check network.${NC}"
        exit 1
    fi
fi

# Detect network segment
LAPTOP_SEGMENT=$(echo "$LAPTOP_IP" | cut -d'.' -f1-3)
PI_SEGMENT=$(echo "$PI_IP" | cut -d'.' -f1-3)

if [[ "$LAPTOP_SEGMENT" != "$PI_SEGMENT" ]]; then
    echo -e "${YELLOW}⚠${NC}  Warning: Laptop ($LAPTOP_SEGMENT.x) and Pi ($PI_SEGMENT.x) on different subnets"
    echo -e "${YELLOW}   This may cause connectivity issues${NC}"
fi

echo ""
echo -e "${BLUE}=== Configuration Summary ===${NC}"
echo -e "Laptop IP:     $LAPTOP_IP"
echo -e "Pi Hostname:   $PI_HOST"
echo -e "Pi IP:         $PI_IP"
echo -e "Backend:       http://$LAPTOP_IP:8081"
echo -e "NATS:          nats://$LAPTOP_IP:4222"
echo -e "Pi DNC:        http://$PI_HOST:8083"

if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    echo -e "${YELLOW}[DRY RUN] Would update config.env and deploy${NC}"
    exit 0
fi

# Update config.env
echo ""
echo -e "${BLUE}Updating config.env...${NC}"
sed -i "s|^BACKEND_HOST=.*|BACKEND_HOST=$LAPTOP_IP|" "$CONFIG_FILE"
sed -i "s|^PI_HOST=.*|PI_HOST=$PI_HOST|" "$CONFIG_FILE"
echo -e "${GREEN}✓${NC} Updated BACKEND_HOST=$LAPTOP_IP"
echo -e "${GREEN}✓${NC} Updated PI_HOST=$PI_HOST"

# Redeploy to Pi
echo ""
echo -e "${BLUE}Deploying to Pi...${NC}"
cd "$ROOT_DIR"
make pi-deploy

echo ""
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Frontend env: Run ${BLUE}make gen-frontend-env${NC} then ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "${YELLOW}Quick start:${NC}"
echo -e "  cd $ROOT_DIR"
echo -e "  make gen-frontend-env"
echo -e "  cd frontend && npm run dev"
