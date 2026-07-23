export interface Settings extends Record<string, any> {}

interface Role {
  authority: string;
  impliedAuthorities: string[];
  teamUser: boolean;
}

interface User {
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

interface Comment {
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
