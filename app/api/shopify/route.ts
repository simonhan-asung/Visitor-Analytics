import { NextRequest, NextResponse } from 'next/server';

// ============ 캐싱 전략 (5분 보관) ============
const CACHE_CONFIG = {
  ttl: 5 * 60 * 1000, // 5분
};

let cachedData: any = null;
let cacheTimestamp: number | null = null;

function getCachedData() {
  const now = Date.now();
  if (cachedData && cacheTimestamp && now - cacheTimestamp < CACHE_CONFIG.ttl) {
    console.log('✓ 백엔드 5분 캐시 데이터 사용');
    return cachedData;
  }
  return null;
}

function setCachedData(data: any) {
  cachedData = data;
  cacheTimestamp = Date.now();
}

// ============ Link 헤더에서 다음 페이지 URL 추출 ============
function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  // 형식: <https://...>; rel="next", <https://...>; rel="previous"
  const parts = linkHeader.split(',');
  for (const part of parts) {
    if (part.includes('rel="next"')) {
      const match = part.match(/<([^>]+)>/);
      if (match) return match[1];
    }
  }
  return null;
}

// ============ Shopify API 호출 (페이지네이션 포함) ============
async function fetchFromShopifyAPI(): Promise<any> {
  const shop =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE ||
    process.env.SHOPIFY_STORE_DOMAIN ||
    'aone-beauty-health.myshopify.com';
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = '2024-01';

  if (!accessToken) {
    throw new Error('SHOPIFY_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다.');
  }

  // ✅ 40일 전부터 조회 (7일 / 30일 / 이번 달 모두 커버)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 40);
  startDate.setHours(0, 0, 0, 0);

  let url: string | null =
    `https://${shop}/admin/api/${apiVersion}/orders.json` +
    `?status=any&limit=250&created_at_min=${startDate.toISOString()}`;

  const allOrders: any[] = [];
  let pageCount = 0;
  const MAX_PAGES = 10; // 안전장치: 최대 2,500건

  while (url && pageCount < MAX_PAGES) {
    pageCount++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response: Response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Shopify API Error ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = await response.json();
      const pageOrders = data.orders || [];
      allOrders.push(...pageOrders);

      console.log(`✓ 페이지 ${pageCount}: ${pageOrders.length}건 (누적 ${allOrders.length}건)`);

      // 다음 페이지 있으면 계속
      url = getNextPageUrl(response.headers.get('link'));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  console.log(`✅ Shopify 총 ${allOrders.length}건 수신 (${pageCount}페이지)`);

  return {
    orders: allOrders,
    totalCount: allOrders.length,
    pages: pageCount,
    fetchedFrom: startDate.toISOString(),
    timestamp: new Date().toISOString(),
  };
}

// ============ GET 핸들러 ============
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    if (!force) {
      const cached = getCachedData();
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    const result = await fetchFromShopifyAPI();
    setCachedData(result);

    return NextResponse.json({ ...result, cached: false });
  } catch (error) {
    console.error('❌ Shopify API 오류:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: String(error), orders: [] },
      { status: 500 }
    );
  }
}
