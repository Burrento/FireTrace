import { useState } from 'react';

/* The two status changes that need asking about first.

   Resolved and Rejected are the two ends of a fire's life, and both are read
   by the person who reported it. Resolving says the fire is out, which an
   operator should not do on a mis-click of a dropdown. Rejecting closes
   somebody's report of a fire, and they are owed a reason -- the server
   requires one, so this is not the only thing enforcing it.

   The reason is written *to the reporter* and is the only staff-entered text
   that reaches them. The note that goes to the timeline and the audit log is
   separate and stays inside the station; keeping them apart is the whole
   point of the two fields.

   Every other status moves straight through without a dialog. A confirmation
   on each one would train the operator to dismiss all of them. */

function StatusConfirm({ label, nextStatus, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const rejecting = nextStatus === 'rejected';
  const canSubmit = !busy && (!rejecting || reason.trim().length > 0);

  return (
    <div className="bfp-modal-backdrop" onClick={onCancel}>
      <div
        className="bfp-modal bfp-modal-sm"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bfp-modal-head">
          <h2 className="bfp-panel-title">
            {rejecting ? 'Reject this report?' : 'Mark this fire resolved?'}
          </h2>
        </header>

        <div className="bfp-modal-body">
          <p className="bfp-panel-sub">
            {rejecting ? (
              <>
                {label} will be closed without a response, and the reporter will
                be told why. Nothing is deleted — the report stays on file.
              </>
            ) : (
              <>
                Are you sure the fire reported in {label} has been put out? The
                reporter is told, and the time is stamped on first entry, so
                resolving early cannot be corrected out of the response figures.
              </>
            )}
          </p>

          {rejecting && (
            <label className="bfp-confirm-field">
              <span>Reason for the reporter</span>
              <textarea
                value={reason}
                maxLength={255}
                rows={3}
                autoFocus
                placeholder="e.g. Smoke was from a controlled rubbish burn, no fire found."
                onChange={(event) => setReason(event.target.value)}
              />
              <span className="bfp-related-meta">
                This is shown to the person who filed the report.
              </span>
            </label>
          )}

          <div className="bfp-confirm-actions">
            <button type="button" className="bfp-mini-btn" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={`bfp-mini-btn ${rejecting ? 'bfp-mini-btn-danger' : 'bfp-mini-btn-primary'}`}
              disabled={!canSubmit}
              onClick={() => onConfirm(reason.trim())}
            >
              {busy ? 'Saving…' : rejecting ? 'Reject and notify' : 'Yes, it is resolved'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatusConfirm;
