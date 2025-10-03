# Progress Bar Examples

## Mock Data Overview

The application now includes realistic mock data to demonstrate the NC Program Progress Bar functionality across different machine states.

## Example Machines

### CNC Machine 1 (CNC-001) - Active Transfer
- **Device**: Pi-Device-001 (Connected)
- **Program**: PART_HOUSING_v2.nc 
- **Status**: RUNNING
- **Progress**: 67.5%
- **Progress Bar**: Green fill showing active block transfer

**Visual Example:**
```
┌─────────────────────────────────────────────────────────┐
│ [Pi-Device-001 🔗] [PART_HOUSING_v2.nc RUNNING] [Feed] │
├─────────────────────────────────────────────────────────┤
│ Block Transfer Progress               67.5%             │
│ [████████████████████████████░░░░░░░░░░░░] 67.5%        │
│      Transferring NC blocks via serial to CNC...       │
└─────────────────────────────────────────────────────────┘
```

### CNC Machine 2 (CNC-002) - Paused Transfer  
- **Device**: Pi-Device-002 (Connected)
- **Program**: BRACKET_ASSEMBLY.h
- **Status**: PAUSED
- **Progress**: 34.2%
- **Progress Bar**: Orange status with pause indicator

**Visual Example:**
```
┌─────────────────────────────────────────────────────────┐
│ [Pi-Device-002 🔗] [BRACKET_ASSEMBLY.h PAUSED] [Feed]  │
├─────────────────────────────────────────────────────────┤
│ Block Transfer Progress               34.2%             │
│ [█████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 34.2%        │
│      Transferring NC blocks via serial to CNC...       │
└─────────────────────────────────────────────────────────┘
```

### CNC Machine 3 (CNC-003) - Device Assigned, No Program
- **Device**: Pi-Device-003 (Disconnected)
- **Program**: None
- **Status**: Device assigned but not connected
- **Display**: Ready state without progress bar

**Visual Example:**
```
┌─────────────────────────────────────────────────────────┐
│ [Pi-Device-003 🔴] [No program loaded]          [Feed] │
└─────────────────────────────────────────────────────────┘
```

### Milling Machine 1 (MILL-001) - No Device Assigned
- **Device**: None assigned
- **Program**: None
- **Status**: Ready for device assignment
- **Display**: Shows assignment needed state

**Visual Example:**
```
┌─────────────────────────────────────────────────────────┐
│ [No device assigned] [No program loaded]        [Feed] │
└─────────────────────────────────────────────────────────┘
```

## Progress Bar Features

### Visual Elements
- **Progress Fill**: Green animated fill showing percentage
- **Percentage Display**: Both numeric and embedded in bar
- **Status Text**: "Transferring NC blocks via serial to CNC controller"
- **State Colors**: 
  - Green: Running transfer
  - Orange: Paused transfer  
  - Red: Error state
  - Gray: Inactive/ready

### Interactive States
- **Running**: Active progress updates
- **Paused**: Progress bar visible but not advancing
- **Error**: Red progress bar with error indication
- **Completed**: 100% fill with completion status

## Technical Implementation

### Mock Data Structure
```typescript
current_program: {
  id: "prog-001",
  name: "PART_HOUSING_v2.nc",
  status: NCProgramStatus.RUNNING,
  progress: 67.5,  // Key field for progress bar
  estimated_duration: 45,
  file_size: 15840
}
```

### Real-Time Updates
In production, progress updates will come from:
1. **heidenhain_sender.py** block transfer tracking
2. **WebSocket events** with progress data  
3. **Backend APIs** reporting transfer state

### Demo Access
To see the progress bar examples:
1. Start the development server: `npm run dev`
2. Navigate to machine detail pages:
   - CNC Machine 1: Active 67.5% progress
   - CNC Machine 2: Paused 34.2% progress  
   - CNC Machine 3: Device assigned, no program
   - Milling Machine 1: No device assigned

The progress bars demonstrate the full range of states and provide a realistic preview of the block transfer monitoring functionality.