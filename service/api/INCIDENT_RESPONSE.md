# Hosted service incident response

This playbook gives a provider-neutral response sequence for suspected compromise, unauthorized access, data exposure, or service integrity failure in the Aduen hosted case API. It is an engineering procedure, not a legal notification policy. Complete and review the operator assignments and jurisdiction-specific requirements before any real consumer records are accepted.

## Operator assignments to complete

Record these in the approved operations system before launch. Do not put personal case data or credentials in this document.

- Incident coordinator and alternate: **not assigned**
- API and database operators: **not assigned**
- Identity provider security contact: **not assigned**
- Privacy and legal decision owner: **not assigned**
- Secure incident record and notification channels: **not configured**
- Applicable jurisdictions, notification thresholds, and deadlines: **not reviewed**

## Response sequence

1. **Open a restricted incident record.** Record the report source, UTC discovery time, affected service, and a unique incident reference. Keep access limited to assigned responders. Do not copy case evidence, access tokens, passwords, or encryption keys into the incident record.
2. **Assign a coordinator and preserve facts.** Record relevant API image digest, deployment and migration history, time range, affected systems, and redacted request IDs. The API request log intentionally excludes case bodies, tokens, owner subjects, IP addresses, and query strings. Database mutation-audit records contain owner subjects, case IDs, actions, and timestamps; access them only when needed and preserve them under restricted access.
3. **Contain the affected path.** If API integrity or access is uncertain, remove API traffic at the ingress or stop the affected replicas. If database credentials may be exposed, disable or rotate the affected role and keep the API out of service until replacement credentials are deployed and verified. If an identity signing key or user session may be compromised, contact the issuer operator; this API does not provide immediate per-token revocation, so isolate API traffic until the issuer has invalidated the exposure and the API has a verified current JWKS. Do not weaken database row policies to restore service.
4. **Protect backup material.** Restrict backup-job and backup-storage access if exposed. Preserve relevant encrypted archives and key IDs under the approved evidence process. Do not delete backups or destroy decryption keys until privacy/legal and recovery owners decide the required preservation and deletion actions.
5. **Assess scope.** Establish the earliest known exposure time and identify affected API replicas, database roles and objects, identity accounts or signing keys, maintenance jobs, backup archives, and secrets. Use minimum necessary data. Keep evidence integrity and provenance recorded; do not treat an unverified log entry as proof of a consumer outcome.
6. **Make notification decisions.** The assigned privacy/legal owner determines whether consumers, regulators, partners, or other parties must be notified, which jurisdictions apply, and the required timing. Record the rationale and approval in the restricted incident record. This repository does not select notification thresholds or deadlines.
7. **Recover and verify.** Rotate affected secrets with staged procedures, rebuild from a verified immutable image, apply and verify the migration ledger, restore only through the approved encrypted-backup process when needed, and check runtime database roles, owner isolation, TLS, retention jobs, and JWKS readiness before reopening traffic. Record the image digest, restore source, checks performed, and approver.
8. **Close with follow-up.** Record a concise timeline, root-cause confidence, affected data categories, containment and recovery evidence, unresolved questions, and owners and dates for corrective work. Update this playbook and run a tabletop or recovery exercise after material changes.

## Reopening gate

Do not accept real consumer records until operator assignments, escalation authority, jurisdiction review, notification deadlines, secure communications, evidence retention, and recovery approvals have been completed and exercised. A green health check alone does not authorize reopening after an incident.
