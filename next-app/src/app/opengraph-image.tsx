import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Vellko Affiliate';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
    // Fetch the logo with error handling
    let logoSrc: ArrayBuffer | null = null;
    try {
        const response = await fetch(new URL('https://eu1-us1.ckcdnassets.com/2362/logos/signuplogo.png'));
        if (response.ok) {
            logoSrc = await response.arrayBuffer();
        } else {
            console.error('Failed to fetch logo:', response.statusText);
        }
    } catch (error) {
        console.error('Error fetching logo:', error);
    }

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#ffffff', // White base
                    backgroundImage: 'radial-gradient(circle at center, #ffffff 0%, #f3f4f6 100%)', // Subtle grey gradient
                    color: '#111827', // Near Black text
                    position: 'relative',
                }}
            >
                {/* Top Accent Bar (Black) */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '16px', background: '#000000' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 50, marginTop: 20 }}>
                    {logoSrc ? (
                        /* @ts-ignore */
                        <img src={logoSrc} width="400" height="150" style={{ objectFit: 'contain' }} />
                    ) : (
                        <div style={{ fontSize: 60, fontWeight: 'bold', color: '#111827' }}>Vellko Affiliate</div>
                    )}
                </div>

                <div
                    style={{
                        fontSize: 64,
                        fontWeight: '900',
                        letterSpacing: '-0.04em',
                        color: '#111827', // Black
                        marginBottom: 20,
                        textAlign: 'center',
                        lineHeight: 1.1,
                    }}
                >
                    Join the Vellko Affiliate Network
                </div>

                <div
                    style={{
                        fontSize: 32,
                        fontWeight: '500',
                        color: '#6b7280', // Grey-500
                        textAlign: 'center',
                        maxWidth: '80%',
                    }}
                >
                    Premium Offers • Timely Payments • Dedicated Support
                </div>

                {/* Bottom Accent Bar (Red) */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '16px', background: '#dc2626' }} />
            </div>
        ),
        {
            ...size,
        }
    );
}
