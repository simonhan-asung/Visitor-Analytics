'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from 'recharts';

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
  };
  billing_address?: {
    city?: string;
  };
  line_items?: any[];
}

interface ChartDataItem {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  orderCount: number;
}

export default function ClientDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('개요');
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

  const chartData: ChartDataItem[] = Object.values(chartDataMap).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ backgroundColor: '#14080a', color: '#fecdd3', minHeight: '100vh' }}>
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

      <main style={{ padding: '24px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
          <button onClick={() => fetchShopifyData(true)} disabled={loading} style={{ backgroundColor: loading ? '#7f1d1d' : '#e11d48', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: loading ? 'not-allowed' : 'pointer' }}>
            🔄 {loading ? '동기화 중...' : '새로고침'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#1c0d10', borderRadius: '10px', padding: '16px', border: '1px solid #33141a', borderTop: '3px solid #f43f5e' }}>
            <div style={{ fontSize: '12px', color: '#fda4af', marginBottom: '8px' }}>순 구매 고객</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>{customerSet.size}명</div>
          </div>
          <div style={{ backgroundColor: '#1c0d10', borderRadius: '10px', padding: '16px', border: '1px solid #33141a', borderTop: '3px solid #10b981' }}>
            <div style={{ fontSize: '12px', color: '#fda4af', marginBottom: '8px' }}>전체 주문</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>{orders.length}건</div>
          </div>
          <div style={{ backgroundColor: '#1c0d10', borderRadius: '10px', padding: '16px', border: '1px solid #33141a', borderTop: '3px solid #fbbf24' }}>
            <div style={{ fontSize: '12px', color: '#fda4af', marginBottom: '8px' }}>총 매출</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>${orders.reduce((acc, o) => acc + parseFloat(o.total_price || '0'), 0).toFixed(2)}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ marginTop: 0, color: '#ffe4e6' }}>📈 일별 주문</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33141a" vertical={false} />
                <XAxis dataKey="date" stroke="#881337" />
                <YAxis stroke="#881337" />
                <Tooltip contentStyle={{ backgroundColor: '#2e0f15', border: '1px solid #4c1d24' }} />
                <Bar dataKey="orderCount" fill="#e11d48" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
