import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Badge, ConfirmDialog, EmptyState, ErrorBox, Field, Loading, Select, TextArea, TextInput } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { formatDateTime, fromLocalInput, toLocalInput } from "../../../lib/format";
import { Btn, Feedback, Pager, Panel, SectionTitle, Table, Td, useAction } from "../common";

export function NewsList() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/news?page=${page}&size=25`);
  const [del, setDel] = useState(null);
  const { run, busy, error: aerr, message } = useAction();
  const remove = async () => {
    const n = del; setDel(null);
    const r = await run(() => api.del(`/admin/news/${n.id}?confirm=yes`), "Novinka zmazaná.");
    if (r.ok) reload();
  };
  return (
    <div>
      <SectionTitle title="News Management"><Link to="/admin/news/new"><Btn tone="primary"><span className="gold-gradient-text">Nová novinka</span></Btn></Link></SectionTitle>
      <Feedback error={aerr} message={message} />
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.items.length === 0 && <EmptyState title="Žiadne novinky" text="Vytvorte prvú novinku." />}
      {data && data.items.length > 0 && (
        <Panel>
          <Table head={["Názov", "Stav", "Dátum", "Autor", ""]}>
            {data.items.map((n) => {
              const scheduled = n.status === "published" && n.publishedAt && new Date(n.publishedAt) > new Date();
              return (
                <tr key={n.id}>
                  <Td><span className="text-(--color-text)">{n.title}</span><br /><span className="text-[10px] text-(--color-text-dim)">/{n.slug}</span></Td>
                  <Td>{n.status === "draft" ? <Badge>koncept</Badge> : scheduled ? <Badge tone="gold">naplánovaná</Badge> : <Badge tone="green">zverejnená</Badge>}</Td>
                  <Td className="whitespace-nowrap">{n.publishedAt ? formatDateTime(n.publishedAt) : "—"}</Td>
                  <Td>{n.author || "—"}</Td>
                  <Td className="whitespace-nowrap"><Link to={`/admin/news/${n.id}`}><Btn>Upraviť</Btn></Link> <Btn tone="danger" disabled={busy} onClick={() => setDel(n)}>Zmazať</Btn></Td>
                </tr>
              );
            })}
          </Table>
          <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />
        </Panel>
      )}
      <ConfirmDialog open={Boolean(del)} title="Zmazať novinku?" text={`„${del?.title}“ bude natrvalo zmazaná.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}

const blocksToText = (blocks) => (blocks || []).map((b) => (b.type === "h2" ? `## ${b.text}` : b.type === "list" ? b.items.map((i) => `- ${i}`).join("\n") : b.text)).join("\n\n");
function textToBlocks(text) {
  const out = [];
  for (const chunk of text.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-*]\s+/.test(l))) out.push({ type: "list", items: lines.map((l) => l.replace(/^[-*]\s+/, "")) });
    else if (/^##\s+/.test(chunk)) out.push({ type: "h2", text: chunk.replace(/^##\s+/, "").replace(/\n/g, " ") });
    else out.push({ type: "p", text: lines.join(" ") });
  }
  return out;
}

export function NewsEdit() {
  const { id } = useParams();
  const isNew = id === "new";
  const { data, error, loading, reload } = useApi(isNew ? null : `/admin/news/${id}`);
  if (!isNew && loading) return <Loading />;
  if (!isNew && error) return <ErrorBox message={error} onRetry={reload} />;
  return <NewsForm key={id} post={isNew ? null : data.post} />;
}

function NewsForm({ post }) {
  const nav = useNavigate();
  const [f, setF] = useState({
    title: post?.title || "", slug: post?.slug || "", excerpt: post?.excerpt || "", image: post?.image || "", category: post?.category || "",
    author: post?.author || "", body: blocksToText(post?.content), status: post?.status || "draft", publishedAt: toLocalInput(post?.publishedAt),
    seoTitle: post?.seoTitle || "", seoDescription: post?.seoDescription || "",
  });
  const { run, busy, error, message } = useAction();
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const save = async () => {
    const content = textToBlocks(f.body);
    const body = {
      title: f.title, excerpt: f.excerpt || null, image: f.image || null, category: f.category || null, author: f.author || null,
      content, status: f.status, publishedAt: f.status === "published" ? fromLocalInput(f.publishedAt) : null,
      seoTitle: f.seoTitle || null, seoDescription: f.seoDescription || null,
      ...(f.slug ? { slug: f.slug } : {}),
    };
    const r = await run(() => (post ? api.put(`/admin/news/${post.id}`, body) : api.post("/admin/news", body)), "Uložené.");
    if (r.ok && !post) nav(`/admin/news/${r.data.id}`, { replace: true });
  };
  return (
    <div>
      <SectionTitle title={post ? "Upraviť novinku" : "Nová novinka"}><Link to="/admin/news"><Btn>← Zoznam</Btn></Link></SectionTitle>
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Názov" className="sm:col-span-2"><TextInput value={f.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Slug (URL)" hint="Prázdne = vygeneruje sa z názvu."><TextInput value={f.slug} onChange={(e) => set({ slug: e.target.value })} /></Field>
          <Field label="Kategória"><TextInput value={f.category} maxLength={40} onChange={(e) => set({ category: e.target.value })} /></Field>
          <Field label="Autor"><TextInput value={f.author} maxLength={80} onChange={(e) => set({ author: e.target.value })} /></Field>
          <Field label="Obrázok (https://… alebo /cesta)"><TextInput value={f.image} onChange={(e) => set({ image: e.target.value })} /></Field>
          <Field label="Krátky popis" className="sm:col-span-2"><TextArea rows={2} value={f.excerpt} maxLength={500} onChange={(e) => set({ excerpt: e.target.value })} /></Field>
          <Field label="Obsah" hint="Odseky oddeľte prázdnym riadkom. „## Nadpis“ = nadpis, riadky začínajúce „- “ = zoznam." className="sm:col-span-2">
            <TextArea rows={14} value={f.body} onChange={(e) => set({ body: e.target.value })} />
          </Field>
          <Field label="Stav">
            <Select value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="draft">Koncept (neviditeľné)</option>
              <option value="published">Zverejnené</option>
            </Select>
          </Field>
          <Field label="Dátum zverejnenia" hint="Budúci dátum = naplánované."><TextInput type="datetime-local" disabled={f.status !== "published"} value={f.publishedAt} onChange={(e) => set({ publishedAt: e.target.value })} /></Field>
          <Field label="SEO titulok"><TextInput value={f.seoTitle} maxLength={120} onChange={(e) => set({ seoTitle: e.target.value })} /></Field>
          <Field label="SEO popis"><TextInput value={f.seoDescription} maxLength={300} onChange={(e) => set({ seoDescription: e.target.value })} /></Field>
        </div>
        <Feedback error={error} message={message} />
        <div><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn></div>
      </Panel>
    </div>
  );
}
