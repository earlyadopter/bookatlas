# Module 17 — Interview System-Design Scenarios

This module is where we stop learning components one by one and practice answering:

> **“How would you design this Mule integration?”**

For these questions, the interviewer usually cares less about exact XML and more about whether you naturally think about:

```text
contract
data flow
dependencies
Salesforce model
sync vs async
volume
error handling
idempotency
security
testing
operations
```

A strong answer should sound structured rather than improvised.

---

# 17.1 Your default system-design framework

When they give you a scenario, mentally walk through this sequence:

```text
1. Clarify requirement
2. Define API/event contract
3. Identify systems of record
4. Determine sync vs async
5. Design Mule flows/layers
6. Map data with DataWeave
7. Choose Salesforce operation
8. Handle errors/retries
9. Design idempotency
10. Consider volume/concurrency
11. Secure/configure
12. Test
13. Monitor
```

You don't need to recite all 13 every time.

But this keeps you from jumping directly into:

> “I'd make a Salesforce Connector call…”

before understanding the problem.

---

# Scenario 1 — REST API creates/updates a Salesforce customer

## Interview prompt

> “Build an API where another application sends customer information to Mule and Mule creates or updates the Account in Salesforce.”

This is probably the safest scenario to be ready for cold.

---

## 17.2 Start by clarifying the contract

Ask or state assumptions:

```text
POST /customers

{
  "customerId": "C001",
  "companyName": "Acme",
  "phone": "3055551234",
  "billingState": "FL"
}
```

First important question:

> “Do we have a stable source-system customer ID?”

If yes, excellent.

That's our Salesforce External ID.

---

## 17.3 Basic design

```text
Client
  ↓
HTTP Listener
  ↓
Validate
  ↓
DataWeave
  ↓
Salesforce Upsert
  ↓
Transform Response
  ↓
Client
```

Salesforce:

```text
Account.External_Customer_ID__c
```

configured as external/unique identifier.

---

## 17.4 DataWeave

Input:

```json
{
  "customerId": "C001",
  "companyName": "Acme",
  "phone": "3055551234",
  "billingState": "FL"
}
```

Salesforce payload:

```dataweave
%dw 2.0
output application/java
---
[{
    External_Customer_ID__c: payload.customerId,
    Name: payload.companyName,
    (Phone: payload.phone) if (payload.phone != null),
    BillingState: payload.billingState
}]
```

Notice the conditional phone field.

Why?

Because:

```text
omitted
```

might mean:

> preserve existing Salesforce value

rather than:

```text
set it to null
```

---

## 17.5 Why Upsert?

Don't do:

```text
Query Account
 ↓
if exists
    Update
else
    Create
```

unless you actually need current Salesforce state.

Instead:

```text
Upsert
by External_Customer_ID__c
```

Advantages:

```text
fewer API calls
simpler flow
concurrency safer
retry safer
naturally idempotent
```

---

## 17.6 Error strategy

```text
bad request
→ 400

Salesforce business validation
→ 4xx/domain response

Salesforce transient connectivity
→ bounded retry

retry exhausted
→ 503

unexpected Mule error
→ 500
```

And importantly:

> “I'd only retry an idempotent operation because a timeout doesn't prove Salesforce didn't commit.”

---

## 17.7 Testing

MUnit:

```text
valid customer
missing customerId
DataWeave mapping
Salesforce success
Salesforce connectivity error
Salesforce validation failure
```

External tests:

```text
real upsert
same customer twice
concurrent same customer
exactly one Salesforce Account
permissions
schema
```

---

## 17.8 Interview answer

A concise version:

> “I'd expose an HTTP API, validate the request at the boundary, transform the external customer model into the Salesforce Account model using DataWeave, and use Salesforce Upsert against a unique stable External ID rather than query-then-create. I'd classify permanent versus transient connector errors, use bounded retries only where the operation is idempotent, normalize Salesforce errors into the API contract, and propagate a correlation ID. MUnit would cover mappings, branches, and error behavior, while a smaller integration suite against a Salesforce sandbox would prove the real schema, permissions, and External-ID semantics.”

That's a complete senior answer.

---

# Scenario 2 — Account and Contacts

## Prompt

> “A customer request contains an Account and multiple Contacts. How would you load that into Salesforce?”

Input:

```json
{
  "customerId": "C001",
  "companyName": "Acme",
  "contacts": [
    {
      "contactId": "P001",
      "firstName": "John",
      "lastName": "Smith"
    },
    {
      "contactId": "P002",
      "firstName": "Sarah",
      "lastName": "Jones"
    }
  ]
}
```

---

# 17.9 Identify dependency

Contacts belong to Account.

So:

```text
Account
 ↓
Contacts
```

not blindly:

```text
Account || Contacts
```

in parallel.

We first need the Salesforce Account relationship.

---

# 17.10 Design

```text
HTTP Listener
 ↓
Validate
 ↓
save original request
 ↓
transform Account
 ↓
Upsert Account
 ↓
store accountId
 ↓
transform Contacts
 ↓
Upsert Contacts
 ↓
response
```

Contact transformation:

```dataweave
%dw 2.0
output application/java
---
vars.originalCustomer.contacts map (contact) -> {
    External_Contact_ID__c: contact.contactId,
    FirstName: contact.firstName,
    LastName: contact.lastName,
    AccountId: vars.accountId
}
```

---

# 17.11 Ask about transactional semantics

What if:

```text
Account succeeds
Contacts fail
```

This is a business decision.

Options:

```text
fail whole API but Account remains

return partial success

queue Contact retry

mark Account integration status incomplete

compensate if required
```

Do **not** say:

> “Mule will roll everything back.”

Salesforce SaaS calls aren't magically one distributed transaction.

---

# 17.12 Better interview wording

> “I'd identify the dependency first: Contacts require the Account relationship, so I wouldn't parallelize those operations blindly. I'd upsert the Account by external ID, capture the resulting Salesforce ID, then transform and upsert the Contacts as a collection. I'd also explicitly define partial-failure semantics because an Account write that already committed cannot simply be rolled back when a later Contact write fails.”

Excellent.

---

# Scenario 3 — Customer profile from Salesforce + Billing + Loyalty

## Prompt

> “Build an API that returns customer information from Salesforce, Billing and Loyalty.”

Now we use Module 6 + Module 9.

---

# 17.13 Determine dependencies

Do the three calls depend on each other?

Suppose all need:

```text
customerId
```

and are otherwise independent.

Then:

```text
Scatter-Gather
```

is a natural candidate.

Architecture:

```text
GET /customer-profile/C001
         ↓
Customer Process API
         ↓
      Scatter-Gather
      ┌────┼─────┐
      ↓    ↓     ↓
Salesforce Billing Loyalty
System API API    API
      └────┼─────┘
           ↓
       DataWeave
           ↓
        response
```

---

# 17.14 Why Scatter-Gather?

Because:

```text
same customer request
```

goes to:

```text
different independent destinations
```

in parallel.

Not:

```text
Parallel For Each
```

because we're not doing identical work across an array.

---

# 17.15 Failure question

Interviewer asks:

> “What happens if Loyalty is down?”

Don't immediately answer.

Ask:

> “Is Loyalty mandatory for the customer profile?”

If no:

```text
Salesforce success
Billing success
Loyalty fails
```

maybe return:

```json
{
  "customerId": "C001",
  "name": "Acme",
  "balance": 1200,
  "loyalty": null,
  "warnings": [
    "Loyalty information temporarily unavailable"
  ]
}
```

If mandatory:

```text
propagate failure
```

---

# 17.16 Avoid giant latency

If:

```text
Salesforce = 300ms
Billing = 500ms
Loyalty = 400ms
```

sequential:

```text
~1200ms
```

parallel:

```text
~500ms + overhead
```

That's why independent reads are good candidates for concurrency.

---

# 17.17 Interview answer

> “I'd treat this as orchestration in a Process API. Assuming Salesforce, Billing and Loyalty all need only the customer ID and are independent, I'd call them concurrently with Scatter-Gather and aggregate the results with DataWeave. I'd define per-route timeout and failure semantics explicitly—for example Loyalty might be optional while Salesforce is mandatory—and propagate the same correlation ID across all three calls.”

Strong.

---

# Scenario 4 — 500,000 nightly customer updates

## Prompt

> “Every night we receive 500,000 customer records that need to synchronize to Salesforce.”

This tests whether you reach for:

```text
For Each
```

incorrectly.

---

# 17.18 First question

Ask:

> “Do all 500,000 actually change every night?”

If only:

```text
20,000
```

change, don't process 500,000.

Prefer:

```text
incremental/delta sync
```

using:

```text
watermark
LastModifiedDate
CDC
source change log
```

---

# 17.19 Architecture

Potential design:

```text
Scheduler
 ↓
retrieve changed records
 ↓
Mule Batch Job
 ↓
validate/transform
 ↓
Batch Aggregator
 ↓
Salesforce Bulk API v2 Upsert
 ↓
record-level failure handling
 ↓
On Complete
 ↓
metrics/report
```

---

# 17.20 Why not For Each?

Because:

```text
500,000 records
×
one Salesforce request
```

is a bad scaling model.

Use:

```text
Salesforce Bulk API
```

for high-volume Salesforce data movement.

Use Mule Batch if you need:

```text
record processing
failure isolation
steps
aggregation
restartability
```

---

# 17.21 External IDs again

Use:

```text
External_Customer_ID__c
```

and:

```text
Bulk Upsert
```

so replay is safe.

If job crashes at 350,000 records:

```text
restart/retry
```

must not create duplicates.

---

# 17.22 Partial failures

Suppose:

```text
500,000 input

499,800 success
200 fail
```

Don't rerun all 500k automatically.

Capture:

```text
record external ID
error type
error message
retryability
```

Retry only appropriate failures.

---

# 17.23 Systemic failure detection

If:

```text
200/500,000
```

bad data:

probably continue.

If suddenly:

```text
350,000
```

fail with:

```text
INVALID_FIELD
```

stop.

That's probably:

```text
schema/config/release issue
```

not random dirty data.

---

# 17.24 Interview answer

> “I'd first determine whether this should really be a full load or incremental sync. For large write volumes I'd use Salesforce Bulk API v2 rather than per-record connector calls. If Mule needs significant record-level validation, transformation, routing or restartability, I'd use a Batch Job and aggregate records before sending them downstream. I'd use External-ID-based upsert for replay safety, capture row-level failures, distinguish systemic from record-level failures, and reconcile counts/state after the job.”

Excellent.

---

# Scenario 5 — Salesforce outage during customer onboarding

## Prompt

> “A critical customer onboarding API writes to Salesforce, but Salesforce may sometimes be unavailable for 30 minutes. What do you do?”

This is mostly a sync/async design question disguised as error handling.

---

# 17.25 First question

Ask:

> “Does the caller genuinely need Salesforce completion before we acknowledge onboarding?”

If yes:

```text
synchronous
```

may require:

```text
bounded retry
then failure
```

But holding HTTP open for 30 minutes is clearly ridiculous.

If no:

```text
async architecture
```

is much better.

---

# 17.26 Async design

```text
Client
 ↓
POST /onboarding
 ↓
validate
 ↓
persist/publish command
 ↓
202 Accepted
```

Then:

```text
Queue
 ↓
Onboarding worker
 ↓
Salesforce Upsert
 ↓
success
```

During outage:

```text
message remains/retries
```

rather than every user request failing immediately.

---

# 17.27 What to return

```json
{
  "requestId": "REQ-123",
  "status": "ACCEPTED"
}
```

Then perhaps:

```http
GET /onboarding/REQ-123
```

returns:

```json
{
  "status": "COMPLETED"
}
```

later.

---

# 17.28 Failure handling

```text
transient Salesforce connectivity
↓
retry/backoff

permanent validation failure
↓
FAILED

repeated infrastructure failure
↓
DLQ / operational recovery
```

Track:

```text
queue depth
oldest message age
retry count
DLQ
```

---

# 17.29 Interview answer

> “If the business doesn't require immediate Salesforce completion, I'd decouple intake from processing with durable messaging. The API validates and persists or publishes the work, returns 202 with a request ID, and a worker performs an idempotent Salesforce upsert with bounded retry. That makes a 30-minute Salesforce outage a backlog rather than a 30-minute HTTP timeout problem. I'd monitor backlog age and expose status or failure state to the caller.”

That's a very strong architecture answer.

---

# Scenario 6 — Salesforce events must update another system

## Prompt

> “Whenever an Account changes in Salesforce, we need to update our internal customer platform within seconds.”

Possible options:

```text
poll Salesforce every few seconds
```

or:

```text
Salesforce CDC/event subscription
```

The latter is usually more appropriate for near-real-time changes.

---

# 17.30 Event-driven design

```text
Salesforce Account changes
 ↓
Change Data Capture
 ↓
Mule
 ↓
transform
 ↓
Customer API
```

Questions to ask:

```text
What fields trigger relevant processing?

What's required latency?

Can events duplicate?

Can they arrive out of order?

How long are they retained?

Can we replay after outage?
```

---

# 17.31 Consumer design

Event:

```json
{
  "eventId": "EVT-100",
  "customerId": "C001",
  "version": 42,
  "status": "SUSPENDED"
}
```

Mule:

```text
receive
 ↓
validate
 ↓
check ordering/version if necessary
 ↓
transform
 ↓
idempotent downstream update
 ↓
ack
```

---

# 17.32 Why both idempotency and versioning?

Duplicate:

```text
version 42
version 42
```

Idempotency solves that.

Out of order:

```text
version 42
then
version 41
```

Version checking solves that.

They are distinct.

---

# 17.33 Interview answer

> “For a seconds-level Salesforce change requirement I'd prefer an event-driven mechanism such as Change Data Capture rather than aggressive polling. I'd design the consumer for duplicate delivery and replay, make the downstream update idempotent, and carry source sequence/version information if stale events can overwrite newer state. I'd also monitor event lag because eventual consistency becomes part of the business SLA.”

Excellent.

---

# Scenario 7 — Mule → Salesforce → Billing → Email

## Prompt

> “When a customer signs up, create them in Salesforce, register them in Billing, then send a welcome email.”

This is testing distributed transaction thinking.

---

# 17.34 Naive design

```text
Salesforce Create
 ↓
Billing Create
 ↓
Email
```

Problem:

```text
Salesforce SUCCESS
Billing FAILS
```

What now?

You cannot say:

```text
rollback everything
```

because these are separate external systems.

---

# 17.35 First classify critical vs noncritical

Ask:

```text
Is billing registration mandatory before onboarding succeeds?

Is email mandatory?
```

Probably:

```text
Salesforce = critical
Billing = critical
Email = noncritical
```

Maybe.

Business decides.

---

# 17.36 Better architecture

Potential hybrid:

```text
POST signup
 ↓
validate
 ↓
create core customer
 ↓
persist state
 ↓
publish CustomerCreated
 ↓
response
```

Then:

```text
CustomerCreated
 ├→ Salesforce consumer
 ├→ Billing consumer
 └→ Email consumer
```

Or keep critical operations orchestrated and make email async.

Example:

```text
Salesforce Upsert
 ↓
Billing customer creation
 ↓
publish CustomerOnboarded
 ↓
return success

event consumer
 ↓
send welcome email
```

---

# 17.37 Compensation/status

If Salesforce succeeds but Billing fails:

Options:

```text
retry Billing

mark integration status PENDING_BILLING

compensate Salesforce if business requires

operator reconciliation
```

Do not blindly delete Salesforce unless that's actually correct business behavior.

---

# 17.38 Interview answer

> “I'd first determine which side effects are part of the transactional business outcome. I wouldn't assume distributed rollback across Salesforce, Billing and Email. I'd use idempotent downstream operations, make noncritical work such as email asynchronous, and for partial critical failure I'd use retry plus explicit workflow state or compensation/reconciliation rather than pretending the entire chain is atomic.”

Senior answer.

---

# Scenario 8 — Multiple APIs need Salesforce customer data

## Prompt

> “Mobile, web, support and order systems all need customer data from Salesforce.”

This is an API-led architecture question.

---

# 17.39 Avoid direct coupling

Bad:

```text
Mobile → Salesforce
Web → Salesforce
Support → Salesforce
Orders → Salesforce
```

Now everyone owns:

```text
SOQL
auth
Salesforce schema
error handling
```

---

# 17.40 System API

Create:

```text
Customer Salesforce System API
```

that exposes meaningful operations:

```text
GET /customers/{id}
POST /customers
GET /customers/{id}/contacts
```

Internally:

```text
Salesforce Connector
SOQL
DataWeave
OAuth
```

---

# 17.41 Process APIs

Then business processes can reuse it:

```text
Order Process API
       ↓

Customer Profile Process API
       ↓

Customer Salesforce System API
```

Experience APIs only if mobile/web need meaningful contract adaptation.

---

# 17.42 Important nuance

If there is only one simple consumer:

> Don't create three API layers merely to draw the MuleSoft diagram.

Say:

> “I'd introduce separate deployable System/Process/Experience layers where they create real reuse, governance, or independent lifecycle.”

Strong.

---

# Scenario 9 — Duplicate Account incidents in production

## Prompt

> “We're seeing duplicate Accounts in Salesforce. What would you investigate?”

Excellent troubleshooting question.

---

# 17.43 Start with identity

Ask:

```text
What determines that two records represent
the same customer?
```

Then inspect:

```text
External ID configured?

Is it unique?

Are we using Upsert?

Is code doing Query → Create?

Are retries using Create?

Are multiple workers processing concurrently?

Is source sending different IDs for same entity?

Are duplicate rules merely fuzzy rather than deterministic?
```

---

# 17.44 Classic cause

Code:

```text
Query C001
 ↓
not found
 ↓
Create
```

Two workers do it simultaneously.

Result:

```text
duplicate
```

Fix:

```text
unique External ID
+
Upsert
```

at the Salesforce write boundary.

---

# 17.45 Another cause

Timeout:

```text
Create succeeds
response lost
Mule retries Create
```

Again duplicate.

Fix requires:

```text
idempotent write
```

not simply:

```text
more retries
```

---

# 17.46 Interview answer

> “I'd first identify whether duplicate prevention is enforced atomically at the Salesforce boundary. I'd look for query-then-create patterns, nonunique or unstable external IDs, retries around Create, concurrent consumers, and source identity problems. My preferred design is usually a stable unique External ID plus Upsert, because an application-side existence check alone races under concurrency.”

Excellent.

---

# Scenario 10 — API works in QA but fails in PROD

## Prompt

> “Same Mule application works in QA but Salesforce calls fail in production.”

Don't immediately debug DataWeave.

---

# 17.47 Compare environment differences

Checklist:

```text
Is same artifact/version running?

Correct environment properties?

Correct Salesforce org?

OAuth configuration?

Integration identity?

Object permissions?

Field-level security?

Record sharing?

Schema deployment?

Validation rules?

Certificate/secret rotation?

Network/TLS?
```

If:

```text
INVALID_FIELD
```

likely schema.

If:

```text
INSUFFICIENT_ACCESS
```

permissions.

If:

```text
authentication
```

credentials/OAuth.

If:

```text
CONNECTIVITY
```

network/downstream.

---

# 17.48 Interview answer

> “Because the same artifact works in QA, I'd first compare environmental dependencies before changing code: Salesforce org and schema, integration identity and permissions, OAuth configuration, secrets/certificates, runtime properties and network path. I'd use the exact error type and correlation ID to narrow the investigation rather than treating all production failures as application bugs.”

Very good.

---

# Scenario 11 — API suddenly gets much slower

## Prompt

> “The Mule customer API went from 500 ms to 5 seconds.”

Use Module 16.

---

# 17.49 Break latency apart

Check:

```text
Mule processing
Salesforce
Billing
DB
connection waiting
retry delays
```

Then:

```text
traffic
CPU
memory
connection saturation
recent release
Salesforce health
```

Look at:

```text
p95 / p99
```

not merely averages.

---

# 17.50 Avoid the bad answer

Don't say:

> “I'd increase the timeout.”

A timeout doesn't make anything faster.

In fact it may hide the problem.

---

# 17.51 Interview answer

> “I'd decompose the latency first. I'd compare end-to-end p95 with Salesforce and other dependency latency, retries, connection saturation, runtime CPU/memory, traffic and recent deployment changes. Then I'd trace representative requests by correlation ID. I wouldn't increase timeouts until I knew which segment was responsible.”

Strong.

---

# Scenario 12 — Design a complete production Mule→Salesforce integration

This is the big one.

Interviewer:

> “Tell me how you'd build a production-ready customer synchronization service.”

Here's how to answer it coherently.

---

# 17.52 Requirement

Assume:

```text
source applications
 ↓
customer API
 ↓
Salesforce
```

Volume:

```text
normal transactional traffic
+
nightly large sync
```

We have:

```text
customerId
```

as stable source identifier.

---

# 17.53 API architecture

Transactional path:

```text
POST /customers
       ↓
Customer Process/System API
       ↓
Salesforce
```

If multiple consumers/processes need Salesforce abstraction:

```text
Customer Process API
       ↓
Salesforce System API
       ↓
Salesforce
```

Don't over-layer unnecessarily.

---

# 17.54 Mule flow

```text
HTTP Listener / APIKit
 ↓
validate
 ↓
save relevant original context
 ↓
DataWeave
 ↓
Salesforce Upsert by External ID
 ↓
response transform
```

---

# 17.55 Error handling

```text
Validation
→ 400

Business/data failure
→ normalized 4xx

Transient Salesforce
→ narrow bounded retry

Retry exhausted
→ 503

Unexpected
→ 500
```

Structured logs with:

```text
correlationId
customerId
operation
duration
normalized error
```

---

# 17.56 Idempotency

Salesforce:

```text
External_Customer_ID__c
```

configured uniquely.

Use:

```text
Upsert
```

rather than:

```text
query → create
```

This protects:

```text
retries
timeouts
concurrent requests
batch replay
```

---

# 17.57 Bulk path

Nightly sync:

```text
Scheduler
 ↓
delta extraction
 ↓
Mule Batch if needed
 ↓
Bulk API v2 Upsert
 ↓
failed-row handling
 ↓
reconciliation
```

Don't run 500k one-record connector calls.

---

# 17.58 Security

```text
OAuth
dedicated integration identity
least privilege
secure properties / secret manager
same application artifact
environment-specific runtime configuration
```

No secrets in Git/logs.

---

# 17.59 Testing

MUnit:

```text
DataWeave
Choice
validation
connector mocks
error branches
```

Integration:

```text
real Salesforce OAuth
SOQL
schema
permissions
External ID
validation rules
```

E2E:

```text
API request
→ Mule
→ Salesforce
→ verify Salesforce state
```

Idempotency:

```text
send same request concurrently
→ exactly one Account
```

---

# 17.60 Deployment

```text
PR
 ↓
MUnit
 ↓
Maven package
 ↓
versioned immutable artifact
 ↓
QA deployment
 ↓
smoke
 ↓
PROD
```

Runtime config differs.

Code/artifact doesn't.

---

# 17.61 Observability

Monitor:

```text
request volume
error %
p95/p99
Salesforce latency
timeouts
retry rate
Salesforce limits
batch job status
queue lag if async
```

Correlate every request.

---

# 17.62 The polished full answer

This is worth practicing almost verbatim:

> “I'd start with a stable API contract and determine whether the use case needs synchronous completion or can be asynchronous. For a transactional customer update, I'd validate at the boundary, transform the source customer model into the Salesforce model with DataWeave, and use Upsert against a unique stable External ID rather than query-then-create. I'd separate transient Salesforce connectivity failures from permanent data or permission errors, use bounded retries only around idempotent operations, normalize connector errors into the API contract, and propagate correlation IDs.
>
> “For high-volume synchronization I'd use delta extraction plus Salesforce Bulk API v2 rather than per-record calls, and Mule Batch if I need record-level processing, aggregation or restartability. Credentials and endpoints would be externalized per environment using a dedicated least-privilege integration identity. MUnit would cover flow logic and error paths, while deployed integration tests would verify the real Salesforce schema, permissions and downstream state. Finally, I'd deploy the same versioned Maven artifact across environments and monitor latency, retries, Salesforce failures and business-level synchronization lag.”

If you can give that answer naturally, you can handle a large percentage of a Mule developer interview.

---

# 17.63 What the interviewer may challenge next

After your first answer, expect follow-ups like:

### “Why Upsert?”

```text
external ID
fewer calls
idempotency
concurrency
```

### “What if Salesforce times out?”

```text
unknown outcome
safe retry only with idempotency
```

### “What if Account succeeds but Contact fails?”

```text
partial state
no distributed rollback
retry/compensation/reconciliation
```

### “What if there are 1 million records?”

```text
delta
Bulk API
Mule Batch
streaming
```

### “What if Salesforce is down for 30 minutes?”

```text
async queue if business permits
```

### “How do you test that?”

```text
MUnit + real Salesforce integration tests
```

### “How do you deploy it?”

```text
Maven → immutable artifact → CloudHub/Runtime → smoke
```

### “How do you monitor it?”

```text
correlation IDs
p95/p99
downstream metrics
retry rate
business lag
```

Notice that these are exactly our Modules 1–16.

---

# 17.64 What not to do in a system-design interview

Avoid immediately diving into syntax:

> “I'd add `<salesforce:upsert>`…”

before discussing requirements.

Avoid pretending everything is synchronous.

Avoid saying:

> “I'd retry any failure three times.”

Avoid:

> “I'd use Parallel For Each to make everything faster.”

Avoid:

> “If the second system fails Mule rolls everything back.”

Avoid:

> “We can guarantee no duplicates because the API only sends once.”

Avoid:

> “HTTP 200 means Salesforce worked.”

Avoid blindly forcing:

```text
Experience → Process → System
```

into every architecture.

Those are the traps we've been systematically eliminating.

---

# 17.65 Your senior-language vocabulary

These terms are useful because they describe real engineering decisions:

```text
stable business key

External ID

idempotent operation

ambiguous outcome

bounded retry

partial failure

eventual consistency

backpressure

record-level failure isolation

reconciliation

compensating action

least privilege

contract boundary

downstream capacity

latency budget

correlation ID

systemic failure

delta synchronization
```

Use them naturally, not as buzzwords.

---

# Module 17 one-screen cheat sheet

```text
SYSTEM DESIGN ANSWER
====================

1. Contract
2. Sync or async?
3. System boundaries
4. Dependencies
5. DataWeave mapping
6. Salesforce operation
7. Error semantics
8. Idempotency
9. Volume/concurrency
10. Security
11. Testing
12. Deployment
13. Observability


TRANSACTIONAL SF WRITE
======================

HTTP
↓
Validate
↓
DataWeave
↓
Upsert by External ID
↓
Response


LARGE DATA
==========

delta
↓
Mule Batch if needed
↓
Salesforce Bulk API v2


MULTIPLE INDEPENDENT SYSTEMS
============================

Scatter-Gather


DEPENDENT OPERATIONS
====================

sequence them


LONG/OUTAGE-TOLERANT WORK
=========================

queue
↓
202
↓
async consumer


FAILURE
=======

transient
→ maybe retry

permanent
→ don't retry


TIMEOUT
=======

unknown outcome


DUPLICATES
==========

unique External ID
+ Upsert


PARTIAL CROSS-SYSTEM FAILURE
============================

no magical rollback

retry
compensate
reconcile
track state


TESTING
=======

MUnit
+
real Salesforce integration
+
few E2E


PRODUCTION
==========

immutable artifact
secure config
correlation IDs
metrics
alerts
```

## The answer pattern I most want you to memorize

When you get a design question and need five seconds to organize yourself, start with:

> **“First I'd clarify the contract, volume, latency requirement and whether the caller needs synchronous completion. Then I'd identify the system dependencies and stable business keys, because those determine orchestration, Salesforce operation, idempotency and retry strategy.”**

That buys you thinking time **and** sounds exactly like someone who designs integrations rather than merely knows Mule components.

**Module 18 is the final technical module: Interview Coding Scenarios.** We'll practice the things they might actually ask you to write or sketch: Mule flow structure, DataWeave transformations, SOQL, Choice logic, Salesforce Upsert, error-handler pseudocode, and a small MUnit test—essentially a compact “write this on screen without looking clueless” drill.
