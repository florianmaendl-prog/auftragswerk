import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3D556B',
          color: '#FFFFFF',
          fontSize: 130,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        A
      </div>
    ),
    { ...size }
  );
}
