import { NextRequest, NextResponse } from 'next/server';

// ============ 캐싱 전략 (1시간 보관) ============
const CACHE_CONFIG = {
  ttl: 60 * 60 * 1000, // 1시간 (밀리초)
  key: 'shopify_orders_cache',
};

let cachedData: any = null;
let cacheTimestamp: number | null = null;

function getCachedData() {
  const now = Date.now();
  if (cachedData && cacheTimestamp && (now - cacheTimestamp) < CACHE_CONFIG.ttl) {
    console.log('✓ 백엔드 1시간 캐시 데이터 사용');
    return cachedData;
  }
  return null;
}

function setCachedData(data: any) {
  cachedData = data;
  cacheTimestamp = Date.now();
}

// ============ Shopify API 호출 (보안 적용) ============
async function fetchFromShopifyAPI(): Promise<any> {
  const shop = process.env.NEXT_PUBLIC_SHOPIFY_STORE || process.env.SHOPIFY_STORE_DOMAIN || 'aone-beauty-health.myshopify.com';
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = '2024-01';

  if (!accessToken) {
    throw new Error('SHOPIFY_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다.');
  }

  const url = `https://${shop}/admin/api/${apiVersion}/orders.json?status=any&limit=50`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Shopify API 오류 (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Shopify API 요청 타임아웃 (10초 초과)');
    }
    throw error;
  }
}

// ============ 데이터 유효성 검사 및 필터링 ============
function validateAndFilterOrders(orders: any[]): any[] {
  return orders
    .filter((order) => {
      if (!order.id || !order.created_at || !order.total_price) {
        console.warn(`⚠️ 불완전한 주문 필터링됨: ${order.id}`);
        return false;
      }
      return true;
    })
    .map((order) => ({
      id: order.id,
      name: order.name || `#${order.id}`,
      created_at: order.created_at,
      total_price: order.total_price || '0',
      financial_status: order.financial_status || 'unknown',
      email: order.email,
      contact_email: order.contact_email,
      customer: order.customer ? {
        id: order.customer.id,
        first_name: order.customer.first_name || '',
        last_name: order.customer.last_name || '',
        email: order.customer.email || '',
        verified_email: order.customer.verified_email || false,
      } : undefined,
      billing_address: order.billing_address ? {
        name: order.billing_address.name,
        first_name: order.billing_address.first_name,
        last_name: order.billing_address.last_name,
        city: order.billing_address.city,
        province: order.billing_address.province,
        country: order.billing_address.country,
      } : undefined,
      line_items: (order.line_items || []).map((item: any) => ({
        id: item.id,
        title: item.title || '상품명 없음',
        quantity: item.quantity || 0,
        price: item.price || '0',
        sku: item.sku,
        vendor: item.vendor,
      })),
    }));
}

// ============ GET 엔드포인트 ============
export async function GET(request: NextRequest) {
  try {
    const cached = getCachedData();
    if (cached) {
      return NextResponse.json({
        success: true,
        orders: cached,
        source: 'cache',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('📡 Shopify API 호출 시작 (1시간 보관)...');
    const shopifyResponse = await fetchFromShopifyAPI();

    if (!shopifyResponse.orders || shopifyResponse.orders.length === 0) {
      console.warn('⚠️ Shopify에서 주문 데이터 없음');
      return NextResponse.json({
        success: true,
        orders: [],
        source: 'shopify',
        timestamp: new Date().toISOString(),
      });
    }

    const validatedOrders = validateAndFilterOrders(shopifyResponse.orders);
    setCachedData(validatedOrders);

    console.log(`✓ ${validatedOrders.length}개 주문 데이터 가져오기 완료`);

    return NextResponse.json({
      success: true,
      orders: validatedOrders,
      source: 'shopify',
      count: validatedOrders.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('❌ API 오류:', errorMessage);

    const cached = getCachedData();
    if (cached) {
      return NextResponse.json(
        {
          success: false,
          error: '최신 데이터를 불러올 수 없어 캐시된 데이터를 표시합니다',
          orders: cached,
          source: 'cache_fallback',
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        orders: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============ POST 수동 캐시 초기화 엔드포인트 ============
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === 'clear-cache') {
      cachedData = null;
      cacheTimestamp = null;
      console.log('🧹 백엔드 캐시 비우기 완료');
      return NextResponse.json({ success: true, message: '캐시 초기화됨' });
    }
    return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: '잘못된 요청 형식' }, { status: 400 });
  }
}