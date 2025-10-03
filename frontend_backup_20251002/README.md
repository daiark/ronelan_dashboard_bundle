# Ronelan Industrial Monitoring Panel

A modern React-based frontend for monitoring CNC machines and industrial equipment, designed to integrate with the Ronelan Go backend.

## 🏗 Features

### Core Monitoring
- **Real-time Machine Monitoring**: Live data visualization with WebSocket connections
- **Interactive Dashboard**: Overview of all machines and individual detailed views
- **Machine Management**: Complete CRUD operations for machines with device assignment
- **Raspberry Pi Integration**: Link machines to Pi devices for NC program control
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Clean, professional interface built with Tailwind CSS
- **Data Visualization**: Real-time charts using Recharts library
- **State Management**: Efficient state handling with Zustand
- **TypeScript**: Full type safety and improved developer experience

### 📋 DNC Feeder Integration
- **NC Program Editor**: Monaco-based editor with Heidenhain syntax highlighting
- **Code Sanitizer**: Auto-detects and fixes common NC program issues
- **Real-time Transfer**: Live progress monitoring for send/receive operations
- **Machine-Device Linking**: Assign Raspberry Pi devices to specific machines
- **Multi-Device Support**: Manage multiple Pi devices with descriptive names
- **Mock Development Mode**: Complete UI testing without hardware dependencies
- **WebSocket Communication**: Reliable real-time connection management
- **Multi-mode Support**: Standard, BCC, BCC-Listen, and Receive modes

## 🛠 Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Zustand** for state management
- **Axios** for API communication
- **WebSocket** for real-time data

## 📦 Installation

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔧 Configuration

### Environment Variables
The project includes environment files for different deployment scenarios:

**.env.development**
```
VITE_API_BASE_URL=http://localhost:8080
```

**.env.production**
```
VITE_API_BASE_URL=http://192.168.1.100:8080
```

## 🔧 Development

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📋 DNC Feeder Usage

The DNC (Distributed Numerical Control) Feeder provides a complete interface for managing NC program transfers to/from CNC machines.

### Quick Start - Mock Mode

```bash
# Start development server
npm run dev

# Navigate to DNC interface
open http://localhost:5173/dnc
```

**Mock mode is enabled by default** - no external hardware or backend required!

### Key Features

📝 **NC Program Editor**
- Syntax highlighting for Heidenhain code
- Real-time validation and editing
- File import/export capabilities

🧹 **Code Sanitizer**
- Detects common issues: `BEGIN PG` → `BEGIN PGM`
- Case normalization and control character removal
- Preview changes before applying
- Auto-apply mode for streamlined workflow

📡 **Transfer Operations**
- **Send**: Upload NC programs to CNC
- **Receive**: Download programs from CNC  
- **Real-time Progress**: Live transfer monitoring
- **Pause/Resume/Stop**: Full transfer control

📊 **Live Monitoring**
- WebSocket connection status
- Transfer progress and data rates
- Real-time logging with level filtering
- Connection management controls

### Testing Workflow

1. **Open DNC Interface**: Navigate to `/dnc`
2. **Load Program**: Use the built-in editor or upload a file
3. **Sanitize Code**: Click "Sanitize" to clean up the program
4. **Start Transfer**: Upload and begin transfer with "Start"
5. **Monitor Progress**: Watch real-time progress and logs
6. **Control Transfer**: Use Pause/Resume/Stop as needed

### Environment Configuration

```bash
# Mock Mode (default - no backend required)
VITE_DNC_USE_MOCK=true

# Gateway Mode (requires Go backend)
VITE_DNC_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8080
```

For detailed setup instructions, see [docs/dnc/dev-setup.md](./docs/dnc/dev-setup.md)

## 🏗 Backend Integration

See [BACKEND_INTEGRATION_GUIDE.md](./BACKEND_INTEGRATION_GUIDE.md) for detailed instructions on integrating with the Go backend.

## 📋 Requirements

- Node.js 18+ 
- npm 8+
- Modern browser with WebSocket support

## 🔄 Development Workflow

1. Start backend Go server
2. Start frontend dev server: `npm run dev`
3. Make changes and test
4. Build production version: `npm run build`
5. Deploy `dist/` contents to backend static folder

## 📋 Project Status

✅ **Completed Features:**
- Project structure and dependencies
- TypeScript types and interfaces  
- API service with environment configuration
- Zustand state management
- WebSocket real-time data handling with enhanced reliability
- Core UI components (Header, Sidebar, MachineStatusCard, RealTimeChart)
- Dashboard with overview and detail views
- **Machine Management System (Complete)**
  - CRUD operations for machines (Create, Read, Update, Delete)
  - Raspberry Pi device assignment with multiple device support
  - Modal-based management interfaces with validation
  - Clean separation of monitoring (dashboard) vs management (detail pages)
- **Performance-optimized build configuration**
- **Error boundaries for reliability**
- **Code splitting and lazy loading**
- **Optimized bundle chunking (React: 187kB, Charts: 242kB, Vendor: 72kB)**
- Integration documentation
- **WebSocket implementation guide for Go backend**
- **📋 DNC Feeder Integration (Complete Mock Mode)**
  - Monaco-based NC program editor with Heidenhain syntax
  - Code sanitizer with preview and auto-apply modes
  - Real-time transfer monitoring and control
  - Machine-to-Pi device linking with context-aware program sending
  - WebSocket-based progress and logging
  - Complete mock service for hardware-free development

## 🚀 **Performance Optimizations**

### **Build Optimizations:**
- **Manual chunking strategy**: Separates React, charts, data management, and vendor code
- **Code splitting**: Lazy loading of heavy components (MachineStatusCard, RealTimeChart)
- **Asset optimization**: Images, styles, and JS files properly organized
- **Compression**: All bundles are minified and gzipped
- **Modern targets**: ESNext for better performance

### **Runtime Optimizations:**
- **Suspense boundaries**: Loading states for lazy components
- **Error boundaries**: Graceful error handling without app crashes
- **WebSocket reliability**: Enhanced reconnection logic (20 attempts, 3s interval)
- **State management**: Zustand for lightweight, efficient state updates
- **Memory management**: Limited sensor data buffer (100 points per machine)

### **Bundle Analysis:**
```
✓ Main App: 28.46 kB (gzipped: 7.26 kB)
✓ React Core: 187.51 kB (gzipped: 59.16 kB)
✓ Charts: 241.58 kB (gzipped: 68.74 kB)
✓ Data Management: 39.41 kB (gzipped: 15.78 kB)
✓ Vendor: 71.94 kB (gzipped: 25.80 kB)
✓ CSS: 14.73 kB (gzipped: 3.40 kB)
```

🔄 **Integration Requirements:**
- Backend WebSocket implementation (detailed guide provided)
- CORS configuration in Go backend
- Static file serving in Go routes

## 🔍 Troubleshooting

### Build Issues
If you encounter build errors, try:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### API Connection Issues
- Check `VITE_API_BASE_URL` in environment files
- Verify backend CORS configuration
- Ensure backend API is running

## 📁 Build Output

The production build creates a `dist/` directory ready for deployment:
- `index.html` - Main HTML file
- `assets/` - Optimized CSS and JS bundles
- Static assets

This project is part of the Ronelan Industrial Monitoring System.
