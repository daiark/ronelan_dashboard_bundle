import React, { useState, useEffect } from 'react';
import { useMachineStore } from '../../store/machineStore';
import { listDncDevices } from '../../config/dnc';
import type { Machine } from '../../types';

interface EditMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine;
}

const EditMachineModal: React.FC<EditMachineModalProps> = ({ isOpen, onClose, machine }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    controller_type: 'Heidenhain',
    max_spindle_speed_rpm: 8000,
    axis_count: 3,
    raspberry_pi_device_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMachine = useMachineStore(s => s.updateMachine);
  const devices = listDncDevices();

  // Initialize form with machine data
  useEffect(() => {
    if (machine && isOpen) {
      setFormData({
        name: machine.name,
        location: machine.location,
        controller_type: machine.controller_type,
        max_spindle_speed_rpm: machine.max_spindle_speed_rpm,
        axis_count: machine.axis_count,
        raspberry_pi_device_id: machine.raspberry_pi_device_id || '',
      });
      setError(null);
    }
  }, [machine, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Machine name is required');
      return;
    }

    if (!formData.location.trim()) {
      setError('Machine location is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: Partial<Machine> = {
        name: formData.name.trim(),
        location: formData.location.trim(),
        controller_type: formData.controller_type,
        max_spindle_speed_rpm: formData.max_spindle_speed_rpm,
        axis_count: formData.axis_count,
        raspberry_pi_device_id: formData.raspberry_pi_device_id || undefined,
        last_updated: new Date().toISOString(),
      };

      await updateMachine(machine.id, updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update machine');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg overflow-hidden">
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dark-100">Edit Machine</h2>
          <button 
            onClick={handleClose} 
            className="p-2 rounded hover:bg-dark-700 text-dark-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-accent-red-500 bg-opacity-10 border border-accent-red-500 rounded-lg p-3">
              <p className="text-accent-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Machine Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:border-accent-blue-500 focus:ring-1 focus:ring-accent-blue-500"
                placeholder="e.g., CNC Machine 1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Location *
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:border-accent-blue-500 focus:ring-1 focus:ring-accent-blue-500"
                placeholder="e.g., Factory Floor A"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Controller Type
              </label>
              <select
                value={formData.controller_type}
                onChange={(e) => setFormData(prev => ({ ...prev, controller_type: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:border-accent-blue-500 focus:ring-1 focus:ring-accent-blue-500"
              >
                <option value="Heidenhain">Heidenhain</option>
                <option value="Fanuc">Fanuc</option>
                <option value="Siemens">Siemens</option>
                <option value="Haas">Haas</option>
                <option value="Mazak">Mazak</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Raspberry Pi Device
              </label>
              <select
                value={formData.raspberry_pi_device_id}
                onChange={(e) => setFormData(prev => ({ ...prev, raspberry_pi_device_id: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:border-accent-blue-500 focus:ring-1 focus:ring-accent-blue-500"
              >
                <option value="">No Device Assigned</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.id} {device.name && `- ${device.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Max Spindle Speed (RPM)
              </label>
              <input
                type="number"
                value={formData.max_spindle_speed_rpm}
                onChange={(e) => setFormData(prev => ({ ...prev, max_spindle_speed_rpm: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:border-accent-blue-500 focus:ring-1 focus:ring-accent-blue-500"
                min="0"
                max="50000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Number of Axes
              </label>
              <input
                type="number"
                value={formData.axis_count}
                onChange={(e) => setFormData(prev => ({ ...prev, axis_count: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:border-accent-blue-500 focus:ring-1 focus:ring-accent-blue-500"
                min="1"
                max="9"
              />
            </div>
          </div>

          {/* Machine Info Display */}
          <div className="bg-dark-700 rounded-lg p-3 mt-4">
            <h3 className="text-sm font-medium text-dark-300 mb-2">Machine Information</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-dark-400">ID:</span>
                <span className="text-dark-200 ml-2 font-mono">{machine.id}</span>
              </div>
              <div>
                <span className="text-dark-400">Created:</span>
                <span className="text-dark-200 ml-2">
                  {new Date(machine.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm border border-dark-300 rounded-lg hover:bg-dark-700 transition-colors text-dark-300"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-accent-blue-500 bg-opacity-20 text-accent-blue-400 rounded-lg hover:bg-opacity-30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMachineModal;
