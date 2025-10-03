#!/bin/bash

# WiFi Auto-Switch Script for Raspberry Pi with NetworkManager
# This script monitors available networks and switches to the highest priority one

# Network priorities (highest to lowest)
# 1. Ibai.X (friend's hotspot)
# 2. daiark_mobile (your hotspot)  
# 3. 8D1E (home network)

LOGFILE="/var/log/wifi-auto-switch.log"
CHECK_INTERVAL=10  # Check every 10 seconds

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# Function to get current SSID
get_current_ssid() {
    nmcli -t -f active,ssid dev wifi | grep "^yes:" | cut -d: -f2
}

# Function to scan for available networks
scan_networks() {
    # Trigger a scan
    nmcli dev wifi rescan 2>/dev/null || true
    sleep 2
    # Get available networks
    nmcli -t -f ssid dev wifi list | grep -E "^(Ibai\.X|daiark_mobile|8D1E)$" | sort -u
}

# Function to check if connection profile exists
connection_exists() {
    local ssid="$1"
    nmcli connection show | grep -q "^$ssid "
}

# Function to create connection if it doesn't exist
create_connection() {
    local ssid="$1"
    local password="$2"
    local priority="$3"
    
    if ! connection_exists "$ssid"; then
        log_message "Creating connection profile for $ssid"
        nmcli connection add \
            type wifi \
            con-name "$ssid" \
            ifname wlan0 \
            ssid "$ssid" \
            wifi-sec.key-mgmt wpa-psk \
            wifi-sec.psk "$password" \
            connection.autoconnect yes \
            connection.autoconnect-priority "$priority"
    fi
}

# Function to connect to a network
connect_to_network() {
    local ssid="$1"
    
    log_message "Attempting to connect to $ssid"
    
    # Use nmcli to connect
    if nmcli connection up "$ssid" 2>/dev/null; then
        log_message "Successfully connected to $ssid"
        return 0
    else
        log_message "Failed to connect to $ssid"
        return 1
    fi
}

# Main monitoring loop
log_message "WiFi Auto-Switch Script (NetworkManager) Started"

# Create connection profiles if they don't exist
create_connection "Ibai.X" "420420aa" 100
create_connection "daiark_mobile" "rfdn7358" 90
create_connection "8D1E" "h5AfPCxeX94cT5" 80

while true; do
    current_ssid=$(get_current_ssid)
    
    # Scan for available networks
    available_networks=$(scan_networks)
    
    # Check if we should switch networks
    should_switch=false
    target_ssid=""
    
    # Priority 1: Check for Ibai.X
    if echo "$available_networks" | grep -q "^Ibai\.X$"; then
        if [ "$current_ssid" != "Ibai.X" ]; then
            should_switch=true
            target_ssid="Ibai.X"
        fi
    # Priority 2: Check for daiark_mobile
    elif echo "$available_networks" | grep -q "^daiark_mobile$"; then
        if [ "$current_ssid" != "daiark_mobile" ] && [ "$current_ssid" != "Ibai.X" ]; then
            should_switch=true
            target_ssid="daiark_mobile"
        fi
    # Priority 3: Fall back to home network if not connected
    elif [ -z "$current_ssid" ]; then
        if echo "$available_networks" | grep -q "^8D1E$"; then
            should_switch=true
            target_ssid="8D1E"
        fi
    fi
    
    # Perform network switch if needed
    if [ "$should_switch" = true ] && [ -n "$target_ssid" ]; then
        log_message "Switching from '$current_ssid' to '$target_ssid'"
        connect_to_network "$target_ssid"
    fi
    
    # Wait before next check
    sleep $CHECK_INTERVAL
done
