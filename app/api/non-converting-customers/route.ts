import { NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

// GA4 Data API 클라이언트 생성
const analyticsDataClient = new BetaAnalyticsDataClient();

// GA4 속성 ID (Google Analytics 관리자 -> 속성 설정에서 확인 가능한 9자리 숫자)
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '123456789';

let cachedData: any = null;
let cacheTimestamp: number | null = null;

// 1. Shopify에서 미구매 고객 목록 가져오기
async function fetchShopifyNonConvertingCustomers() {
  const shop = 'aone-beauty-health.myshopify.com';
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  
  let all: any[] = [];
  let url: any = `https://${shop}/admin/api/2024-01/customers.json?limit=250`;

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token! }
    });
    const data = await res.json();
    all.push(...(data.customers || []));
    
    url = null;
    const link = res.headers.get('link');
    if (link) {
      for (const part of link.split(',')) {
        if (part.includes('next')) {
          const m = part.match(/<([^>]+)>/);
          if (m) url = m[1];
        }
      }
    }
  }

  // 구매 건수가 0인 고객만 필터링
  return all.filter((c: any) => c.orders_count === 0);
}

// 2. GA4에서 특정 user_id(고객 ID)들의 페이지 방문 로그 가져오기
async function fetchGA4VisitLogs(customerIds: string[]) {
  if (customerIds.length === 0) return {};

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'userId' },
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [{ name: 'screenPageViews' }],
      dimensionFilter: {
        filter: {
          fieldName: 'userId',
          inListFilter: {
            values: customerIds
          }
        }
      }
    });

    // GA4 응답 데이터를 고객 ID별로 정리
    const logsByUserId: Record<string, any[]> = {};

    response.rows?.forEach((row) => {
      const userId = row.dimensionValues?.[0]?.value || '';
      const pagePath = row.dimensionValues?.[1]?.value || '';
      const pageTitle = row.dimensionValues?.[2]?.value || '';

      if (userId) {
        if (!logsByUserId[userId]) logsByUserId[userId] = [];
        logsByUserId[userId].push({
          visitedUrl: pagePath,
          pageTitle: pageTitle
        });
      }
    });

    return logsByUserId;
  } catch (error) {
    console.error('GA4 API Fetch Error:', error);
    return {};
  }
}

export async function GET() {
  try {
    // 1시간 캐시 적용
    if (cachedData && cacheTimestamp && Date.now() - cacheTimestamp < 3600000) {
      return NextResponse.json(cachedData);
    }

    // ① 쇼피파이에서 미구매 고객 가져오기
    const customers = await fetchShopifyNonConvertingCustomers();
    const customerIds = customers.map((c: any) => String(c.id));

    // ② GA4에서 해당 고객들의 웹사이트 행동 로그 가져오기
    const ga4Logs = await fetchGA4VisitLogs(customerIds);

    // ③ 두 데이터 결합
    const mergedData = customers.map((c: any) => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      createdAt: c.created_at,
      visitLogs: ga4Logs[String(c.id)] || [] // GA4에서 매칭된 방문 페이지 목록
    }));

    const result = { nonConvertingCustomers: mergedData };

    cachedData = result;
    cacheTimestamp = Date.now();

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ nonConvertingCustomers: [] });
  }
}