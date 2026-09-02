import React, { useRef, useEffect } from 'react';

export default function PinInput({
  value = '',
  onChange,
  error = false,
  errorMessage = 'Incorrect PIN',
  disabled = false,
  autoFocus = false
}) {
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Convert incoming string value to 4 chars array
  const digits = [
    value[0] || '',
    value[1] || '',
    value[2] || '',
    value[3] || ''
  ];

  useEffect(() => {
    if (autoFocus && inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e, index) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const combined = newDigits.join('');
    onChange(combined);

    if (char && index < 3 && inputRefs[index + 1].current) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs[index - 1].current) {
        inputRefs[index - 1].current.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1].current.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasteData) {
      onChange(pasteData);
      const targetIndex = Math.min(pasteData.length, 3);
      if (inputRefs[targetIndex].current) {
        inputRefs[targetIndex].current.focus();
      }
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`flex items-center space-x-3 ${error ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((idx) => (
          <input
            key={idx}
            ref={inputRefs[idx]}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digits[idx]}
            disabled={disabled}
            onChange={(e) => handleChange(e, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onPaste={handlePaste}
            className={`w-12 h-12 text-center text-xl font-mono rounded-md border transition-all duration-150 ${
              error
                ? 'border-[#EF4444] text-[#EF4444] bg-red-50/20 focus:border-[#EF4444]'
                : 'border-black text-[#0A0A0A] bg-white focus:border-[#000000]'
            } disabled:opacity-50`}
          />
        ))}
      </div>
      {error && (
        <span className="text-xs text-[#EF4444] font-medium mt-2">
          {typeof error === 'string' ? error : errorMessage}
        </span>
      )}
    </div>
  );
}
