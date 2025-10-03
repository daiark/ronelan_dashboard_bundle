import React from 'react';

interface HeaderProps {
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="bg-dark-800 shadow-sm border-b border-dark-700">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-accent-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            {title && <h1 className="text-xl font-bold text-dark-100">{title}</h1>}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-dark-300">Live</span>
            </div>
            <div className="text-sm text-dark-300">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
