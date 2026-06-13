import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Navigation } from '@/components/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }
  
  if (session.user.role !== 'ADMINISTRATOR') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation role={session.user.role} userName={session.user.name}/>
      <main className="container mx-auto px-4 py-6 pb-28 md:px-6 md:py-8 lg:pb-8">
        {children}
      </main>
    </div>
  );
}