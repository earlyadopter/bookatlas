
# Module 20 — AI-Assisted Requirements, Development, and Testing

This is where we can make the process significantly more systematic.

The important design principle is:

> **AI may derive, organize, implement and test requirements—but it must never silently invent missing business requirements.**

That's Rule #1.

---

# 20.1 Think of AI as several specialized roles

Don't give one giant agent:

```text
"Build the Salesforce integration."
```

Instead think:

```text
Requirements Analyst
        ↓
Integration Architect
        ↓
Implementation Agent
        ↓
Test Designer
        ↓
Code Reviewer
        ↓
Release Reviewer
```

The same underlying model can play all these roles, but the responsibilities should be separated.

---

# 20.2 Recommended repository structure

I would actually put the integration knowledge in the repository:

```text
docs/
  requirements/
    business-rules.md
    open-questions.md

  mappings/
    customer-salesforce-mapping.csv

  architecture/
    customer-sync.md

  contracts/
    openapi.yaml

  testing/
    test-matrix.md


src/
tests/
```

Now AI isn't relying on the chat history.

The repository becomes the source of truth.

---

# 20.3 Add a requirements state model

Every requirement should be:

```text
CONFIRMED

ASSUMED

OPEN

DEPRECATED
```

Example:

```text
BR-017
Status: CONFIRMED

Missing phone preserves Salesforce value.
```

Versus:

```text
BR-018
Status: OPEN

Behavior when customer is deleted upstream.
```

The coding agent must not implement `BR-018` by guessing.

---

# 20.4 The most important AI rule

Put something like this in your project's agent instructions:

```text
BUSINESS RULE SAFETY

Never invent missing business behavior.

If a required behavior is not explicitly documented:
1. Mark it UNRESOLVED.
2. Describe the decision needed.
3. Provide reasonable options and consequences.
4. Do not implement a business-semantic choice until resolved.

Technical implementation choices may be made independently when they
do not change observable business behavior.
```

This rule alone prevents a lot of AI-created nonsense.

---

# 20.5 Second critical rule: distinguish facts from assumptions

```text
For every implementation plan:

CONFIRMED:
- facts directly supported by requirements/contracts/schema.

ASSUMPTIONS:
- technical assumptions that appear safe.

OPEN QUESTIONS:
- missing business decisions.

RISKS:
- ways the implementation can lose, duplicate, overwrite,
  misorder, or expose data.
```

This is extremely useful for integrations.

---

# 20.6 Mapping-agent skill

Create a specialized skill/prompt:

```text
You are the Integration Mapping Analyst.

Inputs:
- source schema
- Salesforce metadata/schema
- business requirements
- existing mapping matrix

Produce/update the mapping matrix containing:

source path
source type
Salesforce object
Salesforce API field
Salesforce type
required/optional
transformation
default
null/omitted semantics
source of truth
external/relationship key
business-rule ID
validation rule
example source value
example Salesforce value
open question

Never infer business mappings merely because field names look similar.
Flag ambiguous mappings.
```

That last line matters enormously.

AI sees:

```text
customer_status
```

and:

```text
Account.Status__c
```

and will happily assume they're equivalent.

Maybe they're not.

---

# 20.7 Business-requirements interview skill

Prompt:

```text
Act as a senior integration business analyst.

Given the current requirements and mapping artifacts,
identify only material unanswered questions that could change:

- data written
- record identity
- field ownership
- synchronization direction
- business lifecycle
- error behavior
- timing
- compliance/security
- reconciliation

Ask questions as concrete scenarios:

"When X occurs, should Y or Z happen?"

Prefer examples over abstract questions.

Do not ask technical implementation questions that engineering
can decide without Product.
```

This generates much better PM questions.

---

# 20.8 Requirements-gap agent

After every workshop, give AI:

```text
meeting notes
current mappings
business rules
API specification
```

and ask:

```text
Compare these artifacts.

Find:
1. contradictions
2. unanswered decisions
3. fields with no ownership rule
4. fields with undefined null semantics
5. entities without stable keys
6. lifecycle cases not covered
7. failure scenarios without expected behavior
8. requirements with no acceptance test
9. tests with no corresponding requirement

Do not resolve gaps yourself.
```

That's an excellent use of AI.

---

# 20.9 Automatically produce a decision log

After Product answers:

```text
DEC-014
Date: ...
Decision:
Missing phone means preserve Salesforce Phone.

Reason:
Source does not reliably provide phone for legacy customers.

Affects:
BR-022
mapping row Phone
TC-031
TC-032
```

Now six months later nobody asks:

> “Why did we do this?”

---

# 20.10 Generate acceptance scenarios automatically

From:

```text
BR-022:
If source omits phone,
preserve Salesforce Phone.
```

AI generates:

```text
TC-022-A

Given Salesforce Account C001
has Phone = 111

When source sends C001
without phone

Then Account C001 remains
Phone = 111
```

Then:

```text
TC-022-B

Given Salesforce Account C001
has Phone = 111

When source sends
phone = null

Then ...
```

And suddenly AI notices:

> Null behavior hasn't been defined.

That's exactly what you want.

---

# 20.11 Requirement → tests traceability

Create IDs:

```text
BR-001
BR-002
BR-003
```

Test names can reference them:

```typescript
test('BR-002 preserves phone when omitted', ...)
```

Or metadata:

```text
@requirement BR-002
```

Then an AI agent can audit:

```text
requirements
↓
which have tests?
```

and report:

```text
BR-016 has no automated coverage.
```

Much more meaningful than generic code coverage.

---

# 20.12 AI architecture reviewer skill

Prompt:

```text
Review this Mule integration design as a senior integration architect.

For every external side effect, identify:

- system of record
- stable business key
- idempotency mechanism
- timeout behavior
- retry policy
- duplicate risk
- ordering risk
- partial failure behavior
- compensation/reconciliation strategy

Also review:
- sync vs async choice
- volume assumptions
- batching opportunities
- N+1 calls
- API contract leakage
- security boundaries
- observability

Do not suggest additional architectural layers unless they solve
a concrete problem.
```

That final rule stops AI from inventing:

```text
Kafka + 7 microservices
```

for everything.

---

# 20.13 AI implementation skill

Then implementation agent gets:

```text
approved requirements
mapping
architecture
contract
```

Rule:

```text
Implement only CONFIRMED requirements.

Before changing code:
- identify BR IDs being implemented.
- identify tests that prove them.

After changing code:
- run targeted tests.
- run regression tests affected by changed dependencies.
- report any requirement ambiguity discovered while coding.
```

This makes coding requirements-driven.

---

# 20.14 DataWeave-review skill

Very Mule-specific and useful:

```text
Review this DataWeave transformation against the approved mapping matrix.

For every target Salesforce field:

1. identify its source.
2. verify data type.
3. verify transformation.
4. verify required/default behavior.
5. verify null/omission semantics.
6. verify no undocumented source fields are forwarded.
7. identify possible accidental Salesforce field clearing.

Return discrepancies only.
```

That is a **great** AI code-review prompt.

---

# 20.15 Salesforce integration reviewer

Prompt:

```text
Review Salesforce operations for:

- query-before-create race conditions
- opportunities to use Upsert
- missing unique External IDs
- unstable business keys
- unnecessary API round trips
- SOQL N+1 patterns
- relationship ordering
- bulk opportunities
- partial result handling
- retry safety
- permission/FLS assumptions
```

You've now encoded most of Modules 4–12 into a review agent.

---

# 20.16 Error-handling reviewer

```text
For every error handler and retry:

Classify the possible failure as:
- transient
- permanent data/business
- authentication/configuration
- unknown/ambiguous outcome

Check:
- Is retry appropriate?
- Is operation idempotent?
- Can prior attempt already have committed?
- What happens after exhaustion?
- Is error normalized to public API?
- Could On Error Continue accidentally hide failure?
```

Very high-value automated review.

---

# 20.17 Test-generator skill

Do not prompt:

> “Write tests.”

Use:

```text
Generate tests from the approved business rules and API contract.

For each requirement, consider:

1. happy path
2. negative validation
3. boundary values
4. omitted optional fields
5. explicit nulls
6. duplicate/replay
7. concurrent duplicate requests
8. downstream failure
9. partial failure
10. relationship correctness
11. authorization/permission behavior
12. eventual-consistency behavior where applicable

Classify each test as:
MUnit
integration
end-to-end
performance
manual/exploratory

Do not create redundant E2E tests when a lower test layer
proves the behavior more reliably.
```

This last sentence prevents enormous brittle suites.

---

# 20.18 Regression-selection agent

This is particularly useful.

Input:

```text
Git diff
changed Mule flows
DataWeave files
business-rule IDs
mapping changes
```

Prompt:

```text
Determine regression impact.

Trace changes to:
- flows
- subflows
- Salesforce objects/fields
- APIs
- events
- shared DataWeave modules
- error handlers

Return:
1. directly affected requirements
2. directly affected tests
3. dependent flows
4. recommended regression suite
5. risks that cannot be proven by current automation
```

Now instead of:

```text
run everything
```

you can make intelligent selections.

---

# 20.19 AI should verify implementation against mappings

This can be automated surprisingly well.

AI can compare:

```text
mapping.csv
```

with:

```dataweave
{
    Name: payload.companyName,
    ...
}
```

and report:

```text
Mapping says BillingState ← payload.billing.state

Implementation says BillingState ← payload.shipping.state

DISCREPANCY
```

That's an excellent AI use case because it is mostly deterministic review.

---

# 20.20 Schema-drift agent

On a schedule or CI:

```text
Salesforce metadata
+
expected mapping
```

Compare:

```text
Does every mapped field still exist?

Same type?

Still writable?

Still external ID?

Relationship still exists?
```

Then:

```text
mapping uses Account.Legacy_Status__c
but current schema doesn't contain it
```

Fail deployment or alert.

---

# 20.21 Requirements-change impact agent

PM changes:

> “Starting next month, blank phone should clear Salesforce instead of preserving it.”

AI should find:

```text
BR-022
mapping row
DataWeave
MUnit tests
integration tests
documentation
```

and propose the change set.

This is exactly where AI excels: **cross-artifact consistency**.

---

# 20.22 AI-generated test data

Give it Salesforce constraints:

```text
required fields
picklists
relationships
validation rules
```

and ask for:

```text
minimal valid Account

maximal Account

invalid state

missing required field

boundary-length Name

Account + Contacts

duplicate business ID
```

But generated data should remain synthetic.

Never dump production records into prompts unnecessarily.

---

# 20.23 Production-log feedback loop

A powerful later-stage system:

```text
production telemetry
↓
sanitize
↓
AI pattern analysis
↓
uncovered scenario
↓
new regression test
```

Example:

AI notices:

```text
72% of recent failures involve
Contacts arriving before Account availability.
```

Then recommend:

```text
new ordering/retry test
```

This connects production experience back into regression coverage.

---

# 20.24 But AI should not automatically turn every production error into a test

Rule:

```text
Before adding regression coverage,
classify whether the incident represents:

- product defect
- integration defect
- bad external data
- transient infrastructure issue
- configuration issue
- expected rejected behavior
```

Otherwise suite fills with useless tests.

---

# 20.25 AI pull-request reviewer

I would have a PR-level rule like:

```text
Review this integration change against:

1. approved business rules
2. field mapping
3. API/event contract
4. idempotency requirements
5. Salesforce limits/relationships
6. null semantics
7. error/retry design
8. security/logging rules
9. existing regression coverage

Flag:
- undocumented behavior
- broken traceability
- missing test coverage
- accidental target-field changes
```

This is much better than generic:

> “Review my code.”

---

# 20.26 Security-review agent

Prompt:

```text
Inspect changes for:

- hardcoded credentials
- production identifiers
- secret logging
- Authorization header logging
- full payload logging
- PII/PHI leakage
- over-broad Salesforce permissions assumptions
- insecure endpoint configuration
- environment-specific values committed to code

Report findings with file/line and remediation.
```

---

# 20.27 Observability-review agent

Every new integration operation should answer:

```text
How will we know it works?

How will we know it is failing?

How can we trace one transaction?
```

AI rule:

```text
For every new external integration step, verify there is:

- correlation context
- meaningful structured success/failure telemetry
- latency measurement
- normalized error classification
- no sensitive payload logging

For async operations also verify:
- backlog metric
- processing lag
- retry/DLQ visibility.
```

---

# 20.28 Definition of Ready agent

Before implementation:

```text
A story is not READY unless:

- business outcome defined
- source/target identified
- stable identity defined
- field mappings approved
- ownership/conflicts defined
- null behavior defined for changed fields
- lifecycle behavior defined
- failure expectations defined
- timing/volume known sufficiently
- acceptance examples exist
```

AI can check every Jira story against this.

---

# 20.29 Definition of Done agent

After implementation:

```text
DONE requires:

- requirements implemented
- mapping updated
- API/event contract updated
- MUnit passing
- required integration tests passing
- security review clean
- observability present
- deployment configuration documented
- rollback/reconciliation considerations documented
- no unresolved requirement silently implemented
```

That's a robust integration DoD.

---

# 20.30 I'd put a compact rules file in the repo

Something like:

```text
INTEGRATION ENGINEERING RULES

1. Never invent business requirements.
2. Every observable business behavior must trace to BR-*.
3. Every Salesforce write must have an explicitly documented identity/key.
4. Prefer Upsert with stable unique External ID where semantics permit.
5. Never implement Query→Create for duplicate prevention without
   concurrency analysis.
6. Distinguish omitted fields from explicit nulls.
7. Never add a retry without documenting idempotency.
8. Treat timeouts as ambiguous outcomes.
9. Never assume cross-system rollback.
10. Prefer bulk operations over N+1 calls.
11. Never log secrets or unapproved full payloads.
12. Every external dependency needs timeout and error semantics.
13. Async flows require retry, replay/DLQ and lag observability.
14. Every requirement change must trigger test-impact analysis.
15. Mocks cannot prove real Salesforce schema/permissions.
16. Do not declare integration complete based only on HTTP success;
    verify business target state where appropriate.
17. Flag uncertainty instead of guessing.
```

If your coding AI follows these seventeen rules, it will already behave better than a surprising amount of manually written integration code.

---

# 20.31 Then add specialized “skills”

I'd create these:

```text
requirements-interviewer
mapping-reviewer
requirements-gap-analyzer
integration-architect
dataweave-reviewer
salesforce-reviewer
error-resilience-reviewer
test-designer
regression-impact-analyzer
security-reviewer
observability-reviewer
release-readiness-reviewer
```

Each should have narrow responsibilities.

That's much better than a single:

```text
super-agent.md
```

with 12 pages of instructions.

---

# 20.32 A possible AI workflow

Here's the workflow I'd actually want:

```text
PM story / meeting
        ↓
Requirements Analyst AI
        ↓
business-rules.md
open-questions.md
        ↓
Human/Product approval
        ↓
Mapping AI
        ↓
mapping.csv
        ↓
Architecture AI
        ↓
design.md
        ↓
Human engineering review
        ↓
Implementation AI
        ↓
Mule/DataWeave code
        ↓
Test Designer AI
        ↓
MUnit + integration tests
        ↓
Review agents
 ┌──────┼─────────┐
 ↓      ↓         ↓
Mapping Security Resilience
        ↓
CI
        ↓
QA deployment
        ↓
Automated regression
        ↓
Release readiness AI
        ↓
Human release decision
```

Notice the AI doesn't replace the Product Manager.

It converts messy human decisions into consistent engineering artifacts.

---

# 20.33 Where humans stay authoritative

I would explicitly reserve these for humans:

```text
Business semantics

Source-of-truth decisions

Whether data may be overwritten

Compliance decisions

Acceptable business loss/partial failure

Production access/security approval

Release acceptance for high-risk changes
```

AI can surface options and consequences.

It shouldn't quietly choose them.

---

# 20.34 Where AI can be highly autonomous

AI can safely do much more with:

```text
schema comparison

mapping consistency

DataWeave generation

boilerplate Mule flows

MUnit generation

OpenAPI validation

test-data generation

test impact analysis

SOQL review

duplicate-risk detection

log/telemetry review

documentation synchronization

CI troubleshooting
```

because these are much more constrained by existing evidence.

---

# 20.35 A great “requirements meeting → engineering” master prompt

After a meeting:

```text
You are the requirements analyst for a MuleSoft-to-Salesforce integration.

Inputs:
- meeting transcript
- current business rules
- current mapping matrix
- OpenAPI/event contract
- Salesforce schema
- existing test matrix

Update the engineering requirements package.

Produce:

1. Confirmed decisions from the meeting.
2. Newly discovered requirements.
3. Open business questions.
4. Mapping changes.
5. API/event contract implications.
6. Data ownership or null-semantic changes.
7. Idempotency/lifecycle implications.
8. Error/recovery implications.
9. New or changed acceptance scenarios.
10. Existing automated tests affected.

Rules:
- Do not invent missing business behavior.
- Clearly distinguish CONFIRMED from INFERRED.
- Put every unresolved business decision in OPEN QUESTIONS.
- Detect contradictions with existing requirements.
- Preserve requirement IDs where possible.
```

That would be extremely useful.

---

# 20.36 And the implementation master prompt

Once approved:

```text
Implement only the CONFIRMED requirements in this change.

Before coding:
1. List the BR-* requirements being implemented.
2. Identify affected mappings, flows, Salesforce fields and tests.
3. Flag unresolved requirements that block implementation.

During implementation:
- preserve documented null/omission semantics.
- preserve field ownership boundaries.
- use documented stable keys.
- evaluate every retry for idempotency.
- avoid N+1 Salesforce calls.
- never introduce undocumented business behavior.

After implementation:
1. Run targeted MUnit tests.
2. Run affected integration tests.
3. Review changes against the mapping matrix.
4. Perform regression impact analysis.
5. Report remaining risks and untested infrastructure assumptions.
```

That is the kind of prompt I would genuinely use with Claude Code/Codex.

---

# 20.37 My preferred AI test strategy

Have AI think in layers:

```text
Requirement
     ↓
Can MUnit prove it?
     ↓ yes
MUnit

No
     ↓
Does it require real Salesforce?
     ↓ yes
Integration test

No
     ↓
Does it require full workflow?
     ↓ yes
E2E

Does it require volume?
     ↓
Performance test
```

This prevents every test from becoming expensive E2E.

---

# Module 20 Cheat Sheet

```text
AI SHOULD
=========

extract
organize
compare
implement
test
review
trace
detect contradictions


AI MUST NOT
===========

invent business semantics


SOURCE OF TRUTH
===============

repo artifacts:

business-rules.md
mapping.csv
OpenAPI
architecture.md
test-matrix.md


REQUIREMENT STATES
==================

CONFIRMED
ASSUMED
OPEN
DEPRECATED


TRACEABILITY
============

BR-001
↓
mapping
↓
code
↓
test


AI SKILLS
=========

requirements analyst
mapping reviewer
architecture reviewer
DataWeave reviewer
Salesforce reviewer
resilience reviewer
test designer
regression analyzer
security reviewer
observability reviewer
release reviewer


CORE AI RULES
=============

no guessing

external IDs / identity explicit

null semantics explicit

retry ⇒ idempotency review

timeout = ambiguous

no assumed rollback

avoid N+1

verify real SF separately

no secret logging

flag contradictions
```

The interview-worthy sentence tying both modules together is:

> **“I like to make integration requirements executable and traceable: business rules get IDs, mappings reference them, acceptance scenarios are generated from them, and automated tests trace back to the same rules. AI can automate much of the requirements analysis, mapping review, implementation and regression-impact analysis, but I explicitly prohibit it from inventing missing business semantics—it must surface those as Product decisions.”**

And one thing I would add to the two-day Mule exercise: **have the AI create the mapping matrix and business-rule/test matrix before it writes the first DataWeave script.** That forces the implementation to be requirements-driven instead of letting generated code become the de facto specification.

[1]: https://docs.mulesoft.com/general/api-led-design?utm_source=chatgpt.com "Step 2. Design an API Spec | MuleSoft Documentation"
[2]: https://developer.salesforce.com/docs/platform/dataloader/guide/import-data.html?utm_source=chatgpt.com "Importing Data into Salesforce | Getting Started | Dataloader from MuleSoft | Salesforce Developers"
