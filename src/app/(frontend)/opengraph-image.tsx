import { ImageResponse } from 'next/og'

export const alt = 'CVLT - Club Volo Libero Ticino'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e293b',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="48" stroke="#3b82f6" strokeWidth="4" />
            <path d="M30 60 L50 25 L70 60 Z" fill="#3b82f6" />
            <path d="M40 65 L50 40 L60 65 Z" fill="#60a5fa" />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.02em' }}>
            CVLT
          </span>
        </div>
        <div style={{ marginTop: 16, fontSize: 28, opacity: 0.8 }}>
          Club Volo Libero Ticino
        </div>
      </div>
    ),
    { ...size },
  )
}
