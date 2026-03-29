
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
        <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38C7D2" />
          <stop offset="100%" stopColor="#1E9CA4" />
        </linearGradient>
        <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#254B85" />
          <stop offset="100%" stopColor="#1A3668" />
        </linearGradient>
        
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* --- INTERLOCKING TRIANGLE FRAME --- */}
      <g filter="url(#shadow)">
        {/* Left Segment (Dark Blue) */}
        <polygon 
          points="100,20 15,160 60,135 100,75" 
          fill="url(#blueGrad)" 
          stroke="#020617" 
          strokeWidth="2"
          strokeLinejoin="round"
        />
        
        {/* Bottom Segment (Dark Blue) */}
        <polygon 
          points="15,160 185,160 140,135 60,135" 
          fill="url(#blueGrad)" 
          stroke="#020617" 
          strokeWidth="2"
          strokeLinejoin="round"
        />
        
        {/* Right Segment (Teal) */}
        <polygon 
          points="100,20 185,160 140,135 100,75" 
          fill="url(#tealGrad)" 
          stroke="#020617" 
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* --- GIG WORKER SILHOUETTE --- */}
      <g transform="translate(-2, 5)">
        {/* Head */}
        <circle cx="104" cy="78" r="6.5" fill="url(#blueGrad)" />
        
        {/* Torso */}
        <path d="M 98 88 L 108 88 L 105 112 L 98 112 Z" fill="url(#blueGrad)" />
        
        {/* Forward Leg (Right) */}
        <polygon points="102,112 110,140 102,140 98,112" fill="url(#blueGrad)" />
        
        {/* Back Leg (Left) */}
        <polygon points="98,112 92,140 85,138 94,112" fill="url(#blueGrad)" />
        
        {/* Backpack (Teal) */}
        <path d="M 88 90 L 98 90 L 96 108 L 86 105 Z" fill="url(#tealGrad)" rx="2" />
        
        {/* Arm holding phone */}
        <path d="M 104 90 L 114 102 L 120 98" fill="none" stroke="url(#blueGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Phone Device */}
        <rect x="118" y="93" width="5" height="8" rx="1.5" fill="url(#tealGrad)" />
      </g>
    </svg>
  );
}
