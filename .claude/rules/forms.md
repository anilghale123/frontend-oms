---
paths:
  - "src/features/**/schema.ts"
  - "src/features/**/*-form.tsx"
---
# Form rules

- react-hook-form + `zodResolver`; the schema lives in the feature's `schema.ts`.
- Use Radian `Form`, `Input`, `PhoneInput`, `Select`. Errors inline under each field.
- Rider phone: Nepal mobile, 10 digits starting with 97 or 98.
- Vehicle number: required free text, trimmed (Nepal plate formats vary).
- Disable submit while pending; toast on success using the button's verb.
- Server errors from the API map back to fields when the code allows, else a form-level alert.
