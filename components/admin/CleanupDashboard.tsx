// components/admin/CleanupDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Trash2, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw 
} from 'lucide-react';

interface CleanupStats {
  active_users: number;
  deleted_users: number;
  unverified_pending_deletion: number;
  idle_users: number;
  expired_free_analyses: number;
}

export default function CleanupDashboard() {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/cleanup-stats');
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

  const runCleanup = async () => {
    if (!confirm('Run cleanup now? This will delete marked users.')) return;
    
    try {
      setIsRunning(true);
      const response = await fetch('/api/cron/cleanup-users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Cleanup complete!\n\nDeleted: ${data.results.deleted_users}\nExpired: ${data.results.expired_analyses}`);
        fetchStats();
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      alert('Cleanup failed');
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">User Cleanup Dashboard</h2>
          <p className="text-gray-600">Monitor and manage user cleanup automation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
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

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Active Users */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-green-600">
              {stats?.active_users || 0}
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
              {stats?.deleted_users || 0}
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
              {stats?.unverified_pending_deletion || 0}
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
              {stats?.idle_users || 0}
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
              {stats?.expired_free_analyses || 0}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Expired Free</h3>
          <p className="text-sm text-gray-600">Unused after 30 days</p>
        </div>

        {/* Health Score */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <span className="text-3xl font-bold">
              {Math.round(((stats?.active_users || 0) / 50000) * 100)}%
            </span>
          </div>
          <h3 className="font-semibold">Capacity Used</h3>
          <p className="text-sm text-white/80">
            {stats?.active_users || 0} / 50,000 limit
          </p>
        </div>
      </div>

      {/* Cleanup Schedule */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Cleanup Schedule</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Daily Cleanup</p>
              <p className="text-sm text-gray-600">Runs every day at midnight</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              Active
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Expire Free Analyses</p>
              <p className="text-sm text-gray-600">After 30 days unused</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              Active
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Delete Unverified</p>
              <p className="text-sm text-gray-600">After 7 days + 3 day grace period</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              Active
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Delete Idle Users</p>
              <p className="text-sm text-gray-600">After 12 months inactive</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}