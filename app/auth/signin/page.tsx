'use client';

import { signIn } from 'next-auth/react';

export default function SignIn() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#14080a' }}>
      <div style={{ backgroundColor: '#1c0d10', border: '1px solid #33141a', borderRadius: '12px', padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
        <h1 style={{ color: '#ffffff', marginBottom: '30px' }}>Aone Beauty Analytics</h1>
        <p style={{ color: '#fda4af', marginBottom: '20px' }}>Google로 로그인하여 데이터를 확인하세요</p>
        
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{
            backgroundColor: '#e11d48',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          🔐 Google로 로그인
        </button>
      </div>
    </div>
  );
}
