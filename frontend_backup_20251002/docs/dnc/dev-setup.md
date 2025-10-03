# DNC Feeder Development Guide

**Frontend-Only Mock Mode Setup** - No external device communication required

## Quick Start

1. **Environment Setup**
   ```bash
   # Clone and install
   npm install
   
   # Optional: Create .env.local (mock mode is default)
   echo "VITE_DNC_USE_MOCK=true" > .env.local
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   # Navigate to http://localhost:5173/dnc
   ```

3. **Start Testing**
   - Device selector shows multiple Pi devices (rpi-001, rpi-002, etc.)
   - Click **Refresh** to load mock ports/config
   - WebSocket auto-connects (green indicator)
   - Test machine-to-device assignment and program sending

## DNC Mock Mode Features

### 🔧 Device Management
- **Multiple Devices**: 5 Pi devices with descriptive names and locations
  - `rpi-001` - Pi Station A (Floor 1)
  - `rpi-002` - Pi Station B (Floor 1) 
  - `rpi-003` - Pi Station C (Floor 2)
  - `rpi-004` - Pi Station D (Floor 2)
  - `demo` - Demo Device (Development)
- **Machine Integration**: Devices can be assigned to specific machines
- **Context-Aware**: DNC interface shows machine context when accessed from machine detail pages
- **Refresh Button**: Reloads ports and configuration
- **WebSocket Connection**: Auto-connects with visual status
- **Port Detection**: Mock returns standard serial ports

### 📝 NC Program Editor
- **Monaco Editor**: Full syntax highlighting for Heidenhain
- **File Operations**: Open/save NC programs
- **Live Editing**: Real-time syntax validation

### 🧹 Code Sanitizer
The sanitizer detects and fixes common NC program issues:

**Common Fixes Applied:**
- `BEGIN PG` → `BEGIN PGM` (missing 'M')
- `END PG` → `END PGM` 
- Case normalization: `begin pgm` → `BEGIN PGM`
- Control character removal
- Line ending normalization

**Usage Tips:**
- **Auto-Apply Mode**: Enable to apply fixes without preview
- **Preview Mode**: Review all changes before applying
- **Change Counter**: Shows applied fixes with auto-clear
- **Issue Detection**: Categorizes errors, warnings, and fixable issues

### 📡 Transfer Operations

**Send Mode (Standard/BCC):**
1. Upload NC program via editor or file picker
2. Click **Start** → Auto-connects WebSocket if needed
3. Monitor progress in real-time
4. Use **Pause/Resume/Stop** controls as needed

**Receive Mode:**
1. Set mode to "receive"
2. Click **Start Receive** → Auto-connects
3. Mock simulates receiving data from CNC
4. View progress and logs in real-time

**Mock Behavior:**
- Simulated transfer progress (0-100%)
- Realistic timing and data rates
- Status updates: idle → sending/receiving → completed
- Log messages with timestamps

### 📊 Real-time Monitoring
- **Transfer Progress**: Visual progress bar with percentage
- **Connection Status**: WebSocket connection indicator
- **Transfer Rate**: Simulated bytes/second display
- **State Management**: Visual state transitions

### 🗂️ Log Console
- **Level Filtering**: Filter by All/Info/Warn/Error
- **Auto-scroll**: Latest logs always visible
- **Clear Function**: Reset log history
- **Color Coding**: Error (red), Warning (orange), Info (default)
- **Timestamp Display**: Precise timing information

## Testing Workflows

### 🧪 Complete Transfer Test
1. Open `/dnc` directly or via machine "Send Program" button
2. Select Pi device from dropdown (shows names and IDs)
3. Ensure WebSocket is connected (green indicator)
4. Load sample program in editor (or use default)
5. Run **Sanitize** to test code cleaning
6. Click **Upload editor buffer**
7. Select **standard** mode
8. Click **Start** → Watch progress and logs
9. Test **Pause/Resume/Stop** during transfer

### 🧪 Machine Integration Test
1. Go to dashboard and create new machine
2. Assign Pi device to machine via "Device" button
3. Click "Send Program" from machine detail page
4. Verify DNC interface opens with machine context
5. Confirm correct Pi device is pre-selected
6. Test program sending workflow

### 🧪 Sanitizer Test
1. Paste problematic code in editor:
   ```
   0 begin pg example mm
   1 l x+0 y+0
   2 END PG example mm
   ```
2. Click **Sanitize**
3. Review preview showing fixes
4. Click **Apply Changes** or enable **Auto-apply**
5. Verify code is normalized properly

### 🧪 Error Handling Test
- Disconnect/reconnect WebSocket using controls
- Upload various file types
- Test mode switching
- Clear logs during active transfer

## Environment Configuration

```bash
# .env.local - Mock Mode (default)
VITE_DNC_USE_MOCK=true

# .env.local - Gateway Mode (future)
VITE_DNC_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8080
# OR direct device mapping:
VITE_DNC_DEVICE_MAP='{"pi001":"http://192.168.1.10:8000"}'
```

## Build & Preview

```bash
# Build production version
npm run build

# Test production build
npm run preview
# Navigate to http://localhost:4173/dnc
```

## Integration Roadmap

**Phase 1: Mock Development** ✅
- Frontend-only mock implementation
- Complete UI/UX development
- Testing and validation

**Phase 2: Gateway Integration** 🔄
- Go backend gateway implementation
- WebSocket bridge to Pi devices
- Environment-based device resolution

**Phase 3: Direct Device Mode** 📅
- Direct Pi device communication
- Device discovery and management
- Production deployment

## Troubleshooting

**WebSocket Connection Issues:**
- Check browser console for errors
- Use **Reconnect WS** button
- Verify mock mode is enabled

**Editor Issues:**
- Refresh page to reset Monaco editor
- Check browser console for Monaco errors
- Clear browser cache if needed

**Build Issues:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

---
*Mock mode provides complete DNC functionality for development without requiring any backend services or hardware devices.*

