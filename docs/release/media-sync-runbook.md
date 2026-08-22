# HHC LINE Media Sync production runbook

Use this runbook only with the current [pilot manifest](media-sync-pilot-manifest.md). It is an operator checklist, not approval for a production mutation. Do not record account identifiers, LINE identifiers, credentials, tokens, tickets, binding codes, or request payloads in this file or its evidence.

## 1. Preconditions

- [ ] Fetch all seven repositories. Confirm each server/frontend `origin/main`, merged PR, CI, release workflow, migration, image digest, and rollback anchor agrees with the manifest.
- [ ] For LibrePresenter, confirm the closure branch and PR #6 point to the exact reviewed release-code anchor recorded in the manifest. Merge PR #6 only after all final-head CI and macOS/Windows package gates are green; never tag a local, unpushed, or different commit.
- [ ] Confirm Account API, Asset API, Gateway, helper, and Admin are Healthy/Running at the manifest revisions; capture the immediately previous revision or static index before each later deployment.
- [ ] Re-run the read-only negative boundary checks: Account private route is unreachable externally; anonymous Asset reader and invalid ticket are rejected; anonymous Admin management is rejected; www management remains absent.
- [ ] Check aggregate logs for request-ID coverage and no credential, ticket, or binding-code value markers. Do not export raw log bodies.
- [ ] Obtain privileged, read-only proof that no user has newly received `media_sync_user`, no media-sync binding is active, and existing LINE attachment/`save_resource` data is unchanged.

Stop immediately if any item disagrees with the manifest. Restore the prior revision/index before proceeding with another service, then retain only opaque request/work identifiers for investigation.

## 2. Desktop artifact policy

The current desktop policy is **unsigned GitHub artifacts**. macOS Gatekeeper and Windows SmartScreen warnings are expected; no operator may automate or document a bypass.

Before creating a tag:

- [ ] Confirm `package.json` contains the approved version and its changelog/release-notes entry is ready.
- [ ] Confirm the intended tag is exactly `v` followed by the `package.json` version.
- [ ] Confirm the release variables resolve exactly to `VITE_HHC_ACCOUNT_ORIGIN=https://account.alive.org.tw` and `VITE_HHC_ASSET_ORIGIN=https://www.alive.org.tw`.
- [ ] Present and acknowledge that the macOS and Windows artifacts will be unsigned.

The release workflow generates `SHA256SUMS` from the completed package-job artifacts and uploads it with those artifacts. After publication, use a fresh directory or independent machine rather than the CI workspace:

- [ ] Download only the intended artifact and `SHA256SUMS` from the approved official GitHub Release.
- [ ] Verify the downloaded artifact against the downloaded `SHA256SUMS` with a trusted SHA-256 tool before installation or distribution. If the file is absent or verification fails, stop.
- [ ] Confirm the package retains the `librepresenter` protocol and passes packaged runtime/VLC projection smoke before distribution.
- [ ] Present the expected platform warning and checksum result to the pilot operator. Installation or release publication requires the separate tag/release approval checkpoint.

## 3. Inert deployment order

For an approved future deployment, complete one healthy boundary before moving on:

1. Account API and Account frontend.
2. Asset API.
3. Gateway reader and management routes.
4. LINE helper.
5. Admin Console.
6. After PR #6 is reviewed, green, and merged, use only the approved `main` release anchor for LibrePresenter web preview and unsigned GitHub desktop artifacts. Merge alone does not authorize a tag, artifact publication, deployment, or pilot mutation.

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

**Approval checkpoint: bounded pilot acceptance.** After explicit approval only, carry out this complete sequence:

1. Run the approved deterministic public `main` profile smoke before the first pilot mutation.
2. Assign `media_sync_user` to `[reader-a]` and `[reader-b]` only.
3. Create `[collection]`.
4. Grant `[reader-a]` the initial read ACL; do not grant `[reader-b]` yet.
5. Issue one binding code and enter the exact `/media-sync` command in `[helper-group]`.
6. Confirm Admin shows the intended bound group, then prove the code cannot be reused.
7. Grant and then revoke `[reader-b]` ACL access while running the Section 5 isolation checks.
8. Upload only the approved synthetic fixtures in Section 6.
9. Run the approved manual `save_resource` publication and its `unsend` cleanup in Section 6.
10. Repeat the same deterministic public `main` profile smoke after the pilot observation window.

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

For the approved public `main` profile smoke, use the same existing deterministic, text-only smoke-corpus case before the first pilot mutation and after the observation window. It must produce only its established deterministic response: no LLM or tool invocation, no media-sync command/binding/intake/publication activity, and no Asset or Catalog mutation. Retain only an opaque correlation reference and pass/fail result. Any difference stops the pilot.

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

### Tabletop rehearsal (no writes)

Resolve the exact targets, responsible operator, authority, expected checks, and order below without executing an unbind, role/ACL change, route change, deployment, or data mutation. A tabletop result is evidence about readiness only; it is not a rollback.

### Live rollback

Execute a live action only after explicit approval at that checkpoint or under incident authority that was pre-authorized and recorded before the pilot. Then apply only the approved steps needed:

1. Unbind `[helper-group]` to stop new intake.
2. Revoke pilot collection ACLs and `media_sync_user` assignments.
3. Hide or disable the HHC LINE client import entry point.
4. Remove or revert the exact Gateway media routes.
5. Restore helper, Asset API, Account API, and Gateway to their recorded prior revisions only as needed.
6. Reconcile in-flight work and retained assets explicitly; leave additive tables in place.
7. Deprecate an unsigned desktop release rather than deleting downloaded artifacts; publish a corrective release if required.

After each approved live rollback action, repeat the relevant negative authorization checks. A live rollback is not complete until future intake is blocked and the pilot accounts cannot reach the collection.

## 9. Evidence handling and final checkpoint

Keep only CI/release URLs, SHA/digest/revision values, timestamps, aggregate counts, opaque request/work identifiers, pass/fail outcomes, and approved thresholds. Redact screenshots and logs before sharing. Do not include binding commands with real codes, account or LINE IDs, ticket URLs, bearer values, raw request payloads, or asset content.

Before a tag or GitHub Release, present the completed manifest, pilot matrix, observation evidence, completed pre-tag checklist, unsigned-artifact acknowledgement, open risks, and rollback anchors. The checksum is generated only from completed package artifacts and is independently verified after publication as described in Section 2. General rollout remains role/ACL/group-by-group and requires a new explicit approval.
