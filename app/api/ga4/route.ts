import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;

    if (!session?.user?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 임시 모의 데이터 (실제 GA4 API는 나중에 구현)
    return NextResponse.json({
      success: true,
      realtimeUsers: 42,
      data: [
        { date: '2026-07-27', activeUsers: 120, pageViews: 450, engagementRate: 0.65, avgSessionDuration: 3.5 },
        { date: '2026-07-26', activeUsers: 95, pageViews: 380, engagementRate: 0.58, avgSessionDuration: 3.2 },
      ],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GA4 API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GA4 data' },
      { status: 500 }
    );
  }
}
