import { NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '123456789';

// Vercel 배포 환경에서도 작동하도록 인증 정보 명시
const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GCP_PROJECT_ID,
});

export async function GET() {
  try {
    // 1. 실시간 활성 사용자 가져오기
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      metrics: [{ name: 'activeUsers' }],
    });
    const realtimeUsers = realtimeResponse.rows?.[0]?.metricValues?.[0]?.value || '0';

    // 2. 최근 7일간의 상세 사용자 활동 기록 (도시, 기기, 페이지별)
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'date' },
        { name: 'city' },
        { name: 'deviceCategory' },
        { name: 'pageTitle' }
      ],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ desc: true, dimension: { dimensionName: 'date' } }],
      limit: 100, // 최대 100개 항목 표시
    });

    // 프론트엔드에서 쓰기 좋게 데이터 매핑
    const detailedData = response.rows?.map((row) => ({
      date: row.dimensionValues?.[0]?.value,
      city: row.dimensionValues?.[1]?.value,
      device: row.dimensionValues?.[2]?.value,
      pageTitle: row.dimensionValues?.[3]?.value,
      activeUsers: row.metricValues?.[0]?.value,
    })) || [];

    return NextResponse.json({ 
      success: true, 
      realtimeUsers, 
      data: detailedData 
    });

  } catch (error: any) {
    console.error('GA4 Detail API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}