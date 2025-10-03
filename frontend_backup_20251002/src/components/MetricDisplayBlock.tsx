interface MetricDisplayBlockProps {
  label: string
  value: string | number
  unit?: string
  status?: 'normal' | 'warning' | 'critical'
  trend?: 'up' | 'down' | 'stable'
}

const MetricDisplayBlock = ({ label, value, unit, status = 'normal', trend }: MetricDisplayBlockProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'warning':
        return 'text-accent-orange-400'
      case 'critical':
        return 'text-accent-red-400'
      case 'normal':
      default:
        return 'text-accent-green-400'
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return (
          <svg className="w-4 h-4 text-accent-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        )
      case 'down':
        return (
          <svg className="w-4 h-4 text-accent-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )
      case 'stable':
        return (
          <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 hover:border-dark-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wide">
          {label}
        </h3>
        {trend && (
          <div className="flex items-center">
            {getTrendIcon()}
          </div>
        )}
      </div>
      
      <div className="flex items-end space-x-1">
        <span className={`text-3xl font-bold ${getStatusColor()}`}>
          {value}
        </span>
        {unit && (
          <span className="text-lg text-dark-400 font-medium pb-1">
            {unit}
          </span>
        )}
      </div>
      
      {/* Optional status indicator */}
      {status !== 'normal' && (
        <div className="mt-2 flex items-center">
          <div 
            className={`w-2 h-2 rounded-full mr-2 ${
              status === 'warning' ? 'bg-accent-orange-400' : 'bg-accent-red-400'
            }`}
          />
          <span className="text-xs text-dark-400 uppercase tracking-wide">
            {status}
          </span>
        </div>
      )}
    </div>
  )
}

export default MetricDisplayBlock
