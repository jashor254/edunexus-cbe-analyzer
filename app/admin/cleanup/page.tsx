// app/admin/cleanup/page.tsx
import CleanupDashboard from "@/components/admin/CleanupDashboard";

export default function CleanupPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">System Cleanup</h1>
      <CleanupDashboard />
    </div>
  );
}