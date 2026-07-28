'use client';

import { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface LineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku?: string;
  vendor?: string;
}

interface Order {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  email?: string;
  contact_email?: string;
  customer?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    verified_email: boolean;
  };
  billing_address?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    province?: string;
    country?: string;
  };
  line_items?: LineItem[];
}

interface ChartDataItem {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  orderCount: number;
}

const FALLBACK_CHART_DATA: ChartDataItem[] = [
  { date: '2026-07-27', pageViews: 0, uniqueVisitors: 0, orderCount: 0 },
];

export default function VisitorAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('개요');
  const [period, setPeriod] = useState('최근 7일');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchShopifyData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const url = forceRefresh ? '/api/shopify?force=true' : '/api/shopify';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (data.orders && Array.isArray(data.orders)) {
        setOrders(data.orders);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGA4Data = async () => {
    try {
      const res = await fetch('/api/ga4');
      const data = await res.json();
      if (data.success) {
        console.log('GA4 데이터:', data);
      }
    } catch (err) {
      console.error('GA4 Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchShopifyData();
    fetchGA4Data();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchShopifyData();
      fetchGA4Data();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const customerSet = new Set();
  orders.forEach((o) => {
    const customerId =
      o.customer?.id ||
      o.customer?.email ||
      o.email ||
      o.contact_email ||
      o.billing_address?.name ||
      o.name;
    if (customerId) customerSet.add(customerId);
  });
  const totalCustomersCount = customerSet.size;

  const paidOrders = orders.filter((o) => o.financial_status === 'paid' || o.financial_status === 'authorized');
  const nonConvertingOrders = orders.filter((o) => o.financial_status !== 'paid' && o.financial_status !== 'authorized');

  const chartDataMap = orders.reduce((acc: { [key: string]: ChartDataItem }, order) => {
    const date = order.created_at.split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, pageViews: 0, uniqueVisitors: 0, orderCount: 0 };
    }
    acc[date].pageViews += Math.round(parseFloat(order.total_price || '0') * 10);
    acc[date].uniqueVisitors += 1;
    acc[date].orderCount += 1;
    return acc;
  }, {});

  const chartData: ChartDataItem[] = Object.values(chartDataMap).sort((a, b) => a.date.localeCompare(b.date));
  const activeChartData: ChartDataItem[] = chartData.length > 0 ? chartData : FALLBACK_CHART_DATA;

  const vendorMap: { [key: string]: { count: number; revenue: number } } = {};
  const skuMap: { [key: string]: { name: string; count: number; revenue: number } } = {};

  orders.forEach((o) => {
    o.line_items?.forEach((item) => {
      const vendor = item.vendor || '기타 브랜드';
      const sku = item.sku || item.title;
      const price = parseFloat(item.price || '0') * item.quantity;

      if (!vendorMap[vendor]) vendorMap[vendor] = { count: 0, revenue: 0 };
      vendorMap[vendor].count += item.quantity;
      vendorMap[vendor].revenue += price;

      if (!skuMap[sku]) skuMap[sku] = { name: item.title, count: 0, revenue: 0 };
      skuMap[sku].count += item.quantity;
      skuMap[sku].revenue += price;
    });
  });

  const topVendors = Object.entries(vendorMap)
    .map(([vendor, data]) => ({ vendor, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  const topSKUs = Object.entries(skuMap)
    .map(([sku, data]) => ({ sku, ...data }))
    .sort((a, b) => b.count - a.count);

  const regionMap: { [key: string]: number } = {};
  orders.forEach((o) => {
    const city = o.billing_address?.city || '미지정 지역';
    regionMap[city] = (regionMap[city] || 0) + 1;
  });
  const regionData = Object.entries(regionMap).map(([city, count]) => ({ city, count }));

  const COLORS = ['#f43f5e', '#fb7185', '#e11d48', '#10b981', '#fbbf24', '#c084fc'];

  return (
    <div style={{ backgroundColor: '#14080a', color: '#fecdd3', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #33141a', backgroundColor: '#0f0507' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px', color: '#ffffff' }}>Aone Beauty</span>
          <span style={{ color: '#521d26' }}>|</span>
          <span style={{ fontSize: '14px', color: '#fda4af', fontWeight: '500' }}>Visitor Analytics</span>
        </div>

        <div style={{ fontSize: '13px', color: '#9f1239' }}>
          업데이트: {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid #33141a', backgroundColor: '#14080a', overflowX: 'auto' }}>
        {[
          { name: '개요', icon: '📊' },
          { name: '미거래 방문 고객', icon: '🍩' },
          { name: '구매 고객 방문', icon: '🛒' },
          { name: '많이 찾는 SKU·브랜드', icon: '🔍' },
          { name: '카테고리 관심도', icon: '📦' },
          { name: '지역 분포', icon: '🗺️' },
        ].map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '14px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.name ? '2px solid #f43f5e' : '2px solid transparent',
              color: activeTab === tab.name ? '#f43f5e' : '#fb7185',
              fontSize: '13px',
              fontWeight: activeTab === tab.name ? '600' : '400',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>

      <main style={{ padding: '24px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                backgroundColor: '#1c0d10',
                color: '#ffffff',
                border: '1px solid #33141a',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                outline: 'none',
              }}
            >
              <option value="최근 7일">최근 7일</option>
              <option value="최근 30일">최근 30일</option>
              <option value="이번 달">이번 달</option>
            </select>

            <button
              onClick={() => {
                fetchShopifyData(true);
                fetchGA4Data();
              }}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#7f1d1d' : '#e11d48',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              🔄 {loading ? '동기화 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {activeTab === '개요' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { title: '순 구매 고객 수', value: loading ? '...' : `${totalCustomersCount}명`, color: '#f43f5e' },
                { title: '승인/결제 주문 수', value: loading ? '...' : `${paidOrders.length}건`, color: '#fb7185' },
                { title: '전체 주문 수', value: loading ? '...' : `${orders.length}건`, color: '#10b981' },
                { title: '총 매출액', value: loading ? '...' : `$${orders.reduce((acc, o) => acc + parseFloat(o.total_price || '0'), 0).toFixed(2)} CAD`, color: '#fbbf24' },
              ].map((card, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#1c0d10',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    border: '1px solid #33141a',
                    borderTop: `3px solid ${card.color}`,
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#fda4af', marginBottom: '8px' }}>{card.title}</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>{card.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '15px', color: '#ffe4e6' }}>📈 일별 트래픽</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={activeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#33141a" vertical={false} />
                      <XAxis dataKey="date" stroke="#881337" fontSize={12} tickLine={false} />
                      <YAxis stroke="#881337" fontSize={12} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#2e0f15', border: '1px solid #4c1d24', borderRadius: '8px', color: '#fff' }} />
                      <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: '15px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="pageViews" name="페이지뷰" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '15px', color: '#ffe4e6' }}>📊 일별 주문 건수</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={activeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#33141a" vertical={false} />
                      <XAxis dataKey="date" stroke="#881337" fontSize={12} tickLine={false} />
                      <YAxis stroke="#881337" fontSize={12} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#2e0f15', border: '1px solid #4c1d24', borderRadius: '8px', color: '#fff' }} />
                      <Bar dataKey="orderCount" fill="#e11d48" name="주문건수" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === '미거래 방문 고객' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🍩 결제 미완료 고객</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #4c1d24', color: '#fda4af' }}>
                  <th style={{ padding: '10px' }}>주문 번호</th>
                  <th style={{ padding: '10px' }}>금액</th>
                  <th style={{ padding: '10px' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {nonConvertingOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #280d13' }}>
                    <td style={{ padding: '10px', color: '#f43f5e' }}>{o.name}</td>
                    <td style={{ padding: '10px', color: '#fbbf24' }}>${o.total_price}</td>
                    <td style={{ padding: '10px', color: '#fda4af' }}>{o.financial_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === '구매 고객 방문' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🛒 구매 고객 명단</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #4c1d24', color: '#fda4af' }}>
                  <th style={{ padding: '10px' }}>주문 번호</th>
                  <th style={{ padding: '10px' }}>구매자</th>
                  <th style={{ padding: '10px' }}>금액</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #280d13' }}>
                    <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>{o.name}</td>
                    <td style={{ padding: '10px', color: '#fff' }}>{o.customer?.first_name || o.email || '비회원'}</td>
                    <td style={{ padding: '10px', color: '#10b981' }}>${o.total_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === '많이 찾는 SKU·브랜드' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🏷️ 베스트셀러 브랜드</h3>
              {topVendors.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #280d13' }}>
                  <span style={{ color: '#fff' }}>{i + 1}. {v.vendor}</span>
                  <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>${v.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>📦 인기 SKU</h3>
              {topSKUs.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #280d13' }}>
                  <span style={{ color: '#fff' }}>{s.sku}</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{s.count}개</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === '카테고리 관심도' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>📦 브랜드 매출 분포</h3>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={topVendors} dataKey="revenue" nameKey="vendor" cx="50%" cy="50%" outerRadius={100} label>
                    {topVendors.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === '지역 분포' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🗺️ 지역별 주문</h3>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={regionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#33141a" />
                  <XAxis dataKey="city" stroke="#881337" />
                  <YAxis stroke="#881337" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
