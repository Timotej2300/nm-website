import { useState } from "react";
import { EmptyState, ErrorBox, Field, Loading, TextInput } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { formatDateTime } from "../../../lib/format";
import { Pager, Panel, SectionTitle, Table, Td, qs } from "../common";

export default function Audit() {
  const [f, setF] = useState({ action: "", actor: "", q: "", page: 1 });
  const { data, error, loading, reload } = useApi(`/admin/audit${qs({ ...f, size: 50 })}`);
  const set = (p) => setF((s) => ({ ...s, page: 1, ...p }));
  return (
    <div>
      <SectionTitle title="Audit Log" />
      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Akcia (začína na)" hint="napr. auth, roles, maintenance, tickets"><TextInput value={f.action} onChange={(e) => set({ action: e.target.value })} /></Field>
          <Field label="Autor (nick)"><TextInput value={f.actor} onChange={(e) => set({ actor: e.target.value })} /></Field>
          <Field label="Hľadať v popise"><TextInput value={f.q} onChange={(e) => set({ q: e.target.value })} /></Field>
        </div>
        {loading && <Loading />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {data && data.items.length === 0 && <EmptyState title="Žiadne záznamy" />}
        {data && data.items.length > 0 && (
          <>
            <Table head={["Čas", "Autor", "Akcia", "Cieľ", "Popis"]}>
              {data.items.map((i) => (
                <tr key={i.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(i.createdAt)}</Td>
                  <Td>{i.actor || "—"}</Td>
                  <Td className="whitespace-nowrap text-(--color-text)">{i.action}</Td>
                  <Td>{i.targetType ? `${i.targetType}${i.targetId ? ` #${i.targetId}` : ""}` : "—"}</Td>
                  <Td>{i.summary || "—"}</Td>
                </tr>
              ))}
            </Table>
            <Pager page={data.page} size={data.size} total={data.total} onPage={(page) => setF((s) => ({ ...s, page }))} />
          </>
        )}
      </Panel>
    </div>
  );
}
