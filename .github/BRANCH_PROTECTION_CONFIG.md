# Branch Protection Configuration

This document describes the branch protection rules configured for the `main` branch.

## Settings Applied to `main` Branch

### 1. Require a Pull Request Before Merging ✅
- **Status**: Enabled
- **Dismiss stale pull request approvals**: Enabled
- **Require review from code owners**: Disabled (no CODEOWNERS file)
- **Purpose**: All changes must go through PR review before merging

### 2. Require Status Checks to Pass ✅
- **Status**: Enabled
- **Required checks** (the name is the single job in
  `.github/workflows/validate.yml`; a required check naming a job that
  doesn't exist makes every PR unmergeable, so this list must never name
  more jobs than that workflow actually defines):
  - `validate` — plugin structure and manifests; billing end-to-end tests;
    shared runtime, plugin domain-logic, and tool-behaviour tests;
    environment, secret-hygiene and dependency/licence checks; regression
    coverage; vendored-runtime sync; archive build; what the built
    archives actually ship
- **Purpose**: Automated validation runs on every PR and must pass before merge
- **Note**: there is no separate parse-only syntax check. Every shipped
  `.js` file is not merely parsed but actually executed — the
  tool-behaviour and shipped-artifact checks above boot all 14 plugin
  servers and the billing service for real — which catches a broken file
  more thoroughly than a syntax check would.

### 3. Delete Head Branches on Merge ✅
- **Status**: Enabled
- **Purpose**: Automatically deletes feature branches after successful merge, keeping the repo clean

### 4. Additional Security Settings
- **Protect matching branches**: `main`
- **Require linear history**: Disabled (allows squash/rebase)
- **Require branches to be up to date**: Disabled (optional, can be enabled)

## How to Apply These Settings

1. Go to **Settings** → **Branches**
2. Click **Add branch protection rule**
3. Enter branch name pattern: `main`
4. Enable the checkboxes listed above
5. Save changes

## What This Protects Against

- ✅ Direct pushes to `main` without review
- ✅ Merging code that fails validation checks
- ✅ Stale approvals on outdated code
- ✅ Branch clutter after merges
- ✅ Inconsistent code structure across plugins

## Related Files

- `.github/workflows/validate.yml` — GitHub Actions workflow that runs the validation checks; its job name is the required check name above
- `scripts/validate.mjs` — Plugin validation script that runs in the `validate` job
