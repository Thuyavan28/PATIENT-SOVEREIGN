import React from 'react';
import { RiArrowRightUpLine, RiArrowRightDownLine } from 'react-icons/ri';

export default function StatsCard({
  title,
  value,
  subtitle,
  trend = 'up',
  variant = 'neutral' // 'neutral' | 'positive' | 'negative' | 'warning'
}) {
  let valueColor = 'text-[#0A0A0A]';
  let trendIcon = <RiArrowRightUpLine className="text-sm text-[#555555]" />;

  if (variant === 'positive') {
    valueColor = 'text-[#16A34A]';
    trendIcon = <RiArrowRightUpLine className="text-sm text-[#16A34A]" />;
  } else if (variant === 'negative') {
    valueColor = 'text-[#EF4444]';
    trendIcon = <RiArrowRightDownLine className="text-sm text-[#EF4444]" />;
  } else if (variant === 'warning') {
    valueColor = 'text-[#F59E0B]';
    trendIcon = <RiArrowRightUpLine className="text-sm text-[#F59E0B]" />;
  }

  return (
    <div className="bg-white border border-black rounded-2xl p-6 shadow-none hover:border-black transition-all duration-150 flex flex-col justify-between min-h-[140px] font-sans">
      {/* Card heading: Inter Medium / 500 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#555555] tracking-wide font-sans">
          {title}
        </span>
        {trendIcon}
      </div>

      {/* Numbers: Inter Bold / 700 (NOT monospace) */}
      <div className="my-2">
        <span className={`text-3xl font-bold font-sans tracking-tight ${valueColor}`}>
          {value}
        </span>
      </div>

      {/* Subtitle: Inter Regular / 400 */}
      {subtitle && (
        <p className="text-[11px] font-normal text-[#777777] leading-tight font-sans">
          {subtitle}
        </p>
      )}
    </div>
  );
}
