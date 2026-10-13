import { SeedButton } from "@/components/SeedButton";
import { SettingsForm } from "@/components/SettingsForm";
import { PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business identity, numbering sequences and VAT policy used across invoices, receipts and returns."
      >
        <SeedButton label="Load demo dataset" />
      </PageHeader>
      <SettingsForm settings={settings} />
    </>
  );
}
