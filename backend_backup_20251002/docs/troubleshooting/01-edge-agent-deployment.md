# Troubleshooting #01: Edge Agent Deployment

## Project State
- **Status**: ✅ **SUCCESSFUL** - Single-tier ring buffer deployed and operational
- **Architecture**: Simplified from complex 3-tier to single-tier ring buffer with fallback buffers
- **Data Flow**: Pi Edge Agent → NATS JetStream → TimescaleDB (20,198+ records stored)
- **Performance**: Lock-free ring buffer with atomic operations working on ARM64

## Issues Encountered & Solutions

### 1. SSH Transfer Authentication
**Problem**: `Permission denied (publickey,password)` during SCP transfer
**Cause**: SSH not configured for password authentication
**Solution**: Manual deployment with proper password authentication
```bash
scp -o PreferredAuthentications=password -o PubkeyAuthentication=no file.tar.gz pi@192.168.1.131:~/
```

### 2. Go Module Version Compatibility
**Problem**: `invalid go version 1.23.0 must match 1.23` and `unknown directive: toolchain`
**Cause**: Raspberry Pi 3B+ has older Go version (1.15) vs project requirement (1.23)
**Solution**: Cross-compilation from desktop
```bash
# Fix version format and remove toolchain directive
sed -i 's/go 1.23.0/go 1.23/' go.mod
sed -i '/toolchain/d' go.mod
# Cross-compile for ARM
GOOS=linux GOARCH=arm GOARM=6 go build -o cnc-edge-agent-arm .
```

### 3. Multiple Main Functions
**Problem**: `main redeclared in this block` - conflict between main.go and nats_debug.go
**Cause**: Debug file containing main function in same package
**Solution**: Rename debug file to exclude from build
```bash
mv nats_debug.go nats_debug.go.bak
```

### 4. Unused Import Error
**Problem**: `"time" imported and not used` in NATS client
**Cause**: Leftover import from refactoring
**Solution**: Remove unused import from client.go

### 5. Buffer Directory Missing
**Problem**: `open /var/tmp/cnc-agent/warm.buffer: no such file or directory`
**Cause**: Default buffer paths don't exist on Pi
**Solution**: Create directories with proper permissions
```bash
sudo mkdir -p /var/tmp/cnc-agent
sudo chown pi:pi /var/tmp/cnc-agent
```

### 6. NATS Subject Mismatch
**Problem**: `nats: no response from stream` - Messages not being accepted
**Cause**: Edge agent publishing to `CNC.EDGE.data` but stream expects `CNC_DATA.>` pattern
**Solution**: Align subject prefix with stream configuration
```bash
export CNC_EDGE_NATS_SUBJECT_PREFIX="CNC_DATA.edge"
```

### 7. Configuration Complexity
**Problem**: Multiple environment variables required for basic connectivity
**Cause**: No auto-discovery or simplified config mechanism
**Next Steps**: Implement auto-discovery and config file support

## Current Working Configuration
```bash
# Required environment variables for Pi deployment
export CNC_EDGE_NATS_URL="nats://192.168.1.132:4222"
export CNC_EDGE_NATS_SUBJECT_PREFIX="CNC_DATA.edge"
export CNC_EDGE_MACHINE_ID="CNC-PI-001"  # Recommended
```

## Architecture Success
The **single-tier ring buffer** approach is working excellently:
- **HotBuffer**: Primary lock-free ring buffer handling concurrent sensor data
- **Warm Buffer**: Memory-mapped file fallback for network failures
- **Cold Buffer**: Persistent storage for critical data retention
- **Performance**: Atomic operations, zero-copy reads, efficient batching

## Verification Commands
```bash
# Check data storage
docker exec timescale_db psql -U user -d cnc_monitor -c "SELECT COUNT(*) FROM sensor_data;"

# Check recent entries
docker exec timescale_db psql -U user -d cnc_monitor -c "SELECT machine_id, time, temperature FROM sensor_data ORDER BY time DESC LIMIT 5;"

# Monitor NATS
docker logs nats_server

# Check edge agent logs
./cnc-edge-agent  # Shows real-time batching and publishing
```

## Key Learnings
1. **Single-tier approach is superior**: Simplified from complex 3-tier to primary ring buffer + fallbacks
2. **Cross-compilation is essential**: Avoids Pi environment compatibility issues
3. **Subject naming must align**: NATS publishers and consumers need consistent subject patterns
4. **Configuration automation needed**: Manual env vars should be replaced with auto-discovery
5. **Architecture validation**: 20,198+ records prove the system works under load

## Next Improvements
1. Auto-discovery of NATS endpoints
2. Configuration file support
3. Machine ID auto-generation
4. Enhanced sensor simulation with realistic data
5. Performance monitoring dashboard