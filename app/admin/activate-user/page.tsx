// app/admin/activate-user/page.tsx
import ActivateUserForm from "@/components/admin/ActivateUserForm";

export default function ActivateUserPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Manual Payment Activation</h1>
      <ActivateUserForm />
    </div>
  );
}
