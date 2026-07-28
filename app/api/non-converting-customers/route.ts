import { NextRequest, NextResponse } from 'next/server';

let cachedData: any = null;
let cacheTimestamp: number | null = null;

async function fetch_customers(): Promise<any> {
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

  return {
    nonConvertingCustomers: all
      .filter((c: any) => c.orders_count === 0)
      .map((c: any) => ({
        id: c.id,
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name,
        createdAt: c.created_at
      }))
  };
}

export async function GET() {
  try {
    if (cachedData && Date.now() - cacheTimestamp! < 3600000) {
      return NextResponse.json(cachedData);
    }
    const result = await fetch_customers();
    cachedData = result;
    cacheTimestamp = Date.now();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ nonConvertingCustomers: [] });
  }
}
