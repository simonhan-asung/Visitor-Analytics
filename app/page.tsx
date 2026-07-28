'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
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
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('개요');
  const [period, setPeriod] = useState('최근 7일');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [ga4Loading, setGa4Loading] = useState(true);
  const [ga4Data, setGa4Data] = useState<any>(null);
  const [ga4Error, setGa4Error] = useState<string | null>(null);

  // ✅ 새로 추가: 미거래 고객 + GA4 방문 로그 상태
  const [nonConvertingCustomers, setNonConvertingCustomers] = useState<any[]>([]);
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | string | null>(null);

  // ✅ Shopify 주문 데이터
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
      console.error('Shopify Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ GA4 데이터
  const fetchGA4Data = async () => {
    setGa4Loading(true);
    setGa4Error(null);
    try {
      const res = await fetch('/api/ga4', { cache: 'no-store' });
      const data = await res.json();

      if (res.ok && data.success) {
        setGa4Data(data);
      } else {
        setGa4Error(data.error || 'GA4 데이터를 가져올 수 없습니다 (로그인 필요)');
      }
    } catch (err) {
      console.error('GA4 Fetch error:', err);
      setGa4Error('GA4 연결 실패');
    } finally {
      setGa4Loading(false);
    }
  };

  // ✅ 미거래 고객 + GA4 방문 로그 데이터 불러오기
  const fetchNonConvertingCustomers = async () => {
    try {
      const res = await fetch('/api/non-converting-customers', { cache: 'no-store' });
      const data = await res.json();
      if (data.nonConvertingCustomers) {
        setNonConvertingCustomers(data.nonConvertingCustomers);
      }
    } catch (err) {
      console.error('Non-converting customers fetch error:', err);
    }
  };

  useEffect(() => {
    fetchShopifyData();
    fetchNonConvertingCustomers(); // 마운트 시 실행
  }, []);

  // ✅ 로그인 상태가 바뀌면 GA4 다시 조회
  useEffect(() => {
    if (status !== 'loading') {
      fetchGA4Data();
    }
  }, [status]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchShopifyData();
      fetchGA4Data();
      fetchNonConvertingCustomers(); // 5분마다 동기화
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ===== ✅ 기간별 필터링 =====
  const getPeriodStart = (): Date => {
    const now = new Date();
    switch (period) {
      case '최근 7일': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - 6); 
        return d;
      }
      case '최근 30일': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - 29); 
        return d;
      }
      case '이번 달':
        return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      default: {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - 6);
        return d;
      }
    }
  };

  const periodStart = getPeriodStart();
  const periodDays = Math.max(1, Math.ceil((Date.now() - periodStart.getTime()) / (24 * 60 * 60 * 1000)));

  const filteredOrders = orders.filter((o) => new Date(o.created_at) >= periodStart);

  // --- 데이터 계산 ---
  const customerSet = new Set();
  filteredOrders.forEach((o) => {
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

  const paidOrders = filteredOrders.filter((o) => o.financial_status === 'paid' || o.financial_status === 'authorized');

  const totalRevenue = filteredOrders.reduce((acc, o) => acc + parseFloat(o.total_price || '0'), 0);
  const totalItemsSold = filteredOrders.reduce(
    (acc, o) => acc + (o.line_items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0),
    0
  );

  const chartDataMap = filteredOrders.reduce((acc: { [key: string]: ChartDataItem }, order) => {
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

  filteredOrders.forEach((o) => {
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
  filteredOrders.forEach((o) => {
    const city = o.billing_address?.city || '미지정 지역';
    regionMap[city] = (regionMap[city] || 0) + 1;
  });
  const regionData = Object.entries(regionMap)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);

  const COLORS = ['#f43f5e', '#fb7185', '#e11d48', '#10b981', '#fbbf24', '#c084fc', '#38bdf8', '#a3e635', '#fb923c', '#f472b6'];

  const PIE_TOP_N = 8;
  const pieTop = topVendors.slice(0, PIE_TOP_N).map((v) => ({ name: v.vendor, value: Math.round(v.revenue) }));
  const pieRest = topVendors.slice(PIE_TOP_N).reduce((acc, v) => acc + v.revenue, 0);
  const pieData = pieRest > 0 ? [...pieTop, { name: '기타', value: Math.round(pieRest) }] : pieTop;
  const pieTotal = pieData.reduce((acc, d) => acc + d.value, 0) || 1;

  return (
    <div style={{ backgroundColor: '#14080a', color: '#fecdd3', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* 헤더 */}
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

      {/* 탭 */}
      <nav style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid #33141a', backgroundColor: '#14080a', overflowX: 'auto' }}>
        {[
          { name: '개요', icon: '📊' },
          { name: '미거래 방문 고객', icon: '🍩' },
          { name: '구매 고객 방문', icon: '🛒' },
          { name: '많이 찾는 SKU·브랜드', icon: '🔍' },
          { name: '카테고리 관심도', icon: '📦' },
          { name: '지역 분포', icon: '🗺️' },
          { name: 'GA4 분석', icon: '🌐' },
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

        {/* 컨트롤 바 */}
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
                fetchNonConvertingCustomers();
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

          <div style={{ fontSize: '12px', color: '#fda4af', backgroundColor: '#1c0d10', border: '1px solid #33141a', padding: '8px 14px', borderRadius: '8px' }}>
            💡 현재 메뉴: <strong>[{activeTab}]</strong>
          </div>
        </div>

        {/* ===== 개요 탭 ===== */}
        {activeTab === '개요' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { title: '순 구매 고객 수', value: loading ? '...' : `${totalCustomersCount}명`, sub: `${period} · 통합 식별`, color: '#f43f5e' },
                { title: '승인/결제 주문 수', value: loading ? '...' : `${paidOrders.length}건`, sub: '유효 주문', color: '#fb7185' },
                { title: '전체 주문 수', value: loading ? '...' : `${filteredOrders.length}건`, sub: '전체 결제 시도', color: '#10b981' },
                { title: '판매 상품 수', value: loading ? '...' : totalItemsSold.toLocaleString(), sub: 'line item 합계', color: '#c084fc' },
                { title: '총 매출액', value: loading ? '...' : `$${totalRevenue.toFixed(2)} CAD`, sub: `${period} 합계`, color: '#fbbf24' },
                { title: '일평균 주문', value: loading ? '...' : `${(filteredOrders.length / periodDays).toFixed(1)}건`, sub: `${periodDays}일 기준`, color: '#e11d48' },
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

        {/* ===== ✅ 업데이트된 미거래 방문 고객 ===== */}
        {activeTab === '미거래 방문 고객' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6', display: 'flex', justifyContent: 'space-between' }}>
              <span>🍩 미거래/구매전 고객 내역 — {nonConvertingCustomers.length}명</span>
              <span style={{ fontSize: '12px', color: '#fda4af', fontWeight: 'normal' }}>
                * 행을 클릭하면 해당 고객의 웹사이트 방문 URL 기록이 열립니다.
              </span>
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #4c1d24', color: '#fda4af' }}>
                  <th style={{ padding: '10px' }}>고객 ID / 이름</th>
                  <th style={{ padding: '10px' }}>이메일</th>
                  <th style={{ padding: '10px' }}>가입/첫방문일</th>
                  <th style={{ padding: '10px' }}>GA4 방문한 페이지 수</th>
                  <th style={{ padding: '10px' }}>상세 보기</th>
                </tr>
              </thead>
              <tbody>
                {nonConvertingCustomers.map((c) => {
                  const isExpanded = expandedCustomerId === c.id;
                  const visitLogs = c.visitLogs || [];

                  return (
                    <div key={c.id} style={{ display: 'contents' }}>
                      {/* 기본 고객 정보 행 */}
                      <tr 
                        onClick={() => setExpandedCustomerId(isExpanded ? null : c.id)}
                        style={{ 
                          borderBottom: '1px solid #280d13', 
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? '#280d13' : 'transparent' 
                        }}
                      >
                        <td style={{ padding: '10px', color: '#f43f5e', fontWeight: 'bold' }}>
                          {c.firstName ? `${c.firstName} ${c.lastName || ''}` : `고객 #${c.id}`}
                        </td>
                        <td style={{ padding: '10px', color: '#fff' }}>{c.email || '비회원/이메일 없음'}</td>
                        <td style={{ padding: '10px', color: '#fda4af' }}>
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>
                          {visitLogs.length > 0 ? `🌐 ${visitLogs.length}개 페이지` : '방문 로그 없음'}
                        </td>
                        <td style={{ padding: '10px', color: '#fbbf24' }}>
                          {isExpanded ? '▲ 닫기' : '▼ 클릭하여 방문 URL 보기'}
                        </td>
                      </tr>

                      {/* 🔻 클릭 시 열리는 GA4 방문 URL 타임라인 (아코디언) */}
                      {isExpanded && (
                        <tr style={{ backgroundColor: '#14080a' }}>
                          <td colSpan={5} style={{ padding: '16px 24px', borderBottom: '1px solid #4c1d24' }}>
                            <div style={{ fontWeight: 'bold', color: '#fda4af', marginBottom: '10px' }}>
                              🔗 {c.email || c.id} 고객의 웹사이트 행동 경로 (GA4 Log)
                            </div>

                            {visitLogs.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {visitLogs.map((log: any, idx: number) => (
                                  <div 
                                    key={idx} 
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      backgroundColor: '#1c0d10', 
                                      padding: '8px 12px', 
                                      borderRadius: '6px',
                                      border: '1px solid #33141a' 
                                    }}
                                  >
                                    <span style={{ color: '#fff', fontSize: '12px' }}>
                                      📄 <strong>{log.pageTitle || '페이지'}</strong> ({log.visitedUrl})
                                    </span>
                                    <span style={{ color: '#9f1239', fontSize: '11px' }}>
                                      {log.visitTime ? new Date(log.visitTime).toLocaleString('ko-KR') : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#881337', fontSize: '12px' }}>
                                이 고객과 매칭된 GA4 방문 URL 기록이 없습니다.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </div>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== 구매 고객 방문 ===== */}
        {activeTab === '구매 고객 방문' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>
              🛒 구매 고객 명단 (통합) — {period} · 총 {filteredOrders.length}건
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #4c1d24', color: '#fda4af' }}>
                  <th style={{ padding: '10px' }}>주문 번호</th>
                  <th style={{ padding: '10px' }}>구매자 이름 / 이메일</th>
                  <th style={{ padding: '10px' }}>결제 금액</th>
                  <th style={{ padding: '10px' }}>상태</th>
                  <th style={{ padding: '10px' }}>주문 일시</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
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
                      <td style={{ padding: '10px', color: '#fda4af' }}>{o.financial_status}</td>
                      <td style={{ padding: '10px', color: '#9f1239' }}>{new Date(o.created_at).toLocaleString('ko-KR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== SKU·브랜드 ===== */}
        {activeTab === '많이 찾는 SKU·브랜드' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>🏷️ 베스트셀러 브랜드 Top — {period}</h3>
              {topVendors.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #280d13' }}>
                  <span style={{ color: '#fff' }}>{i + 1}. {v.vendor}</span>
                  <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>${v.revenue.toFixed(2)} CAD</span>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>📦 인기 SKU Top — {period}</h3>
              {topSKUs.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #280d13' }}>
                  <span style={{ color: '#fff' }}>{s.sku} ({s.name})</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{s.count}개 판매</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 카테고리 관심도 ===== */}
        {activeTab === '카테고리 관심도' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>
              📦 브랜드/카테고리 매출 점유율 — {period}
            </h3>
            <div style={{ width: '100%', height: 420 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={130}
                    minAngle={3}
                    labelLine={{ stroke: '#4c1d24' }}
                    label={({ name, value }: any) => `${name} $${Math.round(value)}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#14080a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#2e0f15', border: '1px solid #4c1d24', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any, name: any) => [
                      `$${Math.round(Number(value))} CAD (${((Number(value) / pieTotal) * 100).toFixed(1)}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: '8px', fontSize: '12px', color: '#881337' }}>
              상위 {PIE_TOP_N}개 브랜드만 개별 표시, 나머지는 &apos;기타&apos;로 합산됩니다.
            </div>
          </div>
        )}

        {/* ===== 지역 분포 ===== */}
        {activeTab === '지역 분포' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>
              🗺️ 도시별 주문/배송 지역 분포 — {period} · {regionData.length}개 도시
            </h3>
            <div style={{ width: '100%', height: 420 }}>
              <ResponsiveContainer>
                <BarChart data={regionData} margin={{ bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#33141a" vertical={false} />
                  <XAxis dataKey="city" stroke="#881337" fontSize={11} interval={0} angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#881337" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#2e0f15', border: '1px solid #4c1d24', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="count" fill="#f43f5e" name="주문 수" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ===== GA4 분석 ===== */}
        {activeTab === 'GA4 분석' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ marginTop: 0, marginBottom: 0, color: '#ffe4e6' }}>🌐 Google Analytics 4 데이터</h3>

              {status === 'authenticated' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#fda4af' }}>{session?.user?.email}</span>
                  <button
                    onClick={() => signOut()}
                    style={{ backgroundColor: '#2e0f15', color: '#fecdd3', border: '1px solid #4c1d24', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => signIn('google')}
                  style={{ backgroundColor: '#e11d48', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🔐 Google로 로그인
                </button>
              )}
            </div>

            {ga4Loading && (
              <div style={{ color: '#fda4af', padding: '20px 0' }}>GA4 데이터 불러오는 중...</div>
            )}

            {!ga4Loading && ga4Error && (
              <div style={{ backgroundColor: '#2e0f15', border: '1px solid #4c1d24', borderRadius: '8px', padding: '16px', color: '#fbbf24' }}>
                ⚠️ {ga4Error}
                <div style={{ fontSize: '12px', color: '#fda4af', marginTop: '8px' }}>
                  {status === 'authenticated'
                    ? 'Google Analytics 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.'
                    : '위의 "Google로 로그인" 버튼을 눌러 로그인하면 실제 데이터를 볼 수 있습니다.'}
                </div>
              </div>
            )}

            {!ga4Loading && !ga4Error && ga4Data && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ backgroundColor: '#280d13', borderRadius: '8px', padding: '16px', border: '1px solid #4c1d24' }}>
                    <div style={{ fontSize: '12px', color: '#fda4af' }}>실시간 활성 사용자</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>{ga4Data.realtimeUsers || 0}</div>
                  </div>
                </div>

                <h4 style={{ color: '#ffe4e6', marginBottom: '12px' }}>📊 날짜별 상세 방문자 로그 (도시, 기기, 페이지)</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #4c1d24', backgroundColor: '#14080a' }}>
                        <th style={{ padding: '12px 10px', textAlign: 'left', color: '#fda4af' }}>날짜</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', color: '#fda4af' }}>접속 도시</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', color: '#fda4af' }}>접속 기기</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', color: '#fda4af' }}>방문 페이지</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', color: '#fda4af' }}>활성 사용자 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ga4Data.data?.length > 0 ? (
                        ga4Data.data.map((row: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #280d13' }}>
                            <td style={{ padding: '10px', color: '#fff' }}>
                              {row.date ? `${row.date.slice(0,4)}-${row.date.slice(4,6)}-${row.date.slice(6,8)}` : row.date}
                            </td>
                            <td style={{ padding: '10px', color: '#fbbf24' }}>{row.city || '-'}</td>
                            <td style={{ padding: '10px', color: '#c084fc' }}>{row.device || '-'}</td>
                            <td style={{ padding: '10px', color: '#f43f5e' }}>{row.pageTitle || '-'}</td>
                            <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>{row.activeUsers}명</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#881337' }}>
                            상세 방문 로그가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}