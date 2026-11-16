// Stand-in for the `server-only` package under Vitest. The real package throws when imported
// outside a React Server Components build, which would stop route handlers from being tested.
export {};
