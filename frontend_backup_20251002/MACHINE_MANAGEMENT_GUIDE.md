# Machine Management System Guide

## Overview

The Ronelan Industrial Monitoring Panel includes a comprehensive machine management system that allows users to create, read, update, and delete CNC machines, as well as assign Raspberry Pi devices for NC program control.

## Architecture

### UX Design Philosophy

The system follows industrial UX best practices by separating **monitoring** from **management**:

- **Dashboard**: Clean, focused monitoring interface without management clutter
- **Machine Detail Pages**: Dedicated management interface with full CRUD capabilities
- **Contextual Actions**: Management features located where they're most relevant

### User Workflow

```
Dashboard (Monitor) → Click Machine → Detail Page (Manage)
                                   ↓
                         - Edit machine properties
                         - Assign/change Pi device  
                         - Send NC programs
                         - Monitor program execution
```

## Features

### 1. Machine CRUD Operations

#### Create Machine
- **Access**: Dashboard → "Add Machine" button (top-right statistics section)
- **Features**: 
  - Form validation with required fields
  - Controller type selection (Heidenhain, Fanuc, Siemens, etc.)
  - Optional Raspberry Pi device assignment
  - Technical specifications (spindle speed, axis count)

#### Read Machine
- **Dashboard View**: Overview cards with key metrics and status
- **Detail View**: Complete machine information with metrics, charts, and management

#### Update Machine
- **Access**: Machine Detail Page → "Edit" button (top-right header)
- **Features**: 
  - Edit all machine properties
  - Change device assignment
  - Update technical specifications
  - Pre-populated form with current values

#### Delete Machine
- **Access**: Machine Detail Page → "Delete" button (top-right header)
- **Features**: 
  - Secure confirmation requiring exact name input
  - Warning about data loss
  - Automatic cleanup of associated data

### 2. Raspberry Pi Device Assignment

#### Device Management
- **Access**: Machine Detail Page → "Device" button or Edit Machine modal
- **Features**: 
  - List all available Pi devices with descriptive names
  - Show device status and last seen information
  - Assign/reassign devices with single-click selection

#### Device Discovery
The system supports multiple Pi devices with descriptive names:
- `rpi-001` - Pi Station A (Floor 1)
- `rpi-002` - Pi Station B (Floor 1)
- `rpi-003` - Pi Station C (Floor 2)
- `rpi-004` - Pi Station D (Floor 2)
- `demo` - Demo Device (Development)

### 3. NC Program Management

#### Program Control
- **Access**: Machine Detail Page → "NC Program Management" section
- **Features**: 
  - Send programs to CNC via assigned Pi device
  - Monitor transfer progress and status
  - Pause/resume/stop program operations
  - View current program status and progress

#### Device Context
- Programs are sent through the assigned Raspberry Pi device
- Machine context (ID, name) passed to DNC feeder interface
- Automatic device selection based on machine assignment

## Technical Implementation

### Frontend Components

#### Modal Components
- **AddMachineModal**: Create new machines with validation
- **EditMachineModal**: Edit existing machines with device reassignment
- **DeleteMachineModal**: Secure deletion with confirmation
- **AssignDeviceModal**: Dedicated Pi device assignment interface

#### Page Integration
- **Dashboard**: AddMachineModal accessible via "Add Machine" button
- **MachineDetailPage**: All management modals integrated in header
- **NCProgramSection**: Full program management in detail pages
- **NCProgramStatus**: Simplified read-only display for dashboard cards

### State Management

#### Machine Store (machineStore.ts)
```typescript
// CRUD Operations
addMachine(machine: Omit<Machine, 'id'>) → Promise<Machine>
updateMachine(machineId: string, updates: Partial<Machine>) → Promise<void>
deleteMachine(machineId: string) → Promise<void>
assignDevice(machineId: string, deviceId: string) → Promise<void>

// Data Persistence
// Preserves manually added machines during mock refresh
// Maintains device assignments across application restarts
```

#### Mock Data Handling
- Preserves user-created machines (IDs starting with 'M-')
- Maintains device assignments in mock mode
- Seamless transition between mock and production data

### API Integration

#### Required Backend Endpoints

**Machine Management**
```
GET    /api/v1/machines           - List all machines
POST   /api/v1/machines           - Create new machine
PUT    /api/v1/machines/{id}      - Update machine
DELETE /api/v1/machines/{id}      - Delete machine
```

**Device Discovery**
```
GET    /api/dnc/devices           - List available Pi devices
```

**DNC Proxy**
```
*      /api/dnc/{deviceId}/v1/*   - Proxy to Pi device
WS     /api/dnc/{deviceId}/v1/ws  - WebSocket to Pi device
```

### Data Models

#### Machine Type
```typescript
interface Machine {
  id: string;
  name: string;
  location: string;
  controller_type: string;
  max_spindle_speed_rpm: number;
  axis_count: number;
  raspberry_pi_device_id?: string;  // Optional Pi assignment
  created_at: string;
  last_updated: string;
}
```

#### DNC Device Type
```typescript
interface DncDevice {
  id: string;
  name?: string;
  base?: string;
  status?: 'connected' | 'disconnected';
  last_seen?: string;
}
```

## User Guide

### Creating a New Machine

1. **Access**: Click "Add Machine" button in dashboard statistics section
2. **Fill Form**: 
   - Enter machine name (required)
   - Specify location (required)
   - Select controller type
   - Set technical specifications
   - Optionally assign Pi device
3. **Save**: Click "Add Machine" to create

### Managing Existing Machines

1. **Navigate**: Click on machine card in dashboard
2. **Edit**: Use "Edit" button in detail page header
3. **Assign Device**: Use "Device" button to link Pi devices
4. **Delete**: Use "Delete" button with confirmation process

### Sending NC Programs

1. **Navigate**: Go to machine detail page
2. **Locate**: Find "NC Program Management" section
3. **Assign Device**: Ensure Pi device is assigned (if not, use "Assign Device")
4. **Send Program**: Click "Send Program" to open DNC feeder with machine context
5. **Monitor**: Track progress and status in real-time

## Development

### Mock Mode Testing

The system includes comprehensive mock data for testing:
- 5 Pi devices with realistic names and locations
- Persistent machine creation and assignment
- Full CRUD operations without backend dependency

### Environment Configuration

```bash
# Mock Mode (default)
VITE_DNC_USE_MOCK=true

# Production Mode
VITE_DNC_USE_MOCK=false
VITE_API_BASE_URL=http://your-backend:8080
```

### Testing Workflows

#### Complete Management Test
1. Create new machine with device assignment
2. Verify machine appears in dashboard
3. Edit machine properties and change device
4. Send NC program through assigned device
5. Delete machine with confirmation

#### Device Assignment Test
1. Create machine without device
2. Assign device through detail page
3. Change device assignment via edit modal
4. Verify device context in DNC feeder

## Production Deployment

### Backend Requirements
- Implement machine CRUD API endpoints
- Set up device discovery service
- Configure DNC proxy to Pi devices
- Ensure proper CORS configuration

### Security Considerations
- Validate all machine data inputs
- Restrict device assignment to authenticated users
- Audit log for machine modifications
- Secure Pi device communication

### Performance Notes
- Machine data cached in Zustand store
- Lazy loading of management modals
- Efficient re-rendering with React optimization
- Minimal dashboard overhead for monitoring focus

## Troubleshooting

### Common Issues

**Machine disappears after creation**
- Solution: Fixed in current version with mock data persistence

**Device assignment not saved**
- Check network connectivity to backend
- Verify API endpoint implementation
- Review browser console for errors

**Modal not opening**
- Ensure React state management is working
- Check for JavaScript errors in console
- Verify modal component imports

### Debug Information

**State Inspection**
Use browser dev tools to inspect Zustand store:
```javascript
// In browser console
window.__ZUSTAND_DEVTOOLS__
```

**API Testing**
Test backend endpoints with curl:
```bash
curl -X GET http://localhost:8080/api/v1/machines
curl -X POST http://localhost:8080/api/v1/machines -d '{"name":"Test"}' -H "Content-Type: application/json"
```

## Support

For technical support or feature requests related to machine management:
1. Check this documentation first
2. Review browser console for errors
3. Test with mock mode to isolate issues
4. Contact development team with specific error details

---

**Document Version**: 1.1.0  
**Last Updated**: January 10, 2025  
**Compatibility**: Ronelan Frontend v1.1.0+
