// app/admin/careers/page.tsx

import { createClient } from '@/utils/supabase/server';

export default async function AdminCareersPage() {
  const supabase = await createClient();
  
  const { data: pendingCareers } = await supabase
    .from('dynamic_careers')
    .select('*')
    .eq('status', 'pending')
    .order('times_requested', { ascending: false });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Career Requests Review</h1>
      
      <div className="space-y-4">
        {pendingCareers?.map((request) => (
          <div key={request.id} className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">{request.career_name}</h3>
                <p className="text-sm text-gray-600">
                  Requested {request.times_requested} times | 
                  Last: {new Date(request.last_requested_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-green-600 text-white rounded">
                  ✅ Approve
                </button>
                <button className="px-4 py-2 bg-red-600 text-white rounded">
                  ❌ Reject
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(request.career_data, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}