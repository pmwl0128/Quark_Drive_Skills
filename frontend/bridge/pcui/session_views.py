"""Read-only session presentation. Progress is evidence, never an agent liveness claim."""
from __future__ import annotations

import json


def _document(payload) -> dict:
    try:
        doc = json.loads(payload) if payload else None
        return doc if isinstance(doc, dict) else {}
    except (ValueError, TypeError, UnicodeError, RecursionError):
        return {}


def session_view(row) -> dict:
    heads = json.loads(row["heads_json"])
    audit = _document(row["audit_payload"])
    checkpoint = _document(row["checkpoint_payload"])
    audit_current = row["audit_seq"] >= 0 and row["audit_seq"] > max(
        row["build_seq"], row["checkpoint_seq"], row["decision_seq"])
    if audit_current and audit.get("pass") is True:
        state = "done"
    elif row["checkpoint_seq"] >= 0 and row["decision_seq"] < row["checkpoint_seq"] \
            and checkpoint.get("pause") is True:
        state = "awaiting"
    elif audit_current and audit.get("pass") is False:
        state = "needs_changes"
    elif "draft" in heads:
        state = "review"
    else:
        state = "progress" if row["revision"] else "idle"
    return {"id": row["id"], "createdAt": row["created_at"], "updatedAt": row["updated_at"],
            "revision": row["revision"], "heads": heads,
            "meta": json.loads(row["meta_json"]), "state": state}


# One read joins only the current two status artifacts. No full-artifact or per-session N+1 reads.
SESSION_VIEW_SQL = """
select s.*, a.raw_payload as audit_payload, cp.raw_payload as checkpoint_payload,
       coalesce(g.updated_at, s.created_at) as updated_at,
       coalesce(g.audit_seq, -1) as audit_seq, coalesce(g.build_seq, -1) as build_seq,
       coalesce(g.checkpoint_seq, -1) as checkpoint_seq, coalesce(g.decision_seq, -1) as decision_seq
from sessions s
left join (
    select session_id, max(created_at) as updated_at,
           max(case when kind='answer-audit' then sequence else -1 end) as audit_seq,
           max(case when kind in ('context','audit','frame','slate','draft') then sequence else -1 end) as build_seq,
           max(case when kind='checkpoint' then sequence else -1 end) as checkpoint_seq,
           max(case when kind='decision' then sequence else -1 end) as decision_seq
    from session_artifacts group by session_id
) g on g.session_id=s.id
left join artifacts a on a.hash=json_extract(s.heads_json, '$."answer-audit"')
left join artifacts cp on cp.hash=json_extract(s.heads_json, '$.checkpoint')
"""
