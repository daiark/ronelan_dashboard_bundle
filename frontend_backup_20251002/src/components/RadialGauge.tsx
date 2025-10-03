import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import { MachineStatus } from '../types'

interface RadialGaugeProps {
  value: number
  max: number
  min?: number
  unit?: string
  label: string
  status?: MachineStatus
}

const RadialGauge = ({ value, max, min = 0, unit, label, status }: RadialGaugeProps) => {
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100)
  
  const getStatusColor = (status?: MachineStatus) => {
    switch (status) {
      case MachineStatus.RUNNING:
        return '#10b981' // accent-green-500
      case MachineStatus.MAINTENANCE:
        return '#f59e0b' // accent-orange-500
      case MachineStatus.ERROR:
        return '#ef4444' // accent-red-500
      case MachineStatus.IDLE:
      default:
        return '#737373' // dark-400
    }
  }

  const data = [
    {
      name: label,
      value: percentage,
      fill: getStatusColor(status),
    },
  ]

  const formatValue = (val: number) => {
    if (val >= 1000) {
      return (val / 1000).toFixed(1) + 'k'
    }
    return val.toFixed(val < 10 ? 1 : 0)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-32 h-32 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            barSize={12}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              fill={getStatusColor(status)}
              background={{ fill: '#404040' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        
        {/* Center value display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-dark-100">
            {formatValue(value)}
          </div>
          {unit && (
            <div className="text-sm text-dark-300 font-medium">
              {unit}
            </div>
          )}
        </div>
      </div>
      
      {/* Label */}
      <div className="text-center">
        <div className="text-lg font-semibold text-dark-100 mb-1">
          {label}
        </div>
        <div className="text-sm text-dark-400">
          {percentage.toFixed(0)}% of {max}{unit}
        </div>
      </div>
    </div>
  )
}

export default RadialGauge
