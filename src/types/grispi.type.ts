export interface Settings extends Record<string, any> {}

export interface Role {
  authority: string;
  impliedAuthorities: string[];
  teamUser: boolean;
}

export interface User {
  role: Role;
  groups: any[];
  id: number;
  email: string;
  emails: any[];
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  phones: any[];
  organization: any;
  language: any;
  tags: any[];
  enabled: boolean;
  profilePicture: string;
  createdAt: number;
  updatedAt: number;
  fields: any[];
}

/**
 * A single attachment, both as the shape embedded in a `Comment` and as one
 * element of the `POST .../attachments/upload` response array. `inline` is
 * CONFIRMED live (Phase 04 Plan 01 probe A1/A3, see `04-01-SUMMARY.md`
 * "Probe Findings") — present on the upload response and round-trips as
 * `inline:true` on the re-fetched comment's attachment when uploaded with
 * `?inline=true` (D-22 is implementable). `objectUrl` needs no auth header —
 * it 307-redirects to a time-limited signed S3 URL; never persist the
 * resolved S3 link, always keep `objectUrl` itself.
 */
export interface Attachment {
  id: number;
  filename: string;
  objectKey: string;
  objectThumbKey: string;
  bucket: string;
  mimeType: string;
  size: number;
  userId: number;
  objectThumbUrl: string;
  objectUrl: string;
  inline?: boolean;
}

/**
 * `POST {no public/v1 prefix}/attachments/upload` response element —
 * CONFIRMED live (Phase 04 Plan 01 Task 1 checkpoint probe A1, see
 * `04-01-SUMMARY.md` "Probe Findings"; also matches
 * `.planning/research/attachment-upload-contract.md` §1). The endpoint
 * always returns an ARRAY, even for a single uploaded file — callers consume
 * only the first element. Same field set as the live-confirmed response
 * body (identical to `Attachment`, kept as its own named interface since
 * this is a response contract, not the embedded-on-a-`Comment` shape).
 */
export interface UploadFilesResponse {
  id: number;
  filename: string;
  objectKey: string;
  objectThumbKey: string;
  bucket: string;
  mimeType: string;
  size: number;
  userId: number;
  objectThumbUrl: string;
  objectUrl: string;
  inline?: boolean;
}

export interface Comment {
  attachments: Attachment[];
  id: number;
  body: string;
  publicVisible: boolean;
  ticketKey: string;
  createdAt: number;
  creator: User;
  call: any;
  toId: any;
  toEmail: any;
  commentCCs: any[];
  mentionedUsers: any[];
  channel: string;
  externalId: string;
}

interface Group {
  id: number;
  name: string;
}

/**
 * CONFIRMED live (Plan 02 / Task 1 probe, 2026-07-23, see
 * `.planning/phases/01-.../01-02-probe-findings.md`): a real `fieldMap` entry
 * only ever carries `{key, value}` — `serializedValue`/`userFriendlyValue`/
 * `id`/`type` were never observed present on any entry in the live tenant.
 * They are kept as optional (rather than removed) in case another endpoint
 * populates them; do not rely on them without re-verifying.
 */
interface FieldMap {
  id?: any;
  value: any;
  serializedValue?: string | null;
  userFriendlyValue?: string;
  type?: string;
  key: string;
}

export interface Field {
  key: string;
  conditions: any[];
  required: {
    type: string;
    ids: any[];
  };
}

interface Form {
  id: number;
  name: string;
  description: string;
  permission: string;
  consent: any;
  enabled: boolean;
  endUserForm: boolean;
  fields: Field[];
}

export interface Ticket {
  key: string;
  callMergeStatus: any;
  channel: string;
  form: Form;
  createdAt: number;
  updatedAt: number;
  solvedAt: any;
  comments: Comment[];
  fieldMap: {
    [key: string]: FieldMap;
  };
  relation: any[];
  resolution: any;
}

interface Agent {
  id: number;
  fullName: string;
  email: string;
  phone: string;
}

interface Requester {
  id: number;
  fullName: string;
  email: any;
  phone: any;
}

interface Context {
  username: string;
  tenantId: string;
  ticketKey: string;
  ticket: Ticket;
  agent: Agent;
  requester: Requester;
  token: string;
}

export interface GrispiBundle {
  settings: Settings;
  context: Context;
}

/**
 * The following types describe `POST /public/v1/tickets/advanced-search` —
 * an endpoint ABSENT from Grispi's public OpenAPI spec. Their shape is
 * CONFIRMED live against Davut's gsocial-test tenant (Plan 02 / Task 1
 * probe, 2026-07-23; see
 * `.planning/phases/01-.../01-02-probe-findings.md`).
 */
export interface AdvancedSearchCondition {
  fieldKey: string;
  operator: string;
  value: string;
}

export interface AdvancedSearchRequest {
  allConditions: AdvancedSearchCondition[];
  anyConditions: AdvancedSearchCondition[];
}

/**
 * CONFIRMED live — a lean summary, NOT a full `Ticket`. `subject` and
 * `status` arrive inline here (no hydration needed to read them), which is
 * why Plan 02 reads them from the summary rather than from a hydrated
 * ticket's `fieldMap`. Marked optional (rather than required) so existing
 * fixtures that predate the probe keep compiling; the live API always sends
 * them.
 */
export interface SideTicketSummary {
  key: string;
  subject?: string;
  status?: { id: number; name: string };
  channel?: string;
  createdAt?: number;
  updatedAt?: number;
}

/** CONFIRMED live — paging envelope; `pageNumber` is 0-indexed. */
export interface AdvancedSearchResponse {
  content: SideTicketSummary[];
  totalPages: number;
  totalSize: number;
  pageNumber: number;
  numberOfElements: number;
  pageable?: unknown;
  empty?: boolean;
  size?: number;
  offset?: number;
}

/**
 * `GET /public/v1/users/{id}` response — absent from the public OpenAPI
 * spec but CONFIRMED live (Plan 01-03 gap-closure probe, see
 * `.planning/phases/01-.../01-02-probe-findings.md` "EK BULGULAR" #2). Only
 * the fields this codebase actually consumes are typed; the live response
 * carries more (firstName/lastName/phones/role/language/...).
 */
export interface GrispiUserProfile {
  id: number;
  primaryEmail: string | null;
}

/**
 * `POST /v2/tickets` request body — CONFIRMED live against the gsocial-test
 * tenant (Phase 02 Plan 01 Task 1 checkpoint probe, human-run 2026-07-23,
 * A1/A5/Pitfall #1; endpoint moved off `public/v1/tickets` onto `/v2/tickets`
 * in Phase 04 Plan 01/06 — see `04-01-SUMMARY.md` "Architecture Decision":
 * `public/v1` silently ignores `comment.attachmentIds`, only `/v2/tickets`
 * binds attachments). `ts.subject`'s `value` MUST be a real non-empty
 * string — the live API returns 422 ("Subject is required when creating a
 * ticket.") when the key is present but the value is `""`; the key itself
 * must never be omitted. `publicVisible` is deliberately narrowed to the
 * `true` literal (never `boolean`) because this is the one field that turns
 * the side ticket into a real outbound email (D-13) — a caller cannot
 * accidentally construct a silent/internal-only side ticket.
 *
 * `comment.channel` is always the literal `"WEB"` on this path (Phase 04
 * Plan 06 — `/v2/tickets` produced `INTEGRATION` without it in the probe).
 *
 * `comment.attachmentIds` (Phase 04 Plan 01 checkpoint probe A2/N2, see
 * `04-01-SUMMARY.md` "Probe Findings" and "Architecture Decision" — only
 * `/v2/tickets` binds attachments; `public/v1` silently ignores this field)
 * — MUST be omitted entirely when there are zero attachment ids, never sent
 * as an empty array (RESEARCH.md "Assuming attachmentIds field must always
 * be present" pitfall). Optional (not required) so pre-existing literal test
 * fixtures that predate Phase 04 Plan 06 keep compiling without edits; the
 * real store-built request always sets it (see `ComposeStore.submit`).
 */
export interface CreateTicketRequest {
  comment: {
    body: string;
    publicVisible: true;
    creator: [{ key: "us.email"; value: string }];
    channel?: "WEB";
    attachmentIds?: number[];
  };
  fields: Array<{ key: string; value: string }>;
}

/**
 * `PATCH /v2/tickets/{key}` public-reply body — CONFIRMED live (Phase 03
 * Plan 01 for the reply contract; endpoint moved off `public/v1/tickets/
 * {key}` onto `/v2/tickets/{key}` in Phase 04 Plan 01/06 for the exact same
 * attachment-binding reason as `CreateTicketRequest` above — see
 * `04-01-SUMMARY.md` "Architecture Decision"). It is deliberately separate
 * from `CreateTicketRequest`: PATCH callers cannot resend subject,
 * requester, or parent-link fields. `Tickets.replyTicket` is the ONLY
 * client method that sends this shape — `Tickets.patchTicket` (status-only
 * lifecycle) uses `StatusTicketPatchRequest` instead and stays on
 * `public/v1`, per D-15 (see that type's own doc-comment).
 *
 * `comment.channel` / `comment.attachmentIds` — same contract and same
 * omit-when-empty rule as `CreateTicketRequest.comment` (see that
 * doc-comment for the full rationale).
 *
 * `fields` (D-CC-7, quick-260918-fx7): optional and narrowed to the single
 * `ts.email_ccs` key — a PATCH caller may resend CC state alongside the
 * reply comment, but this type's own "no subject/requester/parent-link
 * resend" invariant above stays enforced by the type system.
 */
export interface ReplyTicketPatchRequest {
  comment: {
    body: string;
    publicVisible: true;
    creator: [{ key: "us.email"; value: string }];
    channel?: "WEB";
    attachmentIds?: number[];
  };
  fields?: Array<{ key: "ts.email_ccs"; value: string }>;
}

/**
 * `PATCH /v2/tickets/{key}` internal-note body — D-01/D-02. CONFIRMED live
 * (Phase 04.2 RESEARCH.md P1-P3 probe): `/v2/tickets` PATCH with
 * `comment.publicVisible: false` returns 200, leaves `ts.status` untouched,
 * and both `toId`/`toEmail` stay `null` (no email sent to the requester).
 * Stays on `/v2/tickets`, never `public/v1/tickets/{key}` — same write-path
 * split as `ReplyTicketPatchRequest`/`CreateTicketRequest` above, though the
 * reason here is simply consistency with the create-mutation follow-up call
 * (the side ticket itself was created via `/v2/tickets`), not attachment
 * binding.
 *
 * Deliberately a SIBLING type of `ReplyTicketPatchRequest`, never a widened
 * version of it — `publicVisible` is narrowed to the `false` literal (never
 * `boolean`) so a caller cannot accidentally construct a body that emails
 * the requester (RESEARCH.md Pitfall #3). `ReplyTicketPatchRequest.comment.
 * publicVisible`'s own `true` literal is never widened either; the two
 * types must never merge.
 *
 * `comment.channel` is `"INTEGRATION"`, not the `"WEB"` of the two public
 * paths above — these notes are written by the plugin, not typed by an agent
 * in the Grispi web UI.
 *
 * `fields` (D-22, added 2026-08-17 on RESEARCH.md's adjacent finding): the
 * same PATCH re-asserts `tp.side_conversation_parent` with the parent
 * ticket's key. A live probe showed `POST /v2/tickets`'s `fields` array can
 * fail to persist this field on a freshly created ticket, but a follow-up
 * `fields`-only PATCH persists it immediately — this type carries that
 * proven mechanism as a near-zero-cost addition to a PATCH already being
 * sent.
 */
export interface InternalNotePatchRequest {
  comment: {
    body: string;
    publicVisible: false;
    creator: [{ key: "us.email"; value: string }];
    channel: "INTEGRATION";
  };
  /**
   * OPTIONAL on purpose. The side ticket's note rides along with the D-22
   * parent-field re-assertion, but the PARENT ticket's counterpart note
   * must send NO fields at all: writing that field onto the parent would
   * mark the customer's own ticket as a side conversation and make the
   * panel refuse to open new conversations on it (D-11).
   */
  fields?: Array<{ key: string; value: string }>;
}

/**
 * `PATCH public/v1/tickets/{key}` fields-only body — D-23, `assertSide
 * ConversationLink`'s ONE retry step for the `tp.side_conversation_parent`
 * re-assertion. No `comment` member: a comment PATCH APPENDS, so repeating
 * `InternalNotePatchRequest` on retry would leave two identical internal
 * notes (D-03 — notes are never hidden); this shape makes that structurally
 * impossible. MUST stay on `public/v1`, never `/v2/tickets` — `/v2/tickets`
 * PATCH requires a `comment` in the body (probe finding N2) and returns 500
 * without one, so a comment-free write is only possible here. A live probe
 * (04.2-RESEARCH.md) confirmed a `fields`-only `PATCH public/v1/tickets/
 * {key}` persists this field immediately, which is the mechanism D-22 relies
 * on.
 */
export interface TicketFieldsPatchRequest {
  fields: Array<{ key: string; value: string }>;
}

export type TicketLifecycleStatusId = "2" | "4";

/**
 * Status transitions are status-only by product decisions D-14/D-15/D-17:
 * `"4"` solves and `"2"` reopens. Keeping this as a one-element tuple makes
 * it impossible to attach a comment or append create-only fields.
 *
 * `Tickets.patchTicket` sends this shape to `public/v1/tickets/{key}`,
 * DELIBERATELY never `/v2/tickets` (Phase 04 Plan 01/06 write-path split,
 * `04-01-SUMMARY.md` "Architecture Decision"): `/v2/tickets` PATCH requires
 * a `comment` in the body (probe finding N2) and returns 500 without one —
 * adding a comment here just to satisfy that would itself violate D-15
 * (solve/reopen must produce NO comment and send NO email).
 */
export interface StatusTicketPatchRequest {
  fields: [
    {
      key: "ts.status";
      value: TicketLifecycleStatusId;
    },
  ];
}

export type PatchTicketRequest =
  ReplyTicketPatchRequest | StatusTicketPatchRequest;

export interface PatchTicketMutationField {
  key: string;
  value: unknown;
}

export interface PatchTicketStatusMutationField extends PatchTicketMutationField {
  key: "ts.status";
  value: {
    id: number;
    name: string;
  };
}

/**
 * PATCH returns a mutation-ticket object, not the canonical GET `Ticket`.
 * Only the probe-backed fields needed to identify the mutation and inspect
 * its status are exposed; callers must refetch with `getTicket` for canonical
 * application state.
 */
export interface PatchTicketResponse {
  key: string;
  comments: Comment[];
  fieldMap: Record<string, PatchTicketMutationField> & {
    "ts.status": PatchTicketStatusMutationField;
  };
}

/**
 * `customers.search` record shape — CONFIRMED live (Phase 02 Plan 01 Task 1
 * checkpoint probe, see `02-01-SUMMARY.md` "Probe Findings" A3). Only the
 * fields this codebase actually consumes (`fullName`, `email`) are relied
 * upon by callers; the rest are kept for completeness/debugging since the
 * live response carries them but they are not part of this phase's surface.
 */
export interface Customer {
  id: number;
  email: string | null;
  emails: string[];
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  phones: string[];
  organization: unknown;
  language: unknown;
  tags: unknown[];
  fieldMap: Record<string, unknown>;
  role: string;
  createdAt: number;
  updatedAt: number;
  groups: unknown;
  enabled: boolean;
}

/**
 * `GET /public/v1/customers/search` response envelope — CONFIRMED live
 * (Phase 02 Plan 01 Task 1 checkpoint probe, see `02-01-SUMMARY.md` "Probe
 * Findings" A2 — CORRECTED from the RESEARCH.md assumption of a plain
 * array to the same content-wrapped Spring-page family as
 * `AdvancedSearchResponse`). NOTE: the live endpoint also 422s when
 * `searchTerm` is shorter than 3 characters ("Search term must be at least
 * '3' characters long.") — callers must not fire a search below that
 * length.
 */
export interface CustomerSearchResponse {
  content: Customer[];
  totalPages: number;
  totalSize: number;
  pageNumber: number;
  numberOfElements: number;
  pageable?: unknown;
  empty?: boolean;
  size?: number;
  offset?: number;
}
