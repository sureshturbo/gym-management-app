// Flat illustrated busts used on the owner dashboard (no photos of real people).
// Both share one 160×160 frame so they line up side by side.

const SKIN = '#f2c39b';
const SKIN_SHADE = '#e0a87f';
const MOUTH = '#a4553b';

function Face({ brows, hairColor }) {
  return (
    <>
      <path d={brows} stroke={hairColor} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="71" cy="73" r="2.6" fill="#2a1d18" />
      <circle cx="89" cy="73" r="2.6" fill="#2a1d18" />
      <path d="M73 85 Q80 91 87 85" stroke={MOUTH} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="66" cy="81" r="3.5" fill="#f19a8a" opacity="0.45" />
      <circle cx="94" cy="81" r="3.5" fill="#f19a8a" opacity="0.45" />
    </>
  );
}

export function MaleFigure({ size = 140 }) {
  const hair = '#2b1d16';
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label="Man">
      <defs>
        <clipPath id="fig-m-clip"><circle cx="80" cy="80" r="76" /></clipPath>
      </defs>
      <circle cx="80" cy="80" r="76" fill="rgb(255 255 255 / 22%)" />
      <g clipPath="url(#fig-m-clip)">
        {/* shoulders + arms (tank top shows the arms) */}
        <path d="M22 162 C22 128 40 112 62 108 L98 108 C120 112 138 128 138 162 Z" fill={SKIN} />
        {/* tank top */}
        <path d="M46 162 C46 132 54 116 64 110 C70 118 90 118 96 110 C106 116 114 132 114 162 Z" fill="#17325c" />
        <path d="M64 110 C70 118 90 118 96 110" stroke="#0f2342" strokeWidth="3" fill="none" />
        <rect x="70" y="128" width="20" height="5" rx="2.5" fill="#5aa0f2" />
        {/* neck */}
        <path d="M70 92 L90 92 L91 112 C86 116 74 116 69 112 Z" fill={SKIN_SHADE} />
        {/* ears + head */}
        <circle cx="56" cy="74" r="6" fill={SKIN_SHADE} />
        <circle cx="104" cy="74" r="6" fill={SKIN_SHADE} />
        <ellipse cx="80" cy="72" rx="24" ry="27" fill={SKIN} />
        {/* short hair + light beard */}
        <path d="M55 70 C52 46 66 38 81 38 C97 38 108 47 105 70 C102 60 98 55 92 53 C84 57 70 57 60 55 C57 59 56 64 55 70 Z" fill={hair} />
        <path d="M58 80 C60 96 70 101 80 101 C90 101 100 96 102 80 C100 92 92 96 80 96 C68 96 60 92 58 80 Z" fill={hair} opacity="0.35" />
        <Face brows="M66 65 L76 64 M84 64 L94 65" hairColor={hair} />
      </g>
    </svg>
  );
}

export function FemaleFigure({ size = 140 }) {
  const hair = '#3b2219';
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label="Woman">
      <defs>
        <clipPath id="fig-f-clip"><circle cx="80" cy="80" r="76" /></clipPath>
      </defs>
      <circle cx="80" cy="80" r="76" fill="rgb(255 255 255 / 22%)" />
      <g clipPath="url(#fig-f-clip)">
        {/* long hair behind */}
        <path d="M52 72 C48 42 64 33 80 33 C98 33 112 43 108 72 C110 92 114 110 120 122 C104 124 92 116 88 104 L72 104 C68 116 56 124 40 122 C46 110 50 92 52 72 Z" fill={hair} />
        {/* shoulders + arms */}
        <path d="M28 162 C28 130 44 114 64 110 L96 110 C116 114 132 130 132 162 Z" fill={SKIN} />
        {/* sports top */}
        <path d="M50 162 C50 134 56 120 66 113 C72 120 88 120 94 113 C104 120 110 134 110 162 Z" fill="#c2410c" />
        <path d="M66 113 C72 120 88 120 94 113" stroke="#9a3412" strokeWidth="3" fill="none" />
        <rect x="70" y="131" width="20" height="5" rx="2.5" fill="#fdba74" />
        {/* neck */}
        <path d="M71 94 L89 94 L90 113 C85 117 75 117 70 113 Z" fill={SKIN_SHADE} />
        {/* head */}
        <ellipse cx="80" cy="73" rx="23" ry="26" fill={SKIN} />
        {/* fringe */}
        <path d="M56 70 C55 48 67 40 81 40 C96 40 106 50 104 68 C98 58 88 52 76 54 C68 56 60 61 56 70 Z" fill={hair} />
        {/* earrings */}
        <circle cx="57" cy="86" r="2.6" fill="#facc15" />
        <circle cx="103" cy="86" r="2.6" fill="#facc15" />
        <Face brows="M66 64 Q71 61 76 63 M84 63 Q89 61 94 64" hairColor={hair} />
      </g>
    </svg>
  );
}
