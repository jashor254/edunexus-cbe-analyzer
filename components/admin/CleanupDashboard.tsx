'use client';

import { useState, useEffect } from 'react';
import { 
  Trash2, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Shield
} from 'lucide-react';

interface CleanupStats {
  active_users: number;
  deleted_users: number;
  unverified_pending_deletion: number;
  idle_users: number;
  expired_free_analyses: number;
}

interface CleanupResult {
  deleted_count: number;
  idle_deleted: number;
  unverified_deleted: number;
}

export default function CleanupDashboard() {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

  // ✅ FIXED: Stats fetched from ADMIN route (protected by middleware)
  // NOT from cron route - different purpose, different protection
  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/cleanup-stats', {
        headers: {
          // ✅ Admin secret from server-side only
          // This component should only render on admin pages
          // which are protected by layout auth check
        }
      });

      if (!response.ok) {
        throw new Error(`Failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: Cleanup triggered via SERVER ACTION, not client-side secret
  const runCleanup = async () => {
    if (!confirm('Run cleanup now? This will delete marked users.')) return;

    try {
      setIsRunning(true);

      // ✅ Call admin trigger endpoint (server handles the cron secret internally)
      // Admin route is protected by middleware x-admin-secret
      // The SERVER then calls cron with the secret - client never sees it
      const response = await fetch('/api/admin/trigger-cleanup', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setLastResult(data.results);
        alert(
          `✅ Cleanup complete!\n\n` +
          `Deleted: ${data.results.deleted_count ?? 0}\n` +
          `Idle removed: ${data.results.idle_deleted ?? 0}\n` +
          `Unverified removed: ${data.results.unverified_deleted ?? 0}`
        );
        fetchStats(); // Refresh stats
      } else {
        alert(`❌ Cleanup failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Cleanup failed:', error);
      alert(`❌ Cleanup failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">
              User Cleanup Dashboard
            </h2>
          </div>
          <p className="text-gray-600">
            Monitor and manage user cleanup automation
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={runCleanup}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isRunning ? 'Running...' : 'Run Cleanup Now'}
          </button>
        </div>
      </div>

      {/* Last Cleanup Result */}
      {lastResult && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 font-semibold">
            Last cleanup: {lastResult.deleted_count} deleted •{' '}
            {lastResult.idle_deleted} idle removed •{' '}
            {lastResult.unverified_deleted} unverified removed
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Active Users */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-green-600">
              {stats?.active_users ?? 0}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Active Users</h3>
          <p className="text-sm text-gray-600">Currently active</p>
        </div>

        {/* Deleted Users */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-gray-600" />
            </div>
            <span className="text-3xl font-bold text-gray-600">
              {stats?.deleted_users ?? 0}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Deleted Users</h3>
          <p className="text-sm text-gray-600">Soft deleted</p>
        </div>

        {/* Pending Deletion */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-3xl font-bold text-orange-600">
              {stats?.unverified_pending_deletion ?? 0}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Pending Deletion</h3>
          <p className="text-sm text-gray-600">Unverified users</p>
        </div>

        {/* Idle Users */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-3xl font-bold text-yellow-600">
              {stats?.idle_users ?? 0}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Idle Users</h3>
          <p className="text-sm text-gray-600">12+ months inactive</p>
        </div>

        {/* Expired Analyses */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-3xl font-bold text-red-600">
              {stats?.expired_free_analyses ?? 0}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Expired Free</h3>
          <p className="text-sm text-gray-600">Unused after 30 days</p>
        </div>

        {/* Capacity */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <span className="text-3xl font-bold">
              {Math.round(((stats?.active_users ?? 0) / 50000) * 100)}%
            </span>
          </div>
          <h3 className="font-semibold">Capacity Used</h3>
          <p className="text-sm text-white/80">
            {stats?.active_users ?? 0} / 50,000 limit
          </p>
        </div>

      </div>

      {/* Cleanup Schedule */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Cleanup Schedule
        </h3>
        <div className="space-y-3">
          {[
            {
              title: 'Daily Cleanup',
              desc: 'Runs every day at midnight',
            },
            {
              title: 'Expire Free Analyses',
              desc: 'After 30 days unused',
            },
            {
              title: 'Delete Unverified',
              desc: 'After 7 days + 3 day grace period',
            },
            {
              title: 'Delete Idle Users',
              desc: 'After 12 months inactive',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}