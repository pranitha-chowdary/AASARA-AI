import React from 'react';

interface AasaraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AasaraLogo({ size = 'md', className = '' }: AasaraLogoProps) {
  const sizeMap = {
    sm: 80,
    md: 120,
    lg: 160,
    xl: 240,
  };

  const dimension = sizeMap[size];

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="workerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ECCA3" />
          <stop offset="100%" stopColor="#1F4E5A" />
        </linearGradient>
      </defs>

      {/* Circular background */}
      <circle cx="100" cy="100" r="95" fill="none" stroke="url(#workerGradient)" strokeWidth="2" opacity="0.3" />

      {/* Delivery Worker on Bike */}
      <g>
        {/* Bike Frame - Left */}
        <line x1="60" y1="90" x2="80" y2="130" stroke="url(#workerGradient)" strokeWidth="3" strokeLinecap="round" />
        
        {/* Bike Frame - Right */}
        <line x1="120" y1="90" x2="100" y2="130" stroke="url(#workerGradient)" strokeWidth="3" strokeLinecap="round" />
        
        {/* Bike Top Tube */}
        <line x1="60" y1="90" x2="120" y2="90" stroke="url(#workerGradient)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

        {/* Left Wheel */}
        <circle cx="80" cy="130" r="20" fill="none" stroke="url(#workerGradient)" strokeWidth="2.5" />
        <circle cx="80" cy="130" r="3" fill="url(#workerGradient)" />

        {/* Right Wheel */}
        <circle cx="100" cy="130" r="20" fill="none" stroke="url(#workerGradient)" strokeWidth="2.5" />
        <circle cx="100" cy="130" r="3" fill="url(#workerGradient)" />

        {/* Seat post */}
        <line x1="90" y1="90" x2="85" y2="70" stroke="url(#workerGradient)" strokeWidth="2" strokeLinecap="round" />

        {/* Worker Body */}
        <circle cx="85" cy="55" r="12" fill="url(#workerGradient)" />

        {/* Worker Torso */}
        <rect x="79" y="70" width="12" height="25" rx="2" fill="url(#workerGradient)" opacity="0.9" />

        {/* Left Arm */}
        <line x1="79" y1="75" x2="60" y2="65" stroke="url(#workerGradient)" strokeWidth="3" strokeLinecap="round" />

        {/* Right Arm holding delivery box */}
        <line x1="91" y1="75" x2="110" y2="62" stroke="url(#workerGradient)" strokeWidth="3" strokeLinecap="round" />

        {/* Delivery Package */}
        <rect x="105" y="50" width="22" height="20" rx="2" fill="none" stroke="url(#workerGradient)" strokeWidth="2.5" />
        
        {/* Package handle */}
        <path d="M 110 50 Q 116 42 122 50" fill="none" stroke="url(#workerGradient)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />

        {/* Left Leg */}
        <line x1="82" y1="95" x2="75" y2="120" stroke="url(#workerGradient)" strokeWidth="3" strokeLinecap="round" />

        {/* Right Leg */}
        <line x1="88" y1="95" x2="95" y2="120" stroke="url(#workerGradient)" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Motion lines - delivery speed */}
      <line x1="40" y1="100" x2="50" y2="100" stroke="url(#workerGradient)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="35" y1="110" x2="45" y2="110" stroke="url(#workerGradient)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
