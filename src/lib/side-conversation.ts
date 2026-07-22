/**
 * The single custom field key that marks a Grispi ticket as a "side ticket"
 * (a yan görüşme) and links it back to its parent ticket.
 *
 * D-01/D-02 (locked decision, 22 Tem 2026): this key is HARD-CODED and must
 * NEVER be read from plugin settings. The field itself is provisioned
 * automatically by Grispi when the plugin is installed on a tenant — this
 * codebase only ever reads/writes its value, never its existence.
 */
export const SIDE_CONVERSATION_PARENT_FIELD_KEY = "tu.side_conversation_parent";
