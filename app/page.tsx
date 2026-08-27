'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useGroundTruth } from '@/lib/use-groundtruth';


const initialTimeline = [
  {
    time: '11:42',
    type: 'Dispute opened',
    actor: 'Authorized community representative',
    detail: 'Heavy metal levels exceed the demo threshold at downstream monitoring reach B.',
    tone: 'danger',
  },
  {
    time: '10:18',
    type: 'Bond deposited',
    actor: 'North Ridge Development · Company',
    detail: '125,000 GTB moved to the program-controlled restoration vault.',
    tone: 'success',
  },
  {
    time: 'Yesterday',
    type: 'Liability approved',
    actor: 'Configured project authority · Regulator',
    detail: 'Revision 01 approved against verified multispectral evidence.',
    tone: 'neutral',
  },
];

function MiniMark({ label }: { label: string }) {
  return <span className="mini-mark" aria-hidden="true">{label}</span>;
}

export default function Home() {
  const [caseOpen, setCaseOpen] = useState(false);
  const [activity, setActivity] = useState(initialTimeline);
  const chain = useGroundTruth();
  const stage = chain.stage;
  const role = chain.role;
  const disputeOpen = stage === 'disputed';
  const correctionRequired = stage === 'correction-required';
  const releaseReady = stage === 'release-ready';
  const released = stage === 'released';
  const reportHash = chain.config?.evidence.reportHashHex;
  const reportHashLabel = reportHash ? `${reportHash.slice(0, 10)}…${reportHash.slice(-10)}` : 'Loading evidence hash…';

  function prependActivity(type: string, detail: string, tone: string) {
    const address = chain.walletKey?.toBase58();
    const actor = address ? `${address.slice(0, 4)}…${address.slice(-4)} · ${role}` : `Disconnected · ${role}`;
    setActivity((items) => [{ time: 'Just now', type, actor, detail, tone }, ...items]);
  }

  async function resolveDispute() {
    try {
      await chain.resolveDispute();
      setCaseOpen(false);
      prependActivity('Dispute resolved on-chain', 'Regulator upheld the concern and required a liability correction.', 'neutral');
    } catch { /* Hook exposes the transaction error in the dashboard. */ }
  }

  async function appendCorrection() {
    try {
      await chain.appendCorrection();
      prependActivity('Correction appended on-chain', 'Liability revision 02 reaffirmed at 125,000 GTB. Original approval retained.', 'success');
    } catch { /* Hook exposes the transaction error in the dashboard. */ }
  }

  async function releaseBond() {
    try {
      await chain.releaseBond();
      prependActivity('Bond released on-chain', 'All program guards passed; 125,000 GTB released to the restoration recipient.', 'success');
    } catch { /* Hook exposes the transaction error in the dashboard. */ }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="GroundTruth home">
          <span className="brand-mark"><span /></span>
          <span>GroundTruth</span>
        </a>

        <nav className="primary-nav" aria-label="Project navigation">
          <p>Workspace</p>
          <a className="active" href="#overview"><MiniMark label="O" />Overview</a>
          <a href="#evidence"><MiniMark label="E" />Evidence</a>
          <a href="#liability"><MiniMark label="L" />Liability</a>
          <a href="#disputes"><MiniMark label="D" />Disputes {Boolean(chain.snapshot?.activeDisputes) && <span className="nav-count">{chain.snapshot?.activeDisputes}</span>}</a>
          <a href="#bond"><MiniMark label="B" />Bond</a>
          <a href="#timeline"><MiniMark label="T" />Audit trail</a>
        </nav>

        <div className="network-card">
          <span className="pulse-dot" />
          <div><strong>Solana {chain.config?.cluster === 'devnet' ? 'Devnet' : 'Local validator'}</strong><small>{chain.seeded ? 'On-chain sync active' : 'Demo seed required'}</small></div>
        </div>

        <div className="sidebar-user">
          <span className="avatar">{role.slice(0, 2).toUpperCase()}</span>
          <div><strong>{role}</strong><small>{chain.walletKey ? `${chain.walletKey.toBase58().slice(0, 4)}…${chain.walletKey.toBase58().slice(-4)}` : 'Wallet disconnected'}</small></div>
          <button aria-label="Wallet menu">···</button>
        </div>
      </aside>

      <section className="workspace" id="overview">
        <header className="topbar">
          <div className="project-switcher">
            <span className="project-avatar">NR</span>
            <div><small>Active project</small><strong>North Ridge Development Site</strong></div>
            <span className="chevron">⌄</span>
          </div>
          <div className="top-actions">
            <span className="role-chip">{role} access</span>
            <button className="icon-button" aria-label="Notifications">2</button>
            <button className="wallet-button" onClick={chain.walletKey ? chain.disconnectWallet : chain.connectWallet} title={chain.walletKey ? 'Disconnect Phantom' : 'Connect Phantom'}><span />{chain.walletKey ? `${role} · ${chain.walletKey.toBase58().slice(0, 4)}…${chain.walletKey.toBase58().slice(-4)}` : 'Connect Phantom'}</button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Project overview</p>
              <h1>Restoration liability,<br />verified in the open.</h1>
              <p className="lede">Every claim, decision and bond movement stays linked to its evidence.</p>
            </div>
            <div className="heading-actions">
              <a className="secondary-button" href={chain.config?.accounts.project ? chain.explorerUrl(chain.config.accounts.project) : '#'} target="_blank" rel="noreferrer">View on Explorer ↗</a>
              {disputeOpen && <button className="primary-button" onClick={() => setCaseOpen(true)} disabled={!chain.seeded}>Review dispute</button>}
              {correctionRequired && <button className="primary-button" onClick={appendCorrection} disabled={role !== 'Regulator' || Boolean(chain.transactionLabel)}>Append correction</button>}
              {releaseReady && <button className="primary-button" onClick={releaseBond} disabled={role !== 'Regulator' || Boolean(chain.transactionLabel)}>Release bond</button>}
              {released && <button className="primary-button" disabled>Bond released</button>}
            </div>
          </div>

          <div className={`chain-feedback ${chain.error ? 'chain-error' : ''}`} role="status">
            <span className={chain.loading ? 'sync-dot loading' : chain.error ? 'sync-dot failed' : 'sync-dot'} />
            <strong>{chain.transactionLabel || (chain.loading ? 'Reading Solana state…' : chain.error ? 'On-chain connection needs attention' : `On-chain event sequence ${chain.snapshot?.eventSequence ?? '—'}`)}</strong>
            <small>{chain.error || (chain.walletKey ? `${role} wallet connected` : 'Connect the Regulator Phantom account to sign the remaining demo steps.')}</small>
            {chain.lastSignature && <a href={chain.explorerUrl(chain.lastSignature, 'tx')} target="_blank" rel="noreferrer">Latest transaction ↗</a>}
          </div>

          <section className={`dispute-banner ${!disputeOpen ? 'resolved-banner' : ''}`} id="disputes" aria-label="Dispute status">
            <div className="alert-icon">{disputeOpen ? '!' : '✓'}</div>
            <div className="alert-copy">
              <div><span>{disputeOpen ? 'Active dispute' : 'Dispute resolved'}</span><small>{disputeOpen ? 'Opened today, 11:42 AM' : 'Resolution recorded on-chain'}</small></div>
              <h2>{disputeOpen ? 'Bond release paused automatically' : correctionRequired ? 'Correction required before release' : released ? 'Bond released after all guards passed' : 'All release guards are clear'}</h2>
              <p>{disputeOpen ? 'Community water testing challenges the approved restoration evidence. Resolution or correction is required before funds can move.' : correctionRequired ? 'The regulator upheld the concern. Append a linked correction without changing the original approval.' : released ? 'The recipient balance and immutable audit history now reflect the completed release.' : 'The dispute and its required correction are both resolved. The bond is ready for regulator release.'}</p>
            </div>
            {disputeOpen && <button onClick={() => setCaseOpen(true)}>Open case <span>→</span></button>}
          </section>

          <section className="metrics-grid" aria-label="Project metrics">
            <article className="metric-card">
              <div className="metric-label"><span>Approved liability</span><i className="status-dot green" /></div>
              <strong>{(chain.snapshot?.liability ?? 125000).toLocaleString()} <small>GTB</small></strong>
              <p>Revision {String(chain.snapshot?.revision ?? 3).padStart(2, '0')} · approved on-chain</p>
            </article>
            <article className="metric-card">
              <div className="metric-label"><span>Bond funded</span><i className="status-dot green" /></div>
              <strong>100<span className="metric-percent">%</span></strong>
              <div className="progress"><span /></div>
              <p>{(chain.snapshot?.deposited ?? 125000).toLocaleString()} of {(chain.snapshot?.liability ?? 125000).toLocaleString()} GTB</p>
            </article>
            <article className="metric-card metric-danger">
              <div className="metric-label"><span>Release status</span><i className="status-dot red" /></div>
              <strong>{disputeOpen ? 'Paused' : correctionRequired ? 'Paused' : released ? 'Released' : 'Ready'}</strong>
              <p>{disputeOpen ? `${chain.snapshot?.activeDisputes ?? 1} active dispute blocks release` : correctionRequired ? 'Correction requirement blocks release' : released ? '125,000 GTB transferred' : 'All program guards passed'}</p>
            </article>
            <article className="metric-card">
              <div className="metric-label"><span>Linked evidence</span><i className="status-dot grey" /></div>
              <strong>04</strong>
              <p>4 hash-linked · 1 superseded</p>
            </article>
          </section>

          <section className="evidence-showcase" id="evidence" aria-label="Linked restoration evidence">
            <div className="panel-header evidence-heading">
              <div><p className="eyebrow">Hash-linked evidence</p><h2>Restoration progress and community review</h2></div>
              <span className="ready-chip">SHA-256 anchored</span>
            </div>
            <div className="evidence-grid">
              <figure className="evidence-photo">
                <Image src="/demo-evidence/01-drone-initial-sparse-vegetation.png" width={1536} height={1024} sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 32vw" alt="Initial aerial survey showing sparse vegetation at the fictional North Ridge development site" />
                <figcaption><span className="evidence-state superseded">Superseded</span><strong>Initial condition</strong><small>Multispectral drone survey · vegetation target missed</small></figcaption>
              </figure>
              <figure className="evidence-photo">
                <Image src="/demo-evidence/02-drone-resubmission-restored.png" width={1536} height={1024} sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 32vw" alt="Follow-up aerial survey showing restored vegetation at the fictional North Ridge development site" />
                <figcaption><span className="evidence-state verified">Verified</span><strong>Restoration resubmission</strong><small>Auditor-accepted evidence linked to revision 01</small></figcaption>
              </figure>
              <article className="evidence-report">
                <Image src="/demo-evidence/03-community-water-sampling.png" width={1536} height={1024} sizes="(max-width: 680px) 100vw, (max-width: 1000px) 240px, 28vw" alt="Community representative taking a fictional downstream water sample" />
                <div>
                  <span className="evidence-state disputed">Disputed</span>
                  <strong>Community water review</strong>
                  <p>Independent sampling triggered the active release guard.</p>
                  <code>{reportHashLabel}</code>
                  <a href="/demo-evidence/04-community-water-quality-report.pdf" target="_blank" rel="noreferrer">Open signed demo report ↗</a>
                </div>
              </article>
            </div>
          </section>

          <section className="lower-grid">
            <article className="panel guard-panel" id="bond">
              <div className="panel-header">
                <div><p className="eyebrow">Release controls</p><h2>Bond guard checklist</h2></div>
                <span className={releaseReady || released ? 'ready-chip' : 'blocked-chip'}>{disputeOpen || correctionRequired ? '1 blocker' : released ? 'Complete' : 'Ready'}</span>
              </div>
              <div className="guard-list">
                <div><span className="guard-check ok">✓</span><p><strong>Liability approved</strong><small>Revision matches the escrow record</small></p><b>Passed</b></div>
                <div><span className="guard-check ok">✓</span><p><strong>Bond fully funded</strong><small>Vault balance covers the requirement</small></p><b>Passed</b></div>
                <div className={disputeOpen ? 'guard-failed' : ''}><span className={`guard-check ${!disputeOpen ? 'ok' : ''}`}>{disputeOpen ? '!' : '✓'}</span><p><strong>No active disputes</strong><small>{disputeOpen ? 'One community dispute remains open' : 'Active dispute count is zero'}</small></p><b>{disputeOpen ? 'Blocked' : 'Passed'}</b></div>
                <div className={correctionRequired ? 'guard-failed' : ''}><span className={`guard-check ${!correctionRequired ? 'ok' : ''}`}>{correctionRequired ? '!' : '✓'}</span><p><strong>No correction outstanding</strong><small>{correctionRequired ? 'Resolution requires a linked correction' : 'No unresolved correction requirement'}</small></p><b>{correctionRequired ? 'Blocked' : 'Passed'}</b></div>
              </div>
              <button className={`release-button ${releaseReady ? 'release-enabled' : ''}`} disabled={!releaseReady || role !== 'Regulator' || Boolean(chain.transactionLabel)} onClick={releaseBond}>{released ? '125,000 GTB released' : 'Release 125,000 GTB'} <span>{releaseReady ? role === 'Regulator' ? 'All guards passed' : 'Regulator signature required' : released ? 'Transaction finalized' : 'Guard failed'}</span></button>
            </article>

            <article className="panel timeline-panel" id="timeline">
              <div className="panel-header">
                <div><p className="eyebrow">Immutable history</p><h2>Latest activity</h2></div>
                <a href="#timeline">View all →</a>
              </div>
              <div className="timeline-list">
                {activity.slice(0, 4).map((item, index) => (
                  <div className="timeline-item" key={`${item.type}-${index}`}>
                    <span className={`timeline-node ${item.tone}`} />
                    <div>
                      <small>{item.time}</small>
                      <h3>{item.type}</h3>
                      <p>{item.detail}</p>
                      <span>{item.actor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      </section>

      {caseOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCaseOpen(false)}>
          <section className="case-modal" role="dialog" aria-modal="true" aria-labelledby="case-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-topline"><span className="blocked-chip">Active dispute</span><button onClick={() => setCaseOpen(false)} aria-label="Close dispute">Close</button></div>
            <p className="eyebrow">Community case · DSP-0001</p>
            <h2 id="case-title">Downstream monitoring reach B exceeds heavy metal demo thresholds.</h2>
            <p className="modal-copy">An authorized local community representative submitted an independent water test against liability decision revision 01. The original report remains linked by its SHA-256 hash.</p>
            <div className="evidence-reference">
              <span>Supporting report</span>
              <strong>Fraser-Water-Test-Aug-2026.pdf</strong>
              <code>{reportHashLabel}</code>
            </div>
            <div className="resolution-form">
              <label>Resolution outcome<select defaultValue="upheld"><option value="upheld">Upheld — remediation required</option><option value="dismissed">Dismissed</option></select></label>
              <label>Decision reason<textarea defaultValue="Independent results require the approved liability to be reviewed and reaffirmed." /></label>
              <label className="check-label"><input type="checkbox" defaultChecked /> Require append-only correction before release</label>
            </div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setCaseOpen(false)}>Cancel</button><button className="primary-button" onClick={resolveDispute} disabled={role !== 'Regulator' || Boolean(chain.transactionLabel)}>{chain.transactionLabel || 'Record resolution on-chain'}</button></div>
            {role !== 'Regulator' && <small className="role-warning">Connect or switch Phantom to the configured Regulator demo account.</small>}
          </section>
        </div>
      )}
    </main>
  );
}
