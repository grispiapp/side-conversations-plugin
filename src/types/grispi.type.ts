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

interface Attachment {
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
 * `POST /public/v1/tickets` request body — CONFIRMED live against the
 * gsocial-test tenant (Phase 02 Plan 01 Task 1 checkpoint probe, human-run
 * 2026-07-23; see `02-01-SUMMARY.md` "Probe Findings" A1/A5, Pitfall #1).
 * `ts.subject`'s `value` MUST be a real non-empty string — the live API
 * returns 422 ("Subject is required when creating a ticket.") when the key
 * is present but the value is `""`; the key itself must never be omitted.
 * `publicVisible` is deliberately narrowed to the `true` literal (never
 * `boolean`) because this is the one field that turns the side ticket into
 * a real outbound email (D-13) — a caller cannot accidentally construct a
 * silent/internal-only side ticket.
 */
export interface CreateTicketRequest {
  comment: {
    body: string;
    publicVisible: true;
    creator: [{ key: "us.email"; value: string }];
  };
  fields: Array<{ key: string; value: string }>;
}

/**
 * `PATCH /public/v1/tickets/{key}` public-reply body — CONFIRMED live
 * (Phase 03 Plan 01). It is deliberately separate from
 * `CreateTicketRequest`: PATCH callers cannot resend subject, requester, or
 * parent-link fields.
 */
export interface ReplyTicketPatchRequest {
  comment: {
    body: string;
    publicVisible: true;
    creator: [{ key: "us.email"; value: string }];
  };
}

export type TicketLifecycleStatusId = "2" | "4";

/**
 * Status transitions are status-only by product decisions D-14/D-15/D-17:
 * `"4"` solves and `"2"` reopens. Keeping this as a one-element tuple makes
 * it impossible to attach a comment or append create-only fields.
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
