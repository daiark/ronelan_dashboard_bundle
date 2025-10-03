import React, { useState } from 'react';
import { useMachineStore } from '../../store/machineStore';
import type { Machine } from '../../types';

interface DeleteMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine;
}

const DeleteMachineModal: React.FC<DeleteMachineModalProps> = ({ isOpen, onClose, machine }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const deleteMachine = useMachineStore(s => s.deleteMachine);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmText !== machine.name) {
      setError('Please enter the machine name exactly as shown to confirm deletion');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteMachine(machine.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete machine');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-accent-red-400">Delete Machine</h2>
          <button 
            onClick={handleClose} 
            className="p-2 rounded hover:bg-dark-700 text-dark-300"
            disabled={isDeleting}
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-accent-red-500 bg-opacity-10 border border-accent-red-500 rounded-lg p-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-accent-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-accent-red-400">Warning</h3>
                <p className="text-sm text-accent-red-300 mt-1">
                  This action cannot be undone. This will permanently delete the machine and remove all associated data.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-dark-700 rounded-lg p-3">
            <h3 className="text-sm font-medium text-dark-300 mb-2">Machine to Delete:</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-dark-400 text-xs">Name:</span>
                <span className="text-dark-200 text-xs font-medium">{machine.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400 text-xs">Location:</span>
                <span className="text-dark-200 text-xs">{machine.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400 text-xs">ID:</span>
                <span className="text-dark-200 text-xs font-mono">{machine.id}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              To confirm, please enter the machine name: <strong>{machine.name}</strong>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:border-accent-red-500 focus:ring-1 focus:ring-accent-red-500"
              placeholder={machine.name}
              disabled={isDeleting}
            />
          </div>

          {error && (
            <div className="bg-accent-red-500 bg-opacity-10 border border-accent-red-500 rounded-lg p-3">
              <p className="text-accent-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm border border-dark-300 rounded-lg hover:bg-dark-700 transition-colors text-dark-300"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm bg-accent-red-500 bg-opacity-20 text-accent-red-400 rounded-lg hover:bg-opacity-30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting || confirmText !== machine.name}
            >
              {isDeleting ? 'Deleting...' : 'Delete Machine'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteMachineModal;
