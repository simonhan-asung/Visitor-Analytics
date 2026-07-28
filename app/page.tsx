'use client';

import { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface Order {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  email?: string;
  customer?: any;
  billing_address?: any;
  line_items?: any[];
}

interface ChartDataItem {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  orderCount: number;
}

export default function VisitorAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('개요');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ga4Data, setGA4Data] = useState<any>(null);
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
        setGA4Data(data);
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
    const customerId = o.customer?.id || o.email || o.name;
    if (customerId) customerSet.add(customerId);
  });

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

  const chartData = Object.values(chartDataMap).sort((a, b) => a.date.localeCompare(b.date));
  const COLORS = ['#f43f5e', '#fb7185', '#e11d48', '#10b981', '#fbbf24', '#c084fc'];

  return (
    <div style={{ backgroundColor: '#14080a', color: '#fecdd3', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #33141a', backgroundColor: '#0f0507' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#ffffff' }}>Aone Beauty</span>
          <span style={{ color: '#521d26' }}>|</span>
          <span style={{ fontSize: '14px', color: '#fda4af' }}>Visitor Analytics</span>
        </div>
        <div style={{ fontSize: '13px', color: '#9f1239' }}>
          업데이트: {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid #33141a', backgroundColor: '#14080a', overflowX: 'auto' }}>
        {['개요', '미거래 고객', '구매 고객', 'SKU·브랜드', '카테고리', '지역 분포', 'GA4 분석'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '14px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #f43f5e' : '2px solid transparent',
              color: activeTab === tab ? '#f43f5e' : '#fb7185',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main style={{ padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
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
              cursor: 'pointer',
            }}
          >
            🔄 {loading ? '동기화 중...' : '새로고침'}
          </button>
        </div>

        {activeTab === '개요' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#1c0d10', borderRadius: '10px', padding: '16px', border: '1px solid #33141a', borderTop: '3px solid #f43f5e' }}>
                <div style={{ fontSize: '12px', color: '#fda4af' }}>순 구매 고객</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>{customerSet.size}명</div>
              </div>
              <div style={{ backgroundColor: '#1c0d10', borderRadius: '10px', padding: '16px', border: '1px solid #33141a', borderTop: '3px solid #10b981' }}>
                <div style={{ fontSize: '12px', color: '#fda4af' }}>전체 주문</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>{orders.length}건</div>
              </div>
              <div style={{ backgroundColor: '#1c0d10', borderRadius: '10px', padding: '16px', border: '1px solid #33141a', borderTop: '3px solid #fbbf24' }}>
                <div style={{ fontSize: '12px', color: '#fda4af' }}>총 매출</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>${orders.reduce((sum, o) => sum + parseFloat(o.total_price || '0'), 0).toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>📈 일별 트래픽</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#33141a" />
                      <XAxis dataKey="date" stroke="#881337" />
                      <YAxis stroke="#881337" />
                      <Bar dataKey="orderCount" fill="#e11d48" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'GA4 분석' && (
          <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ color: '#ffe4e6' }}>📊 Google Analytics 4 데이터</h3>
            {ga4Data ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ backgroundColor: '#280d13', borderRadius: '8px', padding: '16px', border: '1px solid #4c1d24' }}>
                    <div style={{ fontSize: '12px', color: '#fda4af' }}>실시간 활성 사용자</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>{ga4Data.realtimeUsers || 0}</div>
                  </div>
                </div>
                
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ color: '#fda4af' }}>일별 데이터</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #4c1d24' }}>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#fda4af' }}>날짜</th>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#fda4af' }}>활성 사용자</th>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#fda4af' }}>페이지뷰</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ga4Data.data?.slice(0, 7).map((row: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #280d13' }}>
                          <td style={{ padding: '10px', color: '#fff' }}>{row.date}</td>
                          <td style={{ padding: '10px', color: '#10b981' }}>{row.activeUsers}</td>
                          <td style={{ padding: '10px', color: '#f43f5e' }}>{row.pageViews}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ color: '#fda4af', marginTop: '20px' }}>GA4 데이터 로딩 중...</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
