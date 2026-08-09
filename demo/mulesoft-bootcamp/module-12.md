# Module 12 — Idempotency and Duplicate Prevention

This is one of the most important integration concepts in the whole bootcamp because distributed systems regularly retry, redeliver, and lose responses.

The key question is:

> **If the same logical request is processed twice, do I get one correct business result or two unintended side effects?**

---

## 12.1 What idempotency means

A simple definition:

```text
same request repeated
→ same intended business state
```

Example:

```text
Set customer C001 status = ACTIVE
```

Run once:

```text
ACTIVE
```

Run twice:

```text
ACTIVE
```

Still fine.

But:

```text
Create new customer C001
```

run twice can produce:

```text
Customer #1
Customer #2
```

That's not idempotent.

---

# 12.2 Why duplicates happen even when your code is “correct”

Imagine:

```text
Mule
  ↓
Salesforce Upsert
  ↓
Salesforce commits successfully
  ↓
response gets lost
  X
Mule sees timeout
```

Mule cannot know whether Salesforce committed.

So caller retries:

```text
same request again
```

This is normal distributed-system behavior.

That is why this sentence is worth memorizing:

> **“A timeout is an ambiguous outcome, not proof that the downstream write failed.”**

---

# 12.3 The easiest Salesforce idempotency mechanism: External ID + Upsert

Suppose source sends:

```json
{
  "customerId": "C001",
  "name": "Acme"
}
```

Salesforce has:

```text
External_Customer_ID__c
```

configured appropriately.

Then Mule uses:

```text
Upsert Account
External ID = External_Customer_ID__c
```

First request:

```text
C001 not found
→ INSERT
```

Retry:

```text
C001 found
→ UPDATE
```

Result:

```text
one Account
```

This is why `Upsert` is so useful for integrations.

---

# 12.4 Business key vs Salesforce ID

Suppose Mule gets:

```text
customerId = C001
```

Do not make the caller know:

```text
Salesforce Id = 001ABC123...
```

Instead:

```text
source business key
C001
      ↓
Salesforce External ID
      ↓
Salesforce record
```

The external ID gives you a stable integration identity across systems.

---

# 12.5 External ID needs to be truly stable

Bad external ID candidate:

```text
email address
```

Why?

Because:

```text
john@acme.com
```

may become:

```text
john.smith@acme.com
```

Now Mule might think:

```text
new customer
```

and create a duplicate.

Better:

```text
customerId
memberId
orderId
policyId
sourceSystemRecordId
```

Something whose semantics are:

> “This uniquely identifies the business entity over time.”

---

# 12.6 Idempotency key

Sometimes the operation itself doesn't naturally have a stable entity key.

Example:

```http
POST /payments
```

Payload:

```json
{
  "customerId": "C001",
  "amount": 100
}
```

You cannot say:

```text
customerId = idempotency key
```

because the customer can legitimately make multiple $100 payments.

Instead caller may send:

```http
Idempotency-Key: PAY-817263
```

Then Mule records:

```text
PAY-817263 already processed?
```

If no:

```text
perform payment
store result
```

If yes:

```text
return previous result
do not charge again
```

---

# 12.7 Business key vs request idempotency key

These solve different problems.

### Business entity key

```text
customerId = C001
```

means:

> Which customer is this?

### Idempotency key

```text
requestId = REQ-987
```

means:

> Have I already processed this particular business operation?

Don't confuse them.

---

# 12.8 Example: order creation

Request:

```json
{
  "orderId": "ORD-10025",
  "customerId": "C001",
  "amount": 499.95
}
```

Here:

```text
orderId
```

may serve both as:

```text
business identity
+
idempotency identity
```

If Salesforce stores:

```text
External_Order_ID__c = ORD-10025
```

and Mule uses Upsert:

```text
retry does not create a second order
```

Perfect.

---

# 12.9 Example where Upsert can be wrong

Suppose source sends:

```json
{
  "transactionId": null,
  "amount": 100
}
```

and you attempt to identify records using:

```text
customerId + amount
```

Two legitimate $100 transactions might occur.

Now your “idempotency” logic suppresses a valid transaction.

Important rule:

> **An idempotency key must identify the logical operation, not merely look unique most of the time.**

---

# 12.10 Where do you store processed idempotency keys?

Common choices:

```text
Mule Object Store
database
Redis/cache
external idempotency service
downstream system's unique constraint
```

If Salesforce itself can enforce uniqueness using an External ID, that's often ideal because the protection sits at the actual write boundary.

---

# 12.11 Mule Object Store mental model

Mule's Object Store is effectively persistent key/value storage available for state such as:

```text
watermarks
tokens
deduplication keys
processing status
```

Conceptually:

```text
key:
REQ-123

value:
{
  status: "COMPLETED",
  salesforceId: "001ABC"
}
```

Then:

```text
request arrives
 ↓
lookup REQ-123
 ↓
exists?
```

If yes:

```text
return stored result
```

If no:

```text
process
```

---

# 12.12 But “check then insert” has a race condition

Suppose two Mule workers receive the same request simultaneously.

Worker A:

```text
Is REQ-123 present?
→ no
```

Worker B:

```text
Is REQ-123 present?
→ no
```

Then both process:

```text
duplicate business operation
```

This is a classic **check-then-act race condition**.

So merely writing:

```text
if not exists:
    process
```

is not automatically safe under concurrency.

---

# 12.13 Atomicity matters

You need some mechanism that guarantees:

```text
only one worker can claim this key
```

For example:

```text
database UNIQUE constraint
atomic insert-if-absent
distributed lock
downstream unique external ID
```

The strongest design often pushes uniqueness as close as possible to the system committing the side effect.

---

# 12.14 Why Salesforce unique External IDs are valuable

Suppose two Mule workers both simultaneously perform:

```text
Upsert C001
```

Salesforce can enforce uniqueness on the External ID.

Now the race is handled by the downstream system rather than by fragile Mule-side logic.

That is much safer than:

```text
Mule Query
↓
record not found
↓
Create
```

because both workers could query before either creates.

---

# 12.15 The Query → Create race

Classic bug:

```text
Worker A:
Query C001 → not found

Worker B:
Query C001 → not found

Worker A:
Create C001

Worker B:
Create C001
```

Result:

```text
2 Accounts
```

This is why:

```text
Query
then Create
```

is not equivalent to:

```text
atomic Upsert with unique external ID
```

Great interview talking point.

---

# 12.16 Idempotency and database uniqueness

If Mule owns a database table:

```sql
processed_requests
------------------
request_id
status
result
```

make:

```text
request_id
```

unique.

Then:

```text
INSERT request_id = REQ-123
```

first worker succeeds.

Second worker gets unique constraint violation.

That is often much safer than:

```text
SELECT
then
INSERT
```

Again: atomic enforcement.

---

# 12.17 Status matters too

Suppose request key exists:

```text
REQ-123
```

but status is:

```text
PROCESSING
```

What should a second request do?

Possible answers:

```text
return 202 PROCESSING
wait
reject with conflict
attach to existing operation
```

If status is:

```text
COMPLETED
```

return previous result.

If:

```text
FAILED
```

you need defined replay semantics.

---

# 12.18 A robust idempotency record

Conceptually:

```json
{
  "idempotencyKey": "REQ-123",
  "status": "COMPLETED",
  "requestHash": "abc...",
  "result": {
    "salesforceId": "001ABC"
  },
  "createdAt": "...",
  "expiresAt": "..."
}
```

Why store request hash?

Because someone might reuse:

```text
REQ-123
```

with a completely different payload.

---

# 12.19 Reused key with different payload

First request:

```text
Idempotency-Key: REQ-123

amount = 100
```

Second:

```text
Idempotency-Key: REQ-123

amount = 900
```

You should not silently return:

```text
previous $100 result
```

as though the second request were valid.

Better:

```text
same key
different request hash
→ conflict/error
```

This protects against client bugs.

---

# 12.20 TTL / expiry

Do you store idempotency keys forever?

Maybe not.

For something like:

```text
HTTP retry protection
```

you might retain them for a defined window.

But if:

```text
orderId
```

is the permanent business identity, Salesforce External ID may effectively enforce uniqueness indefinitely.

Choose retention based on business semantics.

---

# 12.21 Event deduplication

Message:

```json
{
  "eventId": "EVT-827",
  "customerId": "C001",
  "status": "ACTIVE"
}
```

Consumer receives it twice.

Possible approach:

```text
processed event IDs:
EVT-827
```

When second arrives:

```text
already processed
→ acknowledge and skip
```

This is common in at-least-once messaging architectures.

---

# 12.22 But sometimes event ID dedupe is unnecessary

If event means:

```text
Set C001 status = ACTIVE
```

and Salesforce Upsert is naturally idempotent:

```text
process twice
→ still ACTIVE
```

then storing every event ID may not be necessary.

Ask:

> Does duplicate execution actually cause harm?

Avoid complexity that provides no business benefit.

---

# 12.23 Idempotent update vs non-idempotent increment

This is a useful distinction.

Idempotent:

```text
set balance = 100
```

Repeated:

```text
100
100
100
```

still 100.

Non-idempotent:

```text
increment balance by 100
```

Repeated twice:

```text
200
```

So event design matters.

Prefer:

```text
CustomerBalanceChangedTo 100
```

over:

```text
Add 100
```

when semantics permit.

---

# 12.24 Versioning

Now suppose events can arrive out of order.

Current state:

```text
version 42
status = SUSPENDED
```

Then stale event arrives:

```text
version 41
status = ACTIVE
```

If you simply upsert:

```text
status becomes ACTIVE
```

Wrong.

So store/check:

```text
sourceVersion
```

and apply only if:

```text
incomingVersion > currentVersion
```

---

# 12.25 Idempotency vs ordering

Memorize:

```text
Idempotency
→ protects against duplicate operation

Ordering/versioning
→ protects against stale operation
```

A system can be perfectly idempotent and still process events in the wrong order.

---

# 12.26 Optimistic concurrency

This is related.

Suppose two workers read version 10.

Worker A wants:

```text
version 11
status = ACTIVE
```

Worker B wants:

```text
version 11
status = SUSPENDED
```

Both write.

Who wins?

Without concurrency control:

```text
last writer wins
```

Sometimes acceptable.

Sometimes disastrous.

Systems may use:

```text
version field
ETag
timestamp
compare-and-set
optimistic locking
```

to detect conflicting updates.

---

# 12.27 Last-write-wins

This is the simplest policy:

```text
whatever commits last wins
```

Good enough for some fields:

```text
display preferences
last-seen metadata
```

Dangerous for:

```text
financial balances
state-machine transitions
inventory
critical workflow status
```

Ask what conflict semantics are required.

---

# 12.28 Duplicate prevention at multiple layers

A mature design may have:

```text
API idempotency key
       ↓
Mule dedupe state
       ↓
Salesforce External ID
       ↓
Salesforce unique constraint
```

You don't always need all of them.

Use each where it protects a real failure mode.

---

# 12.29 Example: customer upsert

Requirement:

> Create/update customer in Salesforce.

Simple design:

```text
POST /customers
 ↓
External customerId required
 ↓
DataWeave
 ↓
Salesforce Upsert
by External_Customer_ID__c
```

That's already strong idempotency.

No separate Object Store necessarily needed.

---

# 12.30 Example: payment request

Requirement:

> Charge customer exactly once.

Now Salesforce Upsert is not enough.

Design:

```text
POST /payments
Idempotency-Key = PAY-123
 ↓
atomic claim/store key
 ↓
call payment provider
 ↓
store result
 ↓
return result
```

Retry:

```text
PAY-123 exists
→ return prior result
```

This is classic request idempotency.

---

# 12.31 The hardest payment failure

Sequence:

```text
Mule claims PAY-123
 ↓
payment provider charges card
 ↓
Mule crashes before storing result
```

Now idempotency record says maybe:

```text
PROCESSING
```

and you don't know whether payment succeeded.

You need reconciliation with provider using:

```text
provider transaction ID
idempotency key
query transaction status
```

This demonstrates:

> Idempotency design must include recovery from ambiguous intermediate states.

---

# 12.32 Downstream-supported idempotency is best

If payment API itself supports:

```text
Idempotency-Key: PAY-123
```

that's extremely valuable.

Then even if Mule crashes:

```text
retry same downstream key
```

provider returns same result instead of charging again.

General principle:

> **Use downstream-native idempotency when available.**

---

# 12.33 Salesforce Create vs Upsert under concurrent retries

Bad:

```text
Create Account
```

Retry:

```text
duplicate
```

Better:

```text
Upsert Account by External ID
```

Even better:

```text
External ID is unique
```

so Salesforce itself enforces identity.

This is the safe design you should keep coming back to.

---

# 12.34 Duplicate rules in Salesforce

Salesforce itself can have duplicate-management rules.

Those may identify possible duplicates based on things like:

```text
name
email
phone
```

These are useful business controls, but don't confuse them with integration idempotency.

A fuzzy duplicate rule is not a substitute for:

```text
stable external business key
```

---

# 12.35 Why email-based duplicate rules aren't enough

Two Contacts:

```text
john@example.com
john@example.com
```

might indeed be duplicate.

But perhaps:

```text
shared inbox
```

is legitimate.

Meanwhile:

```text
john.old@example.com
john.new@example.com
```

may be the same person.

So duplicate detection is business/entity-resolution logic.

Idempotency is transaction/replay logic.

Different concerns.

---

# 12.36 Batch idempotency

Nightly file:

```text
customers-2026-08-07.csv
```

job processes 200k rows.

At record 150k:

```text
runtime crashes
```

If restarted:

```text
some rows may replay
```

With:

```text
Salesforce Upsert by external ID
```

replay is safe.

Without it:

```text
duplicate storm
```

This is why bulk jobs should be designed for replay from the beginning.

---

# 12.37 Job-level idempotency

Suppose same input file is uploaded twice.

You may track:

```text
file checksum
batch ID
source job ID
```

Example:

```text
batchId = CUSTOMER-2026-08-07
```

If same batch is already completed:

```text
skip / reject duplicate submission
```

Separate from record-level external-ID idempotency.

---

# 12.38 Multi-level idempotency

A sophisticated import might have:

```text
Job level:
batchId

Record level:
customerId

Message level:
eventId
```

Each protects a different duplicate scenario.

---

# 12.39 Idempotency and side effects

Suppose flow does:

```text
Upsert Account
 ↓
Send welcome email
```

Retrying flow:

```text
Account remains one record
```

but:

```text
email gets sent twice
```

So the flow is still **not fully idempotent**.

This is critical.

You must evaluate **every side effect**.

---

# 12.40 Idempotent Salesforce write + non-idempotent notification

Possible fix:

```text
customerCreated event
with unique event ID
```

Email consumer:

```text
dedupe event
```

Or store:

```text
Welcome_Email_Sent__c
```

depending on business design.

Don't assume one idempotent step makes the whole workflow idempotent.

---

# 12.41 Another classic problem: create then publish

```text
Salesforce Upsert
 ↓
publish CustomerCreated
```

Retry after timeout:

```text
Salesforce upsert safe
but event published twice
```

Consumers must tolerate duplicates.

Again, distributed systems.

---

# 12.42 Compensation is not idempotency

Suppose duplicate Account is accidentally created and you later delete it.

That's compensation.

Idempotency means:

```text
duplicate should not have been created
```

Different concept.

---

# 12.43 Exactly-once business outcome

Interviewers may say:

> “We need exactly-once.”

A good answer:

> “I'd clarify exactly-once delivery versus exactly-once business effect. Across distributed services I generally assume retries and duplicate delivery are possible, then enforce idempotent business operations using stable keys, unique constraints, downstream idempotency support, and versioning where ordering matters.”

Excellent.

---

# 12.44 Race condition scenario

Interviewer:

> Two Mule workers receive the same customer at the same time. How do you prevent duplicates?

Good answer:

> “I wouldn't rely on a query-then-create check because both workers can observe ‘not found’ before either creates. I'd prefer an atomic downstream uniqueness mechanism—such as a Salesforce unique External ID with Upsert—or another atomic unique constraint/claim mechanism.”

That is a very strong answer.

---

# 12.45 Retry scenario

> Salesforce times out during Account creation. What do you do?

Answer:

> “I treat the outcome as unknown because Salesforce may have committed. I'd avoid blind Create retries. If the operation is modeled as Upsert against a stable External ID, I can retry safely; otherwise I'd need to reconcile before issuing another non-idempotent write.”

Excellent.

---

# 12.46 Duplicate event scenario

> Kafka/queue delivers the same customer event twice.

Answer:

> “That's normal under at-least-once delivery. If the event maps to an idempotent Salesforce upsert, duplicate execution may already be harmless. If there are non-idempotent side effects, I'd use event-level deduplication or downstream-native idempotency keys.”

---

# 12.47 Out-of-order scenario

> Version 42 is processed, then version 41 arrives.

Answer:

> “Idempotency alone doesn't solve that. I'd carry a source version or sequence and reject stale updates so an older event can't overwrite newer state.”

Very good.

---

# 12.48 How to test idempotency

This should be part of your automation suite.

### Test 1 — same request twice

```text
send request
send identical request again
```

Verify:

```text
one Salesforce record
same external ID
correct final state
```

---

# 12.49 Test 2 — repeated retry

Send:

```text
same request 10 times concurrently
```

Verify:

```text
still one record
```

This is more meaningful than sequential duplicates because it exposes race conditions.

---

# 12.50 Test 3 — ambiguous timeout

Mock downstream so that:

```text
write succeeds
response times out
```

Then trigger retry.

Verify:

```text
no duplicate side effect
```

This is an excellent resilience test.

---

# 12.51 Test 4 — same idempotency key, different payload

Request 1:

```text
REQ-123
amount=100
```

Request 2:

```text
REQ-123
amount=900
```

Verify:

```text
second request rejected
```

if that's your contract.

---

# 12.52 Test 5 — concurrent duplicate messages

Publish:

```text
EVT-999
```

to multiple workers/concurrent execution.

Verify:

```text
one business effect
```

---

# 12.53 Test 6 — stale version

Current Salesforce:

```text
version = 10
```

Send:

```text
version = 9
```

Verify:

```text
ignored/rejected
```

Then send:

```text
version = 11
```

Verify update applies.

---

# 12.54 Test 7 — workflow side effects

Request does:

```text
upsert Account
send email
publish event
```

Retry request.

Verify:

```text
Account once
email once
event behavior as defined
```

Do not test only the Salesforce row.

---

# 12.55 Common bad patterns

### Bad #1

```text
Query Salesforce
if not found:
    Create
```

under concurrency.

Race condition.

### Bad #2

```text
Retry all timeouts with Create
```

Duplicates.

### Bad #3

```text
Use email as universal idempotency key
```

Unstable/non-unique business identity.

### Bad #4

```text
Deduplicate messages but ignore ordering
```

Stale state can still win.

### Bad #5

```text
Upsert Salesforce, therefore entire workflow is idempotent
```

Other side effects may duplicate.

---

# 12.56 Design checklist

Whenever you see a write operation, ask:

```text
What uniquely identifies the entity?

What uniquely identifies the operation?

Can the caller retry?

Can the broker redeliver?

Can two workers process it simultaneously?

Can downstream commit but response be lost?

Does downstream support native idempotency?

Can I enforce uniqueness atomically?

Does ordering matter?

What other side effects occur?

How long should dedupe state live?

How do I recover PROCESSING/unknown state?
```

This is exactly how a senior integration developer thinks.

---

# Module 12 Cheat Sheet

```text
IDEMPOTENCY
===========

same logical request repeated
→ no unintended additional effect


SALESFORCE
==========

best common pattern:

stable External ID
+
unique constraint
+
Upsert


DON'T DO
========

Query
→ not found
→ Create

under concurrency


BUSINESS KEY
============

identifies entity

customerId
orderId


IDEMPOTENCY KEY
===============

identifies operation

requestId
paymentId
eventId


ATOMICITY
=========

check-then-act can race

prefer:
unique constraint
atomic claim
downstream-native idempotency


DUPLICATE EVENTS
================

normal under at-least-once delivery


ORDERING
========

idempotency ≠ ordering

use:
version
sequence
timestamp/optimistic concurrency


RETRIES
=======

timeout = unknown outcome

retry only when business effect is safe


WORKFLOW
========

every side effect must be considered

Salesforce upsert may be idempotent
email/publish/payment may not be
```

The interview sentence to memorize is:

> **“I try to enforce idempotency at the actual side-effect boundary using stable business keys and atomic uniqueness—for Salesforce that often means a unique External ID plus Upsert. I don't rely on query-then-create because it races under concurrency, and I treat ordering/versioning as a separate problem from duplicate suppression.”**

Next is **Module 13: MUnit** — this should be particularly useful for you because it connects directly to your automation background: how Mule unit tests are structured, `mock-when`, `verify-call`, assertions, event setup, testing Choice branches, testing error handlers, and deciding what should be mocked versus tested against a real Salesforce sandbox.
