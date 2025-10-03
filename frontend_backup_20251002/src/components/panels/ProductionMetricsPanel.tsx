import React from 'react';

interface ProductionOrderProps {
  orderId: string;
  completed: number;
  total: number;
  status: 'active' | 'completed' | 'paused';
}

const ProductionOrder: React.FC<ProductionOrderProps> = ({ orderId, completed, total, status }) => {
  const percentage = (completed / total) * 100;
  
  const statusColors = {
    active: 'bg-accent-green-500',
    completed: 'bg-accent-green-600',
    paused: 'bg-accent-orange-500'
  };

  return (
    <div className="bg-dark-700 rounded-lg border border-dark-600 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-dark-100">Order {orderId}</div>
          <div className="text-xs text-dark-400 capitalize">{status}</div>
        </div>
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`}></div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-dark-300">Progress</span>
          <span className="text-dark-100 font-medium">{completed}/{total}</span>
        </div>
        
        <div className="w-full bg-dark-600 rounded-full h-1.5">
          <div 
            className="bg-accent-green-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        
        <div className="text-xs text-dark-400">
          {percentage.toFixed(1)}% Complete
        </div>
      </div>
    </div>
  );
};

const ProductionMetricsPanel: React.FC = () => {
  // Mock production data
  const totalProduction = 847;
  const targetProduction = 1000;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-dark-100">Production Overview</h3>
        <div className="text-xs text-accent-green-400 bg-accent-green-500 bg-opacity-20 px-2 py-1 rounded">
          Active
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-auto">
        {/* Daily Production Progress */}
        <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-dark-100">Daily Production</div>
            <div className="text-xs text-accent-green-400 bg-accent-green-500 bg-opacity-20 px-2 py-1 rounded">
              Active
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-2xl font-bold text-dark-100">{totalProduction}</span>
              <span className="text-sm text-dark-400">/ {targetProduction} parts</span>
            </div>
            
            <div className="w-full bg-dark-600 rounded-full h-3">
              <div 
                className="bg-accent-green-500 h-3 rounded-full transition-all duration-1000"
                style={{ width: `${(totalProduction / targetProduction) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-dark-400">
              <span>{((totalProduction / targetProduction) * 100).toFixed(1)}% of target</span>
              <span>ETA: 2h 15m</span>
            </div>
          </div>
        </div>

        {/* Production Orders */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-dark-200">Active Orders</h4>
          
          <div className="grid gap-2">
            <ProductionOrder
              orderId="PO-2024-001"
              completed={245}
              total={300}
              status="active"
            />
            
            <ProductionOrder
              orderId="PO-2024-002"
              completed={602}
              total={700}
              status="active"
            />
            
            <ProductionOrder
              orderId="PO-2024-003"
              completed={150}
              total={150}
              status="completed"
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600">
            <div className="text-xs text-dark-400">Uptime</div>
            <div className="text-lg font-bold text-accent-green-400">98.5%</div>
          </div>
          
          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600">
            <div className="text-xs text-dark-400">Quality</div>
            <div className="text-lg font-bold text-accent-green-400">99.2%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionMetricsPanel;
