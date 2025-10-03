# Frontend Design Development Guide

## 🎨 Visual Design Development Workflow

### 1. **Development Environment Setup**

**Start the development server for live changes:**
```bash
npm run dev
```
- Visit: `http://localhost:5173`
- **Hot reload**: Changes appear instantly when you save files
- **Browser DevTools**: Inspect elements and test responsive design

### 2. **Design System Architecture**

The application uses a well-structured design system you can easily customize:

#### **Color Scheme (`tailwind.config.js`)**
```javascript
colors: {
  primary: {
    50: '#eff6ff',   // Light blue backgrounds
    500: '#3b82f6',  // Main blue
    600: '#2563eb',  // Buttons, links
    700: '#1d4ed8',  // Hover states
  },
  secondary: {
    50: '#f8fafc',   // Light grays
    200: '#e2e8f0',  // Borders
    600: '#475569',  // Text
    900: '#0f172a',  // Headings
  }
}
```

#### **Component Structure**
```
src/components/
├── Header.tsx          # Top navigation bar
├── Sidebar.tsx         # Machine list navigation
├── MachineStatusCard.tsx # Individual machine cards
├── RealTimeChart.tsx   # Data visualization
└── ErrorBoundary.tsx   # Error handling
```

### 3. **Design Customization Areas**

#### **A. Brand Identity**
**File:** `src/components/Header.tsx`
- Logo/brand mark (currently "R" icon)
- Color scheme
- Typography
- Header layout

**File:** `tailwind.config.js`
- Update color palette
- Add custom fonts
- Define spacing scale

#### **B. Dashboard Layout**
**File:** `src/pages/DashboardPage.tsx`
- Grid layouts
- Card arrangements
- Responsive breakpoints
- Status indicators

#### **C. Machine Cards**
**File:** `src/components/MachineStatusCard.tsx`
- Status indicators
- Metric displays
- Card layouts
- Interactive elements

#### **D. Data Visualization**
**File:** `src/components/RealTimeChart.tsx`
- Chart colors
- Data presentation
- Legend styles
- Tooltips

### 4. **Design Development Process**

#### **Step 1: Design with Mock Data**
Create a mock data provider for design work:

**Create:** `src/utils/mockData.ts`
```typescript
export const mockMachines = [
  {
    id: "CNC-001",
    name: "CNC Machine 1",
    location: "Factory Floor A",
    controller_type: "Fanuc",
    max_spindle_speed_rpm: 12000,
    axis_count: 3,
    created_at: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-01T00:00:00Z"
  },
  // Add more mock machines...
];

export const mockSensorData = [
  {
    machine_id: "CNC-001",
    temperature: 25.5,
    spindle_speed: 8500,
    timestamp: "2024-01-01T12:00:00Z",
    x_pos_mm: 100.5,
    y_pos_mm: 200.3,
    z_pos_mm: 50.1,
    feed_rate_actual: 1200,
    spindle_load_percent: 75,
    machine_state: "running",
    active_program_line: 125,
    total_power_kw: 15.2
  },
  // Add more mock data...
];
```

#### **Step 2: Component-by-Component Design**
Work on one component at a time:

1. **Start with Header**: Brand identity, navigation
2. **Sidebar**: Machine list, filters, search
3. **Dashboard**: Layout, cards, responsive grid
4. **Individual Cards**: Status indicators, metrics
5. **Charts**: Data visualization, colors, legends

#### **Step 3: Responsive Design Testing**
Test on different screen sizes:
- **Desktop**: 1920x1080, 1366x768
- **Tablet**: 1024x768, 768x1024
- **Mobile**: 375x667, 414x896

#### **Step 4: Industrial Theme Considerations**
- **High contrast**: For factory floor visibility
- **Clear status indicators**: Red/green/yellow for machine states
- **Large touch targets**: For industrial touchscreens
- **Minimal distractions**: Focus on critical information

### 5. **Design Tools Integration**

#### **Browser DevTools Workflow**
1. **Open DevTools** (F12)
2. **Toggle device toolbar** for responsive testing
3. **Elements panel**: Inspect and modify styles live
4. **Console**: Check for errors or warnings

#### **Design System Documentation**
Create a style guide as you develop:
- Color usage examples
- Typography scales
- Component states
- Spacing guidelines

### 6. **Customization Examples**

#### **A. Change Color Scheme**
**File:** `tailwind.config.js`
```javascript
// Industrial orange theme
primary: {
  50: '#fff7ed',
  500: '#f97316',  // Orange
  600: '#ea580c',
  700: '#c2410c',
}
```

#### **B. Custom Typography**
```javascript
// Add custom fonts
extend: {
  fontFamily: {
    'industrial': ['Roboto Condensed', 'Arial', 'sans-serif'],
  }
}
```

#### **C. Machine Status Colors**
**File:** `src/components/MachineStatusCard.tsx`
```typescript
const getStatusColor = () => {
  switch (machineState) {
    case 'running': return 'bg-green-500';    // Active green
    case 'idle': return 'bg-yellow-500';      // Warning yellow
    case 'error': return 'bg-red-500';        // Alert red
    case 'maintenance': return 'bg-blue-500'; // Info blue
  }
};
```

### 7. **Advanced Design Features**

#### **A. Dark Mode Support**
```javascript
// In tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1f2937',
          surface: '#374151',
          text: '#f9fafb',
        }
      }
    }
  }
}
```

#### **B. Animation and Transitions**
```css
/* Custom animations for industrial feel */
.machine-pulse {
  animation: pulse 2s infinite;
}

.status-transition {
  transition: all 0.3s ease-in-out;
}
```

#### **C. Custom Icons**
Replace emoji icons with industrial SVG icons:
- Machine status icons
- Alert indicators
- Navigation icons

### 8. **Design Testing Checklist**

#### **Visual Testing**
- [ ] All components render correctly
- [ ] Colors are accessible (contrast ratios)
- [ ] Text is readable at all sizes
- [ ] Icons are clear and meaningful
- [ ] Loading states are smooth

#### **Responsive Testing**
- [ ] Mobile layout works (320px+)
- [ ] Tablet layout is functional
- [ ] Desktop layout is optimized
- [ ] Charts resize properly
- [ ] Navigation adapts to screen size

#### **Industrial Environment Testing**
- [ ] High contrast mode works
- [ ] Touch targets are large enough (44px+)
- [ ] Text is readable from distance
- [ ] Status indicators are immediately clear
- [ ] Critical information is prominent

### 9. **Design Deployment Process**

#### **Development Cycle**
1. **Design** → Make visual changes
2. **Test** → Check in browser (auto-reload)
3. **Iterate** → Refine based on testing
4. **Build** → `npm run build` for production
5. **Deploy** → Copy `dist/` to backend

#### **Design Review Process**
1. **Screenshots**: Document design iterations
2. **User feedback**: Test with actual operators
3. **Accessibility audit**: Ensure compliance
4. **Performance check**: Monitor load times

### 10. **Recommended Design Resources**

#### **Industrial Design Inspiration**
- **Colors**: High contrast industrial palettes
- **Typography**: Clean, readable fonts (Roboto, Inter, Open Sans)
- **Icons**: Industrial/manufacturing icon sets
- **Layouts**: Dashboard design patterns for monitoring

#### **Development Tools**
- **Browser DevTools**: Real-time design testing
- **Responsive design mode**: Device simulation
- **Color contrast checkers**: Accessibility compliance
- **Performance monitoring**: Core Web Vitals

### 11. **Next Steps for Design Development**

1. **Set up development environment** (`npm run dev`)
2. **Create mock data** for realistic testing
3. **Start with color scheme** customization
4. **Work component by component**
5. **Test responsive behavior**
6. **Gather user feedback**
7. **Iterate and refine**

### 12. **Common Design Patterns for Industrial Dashboards**

#### **Status Indicators**
```typescript
// Color-coded status system
const statusConfig = {
  running: { color: 'green', icon: '▶️', pulse: true },
  idle: { color: 'yellow', icon: '⏸️', pulse: false },
  error: { color: 'red', icon: '⚠️', pulse: true },
  maintenance: { color: 'blue', icon: '🔧', pulse: false },
};
```

#### **Metric Cards Layout**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Responsive grid for different screen sizes */}
</div>
```

#### **Industrial Color Palette**
```css
:root {
  --success: #10b981;    /* Machine running */
  --warning: #f59e0b;    /* Attention needed */
  --error: #ef4444;      /* Critical issues */
  --info: #3b82f6;       /* Information */
  --neutral: #6b7280;    /* Secondary info */
}
```

This guide provides a complete framework for design development while maintaining the industrial reliability and performance characteristics already built into the application.
