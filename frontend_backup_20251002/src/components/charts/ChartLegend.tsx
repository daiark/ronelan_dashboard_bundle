import React from 'react';
import type { ChartDataSource } from '../../types/chartDataSources';

interface ChartLegendProps {
  dataSources: ChartDataSource[];
  onToggleDataSource: (sourceId: string) => void;
}

const ChartLegend: React.FC<ChartLegendProps> = ({ 
  dataSources, 
  onToggleDataSource
}) => {
  const enabledCount = dataSources.filter(source => source.enabled).length;
  
  return (
    <div className="chart-legend bg-dark-800 rounded-lg border border-dark-700 p-3">
      <div className="flex flex-wrap gap-2">
        {dataSources.map(source => (
          <button
            key={source.id}
            onClick={() => onToggleDataSource(source.id)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs transition-all duration-200 border ${
              source.enabled 
                ? 'bg-opacity-15 text-white border-opacity-30 hover:bg-opacity-25' 
                : 'bg-dark-700 text-dark-400 hover:text-dark-200 hover:bg-dark-600 border-dark-600'
            }`}
            style={{ 
              backgroundColor: source.enabled ? source.color + '26' : undefined,
              borderColor: source.enabled ? source.color + '4D' : undefined
            }}
          >
            <span 
              className="w-3 h-3 rounded-full border-2 border-white border-opacity-20" 
              style={{ backgroundColor: source.color }}
            />
            <span className="font-medium">{source.label}</span>
            <span className="text-dark-500 text-xs">({source.unit})</span>
            {source.enabled && (
              <svg className="w-3 h-3 text-white opacity-70" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>
      
      {enabledCount === 0 && (
        <div className="text-center py-2 text-dark-400 bg-dark-700 rounded-md">
          <svg className="w-5 h-5 mx-auto mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.05 6.05M9.878 9.878a3 3 0 00-.007 4.243m4.242-4.242L16.95 6.05m-7.072 7.072l4.243 4.243m0 0L6.05 16.121" />
          </svg>
          <p className="text-sm mb-1">No sensors selected</p>
          <p className="text-xs opacity-75">Select sensors to display on chart</p>
        </div>
      )}
    </div>
  );
};

export default ChartLegend;