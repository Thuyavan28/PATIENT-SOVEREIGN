import React from 'react';
import { RiAlertLine, RiShieldCrossLine } from 'react-icons/ri';

export default function FraudFlagBanner({ flags }) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="bg-red-50 border border-[#EF4444] rounded-lg p-4 my-4">
      <div className="flex items-start space-x-3">
        <RiShieldCrossLine className="text-[#EF4444] text-2xl shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#EF4444]">
              Fraud Detection Rules Triggered ({flags.length})
            </h4>
            <span className="text-[10px] font-bold uppercase bg-[#EF4444] text-white px-2 py-0.5 rounded">
              Flagged in Audit Log
            </span>
          </div>

          <div className="mt-2 space-y-1.5">
            {flags.map((flag, idx) => (
              <div
                key={idx}
                className="text-xs bg-white border border-red-200 rounded p-2 flex items-start justify-between"
              >
                <div>
                  <span className="font-mono font-bold text-[#0A0A0A] mr-2">
                    {flag.rule || flag.rule_triggered}
                  </span>
                  <span className="text-[#555555]">
                    {flag.details?.message || JSON.stringify(flag.details)}
                  </span>
                </div>
                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                    flag.severity === 'high'
                      ? 'bg-red-100 text-[#EF4444]'
                      : 'bg-amber-100 text-[#F59E0B]'
                  }`}
                >
                  {flag.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
