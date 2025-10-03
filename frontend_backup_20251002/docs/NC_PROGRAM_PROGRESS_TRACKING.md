# NC Program Progress Tracking Implementation

## Overview

The NC Program Management panel now features real-time progress tracking for block-wise transfer of NC programs from Raspberry Pi to CNC controllers, leveraging the continuous execution mode capabilities of the heidenhain_sender script.

## Architecture

### Progress Data Flow
1. **Raspberry Pi Script**: `heidenhain_sender.py` operates in block-wise transfer mode
2. **Backend API**: Pi service reports transfer progress via WebSocket events
3. **Frontend Store**: Progress data flows through machine store and NC program state
4. **UI Components**: Real-time progress bar updates in the machine detail panel

### Technical Implementation

#### Block Transfer Progress
- **Source**: Based on `heidenhain_sender.py` BCC mode with per-block ACK/NAK handshake
- **Granularity**: Per-block progress reporting during continuous execution mode
- **Data Points**:
  - Blocks sent vs total blocks
  - Transfer rate (blocks/second)
  - Estimated time remaining
  - Current block number being processed

#### UI Components

**Main Control Panel** (`NCProgramSection.tsx`):
- **Single Panel Layout**:
  - **Top Row**: Device name (left) | Program name & status (center) | Feed button (right)
  - **Progress Section**: Block transfer progress bar (appears during program transfer)
- **Device Assignment**: Managed via header "Device" button (no duplication)

**Progress Bar Features**:
- Real-time progress percentage
- Visual progress indicator (green fill)
- Block transfer status messaging
- Error state handling

## Integration with heidenhain_sender.py

### Supported Transfer Modes

Based on external context documentation:

1. **Standard Mode**: 
   - Line-terminated blocks with ETX termination
   - NUL preamble (configurable, default 50)
   - Progress tracked by line count

2. **BCC Mode (Preferred for Progress)**:
   - Header frame: `SOH 'H' NAME 'E' ETB BCC`
   - Data frames: `STX + (line + CRLF) + ETB + BCC`
   - ACK/NAK per block enables precise progress tracking
   - End sequence: `ETX` then `EOT`

### Progress Reporting Commands

```bash
# BCC Listen Mode with Progress (recommended)
python3 heidenhain_sender.py /dev/ttyAMA0 \
  --file TEST1.H \
  --mode bcc_listen \
  --rtscts --bits 7 --parity E --stopbits 1 \
  --progress-websocket ws://backend:8080/api/v1/progress \
  --verbose
```

### Expected WebSocket Events

```json
{
  "type": "progress",
  "blocks_sent": 45,
  "total_blocks": 120,
  "percent": 37.5,
  "rate_blocks_per_sec": 2.3,
  "eta_seconds": 32,
  "current_block": "G01 X10 Y20 F500"
}
```

## Future Enhancements

### Planned Features
1. **Block-level Debugging**: Show current NC block being transmitted
2. **Transfer Rate Monitoring**: Real-time blocks/second display
3. **Error Recovery**: Automatic retry logic for failed blocks
4. **Multi-Program Queue**: Sequential program transfer management

### Backend Integration Requirements
- WebSocket endpoint for progress events
- Pi service integration with machine store
- Error handling and connection recovery
- Authentication for device-specific channels

## Configuration

### Environment Variables
- `VITE_DNC_USE_MOCK`: Enable mock progress data for development
- Device-specific URLs parsed for Pi service endpoints

### Mock Data
Development mode includes simulated progress updates to test UI behavior without requiring actual Pi hardware.

## Performance Considerations

- Progress updates throttled to prevent UI flooding
- WebSocket connection managed with automatic reconnection
- Progress bar animations optimized for 60fps performance
- State updates batched for efficient rendering

---

This implementation provides a robust foundation for real-time NC program transfer monitoring, designed to scale with actual Pi deployment while maintaining excellent development experience through comprehensive mock support.