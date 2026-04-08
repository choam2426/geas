---
name: policy-managing
description: rules.md override management — list active rules, apply temporary overrides, check expiry, and preserve full override history for audit. Writes to .geas/state/policy-overrides.json. Reads from .geas/rules.md.
user-invocable: true
---

# Policy Managing

Override management for `.geas/rules.md`. Lets the team temporarily disable or modify a rule with a reason, an expiry date, and an approver — without permanently altering the canonical rules file.

**Invocation:** `/geas:policy-managing <capability> [arguments]`

---

## Capabilities

### 1. List Rules

Show every rule currently defined in `.geas/rules.md`, annotated with its override status.

**Process:**

1. Read `.geas/rules.md`. Parse each rule entry (expect markdown sections or numbered/bulleted list items). Extract `rule_id` where present, or derive a slug from the heading/first line.
2. Read `.geas/state/policy-overrides.json` (if it does not exist, treat as `{"overrides": []}`).
3. For each rule, check whether an active (non-expired) override exists in the overrides list.
4. Print the rule list.

**Output format:**

```
## Active Rules

| Rule ID                   | Summary                                      | Override Status        |
|---------------------------|----------------------------------------------|------------------------|
| require-retrospective     | Every passed task requires retrospective.json | DISABLED until 2026-04-03 (hotfix deployment) |
| gate-tier2-mandatory      | Tier 2 evidence required for high-risk tasks  | active (no override)   |
| memory-promotion-min-3    | Minimum 3 evidence refs to promote memory     | active (no override)   |
```

If `rules.md` does not exist, output:

```
No rules.md found at .geas/rules.md. Run /geas:setup to initialize the project.
```

---

### 2. Override a Rule

Temporarily disable or modify a rule. Creates or updates `.geas/state/policy-overrides.json`.

**Invocation:** `/geas:policy-managing override <rule_id> <action> <reason> <expires_at> <approved_by>`

**Required fields:**

| Field         | Type                  | Description                                           |
|---------------|-----------------------|-------------------------------------------------------|
| `rule_id`     | string                | Matches a rule slug from `rules.md`                   |
| `action`      | `disable` or `modify` | `disable` = rule is skipped; `modify` = rule is changed |
| `reason`      | string                | Why the override is needed                            |
| `expires_at`  | ISO 8601 datetime     | When the override automatically expires               |
| `approved_by` | agent type string     | Who authorized this override                          |

**Process:**

1. Validate all required fields are present. If any is missing, stop and list the missing fields.
2. Enforce approval rules (see Rules section below).
3. Read `.geas/state/policy-overrides.json` (create if missing).
4. If an active override already exists for `rule_id`, mark the existing entry `expired: true` and add the new entry. Never delete the old entry.
5. Append the new override entry with `expired: false` and `created_at` set to current timestamp.
6. Write the updated file back to `.geas/state/policy-overrides.json` (use Write tool — no dedicated CLI command for policy-overrides).
7. Confirm to the user:

```
Override recorded.
  rule_id:     require-retrospective
  action:      disable
  reason:      hotfix deployment
  expires_at:  2026-04-03T00:00:00Z
  approved_by: product_authority
```

**policy-overrides.json format:**

```json
{
  "overrides": [
    {
      "rule_id": "require-retrospective",
      "action": "disable",
      "reason": "hotfix deployment",
      "expires_at": "2026-04-03T00:00:00Z",
      "approved_by": "product_authority",
      "created_at": "2026-04-02T12:00:00Z",
      "expired": false
    }
  ]
}
```

Fields:

| Field        | Type    | Description                                                   |
|--------------|---------|---------------------------------------------------------------|
| `rule_id`    | string  | Identifies the rule being overridden                          |
| `action`     | string  | `disable` or `modify`                                         |
| `reason`     | string  | Justification for the override                                |
| `expires_at` | string  | ISO 8601 — when the override automatically expires            |
| `approved_by`| string  | Agent type who approved (e.g. `product_authority`)            |
| `created_at` | string  | ISO 8601 — when the override was recorded                     |
| `expired`    | boolean | `false` = currently active; `true` = past expiry or superseded |

---

### 3. Check Expiry

Scan all overrides, detect expired entries, and re-enable the affected rules by marking the override expired.

**Process:**

1. Read `.geas/state/policy-overrides.json`. If the file does not exist, output "No overrides on record." and stop.
2. Get the current timestamp.
3. For each override where `expired: false` and `expires_at < now`:
   - Set `expired: true` on that entry.
   - Record the `rule_id` in a "re-enabled" list.
4. Write the updated file back.
5. Report results:

```
## Expiry Check

Checked 4 overrides.

Re-enabled (expired overrides removed):
  - require-retrospective  (was disabled, expired 2026-04-03T00:00:00Z)

Still active:
  - gate-tier2-mandatory   (expires 2026-04-10T00:00:00Z, approved_by: product_authority)
```

If no overrides have expired:

```
Expiry check complete. All 2 active overrides are still within their expiry window.
```

---

### 4. Override History

Show all overrides ever recorded, including expired ones, for audit purposes.

**Process:**

1. Read `.geas/state/policy-overrides.json`. If the file does not exist, output "No override history found." and stop.
2. Display every entry — active and expired — in a table, sorted by `created_at` descending (most recent first).

**Output format:**

```
## Override History

| # | Rule ID                | Action  | Reason              | Approved By       | Created At           | Expires At           | Status   |
|---|------------------------|---------|---------------------|-------------------|----------------------|----------------------|----------|
| 1 | require-retrospective  | disable | hotfix deployment   | product_authority | 2026-04-02T12:00:00Z | 2026-04-03T00:00:00Z | expired  |
| 2 | gate-tier2-mandatory   | disable | load test window    | product_authority | 2026-04-05T09:00:00Z | 2026-04-10T00:00:00Z | active   |

Total overrides recorded: 2  |  Active: 1  |  Expired: 1
```

If no history exists:

```
No override history found. No overrides have been applied to this project.
```

---

## Rules

1. **Every override requires `reason` and `approved_by`.** An override without both fields must be rejected before writing.

2. **No permanent overrides without `product_authority` explicit approval.** If `expires_at` is more than 30 days from `created_at`, require `approved_by: product_authority`. If a different agent type is provided, reject with:

   ```
   Permanent overrides (> 30 days) require approved_by: product_authority.
   Provided: <value>. Request approval from product_authority before applying.
   ```

3. **Override history is preserved.** Expired or superseded entries are never deleted — only marked `expired: true`. The full history must remain available for audit via the "Override history" capability.

4. **Re-enabling a rule does not delete the override entry.** Expiry sets `expired: true` on the existing record. The record stays in the file permanently.

5. **Concurrent overrides for the same rule:** if an active override already exists for a `rule_id` when a new override is applied, mark the old entry `expired: true` first, then append the new entry. Both entries remain in the file.

---

## When to Use

- Before a hotfix deployment that cannot wait for the normal gate cycle.
- During a load-test window when specific evidence requirements would be impractical.
- When `product_authority` grants a temporary process exception for a release deadline.
- At session start: run "Check expiry" to re-enable any rules whose override window has closed.

---

## File Paths

| File | Purpose |
|------|---------|
| `.geas/rules.md` | Canonical rule definitions (read-only by this skill) |
| `.geas/state/policy-overrides.json` | Active and historical overrides (written by this skill) |
