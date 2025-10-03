import React from 'react';
import { useDncStore } from '../../store/dncStore';

const SerialConfigPanel: React.FC = () => {
  const { ports, config, saveConfig } = useDncStore();

  if (!config) return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
      <div className="text-dark-300">Loading configuration...</div>
    </div>
  );

  const onChange = (field: string, value: unknown) => {
    saveConfig({
      ...config,
      serial: { ...config.serial, [field]: value },
    });
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
      <div className="text-dark-100 font-semibold">Serial Configuration</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-dark-400 text-sm mb-1">Port</label>
          <select className="w-full bg-dark-700 text-dark-100 rounded px-3 py-2"
            value={config.serial.port}
            onChange={(e) => onChange('port', e.target.value)}
          >
            {ports.map(p => (
              <option key={p.device} value={p.device}>{p.device} {p.description ? `— ${p.description}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-dark-400 text-sm mb-1">Baud</label>
          <input type="number" className="w-full bg-dark-700 text-dark-100 rounded px-3 py-2" value={config.serial.baud}
            onChange={(e) => onChange('baud', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-dark-400 text-sm mb-1">Data bits</label>
          <select className="w-full bg-dark-700 text-dark-100 rounded px-3 py-2"
            value={config.serial.bytesize}
            onChange={(e) => onChange('bytesize', Number(e.target.value))}
          >
            <option value={7}>7</option>
            <option value={8}>8</option>
          </select>
        </div>
        <div>
          <label className="block text-dark-400 text-sm mb-1">Parity</label>
          <select className="w-full bg-dark-700 text-dark-100 rounded px-3 py-2"
            value={config.serial.parity}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('parity', e.target.value as 'N' | 'E' | 'O' | 'M' | 'S')}
          >
            <option value="N">N</option>
            <option value="E">E</option>
            <option value="O">O</option>
            <option value="M">M</option>
            <option value="S">S</option>
          </select>
        </div>
        <div>
          <label className="block text-dark-400 text-sm mb-1">Stop bits</label>
          <select className="w-full bg-dark-700 text-dark-100 rounded px-3 py-2"
            value={config.serial.stopbits}
            onChange={(e) => onChange('stopbits', Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-dark-400 text-sm">RTS/CTS</label>
          <input type="checkbox" checked={config.serial.rtscts} onChange={(e) => onChange('rtscts', e.target.checked)} />
          <label className="text-dark-400 text-sm ml-4">XON/XOFF</label>
          <input type="checkbox" checked={config.serial.xonxoff} onChange={(e) => onChange('xonxoff', e.target.checked)} />
        </div>
      </div>
    </div>
  );
};

export default SerialConfigPanel;

