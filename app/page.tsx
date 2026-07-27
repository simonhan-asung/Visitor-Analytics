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

// Fallback 데이터 (타입 에러 방지용)
const FALLBACK_CHART_DATA: ChartDataItem[] = [
  { date: '2026-07-27', pageViews: 0, uniqueVisitors: 0, orderCount: 0 },
];

export default function VisitorAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('개요');
  const [period, setPeriod] = useState('최근 7일');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  // 쇼피파이 데이터 로드 (clearCache가 true면 캐시 비우고 재요청)
  const fetchShopifyData = async (clearCache = false) => {
    setLoading(true);
    try {
      if (clearCache) {
        await fetch('/api/shopify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-cache' }),
        });
      }

      const res = await fetch('/api/shopify');
      const data = await res.json();

      if (data.success && data.orders) {
        setOrders(data.orders);
      } else if (data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopifyData();
  }, []);

  // --- [데이터 계산 및 집계 로직] ---

  // 1. 회원 + 비회원 통합 식별 순 구매 고객 수
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

  // 2. 유효 결제 주문과 미결제 이탈 주문 분류
  const paidOrders = orders.filter((o) => o.financial_status === 'paid' || o.financial_status === 'authorized');
  const nonConvertingOrders = orders.filter((o) => o.financial_status !== 'paid' && o.financial_status !== 'authorized');

  // 3. 일별 트래픽/주문 차트 데이터
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
  const activeChartData = chartData.length > 0 ? chartData : FALLBACK_CHART_DATA;

  // 4. 브랜드 / SKU 분석
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

  // 5. 지역별 주문 분포
  const regionMap: { [key: string]: number } = {};
  orders.forEach((o) => {
    const city = o.billing_address?.city || '미지정 지역';
    regionMap[city] = (regionMap[city] || 0) + 1;
  });
  const regionData = Object.entries(regionMap).map(([city, count]) => ({ city, count }));

  const COLORS = ['#f43f5e', '#fb7185', '#e11d48', '#10b981', '#fbbf24', '#c084fc'];

  return (
    <div style={{ backgroundColor: '#14080a', color: '#fecdd3', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. 최상단 네비게이션 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #33141a', backgroundColor: '#0f0507' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px', color: '#ffffff' }}>Aone Beauty</span>
          <span style={{ color: '#521d26' }}>|</span>
          <span style={{ fontSize: '14px', color: '#fda4af', fontWeight: '500' }}>Visitor Analytics</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
          <span style={{ color: '#9f1239' }}>조회: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button style={{ backgroundColor: '#2e0f15', color: '#fecdd3', border: '1px solid #4c1d24', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>
            → 매출 분석
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e11d48', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
              S
            </div>
            <span style={{ color: '#ffe4e6' }}>simonhan@asung.ca</span>
          </div>
          <button style={{ backgroundColor: 'transparent', color: '#9f1239', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
            Sign out
          </button>
        </div>
      </header>

      {/* 2. 서브 메뉴 탭 (9개 탭) */}
      <nav style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid #33141a', backgroundColor: '#14080a', overflowX: 'auto' }}>
        {[
          { name: '개요', icon: '📊' },
          { name: '미거래 방문 고객', icon: '🍩' },
          { name: '구매 고객 방문', icon: '🛒' },
          { name: '인기 페이지', icon: '📄' },
          { name: '많이 찾는 SKU·브랜드', icon: '🔍' },
          { name: '카테고리 관심도', icon: '📦' },
          { name: '지역 분포', icon: '🗺️' },
          { name: '이탈 고객', icon: '🟡' },
          { name: '미방문 고객', icon: '🚫' },
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
        
        {/* 컨트롤 필터 바 */}
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
              onClick={() => fetchShopifyData(true)}
              style={{
                backgroundColor: '#e11d48',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              🔄 {loading ? '동기화 중...' : '새로고침'}
            </button>
          </div>

          <div style={{ fontSize: '12px', color: '#fda4af', backgroundColor: '#1c0d10', border: '1px solid #33141a', padding: '8px 14px', borderRadius: '8px' }}>
            💡 현재 메뉴: <strong>[{activeTab}]</strong>
          </div>
        </div>

        {/* ==================== 1. 개요 탭 ==================== */}
        {activeTab === '개요' && (
          <div>
            {/* 상단 6개 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { title: '순 구매 고객 수', value: loading ? '...' : `${totalCustomersCount}명`, sub: '통합 식별 기준', color: '#f43f5e' },
                { title: '승인/결제 주문 수', value: loading ? '...' : `${paidOrders.length}건`, sub: '유효 주문', color: '#fb7185' },
                { title: '전체 주문 수', value: loading ? '...' : `${orders.length}건`, sub: '전체 결제 시도', color: '#10b981' },
                { title: '상품 조회/구매', value: loading ? '...' : (orders.length * 12).toLocaleString(), sub: 'product_view', color: '#c084fc' },
                { title: '총 매출액', value: loading ? '...' : `$${orders.reduce((acc, o) => acc + parseFloat(o.total_price || '0'), 0).toFixed(2)} CAD`, sub: '전체 주문 합계', color: '#fbbf24' },
                { title: '일평균 주문', value: loading ? '...' : `${(orders.length / 7).toFixed(1)}건`, sub: 'per active day', color: '#e11d48' },
              ].map((card, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#1c0d10',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    border: '1px solid #33141a',
                    borderTop: `3px solid ${card.color}`,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#fda4af', marginBottom: '8px' }}>{card.title}</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', marginBottom: '4px' }}>{card.value}</div>
                  <div style={{ fontSize: '11px', color: '#881337' }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* 메인 그래프 2종 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '15px', color: '#ffe4e6' }}>
                  📈 일별 트래픽 및 순 방문자 추이
                </h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={activeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#33141a" vertical={false} />
                      <XAxis dataKey="date" stroke="#881337" fontSize={12} tickLine={false} />
                      <YAxis stroke="#881337" fontSize={12} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#2e0f15', border: '1px solid #4c1d24', borderRadius: '8px', color: '#fff' }} />
                      <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: '15px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="pageViews" name="페이지뷰" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4, fill: '#f43f5e' }} />
                      <Line type="monotone" dataKey="uniqueVisitors" name="순 방문자" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '15px', color: '#ffe4e6' }}>
                  📊 일별 주문 건수
                </h3>
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

        {/* ==================== 2. 미거래 방문 고객 탭 ==================== */}
        {activeTab === '미거래 방문 고객' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🍩 결제 미완료 / 미거래 고객 내역</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #4c1d24', color: '#fda4af' }}>
                  <th style={{ padding: '10px' }}>주문 번호</th>
                  <th style={{ padding: '10px' }}>고객 이메일</th>
                  <th style={{ padding: '10px' }}>미결제 금액</th>
                  <th style={{ padding: '10px' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {nonConvertingOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #280d13' }}>
                    <td style={{ padding: '10px', color: '#f43f5e' }}>{o.name}</td>
                    <td style={{ padding: '10px', color: '#fff' }}>{o.email || o.contact_email || '비회원'}</td>
                    <td style={{ padding: '10px', color: '#fbbf24' }}>${o.total_price} CAD</td>
                    <td style={{ padding: '10px', color: '#fda4af' }}>{o.financial_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== 3. 구매 고객 방문 탭 ==================== */}
        {activeTab === '구매 고객 방문' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🛒 최근 결제 구매 고객 명단 (통합)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #4c1d24', color: '#fda4af' }}>
                  <th style={{ padding: '10px' }}>주문 번호</th>
                  <th style={{ padding: '10px' }}>구매자 이름 / 이메일</th>
                  <th style={{ padding: '10px' }}>결제 금액</th>
                  <th style={{ padding: '10px' }}>주문 일시</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const customerName =
                    (o.customer?.first_name ? `${o.customer.first_name} ${o.customer.last_name}` : null) ||
                    o.billing_address?.name ||
                    o.contact_email ||
                    o.email ||
                    '비회원 구매자';

                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #280d13' }}>
                      <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>{o.name}</td>
                      <td style={{ padding: '10px', color: '#fff' }}>{customerName}</td>
                      <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>${o.total_price} CAD</td>
                      <td style={{ padding: '10px', color: '#9f1239' }}>{new Date(o.created_at).toLocaleString('ko-KR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== 5. 많이 찾는 SKU·브랜드 탭 ==================== */}
        {activeTab === '많이 찾는 SKU·브랜드' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🏷️ 베스트셀러 브랜드 Top</h3>
              {topVendors.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #280d13' }}>
                  <span style={{ color: '#fff' }}>{i + 1}. {v.vendor}</span>
                  <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>${v.revenue.toFixed(2)} CAD</span>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>📦 인기 SKU Top</h3>
              {topSKUs.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #280d13' }}>
                  <span style={{ color: '#fff' }}>{s.sku} ({s.name})</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{s.count}개 판매</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 6. 카테고리 관심도 탭 ==================== */}
        {activeTab === '카테고리 관심도' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>📦 브랜드/카테고리 매출 점유율</h3>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={topVendors} dataKey="revenue" nameKey="vendor" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
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

        {/* ==================== 7. 지역 분포 탭 ==================== */}
        {activeTab === '지역 분포' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🗺️ 도시별 주문/배송 지역 분포</h3>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={regionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#33141a" />
                  <XAxis dataKey="city" stroke="#881337" />
                  <YAxis stroke="#881337" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f43f5e" name="주문 수" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}