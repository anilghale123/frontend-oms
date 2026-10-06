# OMS — Next.js TypeScript Implementation Prompt

You are working on a new project called **OMS**.

I have two existing repositories that you must analyze before implementing anything:

### Repository 1 — OMS Design Repository

This is the existing OMS project created by the designer.

* Built with **Next.js + JavaScript/JSX**
* Contains the completed UI/design
* Contains pages, layouts, components, styling, interactions, assets, and some functional behavior
* The main purpose of this repository is to provide the **visual and UX source of truth**

### Repository 2 — eSewa MiniApp

This is an existing production-quality project.

* Built with **Next.js + TypeScript**
* Functionality is already working properly
* It represents the coding standards and architecture that our team already uses
* Use it as the primary reference for:

  * Folder structure
  * Application architecture
  * TypeScript patterns
  * API/service organization
  * State management
  * Reusable components
  * Hooks
  * Utilities
  * Error handling
  * Loading states
  * Form handling
  * Naming conventions
  * Constants
  * Configuration
  * Authentication/authorization patterns where applicable
  * Code organization
  * Maintainability patterns

---

# Main Objective

Build the **OMS application in Next.js + TypeScript** by combining the best parts of both repositories.

The desired result is:

> **OMS Design + eSewa MiniApp engineering standards + improved architecture where appropriate**

Do NOT simply copy one repository into the other.

Instead, understand both codebases first and then implement OMS using the design from the OMS repository and the engineering patterns from eSewa MiniApp.

---

# IMPORTANT: Analyze Before Implementing

Before modifying or creating significant code, inspect both repositories thoroughly.

First determine:

1. OMS application's current:

   * Pages/routes
   * Layouts
   * Components
   * UI patterns
   * Styling system
   * Assets
   * Forms
   * Tables
   * Modals
   * Navigation
   * Responsive behavior
   * Existing functionality
   * API-related code, if any

2. eSewa MiniApp's:

   * App structure
   * Folder structure
   * Routing architecture
   * Component architecture
   * API architecture
   * State management
   * Hooks
   * Utilities
   * Type definitions
   * Error handling
   * Loading/error/empty states
   * Form patterns
   * Authentication/session patterns
   * Configuration/environment handling
   * Naming conventions
   * Reusable abstractions

3. Identify which patterns from eSewa MiniApp are genuinely useful for OMS and which should NOT be copied because OMS has different requirements.

---

# Source-of-Truth Rules

Use these rules throughout the implementation.

### UI / Design

The **OMS design repository is the source of truth** for:

* Visual design
* Layout
* Spacing
* Typography
* Colors
* Components
* Page structure
* Responsive behavior
* Interactions
* Visual states
* Animations
* Existing UX decisions

Do not redesign the OMS unnecessarily.

If the OMS design already provides a component or page, preserve its visual appearance as closely as practical.

---

### Architecture / Engineering

The **eSewa MiniApp repository is the primary reference** for:

* Project architecture
* Folder organization
* TypeScript conventions
* API/service patterns
* State management patterns
* Hooks
* Utilities
* Reusable abstractions
* Error handling
* Loading states
* Form architecture
* Naming conventions
* Code quality standards

However, do not blindly copy its architecture.

Evaluate whether each pattern makes sense for OMS.

If OMS can use a cleaner or more maintainable approach, improve it.

---

# TypeScript Migration

The OMS design repository is written in JSX/JavaScript, but the new OMS implementation MUST use:

* TypeScript
* `.ts`
* `.tsx`

Do not simply rename `.jsx` files to `.tsx`.

Properly convert the code.

For every migrated component:

* Define API response types
* Define form types
* Define state types
* Avoid `any` unless there is a strong technical reason
* Prefer reusable interfaces/types
* Use discriminated unions where useful
* Properly type event handlers
* Properly type refs
* Properly type hooks
* Properly type API/service functions

Create shared types when multiple parts of the application use the same data structure.

---

# Do Not Over-Engineer

The goal is not to create an unnecessarily complicated enterprise architecture.

Prefer:

* Simple
* Predictable
* Maintainable
* Reusable
* Type-safe
* Easy for another developer to understand

Do not introduce abstractions simply because they look architecturally sophisticated.

If a simple component is enough, keep it simple.

---

# Component Strategy

Identify reusable UI patterns from the OMS design.

For example:

* Buttons
* Inputs
* Selects
* Tables
* Cards
* Modals
* Drawers
* Tabs
* Pagination
* Headers
* Sidebars
* Page headers
* Status badges
* Empty states
* Loading states
* Error states
* Form sections

Create reusable components when the same pattern appears multiple times.

However, do not create generic components prematurely.

Use this principle:

> Abstract repeated patterns, not hypothetical future requirements.

---

# Page Implementation

For every OMS page:

1. Understand the original JSX implementation.
2. Preserve the intended UI.
3. Identify its reusable components.
4. Convert it to TypeScript.
5. Integrate it into the new OMS architecture.
6. Connect functionality using the project's proper service/API patterns.
7. Add proper loading, error, empty, and success states.
8. Ensure responsive behavior is preserved.
9. Ensure the final implementation is clean and maintainable.

---

# API / Data Layer

If the existing OMS design contains mocked/static data:

Do not permanently hardcode data into UI components.

Instead, structure the implementation so that real APIs can be integrated cleanly.

Follow the eSewa MiniApp's API/service architecture where appropriate.

Separate:

**UI → hooks/state → service/API → types**

when that separation is appropriate.

Do not put large API/business logic directly inside page components.

---

# State Management

First inspect how eSewa MiniApp handles state.

Then determine what OMS actually needs.

Do not introduce global state for data that can remain local.

Prefer:

* Local component state for local UI state
* Form state for forms
* Server/API state for remote data
* Global state only when genuinely shared across the application

Avoid unnecessary state duplication.

---

# Forms

Inspect the form patterns used by eSewa MiniApp.

For OMS:

* Keep form logic maintainable
* Properly type form values
* Validate user input
* Handle submission/loading/error/success states
* Avoid unnecessary individual state variables when a proper form abstraction can handle the state
* Keep business logic outside presentation components where practical

---

# Error / Loading / Empty States

Every API-driven page should consider:

### Loading

Show an appropriate loading state without causing unnecessary layout shifts.

### Error

Display a useful error state/message and provide retry behavior where appropriate.

### Empty

Clearly communicate when there is no data.

### Success

Provide appropriate feedback after create/update/delete operations.

Follow existing eSewa MiniApp conventions where they are suitable.

---

# Responsive Design

Preserve the responsive behavior from the OMS design.

Test/consider:

* Desktop
* Tablet
* Mobile

Do not assume the designer's desktop implementation automatically works correctly on smaller screens.

If you find a responsive issue while implementing, fix it while preserving the original design intent.

---

# Code Quality Rules

Follow these principles:

* Strong TypeScript
* No unnecessary `any`
* No duplicated business logic
* No duplicated API calls
* No giant components
* No unnecessary prop drilling
* No unnecessary global state
* No hardcoded magic values when constants/configuration are appropriate
* Clear naming
* Small focused components
* Reusable utilities
* Consistent imports
* Consistent formatting
* Proper error handling
* Proper cleanup for effects/subscriptions
* Avoid unnecessary `useEffect`
* Avoid unnecessary re-renders
* Keep server/client boundaries intentional

---

# Before Creating New Architecture

Whenever you are unsure whether to introduce a new pattern, compare it with the eSewa MiniApp implementation.

Ask:

1. Does eSewa already solve this problem?
2. Can the existing pattern be adapted?
3. Is the existing pattern suitable for OMS?
4. Can it be improved without adding unnecessary complexity?

Do not introduce a completely different architecture without a strong reason.

---

# Important: Preserve Existing Design

Do not make arbitrary visual changes.

Do not change:

* Colors
* Spacing
* Typography
* Layout
* Component appearance
* Navigation
* User flows

unless:

1. The existing design is technically broken,
2. The design cannot work correctly with the new architecture,
3. There is a clear responsive/accessibility issue,
4. Or the change is required for functionality.

If a visual change is necessary, keep it as close as possible to the original design.

---

# Improve Where It Matters

You are allowed to improve the implementation where the improvement is clearly beneficial.

Examples:

* Better TypeScript typing
* Better component reuse
* Cleaner folder structure
* Better API separation
* Better error handling
* Better loading states
* Better responsive behavior
* Reduced duplication
* Better accessibility
* Better performance
* Better maintainability
* Better naming
* Cleaner state management

But do not "improve" the code simply for the sake of changing it.

---

# Folder Structure

Before implementing, compare the folder structures of both repositories.

Determine:

* Which OMS folders should remain
* Which eSewa patterns should be adopted
* Which folders should be introduced
* Which folders are unnecessary

Then establish a clean OMS folder structure.

The final structure should feel like a natural evolution of the eSewa MiniApp architecture adapted to OMS, rather than a random combination of both repositories.

---

# Migration Strategy

Do not attempt to convert everything blindly at once.

Use this sequence:

### Phase 1 — Repository Analysis

Analyze both repositories.

Produce a concise report containing:

#### OMS

* Current architecture
* Important pages
* Important components
* Styling approach
* Existing functionality
* Reusable UI components

#### eSewa MiniApp

* Architecture
* Folder structure
* Component patterns
* API patterns
* State management
* TypeScript conventions
* Important reusable patterns

#### Recommended OMS Architecture

Explain:

* What should be taken from OMS
* What should be taken from eSewa
* What should be improved
* What should NOT be copied

Do not modify significant code during this analysis phase.

---

### Phase 2 — Architecture Setup

Create/adjust the OMS TypeScript architecture.

Establish:

* Folder structure
* Shared components
* Types
* Utilities
* Services/API layer
* Hooks
* State management
* Layouts
* Configuration

Make sure the architecture supports the existing OMS design.

---

### Phase 3 — UI Migration

Migrate the OMS pages and components from JSX to TSX.

Preserve the original design.

Convert JavaScript logic into proper TypeScript.

---

### Phase 4 — Functionality

Implement functionality using the architecture established above.

Use the eSewa MiniApp patterns where appropriate.

---

### Phase 5 — Quality Review

After implementation, review the entire application for:

* TypeScript errors
* Runtime errors
* Broken imports
* Incorrect routes
* Missing states
* Duplicated code
* Unnecessary state
* Unnecessary effects
* Poor component boundaries
* Responsive issues
* Accessibility issues
* API/service issues
* Error handling
* Performance problems

Fix issues found during the review.

---

# Decision Rule When Repositories Conflict

If OMS and eSewa MiniApp use different approaches:

### For UI:

Prefer OMS.

### For engineering:

Prefer eSewa MiniApp unless OMS requirements justify a different approach.

### For TypeScript:

Use proper TypeScript rather than directly preserving JavaScript patterns.

### For architecture:

Choose the simpler maintainable solution that fits OMS.

### For functionality:

Preserve OMS's intended behavior while using the proven implementation patterns from eSewa where applicable.

---

# Important Development Behavior

Before implementing a feature, inspect existing code first.

Do not create a new:

* Component
* Hook
* Utility
* Service
* Type
* State mechanism

if an appropriate existing implementation already exists.

Reuse existing abstractions when they genuinely fit.

At the same time, do not force unrelated functionality into an existing abstraction just to avoid creating a new file.

---

# Final Goal

The final OMS application should feel like:

**The original OMS design**
+
**the engineering discipline of eSewa MiniApp**
+
**proper TypeScript implementation**
+
**cleaner architecture where improvements are justified**

It should NOT feel like:

* A simple JSX → TSX conversion
* A copy of eSewa MiniApp
* A copy-paste of the OMS designer repository
* An over-engineered architecture

The final codebase should be production-ready, maintainable, consistent, and easy for another developer familiar with the eSewa MiniApp project to understand.

## Start Here

First inspect both repositories and give me the **Phase 1 analysis**.

Do not start making major implementation changes until the architecture comparison is complete.

Exclude: ignore pages folder from esewa-mini app, use directly into route of nextJs pages no need to make seaprate pages folder as made in esewa-mini-app

note: keep existing page of oms-frontend folder orders as backup renaming it as backup-orders and other pages associated to it as we need to fresh start for our oms project