import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import ClientDashboard from '@/components/ClientDashboard';

export default async function VisitorAnalyticsDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/auth/signin');
  }

  return <ClientDashboard />;
}
