import { api } from "../../lib/api";

export default function ExportTab({ clientId }: { clientId: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <h3 className="mb-2 font-semibold text-white">CSV export</h3>
        <p className="mb-3 text-sm text-muted">Every logged set for this client, ready for a spreadsheet.</p>
        <a className="btn-secondary inline-flex w-fit" href={api.clients.exportCsvUrl(clientId)} download>
          Download CSV
        </a>
      </div>
      <div className="card">
        <h3 className="mb-2 font-semibold text-white">Shareable PDF report</h3>
        <p className="text-sm text-muted">
          Branded PDF reports and auto weekly summaries land in Phase 3 — this is a lightweight first pass for now.
        </p>
      </div>
    </div>
  );
}
