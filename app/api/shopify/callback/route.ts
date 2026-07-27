import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop') || process.env.SHOPIFY_STORE_DOMAIN;
  const code = url.searchParams.get('code');
  
  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET!;

  if (!code) {
    return NextResponse.json({ error: '인증 코드가 없습니다.' }, { status: 400 });
  }

  try {
    // 1. 토큰 교환
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) return NextResponse.json({ error: '토큰 교환 실패' }, { status: 500 });

    const accessToken = tokenData.access_token;

    // 2. 쇼피파이 주문 데이터 가져오기
    const ordersResponse = await fetch(`https://${shop}/admin/api/2026-07/orders.json?status=any&limit=10`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    const ordersData = await ordersResponse.json();

    // 3. 보안을 위해 accessToken은 가리고 데이터만 반환
    return NextResponse.json(ordersData);

  } catch (error: any) {
    return NextResponse.json({ error: `서버 에러: ${error.message}` }, { status: 500 });
  }
}