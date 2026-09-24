import {graphql} from '@/__generated__'

// Feedback GraphQL operations (Story 9.9). Modeled on lib/admin/adminQueries.ts:
// only `sendFeedback` exists — the admin-side `feedback` query and
// `deleteFeedback` are Story 9.10.
export const SendFeedbackMutation = graphql(`
    mutation SendFeedback($text: String!) {
        sendFeedback(text: $text)
    }
`)
