# Warp Session Context for Continuation

## Session Summary
Date: 2025-08-04
Working Directory: `/media/ed/FSSD/DATA/daiark/RoneLan/CODE/edge-branch`
Branch: `feature/edge-agent-fixes`

## What We Accomplished

### 1. Fixed Raspberry Pi Data Collection Issue
- **Problem**: Both Pis were reporting as CNC-PI-001 in the database
- **Root Cause**: Simulator sensor had hardcoded machine ID
- **Solution**: 
  - Updated simulator to read machine ID from config
  - Fixed deployment scripts to create proper config files
  - Cleared old buffers and restarted agents

### 2. Implemented WiFi Auto-Switching
- **Problem**: Pis couldn't automatically switch between WiFi networks
- **Root Cause**: NetworkManager was managing WiFi, not wpa_supplicant directly
- **Solution**: Created NetworkManager-compatible auto-switch script
- **Network Priorities**:
  1. Ibai.X (friend's hotspot) - password: 420420aa
  2. daiark_mobile (your hotspot) - password: rfdn7358
  3. 8D1E (home network) - password: h5AfPCxeX94cT5

## Current State

### Raspberry Pi Status
- **Pi-1**: Hostname "1", typically at:
  - Home network: 192.168.1.133
  - Mobile hotspot: 192.168.43.102
- **Pi-2**: Hostname "2", typically at:
  - Home network: 192.168.1.131
  - Mobile hotspot: 192.168.43.103

### Services Running
- Edge agent on both Pis (collecting CNC data)
- WiFi auto-switch service (checking every 10 seconds)

### Files Created/Modified
```
scripts/
├── wifi-auto-switch.sh          # Original wpa_cli version
├── wifi-auto-switch-nm.sh       # NetworkManager version (active)
├── wifi-auto-switch.service     # Systemd service
└── deploy-wifi-autoswitch.sh    # Deployment script

progress_summary.md              # Technical summary
session_context.md               # This file
```

## How to Continue on Another PC

### 1. Clone and Checkout
```bash
git clone git@github.com:daiark/ronelan_backend.git
cd ronelan_backend
git checkout feature/edge-agent-fixes
```

### 2. SSH Access to Pis
Ensure you have the SSH key:
```bash
~/.ssh/id_rsa_pi
```

### 3. Check Pi Status
```bash
# Check if on home network
ping -c 1 192.168.1.133  # Pi-1
ping -c 1 192.168.1.131  # Pi-2

# Check if on mobile network (when connected to daiark_mobile)
ping -c 1 192.168.43.102  # Pi-1
ping -c 1 192.168.43.103  # Pi-2
```

### 4. Monitor WiFi Switching
```bash
# View auto-switch logs
ssh -i ~/.ssh/id_rsa_pi pi@<PI_IP> 'tail -f /var/log/wifi-auto-switch.log'
```

## Known Working Features
- ✅ Both Pis collecting data with correct machine IDs
- ✅ Automatic WiFi switching between networks
- ✅ Priority-based network selection
- ✅ Fallback to home network when hotspots unavailable

## Next Possible Tasks
1. Verify CNC-PI-002 data appears in database
2. Test Ibai.X hotspot priority switching
3. Add more Pis to the fleet if needed
4. Optimize switching time (currently 10 seconds)

## Important Notes
- NetworkManager is managing WiFi on the Pis (not raw wpa_supplicant)
- The Pis will automatically switch networks based on availability
- All configurations are persistent across reboots
