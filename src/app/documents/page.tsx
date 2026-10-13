import { DocumentsClient } from "@/components/DocumentsClient";
import { PageHeader } from "@/components/ui";
import { listDocuments } from "@/lib/documents";
import { DOCUMENT_CATEGORIES } from "@/lib/documentsShared";
import { listVehicles } from "@/lib/fleet";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const [documents, vehicles] = await Promise.all([
    listDocuments({ status: status === "all" ? undefined : status }),
    listVehicles(),
  ]);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every legal document in one register — registration papers, insurance policies, licences, permits and contracts — with expiry and renewal dates, most urgent first."
      />
      <DocumentsClient
        documents={documents}
        categories={DOCUMENT_CATEGORIES}
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          code: vehicle.code,
          make: vehicle.make,
          model: vehicle.model,
        }))}
        statusFilter={status}
      />
    </>
  );
}
