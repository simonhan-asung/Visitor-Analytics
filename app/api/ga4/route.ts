cat > ~/Desktop/my-analytics-dashboard/app/api/ga4/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 임시 모의 데이터 (테스트용)
    return NextResponse.json({
      success: true,
      realtimeUsers: 42,
      data: [
        { date: '2026-07-27', activeUsers: 120, pageViews: 450, engagementRate: 0.65, avgSessionDuration: 3.5, device: 'mobile', country: 'CA' },
        { date: '2026-07-26', activeUsers: 95, pageViews: 380, engagementRate: 0.58, avgSessionDuration: 3.2, device: 'desktop', country: 'CA' },
        { date: '2026-07-25', activeUsers: 110, pageViews: 420, engagementRate: 0.62, avgSessionDuration: 3.4, device: 'mobile', country: 'US' },
      ],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GA4 API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GA4 data', details: error },
      { status: 500 }
    );
  }
}
EOF