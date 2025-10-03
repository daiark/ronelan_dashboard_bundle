# Progress Summary

## Raspberry Pi Data Issue

### Initial Problem
- Only data from CNC-PI-001 was appearing in the database.

### Investigations and Solutions
1. **Deployment Config Mismatch**
   - Configs `pi-config-1.yaml` and `pi-config-2.yaml` were minimal and misaligned.
   - Fixed by creating full configs with correct sections and machine IDs.

2. **Network Connectivity**
   - PI #1 had NATS connectivity issues.
   - Backend listening confirmed correct.

3. **Published Data**
   - Logs showed publishing to NATS but backend only logged CNC-PI-001.
   - Cause: Simulator sensor hardcoded machine ID to `CNC-PI-001`.
   - Fixed by using machine ID from config.

4. **Resolution**
   - Cleared buffers, restarted agents, and updated the simulator code.

## Wi-Fi Network Management

### Initial Setup
- Raspberry Pis had issues switching between Wi-Fi networks automatically.
- Manual switching worked but not automatic.

### Network Config Steps
1. **WiFi Auto-Switch Script**
   - Created script to auto-switch to highest priority WiFi using NetworkManager.

2. **Configuration Priorities**
   - Highest: Ibai.X (friend's hotspot)
   - Medium: daiark_mobile (your hotspot)
   - Lowest: 8D1E (home network)

3. **Testing and Verification**
   - Pis successfully switch networks based on availability.
   - Worked with both daiark_mobile and home network.

4. **Final Check**
   - Pis correctly switch to higher priority network when available.

This summary outlines the steps and fixes applied to both the Raspberry Pi data issue and Wi-Fi network management. All issues were resolved and systems are functioning as expected.
