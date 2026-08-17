# HHC LINE Media Sync production runbook

Use this runbook only with the current [pilot manifest](media-sync-pilot-manifest.md). It is an operator checklist, not approval for a production mutation. Do not record account identifiers, LINE identifiers, credentials, tokens, tickets, binding codes, or request payloads in this file or its evidence.

## 1. Preconditions

- [ ] Fetch all seven repositories and confirm each `origin/main`, merged PR, CI, release workflow, migration, image digest, and rollback anchor agrees with the manifest.
- [ ] Confirm the candidate client code is merged only after its PR is green. Never deploy a local or unmerged commit.
- [ ] Confirm Account API, Asset API, Gateway, helper, and Admin are Healthy/Running at the manifest revisions; capture the immediately previous revision or static index before each later deployment.
- [ ] Re-run the read-only negative boundary checks: Account private route is unreachable externally; anonymous Asset reader and invalid ticket are rejected; anonymous Admin management is rejected; www management remains absent.
- [ ] Check aggregate logs for request-ID coverage and no credential, ticket, or binding-code value markers. Do not export raw log bodies.
- [ ] Obtain privileged, read-only proof that no user has newly received `media_sync_user`, no media-sync binding is active, and existing LINE attachment/`save_resource` data is unchanged.

Stop immediately if any item disagrees with the manifest. Restore the prior revision/index before proceeding with another service, then retain only opaque request/work identifiers for investigation.

## 2. Desktop artifact policy

The current desktop policy is **unsigned GitHub artifacts**. macOS Gatekeeper and Windows SmartScreen warnings are expected; no operator may automate or document a bypass.

- [ ] Download only the intended artifact from the approved official GitHub Release after the tag checkpoint.
- [ ] Obtain its published SHA-256 checksum through the approved release evidence channel and verify the downloaded bytes before installation. If no approved checksum is available, stop.
- [ ] Confirm the package retains the `librepresenter` protocol and passes packaged runtime/VLC projection smoke before distribution.
- [ ] Present the expected platform warning and checksum result to the pilot operator. Installation or release publication requires the separate tag/release approval checkpoint.

## 3. Inert deployment order

For an approved future deployment, complete one healthy boundary before moving on:

1. Account API and Account frontend.
2. Asset API.
3. Gateway reader and management routes.
4. LINE helper.
5. Admin Console.
6. LibrePresenter web and desktop.

For every service, record only: commit SHA, CI/release URL, migration identifier, ready revision/static publish timestamp, immutable image digest if applicable, and previous rollback anchor. Schema deployment must not create a role assignment, collection, ACL, or binding.

## 4. Bounded pilot dry run

Prepare opaque references only:

| Placeholder      | Required property                                              | Dry-run check                                                  |
| ---------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `[manager]`      | Active account with `media-sync:manage`; no reader assumption  | Can open Admin management but cannot read the pilot collection |
| `[reader-a]`     | Active account selected for the initial ACL                    | Will receive `media_sync_user` and the first read ACL          |
| `[reader-b]`     | Active account selected for negative coverage                  | Will receive `media_sync_user`, initially no ACL               |
| `[helper-group]` | Existing registered helper group with confirmed profile/source | Is not bound to another active collection                      |
| `[collection]`   | New pilot collection in `line.group.media-sync`                | Synthetic/non-sensitive media only                             |

Before mutation, present target count, collection namespace/name, subject types, binding-code TTL, group/profile confirmation, and the unbind/revoke rollback sequence. Keep the actual binding code only in the operator's private interaction; do not place it in logs, screenshots, PRs, or evidence documents.

**Approval checkpoint: pilot authorization and binding.** After explicit approval only:

1. Assign `media_sync_user` to `[reader-a]` and `[reader-b]` only.
2. Create `[collection]`.
3. Grant `[reader-a]` the initial read ACL; do not grant `[reader-b]` yet.
4. Issue one binding code and enter the exact `/media-sync` command in `[helper-group]`.
5. Confirm Admin shows the intended bound group, then prove the code cannot be reused.

## 5. Authorization matrix

| Actor                     | Required result before media                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `[manager]`               | Can manage collections/bindings; cannot list, fetch metadata, issue a ticket, or fetch content unless separately granted read access |
| `[reader-a]`              | Can list the collection and import it through the existing picker                                                                    |
| `[reader-b]`              | Cannot list, fetch metadata, issue a ticket, or fetch content                                                                        |
| External/anonymous caller | Private Account route and management route remain unreachable; reader/ticket routes reject according to their public contract        |

Then grant `[reader-b]` the ACL and prove appearance after refresh. Revoke it and prove its `403` cancels/purges only B's online root while A remains usable. Record the known limitation: an `always-offline` file cannot be remotely erased while its device is offline.

## 6. Synthetic media acceptance

After the binding checkpoint, send non-sensitive fixtures one at a time:

- [ ] supported image;
- [ ] supported native video;
- [ ] video that requires Electron VLC preparation;
- [ ] PDF;
- [ ] PPTX;
- [ ] unsupported file;
- [ ] over-policy file.

For every supported fixture, correlate opaque webhook/work/request identifiers and prove: prompt webhook acknowledgement; one canonical ingest and Asset object; clean ClamAV result; collection membership only after clean; and no group success message. Unsupported and over-policy fixtures must have no collection membership.

For `[reader-a]`, verify repeated single-select picker imports, browser online-only ticket/Range playback without a persisted source Blob, Electron on-demand native preparation for VLC, image/video/PDF/PPTX projection, projection popup, and blackout/unblank restoration of authoritative video position.

Run one bound-group manual `save_resource` publication. Prove one source asset and normal curated publication, then unsend it and prove collection tombstone, publication cleanup, owner asset deletion, and client delta cleanup.

## 7. Observation window

The following are **proposed conservative thresholds**. The operator must agree to the duration and thresholds before the first synthetic upload; they are not approved defaults.

| Signal                  | Proposed pilot threshold                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Observation window      | At least 60 minutes after a known end-to-end synthetic event                                                          |
| Webhook acknowledgement | Every fixture acknowledgement completes within 5 seconds                                                              |
| Queue/scan freshness    | No unexplained queued or scan work older than 15 minutes after the final fixture                                      |
| Ingest correctness      | Exactly one canonical ingest/membership per supported source; zero membership for unsupported/over-policy sources     |
| Authorization           | Zero unexpected successful reads or content fetches; expected `401`/`403` transitions are recorded as opaque evidence |
| Reliability             | Zero unexplained terminal worker failures or unclassified 5xx responses                                               |
| Storage/bandwidth       | No unexplained growth beyond the known fixtures, derivatives, and expected Range traffic                              |
| Sensitive data          | Zero credential, binding-code, ticket, or token values in sampled diagnostic output                                   |

An unchanged dashboard is not evidence. Trace at least one known fixture through webhook, worker, scan, membership, client refresh, and projection.

## 8. Rollback rehearsal and execution

Rehearse the order without deleting database tables or production assets:

1. Unbind `[helper-group]` to stop new intake.
2. Revoke pilot collection ACLs and `media_sync_user` assignments.
3. Hide or disable the HHC LINE client import entry point.
4. Remove or revert the exact Gateway media routes.
5. Restore helper, Asset API, Account API, and Gateway to their recorded prior revisions only as needed.
6. Reconcile in-flight work and retained assets explicitly; leave additive tables in place.
7. Deprecate an unsigned desktop release rather than deleting downloaded artifacts; publish a corrective release if required.

After each rollback action, repeat the relevant negative authorization checks. A rollback is not complete until future intake is blocked and the pilot accounts cannot reach the collection.

## 9. Evidence handling and final checkpoint

Keep only CI/release URLs, SHA/digest/revision values, timestamps, aggregate counts, opaque request/work identifiers, pass/fail outcomes, and approved thresholds. Redact screenshots and logs before sharing. Do not include binding commands with real codes, account or LINE IDs, ticket URLs, bearer values, raw request payloads, or asset content.

Before a tag or GitHub Release, present the completed manifest, pilot matrix, observation evidence, artifact checksum, unsigned-artifact acknowledgement, open risks, and rollback anchors. General rollout remains role/ACL/group-by-group and requires a new explicit approval.
