#!/bin/bash

# Deploy WiFi auto-switch to Raspberry Pis

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to deploy to a Pi
deploy_to_pi() {
    local PI_IP=$1
    local PI_NAME=$2
    
    echo "Deploying to $PI_NAME at $PI_IP..."
    
    # Check if Pi is reachable
    if ! ping -c 1 -W 2 $PI_IP &>/dev/null; then
        echo "Error: $PI_NAME at $PI_IP is not reachable"
        return 1
    fi
    
    # Copy the script
    echo "Copying wifi-auto-switch.sh..."
    scp -i ~/.ssh/id_rsa_pi "$SCRIPT_DIR/wifi-auto-switch.sh" pi@$PI_IP:/tmp/
    
    # Copy the service file
    echo "Copying wifi-auto-switch.service..."
    scp -i ~/.ssh/id_rsa_pi "$SCRIPT_DIR/wifi-auto-switch.service" pi@$PI_IP:/tmp/
    
    # Install and start the service
    echo "Installing and starting service..."
    ssh -i ~/.ssh/id_rsa_pi pi@$PI_IP << 'EOF'
        # Move script to correct location
        sudo mv /tmp/wifi-auto-switch.sh /usr/local/bin/
        sudo chmod +x /usr/local/bin/wifi-auto-switch.sh
        
        # Move service file to correct location
        sudo mv /tmp/wifi-auto-switch.service /etc/systemd/system/
        
        # Create log file
        sudo touch /var/log/wifi-auto-switch.log
        sudo chmod 666 /var/log/wifi-auto-switch.log
        
        # Reload systemd and start service
        sudo systemctl daemon-reload
        sudo systemctl enable wifi-auto-switch.service
        sudo systemctl start wifi-auto-switch.service
        
        # Check status
        sudo systemctl status wifi-auto-switch.service --no-pager
EOF
    
    echo "Deployment to $PI_NAME completed!"
    echo ""
}

# Try different IP ranges
echo "Searching for Pis..."

# Check home network IPs
for ip in 192.168.1.133 192.168.1.131; do
    if ping -c 1 -W 1 $ip &>/dev/null; then
        if [[ $ip == *133 ]]; then
            deploy_to_pi $ip "Pi-1"
        else
            deploy_to_pi $ip "Pi-2"
        fi
    fi
done

# Check mobile hotspot IPs
for ip in 192.168.43.102 192.168.43.103; do
    if ping -c 1 -W 1 $ip &>/dev/null; then
        if [[ $ip == *102 ]]; then
            deploy_to_pi $ip "Pi-1"
        else
            deploy_to_pi $ip "Pi-2"
        fi
    fi
done

# Check if any Pis were found
if ! ping -c 1 -W 1 192.168.1.102 &>/dev/null && \
   ! ping -c 1 -W 1 192.168.1.103 &>/dev/null && \
   ! ping -c 1 -W 1 192.168.43.102 &>/dev/null && \
   ! ping -c 1 -W 1 192.168.43.103 &>/dev/null; then
    echo "No Pis found on network. Please ensure they are connected and try again."
fi
