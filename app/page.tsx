'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/shopify?force=true');
        const data = await res.json();
        if (data.orders) {
          setOrders(data.orders);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ backgroundColor: '#14080a', color: '#fecdd3', minHeight: '100vh', padding: '24px' }}>
      <h1 style={{ color: '#ffffff' }}>Aone Beauty Analytics</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
        <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#fda4af', marginTop: 0 }}>전체 주문</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>{orders.length}건</p>
        </div>

        <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#fda4af', marginTop: 0 }}>총 매출</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>
            ${orders.reduce((sum, o: any) => sum + parseFloat(o.total_price || 0), 0).toFixed(2)}
          </p>
        </div>

        <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#fda4af', marginTop: 0 }}>상태</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>{loading ? '로딩...' : '완료'}</p>
        </div>
      </div>

      <div style={{ marginTop: '40px', backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '8px', padding: '20px' }}>
        <h2 style={{ color: '#fda4af' }}>최근 주문</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #33141a' }}>
              <th style={{ padding: '10px', textAlign: 'left', color: '#fda4af' }}>주문번호</th>
              <th style={{ padding: '10px', textAlign: 'left', color: '#fda4af' }}>금액</th>
              <th style={{ padding: '10px', textAlign: 'left', color: '#fda4af' }}>날짜</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 10).map((order: any) => (
              <tr key={order.id} style={{ borderBottom: '1px solid #280d13' }}>
                <td style={{ padding: '10px', color: '#fff' }}>{order.name}</td>
                <td style={{ padding: '10px', color: '#10b981' }}>${order.total_price}</td>
                <td style={{ padding: '10px', color: '#9f1239' }}>{new Date(order.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
