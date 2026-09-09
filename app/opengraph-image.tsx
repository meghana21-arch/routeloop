import { ImageResponse } from 'next/og';

export const alt =
  'RouteLoop — Control every LLM request. Prove every routing decision.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background: '#0b0d0f',
        color: '#edf1f4',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
          <path
            d="M10 18C18 7 31 8 37 18C43 28 51 29 54 18"
            stroke="#5AA7FF"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M54 46C46 57 33 56 27 46C21 36 13 35 10 46"
            stroke="#52D273"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="4" fill="#EDF1F4" />
        </svg>
        <span>RouteLoop</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 16,
            color: '#52d273',
            letterSpacing: '0.14em',
          }}
        >
          PRODUCTION SYSTEM
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 66,
            lineHeight: 1.02,
            letterSpacing: '-0.05em',
            fontWeight: 700,
            maxWidth: 980,
          }}
        >
          <span>Control every LLM request.</span>
          <span style={{ color: '#89959f' }}>
            Prove every routing decision.
          </span>
        </div>
        <div style={{ fontSize: 24, color: '#89959f' }}>
          Adaptive routing · durable traces · cost accounting · deterministic
          evaluations
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          fontSize: 17,
          fontFamily: 'monospace',
          color: '#aeb8bf',
        }}
      >
        <span>CLIENT</span>
        <span style={{ color: '#5aa7ff' }}>/</span>
        <span>GO GATEWAY</span>
        <span style={{ color: '#5aa7ff' }}>/</span>
        <span>GEMINI</span>
        <span style={{ color: '#52d273' }}>/</span>
        <span>NEON</span>
        <span style={{ color: '#52d273' }}>/</span>
        <span>EVALUATOR</span>
      </div>
    </div>,
    size,
  );
}
