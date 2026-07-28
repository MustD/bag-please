import type {CodegenConfig} from '@graphql-codegen/cli'

// GraphQL codegen (client-preset) — introspects the live backend schema at
// :2080 and emits typed helpers into src/__generated__/ (never hand-edited).
//
// The schema endpoint requires a Bearer token. Access tokens are short-lived
// (~15 min), so rather than commit one, mint a fresh admin token and pass it in:
//
//   TOKEN=$(curl -s -X POST http://localhost:2080/api/auth/login \
//     -H 'Content-Type: application/json' \
//     -d '{"username":"admin","password":"admin"}' | jq -r .accessToken)
//   CODEGEN_TOKEN="$TOKEN" npm run generate
//
// Requires the full stack running on :2080 (docker compose up -d --build).
const config: CodegenConfig = {
  overwrite: true,
  schema: {
    'http://localhost:2080/api/graphql': {
      headers: {
        Authorization: `Bearer ${process.env.CODEGEN_TOKEN ?? ''}`,
      },
    },
  },
  documents: ['src/**/*.{ts,tsx}'],
  // Don't fail when there are no operations yet (none defined in Story 5.1).
  ignoreNoDocuments: true,
  // Allow partial output when documents are invalid.
  allowPartialOutputs: true,
  generates: {
    './src/__generated__/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: true,
      },
      config: {
        // Apollo Client always includes `__typename` fields.
        nonOptionalTypename: true,
        // Apollo Client doesn't add `__typename` to root operation types.
        skipTypeNameForRoot: true,
      },
    },
  },
}
export default config
