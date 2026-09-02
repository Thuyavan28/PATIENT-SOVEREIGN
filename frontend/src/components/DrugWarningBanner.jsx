import React from 'react';
import { RiAlertLine, RiCheckboxCircleLine } from 'react-icons/ri';

export default function DrugWarningBanner({ warnings }) {
  if (!warnings) return null;

  const interactions = warnings.interactions || [];
  const allergyConflicts = warnings.allergy_conflicts || [];
  const isSafe = warnings.safe === true && interactions.length === 0 && allergyConflicts.length === 0;

  if (isSafe) {
    return (
      <div className="bg-green-50/70 border border-[#16A34A] rounded-lg p-4 my-4 flex items-start space-x-3">
        <RiCheckboxCircleLine className="text-[#16A34A] text-xl shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-[#16A34A]">
            AI Clinical Analysis: No Known Conflicts
          </h4>
          <p className="text-xs text-[#555555] mt-0.5">
            Prescription verified against patient's current medications and known allergies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-[#F59E0B] rounded-lg p-5 my-4">
      <div className="flex items-start space-x-3">
        <RiAlertLine className="text-[#F59E0B] text-2xl shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0A0A0A]">
              Clinical Drug Safety Warnings Detected
            </h4>
            <span className="text-[11px] font-medium bg-[#F59E0B] text-white px-2 py-0.5 rounded">
              Clinical Review Recommended
            </span>
          </div>

          {/* Allergy conflicts */}
          {allergyConflicts.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="text-xs font-semibold text-[#EF4444] uppercase tracking-wide block">
                Allergy Cross-Reactivity Conflicts:
              </span>
              {allergyConflicts.map((c, idx) => (
                <div key={idx} className="bg-white border border-red-200 rounded p-2.5 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[#0A0A0A]">{c.drug}</span>
                    <span className="text-[#555555]">conflicts with patient allergy</span>
                    <span className="font-semibold text-[#EF4444] bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      {c.allergy}
                    </span>
                  </div>
                  <p className="text-[#555555] mt-1 text-[11px] leading-relaxed">
                    {c.reason}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Drug interactions */}
          {interactions.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide block">
                Drug-Drug Interactions:
              </span>
              {interactions.map((i, idx) => (
                <div key={idx} className="bg-white border border-amber-200 rounded p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#0A0A0A]">
                      {Array.isArray(i.drugs) ? i.drugs.join(' + ') : i.drug}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        i.severity === 'high'
                          ? 'bg-red-100 text-[#EF4444]'
                          : 'bg-amber-100 text-[#F59E0B]'
                      }`}
                    >
                      {i.severity} severity
                    </span>
                  </div>
                  <p className="text-[#555555] mt-1 text-[11px] leading-relaxed">
                    {i.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
