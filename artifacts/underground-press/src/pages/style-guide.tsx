import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetIssueQueryKey, useRequestUploadUrl, type Issue, type ArtReference, type Asset } from '@workspace/api-client-react';
import { usePress, errMsg, fmt, downloadJson } from '@/lib/press';
import { useToast } from '@/hooks/use-toast';
import { Head, Loading, ErrorState, Tag, WriteNote, ApprovalDialog, ApprovalIdentity } from '@/components/bits';
import '@/styles/press-direction.css';
import { PROVISIONAL, ensureCondensedFont } from '@/components/asset-style-review';
ensureCondensedFont();

const KINDS = [['golden_image', 'Golden Image'], ['front_page', 'Front-page benchmark']] as const;
const SW = [['Newsprint', '#e6d9b8'], ['Ink black', '#1b1511'], ['Oxblood', '#5c1a20'], ['Sewer green', '#34503f'], ['Mustard', '#d6a021']];
const RULES = ['Dense, legible 1991 offset alternative tabloid.', 'Warm distressed newsprint; black, oxblood, sewer-green and mustard spot inks.', 'Condensed headlines over editorial serif body.', 'Restrained halftone and imperfect registration.', 'Boxed modular columns.', 'Hand-drawn ink and vintage-comic portraits, adverts and puzzles.', 'Approved art is never filtered, edited, restyled or regenerated.'];
const base = `${import.meta.env.BASE_URL}api/storage`;

export default function StyleGuide() {
  const { issue, isLoading, error, refetch, run, pending, canWrite, auth } = usePress();
  const qc = useQueryClient();
    const { toast } = useToast();
  const reqUrl = useRequestUploadUrl();
  const isMyrtle = auth.roles.includes('myrtle_editor');
  const accountName = [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ').trim() || auth.user?.email || auth.user?.id;
  const [kind, setKind] = useState<'golden_image' | 'front_page'>('golden_image');
  const [title, setTitle] = useState(''); const [src, setSrc] = useState(''); const [mode, setMode] = useState<'asset' | 'url'>('asset');
  const [assetId, setAssetId] = useState(''); const [url, setUrl] = useState(''); const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null); const [credit, setCredit] = useState(''); const [source, setSource] = useState(''); const [busy, setBusy] = useState(false);
  const [conf, setConf] = useState<ArtReference | null>(null); const [confRev, setConfRev] = useState(0);
  const [regRev, setRegRev] = useState<number | null>(null); const [upErr, setUpErr] = useState('');
  if (isLoading) return <Loading />;
  if (error || !issue) return <ErrorState error={error} retry={refetch} />;
  const ad = issue.artDirection; const refs = ad?.references ?? []; const hist = [...(ad?.history ?? [])].reverse();
  const frontPageRef = refs.find((r) => r.kind === 'front_page');
  const confirmedFrontPage = [...refs, ...(ad?.history ?? [])]
    .filter((r) => r.kind === 'front_page' && !!r.approval && r.id !== frontPageRef?.id)
    .sort((a, b) => b.version - a.version)[0];
  const comparableFrontPageReplacement = isMyrtle && canWrite && frontPageRef && !frontPageRef.approval &&
    confirmedFrontPage?.assetSnapshot?.contentType.startsWith('image/') && confirmedFrontPage.assetSnapshot.objectPath &&
    frontPageRef.assetSnapshot?.contentType.startsWith('image/') && frontPageRef.assetSnapshot.objectPath
    ? { confirmed: confirmedFrontPage, proposed: frontPageRef }
    : null;
  const upload = async () => {
    if (!file || !credit.trim() || !source.trim()) return;
    setBusy(true); setUpErr('');
    let stage = 'request upload';
    try {
      const ct = file.type || 'application/octet-stream';
      const { uploadURL, objectPath } = await reqUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: ct } });
      stage = 'storage upload';
      const put = await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': ct } });
      if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`);
      const asset: Asset = { id: crypto.randomUUID(), name: file.name, objectPath, contentType: ct, size: file.size, caption: 'Reference artwork', credit, source, provenance: 'uploaded_unverified', pages: [], review: 'pending', reviewer: '', reviewNotes: '', dpi: 0 };
      stage = 'record';
      if (await run({ action: 'add_asset', asset }, 'Reference file saved, still unconfirmed')) { setAssetId(asset.id); setFile(null); setRegRev(qc.getQueryData<Issue>(getGetIssueQueryKey())?.revision ?? null); }
      else setUpErr('The file reached private storage, but the server did not save an asset record. It is not registered as a reference. Retrying uploads the file again.');
    } catch (e) { const m = stage === 'record' ? 'Saving the asset record failed' : stage === 'storage upload' ? 'The file was not stored' : 'Could not request an upload'; setUpErr(`${m}: ${errMsg(e)}`); toast({ title: 'Upload failed', description: `${m}: ${errMsg(e)}`, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const valid = title.trim() && src.trim() && (mode === 'asset' ? assetId : /^https:\/\//i.test(url));
  const touch = () => setRegRev((r) => r ?? issue.revision);
  const stale = regRev !== null && regRev !== issue.revision;
  const register = async () => {
    if (stale) return;
    if (await run({ action: 'set_art_reference', artReference: { kind, title, assetId: mode === 'asset' ? assetId : '', url: mode === 'url' ? url.trim() : '', sourceIdentity: src }, notes }, 'Reference registered, awaiting Myrtle confirmation', regRev ?? issue.revision)) { setRegRev(null); setTitle(''); setSrc(''); setAssetId(''); setUrl(''); setNotes(''); }
  };
  const exp = () => downloadJson('style-guide-editorial.json', { label: 'Editorial style guide export: not a print approval', revision: issue.revision, references: refs, history: ad?.history ?? [], pinnedAssets: [...refs, ...(ad?.history ?? [])].map((r) => r.assetSnapshot).filter(Boolean) });
  const Ref = ({ r }: { r: ArtReference }) => (
    <div className="text-sm">
      <b>{r.title}</b> <span className="mono text-xs">v{r.version} / {r.id}</span>
      <div className="text-xs">Source: {r.sourceIdentity} / supplied by {r.suppliedBy} / {fmt(r.at)}</div>
      {r.assetId && r.assetSnapshot && <div className="text-xs">Pinned original: {r.assetSnapshot.name} ({r.assetSnapshot.objectPath}){canWrite && r.assetSnapshot.contentType.startsWith('image/') && <img className="max-h-40 mt-1 border border-[#1e1812]" src={`${base}${r.assetSnapshot.objectPath}`} alt={r.title} />}</div>}
      {!canWrite && <div className="text-xs italic" data-testid="notice-sign-in-reference">Sign in to inspect the protected linked reference. The record exists; its link, file and notes are withheld from readers.</div>}
      {r.url && canWrite && <a className="underline text-xs" href={r.url} target="_blank" rel="noopener noreferrer">External link (not locally imported)</a>}
      {canWrite && r.registrationNotes && <div className="text-xs italic">Registration notes: {r.registrationNotes}</div>}
      <div className="mt-1">{r.approval ? <><Tag kind="ok">Confirmed</Tag> <span className="text-xs"><ApprovalIdentity approval={r.approval} /> / {fmt(r.approval.at)}</span>{canWrite && r.approval.notes && <div className="text-xs italic">Evidence notes: {r.approval.notes}</div>}</> : <Tag kind="warn">Unconfirmed</Tag>}</div>
    </div>
  );
  return (
    <div>
      <Head kicker="Art direction" title="Style guide"><button className="btn btn-mustard" disabled={!canWrite} title={!canWrite ? 'Sign in to export protected reference records.' : ''} onClick={exp} data-testid="button-export-style">Export editorial JSON</button></Head>
      <WriteNote canWrite={canWrite} login={auth.login} />
      <div className="card-flat text-sm mb-4">Reference confirmation identifies the actual original only; it grants no art approval and does not verify Page 1 approval paperwork. After source recovery and reference confirmation, a verified Myrtle editor can compare the original Page 1 approval document in <a className="underline font-bold" href="/history">History</a>. That separate record is bound to the exact cover/reference version; Page 1 and original image files are never restyled.</div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {KINDS.map(([k, label]) => { const r = refs.find((x) => x.kind === k); return (
          <section key={k} className="card" data-testid={`ref-${k}`}>
            <h2 className="text-2xl font-black mb-2">{label}</h2>
            {r ? <><Ref r={r} />
              {k === 'front_page' && comparableFrontPageReplacement && (
                <section className="card-flat mt-3" aria-label="Compare Page 1 images" data-testid="page-one-image-comparison">
                  <h3 className="text-lg font-black mb-2">Compare Page 1 images</h3>
                  <p className="text-xs mb-3">The proposed image remains unconfirmed. Compare it with the most recently confirmed saved original before confirming this exact replacement.</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <figure className="min-w-0" data-testid="confirmed-front-page-image">
                      <img className="w-full max-h-[32rem] object-contain border border-[#1e1812] bg-[#eee6d5]" src={`${base}${comparableFrontPageReplacement.confirmed.assetSnapshot!.objectPath}`} alt={`Confirmed original: ${comparableFrontPageReplacement.confirmed.title}, version ${comparableFrontPageReplacement.confirmed.version}`} />
                      <figcaption className="text-sm mt-1"><b>Currently confirmed original</b><br />{comparableFrontPageReplacement.confirmed.title} · v{comparableFrontPageReplacement.confirmed.version}</figcaption>
                    </figure>
                    <figure className="min-w-0" data-testid="proposed-front-page-image">
                      <img className="w-full max-h-[32rem] object-contain border border-[#1e1812] bg-[#eee6d5]" src={`${base}${comparableFrontPageReplacement.proposed.assetSnapshot!.objectPath}`} alt={`Unconfirmed proposed replacement: ${comparableFrontPageReplacement.proposed.title}, version ${comparableFrontPageReplacement.proposed.version}`} />
                      <figcaption className="text-sm mt-1"><b>Proposed replacement — unconfirmed</b><br />{comparableFrontPageReplacement.proposed.title} · v{comparableFrontPageReplacement.proposed.version}</figcaption>
                    </figure>
                  </div>
                </section>
              )}
              {!r.approval && <>
                {!r.assetSnapshot?.objectPath && !r.url.trim() && <p role="status" className="card-flat mt-2 text-xs" data-testid={`notice-reference-image-missing-${k}`}>This reference has no available image. Supply a fresh reference before confirming it.</p>}
                <button className="btn btn-green mt-2" disabled={!isMyrtle || pending || (!r.assetSnapshot?.objectPath && !r.url.trim())} title={!r.assetSnapshot?.objectPath && !r.url.trim() ? 'Supply a fresh reference image first' : isMyrtle ? '' : 'Myrtle editor role required'} onClick={() => { setConfRev(issue.revision); setConf(r); }} data-testid={`button-confirm-${k}`}>Confirm this is the original</button>
              </>}</> : <p className="text-sm font-bold" data-testid={`missing-${k}`}>reference artwork not yet imported</p>}
          </section>); })}
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <section className="card"><h2 className="text-2xl font-black mb-2">Art rules</h2><p className="card-flat text-xs mb-2" data-testid="notice-provisional">{PROVISIONAL}</p><ul className="list-disc pl-5 text-sm space-y-1">{RULES.map((r) => <li key={r}>{r}</li>)}</ul></section>
        <section className="card"><h2 className="text-2xl font-black mb-2">Preview tokens</h2><div className="grid grid-cols-5 gap-2">{SW.map(([n, c]) => <div key={n} className="text-[10px] mono"><div className="pd-sw" style={{ background: c }} />{n}<br />{c}</div>)}</div>
          <div className="press-preview p-3 mt-3"><h3 className="text-2xl font-bold">Condensed headline sample</h3><p className="text-sm">Editorial serif body sample for production previews only. Page 1 proof stays unchanged.</p></div></section>
      </div>
      <section className="card mb-6">
        <h2 className="text-2xl font-black mb-2">Register reference</h2>
        {!isMyrtle ? <p className="text-sm">Only an account with the Myrtle editor role can register or confirm references.</p> : (
          <div className="space-y-2 text-sm">
            <div className="grid sm:grid-cols-2 gap-2">
              <div><label className="lbl" htmlFor="rk">Kind</label><select id="rk" className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div><label className="lbl" htmlFor="rt">Title</label><input id="rt" className="field" value={title} onChange={(e) => { touch(); setTitle(e.target.value); }} /></div>
            </div>
            <div><label className="lbl" htmlFor="rs">Source and credit</label><input id="rs" className="field" value={src} onChange={(e) => { touch(); setSrc(e.target.value); }} /></div>
            <div className="flex gap-3"><label><input type="radio" checked={mode === 'asset'} onChange={() => setMode('asset')} /> Private file</label><label><input type="radio" checked={mode === 'url'} onChange={() => setMode('url')} /> HTTPS link</label></div>
            {mode === 'asset' ? <>
              <select className="field" aria-label="Existing asset" value={assetId} onChange={(e) => { touch(); setAssetId(e.target.value); }}><option value="">Choose an existing asset</option>{issue.assets.filter((a) => !a.objectPath.startsWith('/objects/uploads/')).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <div className="card-flat space-y-2"><b>Or upload a new reference file</b> (saved first, then selected above; registration is a second step)
                <input type="file" className="field" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Reference file" />
                <input className="field" placeholder="Credit" value={credit} onChange={(e) => setCredit(e.target.value)} /><input className="field" placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
                <button className="btn" disabled={busy || pending || !file || !credit.trim() || !source.trim()} onClick={upload} data-testid="button-upload-reference">{busy ? 'Working...' : 'Upload private file'}</button></div></>
              : <input className="field" placeholder="https://" value={url} onChange={(e) => { touch(); setUrl(e.target.value); }} aria-label="HTTPS link" />}
            <input className="field" placeholder="Notes" value={notes} onChange={(e) => { touch(); setNotes(e.target.value); }} aria-label="Notes" />
            {stale && <div role="alert" className="card-flat text-xs" data-testid="notice-stale-registration">The issue moved from revision {regRev} to {issue.revision} while this form was open. Registration is blocked until you review the latest references and re-baseline. <button className="btn" onClick={() => setRegRev(issue.revision)}>I reviewed the latest; re-baseline</button></div>}
            {upErr && <div role="alert" className="card-flat text-xs" data-testid="notice-upload-error">{upErr}</div>}
            <button className="btn btn-red" disabled={!valid || pending || stale} onClick={register} data-testid="button-register-reference">Register reference</button>
          </div>)}
      </section>
      <section><h2 className="text-2xl font-black mb-2">Reference history (immutable)</h2>
        {hist.length === 0 ? <p className="text-sm">No history yet.</p> : <div className="space-y-2">{hist.map((r) => <div key={`${r.id}-${r.version}`} className="card-flat"><Ref r={r} /></div>)}</div>}</section>
      <ApprovalDialog open={!!conf} title={`Confirm original: ${conf?.title ?? ''}`} verifiedMyrtle isMyrtleEditor={isMyrtle} accountName={accountName} pending={pending}
        description={`Captured at revision ${confRev}. Confirming states that the registered ${conf?.kind.replace('_', ' ')} is the exact original. It grants no art approval.`}
        ack="I opened and fully inspected the actual original, and it is the exact reference."
        onClose={() => setConf(null)}
        onSubmit={async (_r, notes) => {
          if (!conf) return;
          if (confRev !== issue.revision) { toast({ title: 'Stale confirmation blocked', description: `Issue moved from revision ${confRev} to ${issue.revision}. Close, re-inspect the latest reference and retry.`, variant: 'destructive' }); return; }
          if (await run({ action: 'confirm_art_reference', id: conf.id, notes, checked: true }, 'Reference confirmed', confRev)) setConf(null);
        }} />
    </div>
  );
}
