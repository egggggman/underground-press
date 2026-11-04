import { useRef, useState } from 'react';
import { Upload, Pencil, Trash2 } from 'lucide-react';
import { useRequestUploadUrl, type Asset } from '@workspace/api-client-react';
import { usePress, errMsg } from '@/lib/press';
import { useToast } from '@/hooks/use-toast';
import '@/styles/press-direction.css';
import { StyleBadge } from '@/components/asset-style-review';
import { Head, Loading, ErrorState, Tag, statusKind, Modal, Empty, Confirm, WriteNote } from '@/components/bits';

const PAGES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const blank = (): Asset => ({ id: crypto.randomUUID(), name: '', objectPath: '', contentType: '', size: 0, caption: '', credit: '', source: '', provenance: 'uploaded_unverified', pages: [], review: 'pending', reviewer: '', reviewNotes: '', dpi: 0 });
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Assets() {
  const { issue, isLoading, error, refetch, run, pending, canWrite, auth } = usePress();
  const { toast } = useToast();
  const reqUrl = useRequestUploadUrl();
  const [form, setForm] = useState<Asset | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Asset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (isLoading) return <Loading />;
  if (error || !issue) return <ErrorState error={error} retry={refetch} />;
  const set = (k: keyof Asset, v: unknown) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const open = (a: Asset | null) => { setFile(null); setIsNew(!a); setForm(a ?? blank()); };
  const close = () => {
    if (busy) return;
    if (form?.objectPath && !window.confirm('This uploaded file has no saved asset record yet. Close and leave the unlisted file in storage?')) return;
    setForm(null);
  };
  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      let asset = form;
      if (isNew) {
        if (!form.objectPath) {
          if (!file) { toast({ title: 'Choose a file first', variant: 'destructive' }); return; }
          if (file.size > 20 * 1024 * 1024) throw new Error('Files must be 20 MB or smaller.');
          const ct = file.type || 'application/octet-stream';
          const { uploadURL, objectPath } = await reqUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: ct } });
          const put = await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': ct } });
          if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`);
          asset = { ...form, name: form.name || file.name, objectPath, contentType: ct, size: file.size };
          setForm(asset);
        }
      }
      const ok = await run(isNew ? { action: 'add_asset', asset } : { action: 'edit_asset', id: asset.id, asset }, isNew ? 'Asset uploaded, unverified' : 'Asset saved; review reset');
      if (ok) setForm(null);
    } catch (e) {
      toast({ title: 'Upload failed', description: errMsg(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <div>
      <Head kicker="Asset locker" title="Assets">
        <button className="btn btn-red" disabled={!canWrite} onClick={() => open(null)} data-testid="button-upload-asset"><Upload size={14} />Upload asset</button>
      </Head>
      <WriteNote canWrite={canWrite} login={auth.login} />
      <p className="text-sm mb-4 max-w-2xl">Uploads land as unverified until a person reviews them in Artwork. Original working files stay private to signed-in collaborators before and after review. Approval never publishes a file; public release requires a separate explicit copy to public asset storage. Max 20 MB. Use raster images, PDFs, plain text, or binary source files—not active HTML or SVG. Credit and source matter: Nobody publishes, but everybody gets named.</p>
      <div className="card-flat mb-4 text-sm" data-testid="note-media-backup">
        Media bytes are stored separately from these asset records. To back them up or restore missing files from the selected GitHub repository, use the separately previewed media transfer in Repository. A transfer does not approve artwork or verify its source.
      </div>
      {issue.assets.length === 0 ? (
        <Empty title="No assets on file" body="Upload a photo, scan or drawing and tag the pages it runs on.">
          <button className="btn btn-red" disabled={!canWrite} onClick={() => open(null)} data-testid="button-upload-empty">Upload the first one</button>
        </Empty>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-sm" data-testid="table-assets">
            <thead className="bg-[#1e1812] text-[#f2ead3] mono text-xs uppercase"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Provenance</th><th className="p-2 text-left">Pages</th><th className="p-2 text-left">DPI</th><th className="p-2 text-left">Review</th><th className="p-2" /></tr></thead>
            <tbody>
              {issue.assets.map((a) => (
                <tr key={a.id} className="border-t border-[#1e181255] align-top" data-testid={`row-asset-${a.id}`}>
                  <td className="p-2">{canWrite && a.contentType.startsWith('image/') && a.objectPath && <div className="pd-frame press-preview inline-block mb-1"><img className="max-h-16" loading="lazy" src={`${import.meta.env.BASE_URL}api/storage${a.objectPath}`} alt={a.caption || a.name} /></div>}<b className="block">{a.name}</b><div className="mono text-xs">{a.contentType} / {kb(a.size)}</div><div className="text-xs italic">{a.caption}</div><div className="text-xs">Credit: {a.credit || 'missing'} / Source: {a.source || 'missing'}</div></td>
                  <td className="p-2"><Tag kind={statusKind(a.provenance)}>{a.provenance.replace(/_/g, ' ')}</Tag></td>
                  <td className="p-2 mono">{a.pages.join(', ') || '-'}</td>
                  <td className="p-2 mono">{a.dpi || 'unset'}</td>
                  <td className="p-2"><Tag kind={statusKind(a.review)}>{a.review}</Tag><div className="mt-1"><StyleBadge asset={a} issue={issue} /></div></td>
                  <td className="p-2 whitespace-nowrap">
                    <button className="btn btn-ghost" disabled={!canWrite} onClick={() => open(a)} aria-label="Edit asset" data-testid={`button-edit-asset-${a.id}`}><Pencil size={14} /></button>
                    <button className="btn btn-ghost" disabled={!canWrite} onClick={() => setDel(a)} aria-label="Delete asset" data-testid={`button-delete-asset-${a.id}`}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!form} title={isNew ? 'Upload asset' : 'Edit asset'} onClose={close}>
        {form && (
          <div className="space-y-3">
            {isNew && (
              <div><label className="lbl" htmlFor="af">File</label>
                <input id="af" ref={fileRef} type="file" className="field" disabled={!!form.objectPath} onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="input-asset-file" />
                {file && <p className="text-xs mt-1">{file.name} / {kb(file.size)}{file.size > 20971520 ? ' (over 20 MB limit)' : ''}</p>}</div>
            )}
            {isNew && form.objectPath && <p className="card-flat text-xs" role="status" data-testid="notice-upload-complete">File upload completed. Asset details are not saved until the server confirms them; retrying will reuse this upload.</p>}
            <div><label className="lbl" htmlFor="a1">Name</label><input id="a1" className="field" value={form.name} onChange={(e) => set('name', e.target.value)} data-testid="input-asset-name" /></div>
            <div><label className="lbl" htmlFor="a2">Caption</label><input id="a2" className="field" value={form.caption} onChange={(e) => set('caption', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="lbl" htmlFor="a3">Credit</label><input id="a3" className="field" value={form.credit} onChange={(e) => set('credit', e.target.value)} /></div>
              <div><label className="lbl" htmlFor="a4">Source</label><input id="a4" className="field" value={form.source} onChange={(e) => set('source', e.target.value)} /></div>
            </div>
            <div><label className="lbl" htmlFor="a5">Measured DPI (0 if unknown)</label><input id="a5" type="number" min={0} className="field" value={form.dpi} onChange={(e) => set('dpi', Number(e.target.value) || 0)} data-testid="input-asset-dpi" /></div>
            <div><span className="lbl">Pages</span><div className="flex flex-wrap gap-2">
              {PAGES.map((n) => (
                <label key={n} className={`tag cursor-pointer ${form.pages.includes(n) ? 'tag-ok' : ''}`}>
                  <input type="checkbox" className="sr-only" checked={form.pages.includes(n)} data-testid={`checkbox-asset-page-${n}`}
                    onChange={() => set('pages', form.pages.includes(n) ? form.pages.filter((x) => x !== n) : [...form.pages, n].sort((a, b) => a - b))} />{n}
                </label>
              ))}</div></div>
            <div className="flex justify-end gap-2"><button className="btn" disabled={busy} onClick={close}>Cancel</button>
              <button className="btn btn-green" disabled={busy || pending} onClick={save} data-testid="button-save-asset">{busy ? 'Working...' : isNew ? 'Upload and add' : 'Save asset'}</button></div>
          </div>
        )}
      </Modal>
      <Confirm open={!!del} title="Delete this asset?" body={`"${del?.name}" metadata will leave the working copy. Unassign it from puzzles first. The stored file and historical snapshots are preserved.`} label="Delete asset" pending={pending}
        onClose={() => setDel(null)} onConfirm={async () => { if (del && (await run({ action: 'delete_asset', id: del.id }, 'Asset deleted'))) setDel(null); }} />
    </div>
  );
}
