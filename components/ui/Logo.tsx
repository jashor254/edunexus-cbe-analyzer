'use client'

interface LogoProps {
  variant?: 'dark' | 'light'
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  iconOnly?: boolean
}

function CompassIcon({ s, variant }: { s: number; variant: 'dark' | 'light' }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="32" cy="32" r="30"
        fill={variant === 'dark' ? '#1e1b4b' : '#eef2ff'}
        stroke={variant === 'dark' ? '#4f46e5' : '#6366f1'}
        strokeWidth="1.5"
      />
      <circle
        cx="32" cy="32" r="20"
        fill="none"
        stroke={variant === 'dark' ? '#312e81' : '#c7d2fe'}
        strokeWidth="0.8"
        strokeDasharray="2 5"
      />
      {/* North — Amber */}
      <polygon
        points="32,4 36.5,28.5 32,30 27.5,28.5"
        fill="#f59e0b"
      />
      {/* South — Periwinkle */}
      <polygon
        points="32,60 36.5,35.5 32,34 27.5,35.5"
        fill={variant === 'dark' ? '#818cf8' : '#6366f1'}
      />
      {/* West — Emerald */}
      <polygon
        points="4,32 28.5,27.5 30,32 28.5,36.5"
        fill="#10b981"
      />
      {/* East — Rose */}
      <polygon
        points="60,32 35.5,27.5 34,32 35.5,36.5"
        fill="#f43f5e"
      />
      {/* Center */}
      <circle
        cx="32" cy="32" r="4"
        fill={variant === 'dark' ? '#0f0e2a' : '#ffffff'}
        stroke="#f59e0b"
        strokeWidth="1.5"
      />
      <circle cx="32" cy="32" r="1.8" fill="#fde68a" />
      {/* N label */}
      <text
        x="32" y="17"
        textAnchor="middle"
        fontFamily="system-ui"
        fontSize="9"
        fontWeight="700"
        fill={variant === 'dark' ? '#fbbf24' : '#d97706'}
      >
        N
      </text>
    </svg>
  )
}

export function Logo({
  variant = 'dark',
  size = 'md',
  showTagline = false,
  iconOnly = false,
}: LogoProps) {
  const iconSizes = { sm: 28, md: 40, lg: 56 }
  const textSizes = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' }
  const iconSize = iconSizes[size]

  if (iconOnly) return <CompassIcon s={iconSize} variant={variant} />

  return (
    <div className="flex items-center gap-3">
      <CompassIcon s={iconSize} variant={variant} />
      <div className="flex flex-col gap-0.5">
        <span
          className={`${textSizes[size]} font-extrabold tracking-tight leading-none
            ${variant === 'dark' ? 'text-white' : 'text-[#0f0e2a]'}`}
        >
          Edu
          <span className={variant === 'dark' ? 'text-amber-400' : 'text-indigo-600'}>
            Nexus
          </span>
        </span>
        {showTagline && (
          <span className="text-[10px] tracking-[2.5px] uppercase font-medium text-indigo-400">
            Every child finds their way
          </span>
        )}
      </div>
    </div>
  )
}
