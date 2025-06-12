import React from 'react';

export function Slider({
  value = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  disabled = false,
  ...props
}) {
  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    onValueChange?.([newValue]);
  };

  const currentValue = value[0] || 0;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                   disabled:opacity-50 disabled:cursor-not-allowed
                   slider-thumb"
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #4b5563 ${percentage}%, #4b5563 100%)`
        }}
        {...props}
      />
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          border: 2px solid white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          border: 2px solid white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider-thumb:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 2px #3b82f6;
        }
        
        .slider-thumb:focus::-moz-range-thumb {
          box-shadow: 0 0 0 2px #3b82f6;
        }
      `}</style>
    </div>
  );
}

export default Slider;
