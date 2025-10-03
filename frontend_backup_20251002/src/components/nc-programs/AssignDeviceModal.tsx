import React, { useState } from 'react';
import { useMachineStore } from '../../store/machineStore';
import { listDncDevices } from '../../config/dnc';

interface AssignDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: string;
  machineName?: string;
  currentDeviceId?: string;
}

const AssignDeviceModal: React.FC<AssignDeviceModalProps> = ({
  isOpen,
  onClose,
  machineId,
  machineName,
  currentDeviceId,
}) => {
  const devices = listDncDevices();
  const [selected, setSelected] = useState<string | undefined>(currentDeviceId);
  const assignDevice = useMachineStore(s => s.assignDevice);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (selected) {
      await assignDevice(machineId, selected);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dark-100">Assign Device</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-dark-700 text-dark-300">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-dark-400">Assign a Raspberry Pi DNC device to <span className="text-dark-100 font-medium">{machineName || machineId}</span></p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {devices.map(d => (
              <label key={d.id} className={`flex items-center justify-between p-2 rounded border cursor-pointer ${selected === d.id ? 'border-accent-blue-500 bg-accent-blue-500 bg-opacity-10' : 'border-dark-600 hover:border-dark-500'}`}>
                <div>
                  <div className="text-dark-100 font-medium">{d.id}</div>
                  {d.name && <div className="text-xs text-dark-400">{d.name}</div>}
                </div>
                <input type="radio" name="device" checked={selected === d.id} onChange={() => setSelected(d.id)} />
              </label>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-dark-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded bg-dark-700 hover:bg-dark-600 text-dark-200">Cancel</button>
          <button onClick={handleSave} disabled={!selected} className="px-3 py-2 rounded bg-accent-green-500 bg-opacity-20 text-accent-green-400 hover:bg-opacity-30 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
};

export default AssignDeviceModal;

