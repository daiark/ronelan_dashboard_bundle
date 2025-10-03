import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  title: string;
  onRemove: () => void;
  minHeight?: number;
  defaultHeight?: number;
  maxHeight?: number;
  autoHeight?: boolean;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  title,
  onRemove,
  minHeight = 200,
  defaultHeight = 400,
  maxHeight = 800,
  autoHeight = true,
}) => {
  const [height, setHeight] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [isManuallyResized, setIsManuallyResized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  // Auto-calculate content height
  const calculateContentHeight = useCallback(() => {
    if (!autoHeight || isManuallyResized || !contentRef.current) return;
    
    // Get the natural height of the content by temporarily removing height constraint
    const contentElement = contentRef.current;
    const originalHeight = contentElement.style.height;
    const originalOverflow = contentElement.style.overflow;
    const originalMaxHeight = contentElement.style.maxHeight;
    
    // Temporarily set height to auto to measure natural height
    contentElement.style.height = 'auto';
    contentElement.style.maxHeight = 'none';
    contentElement.style.overflow = 'visible';
    
    // Force a reflow to get accurate measurements
    void contentElement.offsetHeight;
    
    const contentHeight = contentElement.scrollHeight;
    const headerHeight = 73; // Header height in pixels
    const marginBuffer = 20; // Add some buffer for better appearance
    const totalHeight = contentHeight + headerHeight + marginBuffer;
    
    // Restore original styles
    contentElement.style.height = originalHeight;
    contentElement.style.maxHeight = originalMaxHeight;
    contentElement.style.overflow = originalOverflow;
    
    // Apply constraints
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, totalHeight));
    setHeight(constrainedHeight);
  }, [autoHeight, isManuallyResized, minHeight, maxHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setIsManuallyResized(true); // Mark as manually resized
    startY.current = e.clientY;
    startHeight.current = height;
  }, [height]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = e.clientY - startY.current;
    const newHeight = startHeight.current + deltaY;
    
    // Apply constraints
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    setHeight(constrainedHeight);
  }, [isDragging, minHeight, maxHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
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

  // Auto-calculate height when content changes
  useEffect(() => {
    // Immediate calculation for static content
    const immediateTimer = setTimeout(() => {
      calculateContentHeight();
    }, 50);
    
    // Delayed calculation for complex components (charts, etc.)
    const delayedTimer = setTimeout(() => {
      calculateContentHeight();
    }, 300);

    return () => {
      clearTimeout(immediateTimer);
      clearTimeout(delayedTimer);
    };
  }, [children, calculateContentHeight]);

  // Additional check for when content elements finish loading (images, charts, etc.)
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const observer = new ResizeObserver(() => {
      if (!isManuallyResized) {
        // Debounce the calculation
        const timer = setTimeout(() => {
          calculateContentHeight();
        }, 100);
        return () => clearTimeout(timer);
      }
    });

    observer.observe(contentElement);
    return () => observer.disconnect();
  }, [calculateContentHeight, isManuallyResized]);

  // Also calculate on mount and resize
  useEffect(() => {
    const handleResize = () => {
      if (!isManuallyResized) {
        calculateContentHeight();
      }
    };

    window.addEventListener('resize', handleResize);
    calculateContentHeight(); // Initial calculation

    return () => window.removeEventListener('resize', handleResize);
  }, [calculateContentHeight, isManuallyResized]);

  return (
    <div 
      ref={panelRef}
      className="relative bg-dark-800 border border-dark-700 rounded-xl mb-4"
      style={{ height: `${height}px` }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800 rounded-t-xl">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-dark-100">{title}</h3>
        </div>
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-dark-700 text-dark-400 hover:text-dark-100 transition-colors"
          title="Remove panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Panel Content */}
      <div 
        ref={contentRef}
        className="p-4 overflow-auto"
        style={{ height: `${height - 73}px` }} // Subtract header height (73px)
      >
        {children}
      </div>

      {/* Resize Handle - always show for individual resizing */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-2 cursor-row-resize group flex items-center justify-center ${
          isDragging ? 'bg-accent-green-500' : 'hover:bg-accent-green-600'
        } transition-colors`}
        onMouseDown={handleMouseDown}
      >
        {/* Resize Handle Visual Indicator */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center justify-center w-8 h-1 bg-dark-600 rounded-full border border-dark-500">
            <div className="flex space-x-0.5">
              <div className="w-1 h-0.5 bg-dark-400 rounded-full"></div>
              <div className="w-1 h-0.5 bg-dark-400 rounded-full"></div>
              <div className="w-1 h-0.5 bg-dark-400 rounded-full"></div>
            </div>
          </div>
        </div>
        
        {/* Extended hit area */}
        <div className="absolute -top-2 -bottom-2 left-0 right-0"></div>
      </div>
      
      {/* Height indicator during drag */}
      {isDragging && (
        <div className="absolute top-2 right-2 bg-dark-900 border border-dark-600 rounded px-2 py-1 text-xs text-dark-300 pointer-events-none z-10">
          {height}px
        </div>
      )}
    </div>
  );
};

export default ResizablePanel;
