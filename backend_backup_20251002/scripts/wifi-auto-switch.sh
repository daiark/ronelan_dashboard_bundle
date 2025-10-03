#!/bin/bash

# WiFi Auto-Switch Script for Raspberry Pi
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
    sudo wpa_cli -i wlan0 status 2>/dev/null | grep "^ssid=" | cut -d= -f2
}

# Function to scan for available networks
scan_networks() {
    sudo wpa_cli -i wlan0 scan >/dev/null 2>&1
    sleep 2
    sudo wpa_cli -i wlan0 scan_results 2>/dev/null | grep -E "(Ibai\.X|daiark_mobile|8D1E)" | awk '{print $5}'
}

# Function to get network ID by SSID
get_network_id() {
    local ssid="$1"
    sudo wpa_cli -i wlan0 list_networks | grep -w "$ssid" | awk '{print $1}'
}

# Function to connect to a network
connect_to_network() {
    local network_id="$1"
    local ssid="$2"
    
    log_message "Attempting to connect to $ssid (network_id: $network_id)"
    
    # Disconnect from current network
    sudo wpa_cli -i wlan0 disconnect >/dev/null 2>&1
    sleep 2
    
    # Select and enable the network
    sudo wpa_cli -i wlan0 select_network "$network_id" >/dev/null 2>&1
    
    # Wait for connection
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        sleep 2
        local status=$(sudo wpa_cli -i wlan0 status | grep "wpa_state=" | cut -d= -f2)
        if [ "$status" = "COMPLETED" ]; then
            log_message "Successfully connected to $ssid"
            return 0
        fi
        ((attempt++))
    done
    
    log_message "Failed to connect to $ssid after $max_attempts attempts"
    return 1
}

# Main monitoring loop
log_message "WiFi Auto-Switch Script Started"

while true; do
    current_ssid=$(get_current_ssid)
    
    # Scan for available networks
    available_networks=$(scan_networks)
    
    # Check if we should switch networks
    should_switch=false
    target_ssid=""
    target_network_id=""
    
    # Priority 1: Check for Ibai.X
    if echo "$available_networks" | grep -q "Ibai.X"; then
        if [ "$current_ssid" != "Ibai.X" ]; then
            should_switch=true
            target_ssid="Ibai.X"
            target_network_id=$(get_network_id "Ibai.X")
        fi
    # Priority 2: Check for daiark_mobile
    elif echo "$available_networks" | grep -q "daiark_mobile"; then
        if [ "$current_ssid" != "daiark_mobile" ] && [ "$current_ssid" != "Ibai.X" ]; then
            should_switch=true
            target_ssid="daiark_mobile"
            target_network_id=$(get_network_id "daiark_mobile")
        fi
    # Priority 3: Fall back to home network if not connected to anything
    elif [ -z "$current_ssid" ] || [ "$current_ssid" = "" ]; then
        if echo "$available_networks" | grep -q "8D1E"; then
            should_switch=true
            target_ssid="8D1E"
            target_network_id=$(get_network_id "8D1E")
        fi
    fi
    
    # Perform network switch if needed
    if [ "$should_switch" = true ] && [ -n "$target_network_id" ]; then
        log_message "Switching from '$current_ssid' to '$target_ssid'"
        connect_to_network "$target_network_id" "$target_ssid"
    fi
    
    # Wait before next check
    sleep $CHECK_INTERVAL
done
