'use client';

import { useState } from 'react';

type Stage = 'disputed' | 'correction-required' | 'release-ready' | 'released';
type Role = 'Regulator' | 'Company' | 'Auditor' | 'Community';

const initialTimeline = [
  {
    time: '11:42',
    type: 'Dispute opened',
    actor: 'SqyF…mJ8k · Community',
    detail: 'Heavy metal levels exceed the demo threshold at downstream monitoring reach B.',
    tone: 'danger',
  },
  {
    time: '10:18',
    type: 'Bond deposited',
    actor: '9xK2…pL4a · Company',
    detail: '125,000 GTB moved to the program-controlled restoration vault.',
    tone: 'success',
  },
  {
    time: 'Yesterday',
    type: 'Liability approved',
    actor: 'G7vP…rN2c · Regulator',
    detail: 'Revision 03 approved against verified multispectral evidence.',
    tone: 'neutral',
  },
];

function MiniMark({ label }: { label: string }) {
  return <span className="mini-mark" aria-hidden="true">{label}</span>;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>('disputed');
  const [roleIndex, setRoleIndex] = useState(0);
  const [caseOpen, setCaseOpen] = useState(false);
  const [activity, setActivity] = useState(initialTimeline);
  const roles: Role[] = ['Regulator', 'Company', 'Auditor', 'Community'];
  const role = roles[roleIndex];
  const disputeOpen = stage === 'disputed';
  const correctionRequired = stage === 'correction-required';
  const releaseReady = stage === 'release-ready';
  const released = stage === 'released';

  function prependActivity(type: string, detail: string, tone: string) {
    setActivity((items) => [{ time: 'Just now', type, actor: `G7vP…rN2c · ${role}`, detail, tone }, ...items]);
  }

  function resolveDispute() {
    setStage('correction-required');
    setCaseOpen(false);
    prependActivity('Dispute resolved', 'Regulator upheld the concern and required a liability correction.', 'neutral');
  }

  function appendCorrection() {
    setStage('release-ready');
    prependActivity('Correction appended', 'Liability revision 04 reaffirmed at 125,000 GTB. Original approval retained.', 'success');
  }

  function releaseBond() {
    setStage('released');
    prependActivity('Bond released', 'All program guards passed; 125,000 GTB released to the restoration recipient.', 'success');
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
          <a href="#disputes"><MiniMark label="D" />Disputes <span className="nav-count">1</span></a>
          <a href="#bond"><MiniMark label="B" />Bond</a>
          <a href="#timeline"><MiniMark label="T" />Audit trail</a>
        </nav>

        <div className="network-card">
          <span className="pulse-dot" />
          <div><strong>Solana Devnet</strong><small>Program connected</small></div>
        </div>

        <div className="sidebar-user">
          <span className="avatar">GR</span>
          <div><strong>{role}</strong><small>G7vP…rN2c</small></div>
          <button aria-label="Wallet menu">···</button>
        </div>
      </aside>

      <section className="workspace" id="overview">
        <header className="topbar">
          <div className="project-switcher">
            <span className="project-avatar">LF</span>
            <div><small>Active project</small><strong>North Ridge Development Site</strong></div>
            <span className="chevron">⌄</span>
          </div>
          <div className="top-actions">
            <span className="role-chip">{role} access</span>
            <button className="icon-button" aria-label="Notifications">2</button>
            <button className="wallet-button" onClick={() => setRoleIndex((roleIndex + 1) % roles.length)} title="Switch demo role"><span />{role} · G7vP…rN2c</button>
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
              <button className="secondary-button">View on Explorer ↗</button>
              {disputeOpen && <button className="primary-button" onClick={() => setCaseOpen(true)}>Review dispute</button>}
              {correctionRequired && <button className="primary-button" onClick={appendCorrection}>Append correction</button>}
              {releaseReady && <button className="primary-button" onClick={releaseBond}>Release bond</button>}
              {released && <button className="primary-button" disabled>Bond released</button>}
            </div>
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
              <strong>125,000 <small>GTB</small></strong>
              <p>Revision 03 · approved Aug 26</p>
            </article>
            <article className="metric-card">
              <div className="metric-label"><span>Bond funded</span><i className="status-dot green" /></div>
              <strong>100<span className="metric-percent">%</span></strong>
              <div className="progress"><span /></div>
              <p>125,000 of 125,000 GTB</p>
            </article>
            <article className="metric-card metric-danger">
              <div className="metric-label"><span>Release status</span><i className="status-dot red" /></div>
              <strong>{disputeOpen ? 'Paused' : correctionRequired ? 'Paused' : released ? 'Released' : 'Ready'}</strong>
              <p>{disputeOpen ? '1 active dispute blocks release' : correctionRequired ? 'Correction requirement blocks release' : released ? '125,000 GTB transferred' : 'All program guards passed'}</p>
            </article>
            <article className="metric-card">
              <div className="metric-label"><span>Evidence records</span><i className="status-dot grey" /></div>
              <strong>04</strong>
              <p>3 verified · 1 superseded</p>
            </article>
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
              <button className={`release-button ${releaseReady ? 'release-enabled' : ''}`} disabled={!releaseReady} onClick={releaseBond}>{released ? '125,000 GTB released' : 'Release 125,000 GTB'} <span>{releaseReady ? 'All guards passed' : released ? 'Transaction finalized' : 'Guard failed'}</span></button>
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
            <p className="modal-copy">An authorized local community representative submitted an independent water test against liability decision revision 03. The original report remains linked by its SHA-256 hash.</p>
            <div className="evidence-reference">
              <span>Supporting report</span>
              <strong>Fraser-Water-Test-Aug-2026.pdf</strong>
              <code>96b7f7e7…05a4c219</code>
            </div>
            <div className="resolution-form">
              <label>Resolution outcome<select defaultValue="upheld"><option value="upheld">Upheld — remediation required</option><option value="dismissed">Dismissed</option></select></label>
              <label>Decision reason<textarea defaultValue="Independent results require the approved liability to be reviewed and reaffirmed." /></label>
              <label className="check-label"><input type="checkbox" defaultChecked /> Require append-only correction before release</label>
            </div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setCaseOpen(false)}>Cancel</button><button className="primary-button" onClick={resolveDispute} disabled={role !== 'Regulator'}>Record resolution</button></div>
            {role !== 'Regulator' && <small className="role-warning">Switch the demo wallet to Regulator to resolve this dispute.</small>}
          </section>
        </div>
      )}
    </main>
  );
}
