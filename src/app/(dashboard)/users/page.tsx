import { Users } from "lucide-react";
import { PageEmpty } from "@/components/page-empty";
import { TopHeader } from "@/components/top-header";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <TopHeader title="Équipe" />
      <PageEmpty Icon={Users} title="Équipe & accès" />
    </div>
  );
}
