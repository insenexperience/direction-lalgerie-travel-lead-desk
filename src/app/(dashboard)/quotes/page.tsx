import { FileText } from "lucide-react";
import { PageEmpty } from "@/components/page-empty";
import { TopHeader } from "@/components/top-header";

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <TopHeader title="Devis" />
      <PageEmpty Icon={FileText} title="Espace devis" />
    </div>
  );
}
