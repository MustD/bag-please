import {CodegenConfig} from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: {
    "http://localhost:2080/api/graphql": {
      headers: {
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJiYWctcGxlYXNlLmNvbSIsImlzcyI6ImJhZy1wbGVhc2UuY29tIiwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTc3ODY4MzI4NX0.qOWFcCM8r22bzcsMtLpQ0W1tpK0zMFhP0E8LkMHydS0",
      },
    },
  },
  // This assumes that all your source files are in a top-level `src/` directory - you might need to adjust this to your file structure
  documents: ["src/**/*.{ts,tsx}"],
  // Don't exit with non-zero status when there are no documents
  ignoreNoDocuments: true,
  generates: {
    // Use a path that works the best for the structure of your application
    "./src/__generated__/": {
      preset: "client",
      presetConfig: {
        // Disable fragment masking
        fragmentMasking: true,
      },
      config: {
        // Apollo Client always includes `__typename` fields
        nonOptionalTypename: true,
        // Apollo Client doesn't add the `__typename` field to root types so
        // don't generate a type for the `__typename` for root operation types.
        skipTypeNameForRoot: true,
      },
    },
  },
};
export default config;
