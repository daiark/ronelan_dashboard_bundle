import React, { useMemo, useState, useEffect } from 'react';
import { useMachineStore } from '../../store/machineStore';
import TimeSeriesDataGraph from '../TimeSeriesDataGraph';
import ChartLegend from '../charts/ChartLegend';
import { AVAILABLE_DATA_SOURCES, getEnabledDataSources } from '../../types/chartDataSources';
import type { ChartDataSource } from '../../types/chartDataSources';

interface TimeSeriesPanelProps {
  data?: any[];
  height?: number;
}

const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({ data, height = 400 }) => {
  const { sensorData } = useMachineStore();
  
  // State for managing which data sources are enabled
  const [dataSources, setDataSources] = useState<ChartDataSource[]>(() => {
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem('chartDataSources');
      if (saved) {
        const savedSources = JSON.parse(saved) as ChartDataSource[];
        // Merge with current available sources to handle new additions
        return AVAILABLE_DATA_SOURCES.map(source => {
          const savedSource = savedSources.find(s => s.id === source.id);
          return savedSource ? { ...source, enabled: savedSource.enabled } : source;
        });
      }
    } catch (error) {
      console.warn('Failed to load chart preferences from localStorage:', error);
    }
    return [...AVAILABLE_DATA_SOURCES];
  });
  
  // Save to localStorage whenever dataSources changes
  useEffect(() => {
    try {
      localStorage.setItem('chartDataSources', JSON.stringify(dataSources));
    } catch (error) {
      console.warn('Failed to save chart preferences to localStorage:', error);
    }
  }, [dataSources]);
  
  // Get only enabled data sources
  const enabledDataSources = useMemo(() => {
    return getEnabledDataSources(dataSources);
  }, [dataSources]);
  
  // Toggle data source enabled state
  const handleToggleDataSource = (sourceId: string) => {
    setDataSources(prev => 
      prev.map(source => 
        source.id === sourceId 
          ? { ...source, enabled: !source.enabled }
          : source
      )
    );
  };

  // Get combined sensor data from all machines for the chart - memoized for performance
  const combinedSensorData = useMemo(() => {
    // If specific data is passed as props, use that instead of store data
    if (data && data.length > 0) {
      return data.slice(-50);
    }
    
    const allData = Object.values(sensorData || {}).flat();
    allData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return allData.slice(-50);
  }, [sensorData, data]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col">
          <div className="flex-1 mb-2">
            <TimeSeriesDataGraph 
              data={combinedSensorData}
              enabledDataSources={enabledDataSources}
              height={height}
              showLegend={false}
            />
          </div>
          
          <div className="flex-shrink-0">
            <ChartLegend 
              dataSources={dataSources}
              onToggleDataSource={handleToggleDataSource}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSeriesPanel;
