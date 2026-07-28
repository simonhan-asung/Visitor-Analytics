import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const analyticsDataClient = new BetaAnalyticsDataClient();

    // 최근 30일 데이터
    const response = await analyticsDataClient.runReport({
      property: `properties/${process.env.GOOGLE_ANALYTICS_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: '30daysAgo',
          endDate: 'today',
        },
      ],
      dimensions: [
        { name: 'date' },
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'engagementRate' },
      ],
    });

    const formattedData = response[0]?.rows?.map((row: any) => ({
      date: row.dimensionValues[0]?.value,
      activeUsers: parseInt(row.metricValues[0]?.value || '0'),
      pageViews: parseInt(row.metricValues[1]?.value || '0'),
      engagementRate: parseFloat(row.metricValues[2]?.value || '0'),
    })) || [];

    return NextResponse.json({
      success: true,
      realtimeUsers: 0,
      data: formattedData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GA4 API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GA4 data', details: String(error) },
      { status: 500 }
    );
  }
}
