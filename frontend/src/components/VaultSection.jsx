import React, { useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiCloseLine } from 'react-icons/ri';
import ConfirmModal from './ConfirmModal';

export default function VaultSection({
  title,
  subtitle,
  icon: Icon,
  items = [],
  onAdd,
  onRemove,
  fields = [],
  renderItem
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({});
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onAdd(formData);
      setFormData({});
      setIsAdding(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteIndex === null) return;
    await onRemove(deleteIndex);
    setDeleteIndex(null);
  };

  return (
    <div className="bg-white border border-black rounded-lg p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-black">
        <div className="flex items-center space-x-2.5">
          {Icon && <Icon className="text-lg text-[#0A0A0A]" />}
          <div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
            {subtitle && <p className="text-xs text-[#555555]">{subtitle}</p>}
          </div>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-1 text-xs font-medium bg-black text-white px-2.5 py-1.5 rounded-md hover:bg-[#333333] transition-colors"
          >
            <RiAddLine className="text-sm" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Inline Add Form */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className="my-4 p-4 bg-gray-50 border border-black rounded-md space-y-3 animate-fadeSlideIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#0A0A0A]">Add New Entry</span>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setFormData({});
              }}
              className="text-[#555555] hover:text-[#0A0A0A]"
            >
              <RiCloseLine className="text-base" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.name} className={f.fullWidth ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-[#555555] mb-1">
                  {f.label} {f.required && <span className="text-[#EF4444]">*</span>}
                </label>
                {f.type === 'select' ? (
                  <select
                    value={formData[f.name] || f.options[0]?.value || ''}
                    onChange={(e) => handleInputChange(f.name, e.target.value)}
                    required={f.required}
                    className="w-full text-xs"
                  >
                    {f.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder || ''}
                    value={formData[f.name] || ''}
                    onChange={(e) => handleInputChange(f.name, e.target.value)}
                    required={f.required}
                    className="w-full text-xs"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setFormData({});
              }}
              className="px-3 py-1.5 text-xs border border-black rounded hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 text-xs bg-black text-white rounded hover:bg-[#333333] font-medium disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save to Vault'}
            </button>
          </div>
        </form>
      )}

      {/* Items List */}
      <div className="divide-y divide-gray-100 mt-2">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#555555]">
            No records in this category.
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="py-3 flex items-start justify-between group hover:bg-gray-50/50 px-2 rounded -mx-2 transition-colors"
            >
              <div className="flex-1 pr-4">
                {renderItem ? (
                  renderItem(item)
                ) : (
                  <div>
                    <span className="text-sm font-medium text-[#0A0A0A]">
                      {item.name || item.vaccine || item.procedure || item.condition}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setDeleteIndex(index)}
                title="Remove item"
                className="text-[#555555] hover:text-[#EF4444] p-1 rounded transition-colors"
              >
                <RiDeleteBinLine className="text-base" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteIndex !== null}
        onClose={() => setDeleteIndex(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Health Vault Record"
        message="Are you sure you want to remove this record from your sovereign health vault? This action will be recorded in your immutable audit trail."
        confirmText="Remove Record"
        danger
      />
    </div>
  );
}
