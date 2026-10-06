---
paths:
  - "src/lib/domain/**"
---
# Domain layer rules

- Pure TypeScript. No React, no Next, no fetch, no imports outside `src/lib/domain`.
- One exported, named function per rule: `canTransition`, `canAssignRider`,
  `remainingAttempts`, `canOverride`… Components and mock handlers both call these.
- Statuses and transitions are `as const` data, not scattered string literals.
- `switch` statements on status end with an exhaustive `never` check.
- If you add or change a rule here, update `docs/domain-rules.md` in the same change.
- If a rule is unclear in the PRD, don't invent one: add it to the Open questions in
  `docs/domain-rules.md` and pick the safer default.
