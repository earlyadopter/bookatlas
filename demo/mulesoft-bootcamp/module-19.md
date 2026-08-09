Absolutely. I would add these as **Module 19 — Requirements Engineering for Integrations** and **Module 20 — AI-Assisted Integration Engineering**.

The first one is especially important because a field-mapping spreadsheet alone is not enough. It tells you **where data goes**, but not necessarily **what it means, when it should move, which system wins conflicts, what null means, or what should happen when the workflow partially fails**.

MuleSoft itself recommends defining the API contract and understanding purpose, data flows, and security requirements before implementation. ([MuleSoft Documentation][1])

# Module 19 — Requirements Gathering for Mule/Salesforce Integrations

## 19.1 Start with the mapping spreadsheet — but make it richer

Yes, I would absolutely expect some sort of mapping document.

But instead of just:

| Source         | Salesforce                |
| -------------- | ------------------------- |
| `customer_id`  | `External_Customer_ID__c` |
| `company_name` | `Name`                    |
| `phone`        | `Phone`                   |

make it more like:

| Source field   | SF Object | SF Field                  | Type   | Required? | Transformation | Null behavior      | Key?        | Business rule                | Example    |
| -------------- | --------- | ------------------------- | ------ | --------- | -------------- | ------------------ | ----------- | ---------------------------- | ---------- |
| `customer_id`  | Account   | `External_Customer_ID__c` | String | Yes       | trim           | reject if null     | External ID | uniquely identifies customer | C001       |
| `company_name` | Account   | `Name`                    | String | Yes       | trim           | reject             | No          | legal/display company name   | Acme       |
| `phone`        | Account   | `Phone`                   | String | No        | normalize      | omitted = preserve | No          | primary business phone       | 3055551234 |
| `state`        | Account   | `BillingState`            | String | No        | uppercase      | null = clear?      | No          | billing address state        | FL         |

The extra columns are where most integration defects live.

Salesforce's own data-loading guidance emphasizes mapping required fields and selecting the Salesforce ID or external ID used for upsert. ([Developer][2])

---

# 19.2 The biggest question is not “what maps to what?”

It's:

> **What are the business semantics of this data?**

For each important field, ask:

```text
What does this field actually mean?

Who owns it?

Who is allowed to change it?

Is Salesforce the source of truth
or only a consumer?

What does missing mean?

What does null mean?

Can the value be overwritten?

What identifies the entity uniquely?

Can that identifier ever change?
```

These questions uncover far more defects than discussing column names.

---

# 19.3 Ask Product about scenarios, not implementation

Avoid asking a Product Manager:

> “Should Mule use Upsert or Update?”

That's our technical decision.

Ask:

> “If we receive customer C001 again tomorrow with changed information, should we modify the existing Salesforce customer or create another one?”

Then **we translate that** into:

```text
stable customer ID
+
Salesforce External ID
+
Upsert
```

This distinction matters.

Product owns:

```text
business behavior
```

Engineering owns:

```text
implementation strategy
```

---

# 19.4 The form of questions I recommend

Ask requirements as:

> **“When X happens, what should happen to Y?”**

That's much better than:

> “What are the requirements?”

For example:

> “When the source changes a customer's phone number, should Salesforce always be updated?”

Then:

> “What if someone manually changed the phone in Salesforce after the previous synchronization?”

Now you've uncovered **data ownership/conflict behavior**.

---

# 19.5 Source-of-truth matrix

For important fields, create another small table:

| Data                | Source of truth | Can Salesforce edit? | Sync direction |
| ------------------- | --------------- | -------------------- | -------------- |
| Customer legal name | ERP             | Maybe                | ERP → SF       |
| Phone               | Salesforce?     | Yes                  | SF → ERP?      |
| Customer ID         | ERP             | No                   | ERP → SF       |
| Account status      | Billing         | No                   | Billing → SF   |

This may reveal that the integration isn't actually:

```text
Source → Salesforce
```

It may be:

```text
ERP ───────→ Salesforce
Salesforce ─→ ERP
Billing ────→ Salesforce
```

Now conflict rules become critical.

---

# 19.6 Ask “who wins?”

Suppose:

```text
ERP:
Phone = 305-111-1111

Salesforce:
Phone = 305-222-2222
```

Which wins?

Possible answer:

```text
ERP always wins
```

or:

```text
Salesforce owns phone
```

or:

```text
latest update wins
```

or:

```text
manual Salesforce edits must be preserved
```

These produce completely different Mule designs.

---

# 19.7 Null semantics deserve their own meeting

Ask explicitly:

> “If the source stops sending a value, should we leave the Salesforce field unchanged or clear it?”

Those are very different:

```text
field omitted
→ preserve

field = null
→ clear
```

Maybe.

Or Product may say:

```text
both mean clear
```

Don't decide this yourself.

This single ambiguity can destroy large amounts of Salesforce data.

---

# 19.8 Ask about lifecycle, not only Create

Most requirements initially describe:

```text
new customer
```

Ask:

```text
What happens when customer changes?

What happens when customer closes?

What happens when customer is deleted upstream?

Do we delete Salesforce Account?

Deactivate it?

Archive it?

Ignore deletion?
```

Business people often haven't thought about this yet.

That's exactly why you're asking.

---

# 19.9 “Delete” is especially dangerous

Source says:

```text
DELETE customer
```

Should Salesforce:

```text
DELETE Account
```

Probably not necessarily.

Could mean:

```text
Status__c = INACTIVE
```

because:

```text
Cases
Opportunities
Contacts
audit/history
```

may depend on the Account.

Ask Product:

> “What does removal from the source mean from the business perspective?”

---

# 19.10 Ask about identity very early

This is one of the first things I'd ask:

> **“What field uniquely identifies the same customer across systems?”**

You want something like:

```text
customerNumber = 752891
```

not:

```text
company name
email
phone
```

Then ask:

> “Can this identifier ever change or be reused?”

If they say:

> “Usually no.”

Keep asking.

“Usually unique” is not an integration key.

---

# 19.11 Ask about duplicates

Business question:

> “What should happen if the source sends a customer ID that already exists?”

Maybe:

```text
update existing
```

Then:

> “What if Salesforce already contains two Accounts with that ID?”

Now you've uncovered a data-quality exception.

Possible expected behavior:

```text
fail + alert
```

rather than randomly choosing one.

---

# 19.12 Ask about relationships

For:

```text
Account
Contact
Opportunity
Case
```

ask:

> “Can a Contact exist without an Account?”

> “Can a Contact move between Accounts?”

> “Can one source customer map to multiple Salesforce Accounts?”

> “What happens when Account processing fails—should Contacts still be attempted?”

These determine orchestration.

---

# 19.13 Ask about ordering

Example:

```text
Customer created
Contact created
Customer updated
Customer deactivated
```

Can events arrive out of order?

Ask:

> “If we receive an older update after a newer one, should we ignore the older event?”

That leads to:

```text
source version
sequence
timestamp
```

requirements.

---

# 19.14 Ask about timing

Not:

> “Should it be real-time?”

That's too vague.

Ask:

> “How long after a customer changes in the source is it acceptable for Salesforce to still show the old value?”

Possible answers:

```text
< 5 seconds

< 5 minutes

same day

overnight
```

Those answers tell you whether you need:

```text
synchronous API

events/CDC

queue

15-minute scheduler

nightly batch
```

---

# 19.15 Ask about volume

Ask business/operations:

```text
How many records normally?

How many at peak?

How many change daily?

Largest expected file?

Any seasonal spikes?

How quickly must backlog clear?
```

The difference between:

```text
500/day
```

and:

```text
5 million/night
```

changes the architecture completely.

---

# 19.16 Ask what “success” means

Consider Account + Contacts.

Is success:

```text
Account succeeded
```

or:

```text
Account AND every Contact succeeded
```

or:

```text
Account succeeded
and Contacts can finish later
```

Ask exactly:

> “If Account is created but one of five Contacts fails, what should the caller/business user see?”

This turns vague requirements into usable error semantics.

---

# 19.17 Ask what happens when Salesforce is unavailable

Don't ask Product:

> “Should we retry with exponential backoff?”

Ask:

> “If Salesforce is unavailable for 30 minutes, should the incoming customer request fail immediately, or should we accept it and synchronize when Salesforce recovers?”

That tells engineering:

```text
fail synchronously
```

versus:

```text
queue / eventual consistency
```

Then engineering chooses retry/backoff mechanics.

---

# 19.18 Ask about permanent failures

Example:

Salesforce rejects:

```text
invalid state code
```

Ask:

> “Who should be notified when a customer cannot be synchronized because the source data is invalid?”

Possibilities:

```text
source application
operations team
Salesforce admin
business user
nobody; dashboard only
```

Then ask:

> “Who is responsible for correcting it?”

Integration requirements include operational ownership.

---

# 19.19 Ask about replay

> “After somebody corrects bad source data, how should the failed customer be resubmitted?”

Possible:

```text
automatic retry
manual replay
source resends
operations console
nightly reconciliation
```

You need to know this before building DLQ/error handling.

---

# 19.20 Ask about auditability

Questions:

> “Do we need to know when each customer last synchronized?”

> “Do we need to retain the source record/version that produced a Salesforce change?”

> “Does a business user need to see synchronization status?”

This might produce fields like:

```text
Integration_Status__c

Source_Last_Modified__c

Last_Sync_Timestamp__c
```

or an external audit store.

---

# 19.21 Ask about manually edited Salesforce fields

Critical question:

> “Which fields may Salesforce users edit manually?”

Then:

> “Should the next source synchronization overwrite those edits?”

Example:

```text
ERP owns:
Legal_Name__c

Salesforce reps own:
Notes
Account_Manager__c
```

Your DataWeave should map only source-owned fields.

Do not send a giant Account object full of nulls.

---

# 19.22 Ask about derived fields

Some Salesforce fields may not map directly.

Example:

```text
source:
revenue = 5,000,000

Salesforce:
Customer_Tier__c = ENTERPRISE
```

Ask Product:

> “What exactly determines Customer Tier?”

Document rule:

```text
revenue > 1M
AND status = ACTIVE
→ ENTERPRISE
```

Now it becomes:

```text
requirement
↓
DataWeave/business logic
↓
test cases
```

---

# 19.23 Add a “business rule ID”

This is where I would improve the mapping spreadsheet.

For example:

| Rule ID | Requirement                                  |
| ------- | -------------------------------------------- |
| BR-001  | Existing customer is updated, not duplicated |
| BR-002  | Missing phone preserves existing SF phone    |
| BR-003  | Source status CLOSED maps to SF INACTIVE     |
| BR-004  | Invalid customer ID rejects entire request   |
| BR-005  | Contact failure does not delete Account      |

Then mapping can reference:

```text
BR-002
```

Tests can reference:

```text
BR-002
```

Now you have traceability:

```text
requirement
→ implementation
→ test
```

---

# 19.24 My preferred requirements package

I would maintain **five lightweight artifacts**, not a giant 80-page specification:

```text
1. Context/data-flow diagram

2. API/event contract

3. Field mapping matrix

4. Business rules + edge cases

5. Acceptance-test matrix
```

MuleSoft's contract-first guidance fits this approach: define purpose/data flow/security and the API specification before implementation. ([MuleSoft Documentation][1])

---

# 19.25 Context diagram

Something as simple as:

```text
       Customer Portal
             │
             ↓
        Mule API
        /       \
       ↓         ↓
Salesforce     Billing
```

Or:

```text
ERP
 ↓ customer changes
Mule
 ↓
Salesforce

Salesforce CDC
 ↓
Mule
 ↓
Data Warehouse
```

It frequently exposes misunderstood directions immediately.

---

# 19.26 Then write scenarios

I prefer **Given / When / Then** because business people can review them.

Example:

```text
Given customer C001 already exists in Salesforce
with Phone = 111

When source sends C001 with Phone = 222

Then the existing Account is updated
and no new Account is created
```

Another:

```text
Given customer C001 already exists
with Phone = 111

When source sends C001 without a Phone field

Then Salesforce Phone remains 111
```

These are much easier for Product to approve than Mule XML.

---

# 19.27 Ask Product to approve examples

One of the best tricks:

Don't ask:

> “Do you approve the requirements?”

Instead give them concrete examples:

```text
Input → Expected Salesforce State
```

and ask:

> **“Is this what you expect?”**

Business people are much better at spotting:

> “No, that's wrong.”

than writing formal requirements from scratch.

---

# 19.28 Requirements workshop agenda

For a 45–60 minute session I'd structure it roughly as:

```text
1. Business goal

2. Source + target systems

3. Trigger/timing

4. Entity identity

5. Field mappings

6. Ownership/conflicts

7. lifecycle/delete behavior

8. partial failures

9. outage/recovery expectations

10. acceptance examples
```

Then schedule a second review only for unresolved items.

---

# 19.29 The questions I would actually ask the Product Manager

Keep these handy:

```text
What business event starts this process?

What should exist in Salesforce afterward?

How do we recognize the same customer?

Which system owns each important field?

What happens when the value changes?

What does missing/null mean?

What happens when the source record is deleted?

Which fields may users edit in Salesforce?

How quickly must Salesforce reflect a change?

What should happen if Salesforce is unavailable?

What counts as successful processing?

What if only part of the request succeeds?

Who handles records that cannot be synchronized?

How should corrected records be replayed?

What examples can we use as acceptance cases?
```

That's a much better requirements conversation than:

> “Can you give me the field mapping?”

---

# Module 19 Cheat Sheet

```text
FIELD MAPPING IS NOT ENOUGH

Need:
meaning
ownership
null semantics
identity
lifecycle
timing
failure semantics


ASK BUSINESS QUESTIONS
======================

"When X happens,
what should happen to Y?"


KEY QUESTIONS
=============

source of truth?
unique key?
who wins conflicts?
missing vs null?
delete vs deactivate?
sync timing?
partial success?
outage behavior?
replay?
audit?


ARTIFACTS
=========

data-flow diagram
API/event contract
mapping matrix
business rules
acceptance scenarios


TRACEABILITY
============

BR-001
→ mapping/code
→ automated tests
```

The sentence I'd use in an interview:

> **“I don't treat a field-mapping spreadsheet as the full integration requirement. I use it together with explicit business rules around identity, field ownership, null semantics, lifecycle, timing, partial failures and recovery, and I turn concrete input-to-expected-state examples into acceptance tests before implementation.”**

---
