import React, { useState, useEffect } from 'react';
import { toast } from '../lib/toast';
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiAlertLine,
  RiInformationLine,
  RiCloseLine
} from 'react-icons/ri';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe(({ action, item, id }) => {
      if (action === 'add') {
        setToasts((prev) => [...prev, item]);
      } else if (action === 'remove') {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }
    });
    return unsubscribe;
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-md w-full pointer-events-none">
      {toasts.map((t) => {
        let borderClass = 'border-[#D0D0D0]';
        let icon = <RiInformationLine className="text-[#0A0A0A] text-lg shrink-0 mt-0.5" />;

        if (t.type === 'success') {
          borderClass = 'border-[#16A34A]';
          icon = <RiCheckboxCircleLine className="text-[#16A34A] text-lg shrink-0 mt-0.5" />;
        } else if (t.type === 'error') {
          borderClass = 'border-[#EF4444]';
          icon = <RiErrorWarningLine className="text-[#EF4444] text-lg shrink-0 mt-0.5" />;
        } else if (t.type === 'warning') {
          borderClass = 'border-[#F59E0B]';
          icon = <RiAlertLine className="text-[#F59E0B] text-lg shrink-0 mt-0.5" />;
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between bg-white border ${borderClass} shadow-md rounded-lg p-3.5 transition-all transform duration-200 animate-fadeSlideIn`}
          >
            <div className="flex items-start space-x-2.5">
              {icon}
              <div className="text-sm font-medium text-[#0A0A0A] leading-snug">
                {t.message}
              </div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[#555555] hover:text-[#0A0A0A] ml-3 p-0.5"
            >
              <RiCloseLine className="text-base" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
