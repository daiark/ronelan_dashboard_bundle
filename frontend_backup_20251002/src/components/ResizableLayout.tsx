import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizableLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  hasRightPanel: boolean;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  storageKey?: string;
}

const STORAGE_KEY_PREFIX = 'ronelan-layout-';

const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  leftPanel,
  rightPanel,
  hasRightPanel,
  defaultLeftWidth = 60, // percentage
  minLeftWidth = 30,
  maxLeftWidth = 80,
  storageKey = 'dashboard',
}) => {
  // Load saved width from localStorage, fallback to default
  const getInitialWidth = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${storageKey}`);
      if (saved) {
        const parsedWidth = parseFloat(saved);
        if (parsedWidth >= minLeftWidth && parsedWidth <= maxLeftWidth) {
          return parsedWidth;
        }
      }
    }
    return defaultLeftWidth;
  };

  const [leftWidth, setLeftWidth] = useState(getInitialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Apply constraints
    const constrainedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));
    setLeftWidth(constrainedWidth);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${storageKey}`, constrainedWidth.toString());
    }
  }, [isDragging, minLeftWidth, maxLeftWidth, storageKey]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!hasRightPanel) {
    return <div className="h-full w-full">{leftPanel}</div>;
  }

  const rightWidth = 100 - leftWidth;

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Left Panel */}
      <div 
        className="h-full overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* Resizable Divider */}
      <div
        className={`flex-shrink-0 w-1 bg-dark-600 hover:bg-accent-green-500 transition-colors cursor-col-resize relative group ${
          isDragging ? 'bg-accent-green-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* Divider Handle - visible on hover */}
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-3 h-8 bg-dark-600 rounded-full border border-dark-500 flex items-center justify-center">
            <div className="w-0.5 h-4 bg-dark-400 rounded-full mx-0.5"></div>
            <div className="w-0.5 h-4 bg-dark-400 rounded-full mx-0.5"></div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div 
        className="h-full overflow-hidden"
        style={{ width: `${rightWidth}%` }}
      >
        {rightPanel}
      </div>
    </div>
  );
};

export default ResizableLayout;
