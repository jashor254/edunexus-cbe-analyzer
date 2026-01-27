'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client'; // Tumia client-side client hapa
import { User, Mail, Key, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner'; // Kama unatumia sonner kwa notifications

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id) // Tumia ID badala ya Email (ni haraka zaidi)
          .single();
        
        setName(userData?.name || '');
      }
      setLoading(false);
    };
    loadUser();
  }, [supabase]);

  const handleUpdate = async () => {
    setUpdating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', user?.id);

    if (error) {
      alert("Error updating profile");
    } else {
      alert("Profile updated successfully!");
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Profile Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <User className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold">Profile Details</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed">
                  <Mail className="w-4 h-4" />
                  <span>{email}</span>
                </div>
              </div>

              <button 
                onClick={handleUpdate}
                disabled={updating}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-red-50/50 rounded-2xl border border-red-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-red-900">Danger Zone</h2>
            </div>
            <p className="text-sm text-red-700 mb-4">
              Deleting your account will remove all your data, assessments, and AI reports. This action is irreversible.
            </p>
            <button className="px-6 py-2 bg-white border border-red-200 text-red-600 font-semibold rounded-lg hover:bg-red-600 hover:text-white transition-all">
              Delete Account
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}