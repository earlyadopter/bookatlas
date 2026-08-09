# Module 10 — Synchronous vs Asynchronous Integrations

This module is about a core architecture decision:

> **Does the caller wait for the work to finish, or do we accept the work and finish it later?**

That choice affects latency, reliability, retries, user experience, error handling, and scaling.

---

## 10.1 Synchronous integration

Classic request/response:

```text
Client
  ↓
POST /customers
  ↓
Mule
  ↓
Salesforce
  ↓
Mule
  ↓
HTTP response
```

The caller waits.

Example:

```http
POST /customers
```

Response:

```json
{
  "customerId": "C001",
  "status": "SUCCESS"
}
```

Use synchronous processing when:

```text
caller needs immediate result

work is fast enough

downstream availability is acceptable

failure should be reported immediately

transaction is relatively small
```

---

# 10.2 Synchronous example

A UI asks:

> “Does customer C001 exist?”

Flow:

```text
GET /customers/C001
      ↓
Salesforce Query
      ↓
Transform
      ↓
200 response
```

Very reasonable.

Making this asynchronous would be silly:

```text
202 Accepted
come back later to see if customer exists
```

---

# 10.3 The synchronous reliability problem

Now imagine:

```text
POST /onboard-customer
```

does:

```text
Salesforce
   ↓
Billing
   ↓
ERP
   ↓
Email system
```

Each takes two seconds.

Best case:

```text
~8+ seconds
```

Then Billing temporarily fails.

Should the caller wait while Mule retries?

Now:

```text
8 seconds
+ retry delay
+ retry
+ another timeout
```

You may exceed:

```text
client timeout
load balancer timeout
API gateway timeout
user patience
```

This is where asynchronous architecture starts becoming attractive.

---

# 10.4 Asynchronous integration

Instead:

```text
Client
  ↓
POST /customers
  ↓
Mule validates request
  ↓
Queue / Event
  ↓
202 Accepted
```

Then separately:

```text
Queue
 ↓
Mule worker
 ↓
Salesforce
 ↓
Billing
 ↓
ERP
```

The client does not wait for the downstream work.

---

# 10.5 HTTP 202

A common async response is:

```http
202 Accepted
```

Meaning roughly:

> “The request is valid and accepted for processing, but processing is not complete yet.”

Example:

```json
{
  "requestId": "REQ-12345",
  "status": "ACCEPTED"
}
```

The caller may later:

```text
GET /requests/REQ-12345
```

or receive a callback/event.

---

# 10.6 Why async is more resilient

Suppose Salesforce is unavailable for 20 minutes.

Synchronous:

```text
caller
 ↓
Mule
 ↓
Salesforce unavailable
 ↓
503
```

Every caller now needs its own retry strategy.

Async:

```text
caller
 ↓
queue
 ↓
202
```

Worker:

```text
attempt Salesforce
 ↓
fails
 ↓
retry later
```

The queue decouples:

```text
request arrival
```

from:

```text
downstream availability
```

That is a huge reliability benefit.

---

# 10.7 Queue as a shock absorber

Suppose normal traffic:

```text
100 requests/minute
```

Suddenly:

```text
10,000 requests
```

Without queue:

```text
10,000 requests
  ↓
Mule
  ↓
Salesforce
```

You may overwhelm Salesforce.

With queue:

```text
10,000 requests
      ↓
    Queue
      ↓
workers consume at controlled rate
```

This is called:

```text
buffering
backpressure
load leveling
```

Very useful integration vocabulary.

---

# 10.8 But queues don't create capacity

If requests arrive at:

```text
10,000/hour
```

and workers permanently process only:

```text
5,000/hour
```

your queue grows forever.

So async gives you buffering, not magic throughput.

You still need:

```text
capacity planning
autoscaling
batching
downstream limits
monitoring
```

---

# 10.9 Mule async options

Depending on environment, you'll encounter things like:

```text
Anypoint MQ
JMS
Kafka
Amazon SQS
other message brokers
```

and event sources such as:

```text
Salesforce Platform Events
Change Data Capture
Pub/Sub
```

For your interview, focus on the architecture rather than memorizing every connector.

---

# 10.10 Queue mental model

Producer:

```text
Mule API
  ↓
publish message
  ↓
queue
```

Consumer:

```text
queue listener
  ↓
Mule flow
  ↓
Salesforce
```

The producer and consumer don't need to run at the same moment.

That is **temporal decoupling**.

---

# 10.11 Queue vs Flow Reference

From Module 6:

```text
Flow Reference
```

is synchronous:

```text
caller waits
```

Queue:

```text
publish
↓
handoff
↓
consumer runs independently
```

Big distinction.

---

# 10.12 Async Scope vs messaging

You may also hear Mule's:

```text
Async scope
```

Conceptually:

```text
main flow
   ↓
start work asynchronously
   ↓
main flow continues
```

But don't confuse that with durable messaging.

If you need:

```text
guaranteed eventual processing
survival across application crash
redelivery
DLQ
```

a durable queue/message broker is usually a stronger architecture than merely launching asynchronous work in memory.

---

# 10.13 Event-driven architecture

Instead of commanding:

```text
Create billing customer now
```

one system can publish:

```text
CustomerCreated
```

Then multiple consumers react:

```text
CustomerCreated
   ├→ Salesforce consumer
   ├→ Billing consumer
   ├→ Analytics consumer
   └→ Notification consumer
```

This is event-driven integration.

---

# 10.14 Command vs event

Useful distinction:

### Command

```text
CreateCustomerInBilling
```

means:

> “Please do this.”

Usually has one intended handler.

### Event

```text
CustomerCreated
```

means:

> “This already happened.”

Potentially many subscribers react.

This distinction makes you sound comfortable with messaging architecture.

---

# 10.15 Choreography

Remember Module 6?

Orchestration:

```text
Mule centrally tells systems what to do
```

Choreography:

```text
systems react to events
```

Example:

```text
CustomerOnboarded
     ↓
Salesforce updater

CustomerOnboarded
     ↓
Billing updater

CustomerOnboarded
     ↓
Email service
```

No single central process necessarily waits for all three.

---

# 10.16 Eventual consistency

This is one of the biggest async concepts.

At 10:00:00:

```text
source customer updated
```

At 10:00:01:

```text
event published
```

At 10:00:03:

```text
Salesforce updated
```

For two seconds:

```text
source != Salesforce
```

That's **eventual consistency**.

The systems converge eventually rather than staying atomically synchronized at every instant.

---

# 10.17 Eventual consistency isn't necessarily a bug

For many integrations:

```text
Salesforce lag of a few seconds
```

is perfectly acceptable.

For others:

```text
stock availability
payment authorization
account balance
```

you may require stronger guarantees.

Architecture should match business semantics.

---

# 10.18 Polling

Another common pattern:

```text
Scheduler
   ↓
every 15 minutes
   ↓
query Salesforce
   ↓
find changes
```

Example:

```text
Scheduler
  ↓
SELECT records
WHERE LastModifiedDate > watermark
```

This is polling.

Pros:

```text
simple
works when source has no event mechanism
easy to reason about
```

Cons:

```text
delay
repeated queries
API consumption
watermark complexity
deleted-record handling
```

---

# 10.19 Event vs polling

Suppose Salesforce changes Account.

Polling:

```text
Mule:
anything changed?
anything changed?
anything changed?
```

Event:

```text
Salesforce:
Account changed!
   ↓
Mule
```

Event-driven is often lower latency and avoids repeated empty queries.

But it adds:

```text
event infrastructure
delivery semantics
replay considerations
ordering issues
consumer state
```

So polling isn't automatically bad.

---

# 10.20 Salesforce Change Data Capture

Salesforce CDC is conceptually:

```text
Account changed
     ↓
change event
     ↓
Mule
```

Useful for:

```text
data synchronization
replication
cache updates
downstream propagation
```

Instead of polling `LastModifiedDate`.

You don't need the exact connector syntax for the interview.

Recognize the use case.

---

# 10.21 Platform Events

Platform Events are more business-event-oriented.

Example:

```text
Loan_Approved__e
```

or:

```text
Customer_Onboarded__e
```

Salesforce publishes:

```text
Customer onboarded
```

Mule reacts.

Think:

```text
CDC
≈ record changed

Platform Event
≈ business event
```

That's a useful high-level distinction.

---

# 10.22 Pub/Sub API

You may hear Salesforce:

```text
Pub/Sub API
```

This is Salesforce's event subscription/publication infrastructure for event types such as CDC and Platform Events.

Again, don't spend interview prep memorizing protocol details.

Know:

```text
Mule can consume Salesforce events
instead of only polling/querying Salesforce
```

---

# 10.23 At-most-once, at-least-once, exactly-once

This terminology often appears in messaging interviews.

### At-most-once

```text
message processed 0 or 1 times
```

No duplicate processing, but message may be lost.

### At-least-once

```text
message processed 1 or more times
```

No intended loss, but duplicates possible.

### Exactly-once

```text
processed exactly once
```

Very desirable, but much harder across distributed systems.

---

# 10.24 Practical integration mindset

Most real message systems often force you to reason as if:

```text
duplicate delivery is possible
```

Therefore:

```text
consumer must be idempotent
```

This should sound familiar by now.

Example event:

```json
{
  "eventId": "EVT-123",
  "customerId": "C001"
}
```

Mule might store/process:

```text
EVT-123
```

only once.

Or Salesforce upsert by stable business key.

---

# 10.25 Why duplicate events happen

Consumer receives:

```text
EVT-123
```

Processes successfully.

Before it acknowledges message:

```text
consumer crashes
```

Broker thinks:

```text
not acknowledged
```

and redelivers.

Now:

```text
EVT-123
```

arrives again.

That's normal distributed-system behavior.

---

# 10.26 Therefore acknowledge only after success

Conceptually:

```text
receive message
  ↓
process Salesforce
  ↓
success
  ↓
acknowledge
```

If you acknowledge before processing:

```text
receive
 ↓
ack
 ↓
Salesforce fails
```

message may be lost.

Exact acknowledgement semantics depend on broker/connector, but the concept matters.

---

# 10.27 Dead Letter Queue

After repeated failures:

```text
message
 ↓
retry
 ↓
retry
 ↓
retry
 ↓
still fails
```

you often move it to:

```text
DLQ
Dead Letter Queue
```

Meaning:

> “Automatic processing has given up. This needs separate investigation or recovery.”

---

# 10.28 What belongs in DLQ?

Example:

```json
{
  "eventId": "EVT-999",
  "customerId": "C347",
  "error": "Salesforce validation failed"
}
```

But don't treat DLQ as:

```text
trash can
```

You need operational processes around it:

```text
monitoring
alerts
diagnosis
replay
manual correction
audit
```

---

# 10.29 Retry queue vs DLQ

A mature architecture may have:

```text
main queue
   ↓
processing fails
   ↓
retry queue / delayed retry
   ↓
fails repeatedly
   ↓
DLQ
```

This avoids blocking normal messages behind one bad record.

---

# 10.30 Poison message

A message that will never succeed without correction:

```text
customerId missing
invalid schema
impossible Salesforce field
```

is sometimes called a:

```text
poison message
```

Retrying it forever wastes capacity.

Route it to DLQ or error handling after appropriate attempts.

---

# 10.31 Ordering

Suppose events arrive:

```text
1. Customer Active
2. Customer Suspended
```

But processing completes:

```text
2 first
1 second
```

Final state:

```text
Active
```

Wrong.

Async systems therefore have to think about:

```text
ordering
partition keys
sequence numbers
version numbers
timestamps
```

Same issue we discussed with Parallel For Each.

---

# 10.32 Key-based ordering

If broker supports partitioning/keying, you might use:

```text
customerId
```

as key.

Then events for:

```text
C001
```

can stay ordered relative to one another, while:

```text
C002
C003
```

can process independently.

Conceptually:

```text
partition by customerId
```

Very common in Kafka-style architectures.

---

# 10.33 Idempotency alone doesn't solve stale ordering

Important nuance.

Suppose:

```text
event 2 = Suspended
event 1 = Active
```

Both are idempotent.

If event 1 arrives last, you still end up wrong.

You may need:

```text
version = 17
```

and reject:

```text
version < currentVersion
```

So:

```text
idempotency
```

handles duplicates.

```text
version/order control
```

handles stale events.

Different problems.

---

# 10.34 Async Salesforce update example

Message:

```json
{
  "eventId": "E123",
  "customerId": "C001",
  "version": 42,
  "status": "SUSPENDED"
}
```

Consumer:

```text
receive
 ↓
check event/version
 ↓
transform
 ↓
Salesforce Upsert
 ↓
acknowledge
```

If event repeats:

```text
same eventId/version
```

do nothing harmful.

---

# 10.35 Event schema versioning

Events themselves are contracts.

Today:

```json
{
  "customerId": "C001",
  "status": "ACTIVE"
}
```

Tomorrow someone adds:

```json
{
  "customerId": "C001",
  "status": "ACTIVE",
  "region": "US"
}
```

Usually additive change is easier.

But removing/renaming fields may break consumers.

So treat:

```text
event schema
```

with the same seriousness as:

```text
REST API schema
```

This is directly relevant to automated contract testing.

---

# 10.36 Sync vs async decision rule

Ask:

```text
Does caller need final result right now?
```

If yes:

```text
synchronous may fit
```

If no:

```text
async may fit
```

Then ask:

```text
Can work take a long time?

Can downstream systems be unavailable?

Could traffic spike?

Do we need independent retries?

Is eventual consistency acceptable?
```

More “yes” answers make async more attractive.

---

# 10.37 Good synchronous use cases

```text
retrieve customer profile

validate coupon

check inventory

obtain a quick credit decision

retrieve Salesforce Account
```

where response is immediately needed.

---

# 10.38 Good asynchronous use cases

```text
nightly synchronization

large import

send notifications

customer onboarding across many systems

data warehouse update

mass Salesforce updates

post-processing after order creation
```

---

# 10.39 Hybrid pattern

Very common:

```text
POST /orders
 ↓
validate
 ↓
create core order synchronously
 ↓
publish OrderCreated event
 ↓
201 Created
```

Then async consumers do:

```text
analytics
marketing
email
CRM enrichment
```

This keeps critical path short.

---

# 10.40 Another hybrid

```text
POST /customer-import
 ↓
validate file metadata
 ↓
queue batch
 ↓
202 Accepted
```

Then:

```text
worker
 ↓
process 100,000 customers
 ↓
Salesforce Bulk API
```

Caller can query:

```text
GET /imports/{id}
```

for status.

Very realistic enterprise design.

---

# 10.41 Scheduler pattern

Mule Scheduler can trigger flows:

```text
every 15 minutes
every night
daily at 2 AM
```

Example:

```text
Scheduler
   ↓
query source DB
   ↓
DataWeave
   ↓
Salesforce Bulk Upsert
```

This is still asynchronous from a user perspective, even though there's no queue.

---

# 10.42 Scheduler + watermark

Typical delta sync:

```text
Scheduler
 ↓
read watermark
 ↓
query changed records
 ↓
process
 ↓
update watermark
```

Remember Module 5 concerns:

```text
crash halfway
equal timestamps
deleted records
overlap
```

Often you intentionally query with overlap and rely on idempotent upserts.

---

# 10.43 Polling too frequently

Bad:

```text
every second:
SELECT all modified records
```

Potential issues:

```text
Salesforce API usage
cost
load
duplicate work
race conditions
```

Choose polling interval based on:

```text
business latency requirement
source limits
expected change volume
```

---

# 10.44 Polling too infrequently

If requirement says:

```text
Salesforce must reflect change within 1 minute
```

and scheduler runs:

```text
every hour
```

architecture doesn't satisfy SLA.

Obvious, but state this explicitly in design discussions.

---

# 10.45 Event replay

Suppose consumer is down for an hour.

What happens to events?

Questions:

```text
does broker retain them?
how long?
can consumer resume?
is there replay ID / offset?
```

For Salesforce events, replay/resume concepts are important.

At interview level, say:

> “For event-driven designs I'd verify retention and replay semantics so a consumer outage doesn't silently create data gaps.”

Strong answer.

---

# 10.46 Async observability

Synchronous:

```text
request
↓
response
```

is relatively easy to trace.

Async:

```text
request
 ↓
message
 ↓
queue
 ↓
consumer
 ↓
Salesforce
```

requires stronger observability.

You need:

```text
correlation ID
message ID
event ID
retry count
processing status
DLQ monitoring
queue depth
message age
```

---

# 10.47 Queue depth

Suppose:

```text
queue normally: 20 messages
```

then suddenly:

```text
18,000 messages
```

Something is wrong.

Maybe:

```text
consumer down
Salesforce slow
traffic spike
worker under-scaled
poison-message retry storm
```

Queue depth is a key operational metric.

---

# 10.48 Oldest message age

Even more useful sometimes:

```text
oldest message = 45 minutes
```

This directly tells you:

> “Our integration is 45 minutes behind.”

That's a business-impact metric.

---

# 10.49 Async success response doesn't mean business completion

Important API semantic.

If you return:

```http
202 Accepted
```

don't send:

```json
{
  "status": "SUCCESS"
}
```

because the business operation isn't complete.

Use:

```json
{
  "status": "ACCEPTED"
}
```

or:

```text
PROCESSING
QUEUED
```

Clear contract semantics matter.

---

# 10.50 Status resource

A robust async API might return:

```json
{
  "requestId": "REQ-123",
  "status": "ACCEPTED"
}
```

Then:

```http
GET /requests/REQ-123
```

could return:

```json
{
  "requestId": "REQ-123",
  "status": "COMPLETED"
}
```

or:

```json
{
  "requestId": "REQ-123",
  "status": "FAILED",
  "errorCode": "CUSTOMER_INVALID"
}
```

---

# 10.51 Callback/webhook pattern

Instead of polling status:

```text
client gives callback URL
```

Then after completion:

```text
Mule
 ↓
POST callback
```

But callbacks introduce their own problems:

```text
client endpoint unavailable
callback retries
callback authentication
duplicate callbacks
```

Again, distributed systems.

---

# 10.52 Exactly-once delivery — be skeptical

If interviewer says:

> “We need exactly-once delivery.”

A mature response is:

> “I'd clarify whether they mean exactly-once message delivery or exactly-once business effect. Across distributed systems, I usually design for possible duplicate delivery and make the consumer idempotent so the business effect is effectively once.”

Excellent answer.

---

# 10.53 Exactly-once business effect

Example:

```text
message delivered twice
```

but Salesforce uses:

```text
External_Order_ID__c
```

with Upsert.

Result:

```text
one Opportunity/Order record
```

So:

```text
delivery may be at-least-once
business effect is idempotent
```

This is often the practical goal.

---

# 10.54 Transaction boundary with queue

A hard problem:

```text
save database record
↓
publish message
```

What if DB succeeds but message publish fails?

Or message succeeds but DB transaction rolls back?

This is why patterns such as:

```text
transactional outbox
```

exist.

You don't need to implement one during this interview unless they go deep, but recognize the issue:

> Writing state and publishing an event are two separate side effects unless designed transactionally.

---

# 10.55 Outbox pattern mental model

Instead of:

```text
update DB
then publish event
```

do:

```text
same DB transaction:
  update business data
  insert OutboxEvent
```

Then separate worker publishes outbox events.

This prevents:

```text
DB state committed
but event permanently lost
```

It's a useful architecture concept if they push into advanced integration design.

---

# 10.56 Salesforce as source vs target

So far we've mostly had:

```text
Mule → Salesforce
```

But Salesforce can also be source:

```text
Salesforce
   ↓
CDC / Platform Event / polling
   ↓
Mule
   ↓
ERP
```

Your design questions remain:

```text
delivery semantics
duplicates
ordering
retries
DLQ
idempotency
```

regardless of direction.

---

# 10.57 Interview scenario

> User creates a customer and needs the Salesforce ID before continuing.

Answer:

> “That's a strong synchronous case. I'd validate, upsert Salesforce, and return the result directly, assuming the expected latency and availability satisfy the API SLA.”

---

# 10.58 Interview scenario

> We receive 500,000 nightly updates.

Answer:

> “I would not make that a synchronous API. I'd treat it as asynchronous/batch processing—likely scheduler or queue driven—and use Salesforce Bulk API v2, with job-level and record-level error handling.”

---

# 10.59 Interview scenario

> Salesforce may be unavailable for an hour, but we must not lose requests.

Answer:

> “I'd decouple intake from processing with durable messaging. The API can accept and persist/publish the work, return 202 where appropriate, and a consumer retries Salesforce independently. I'd monitor queue age/depth and send permanently failing messages to a DLQ.”

Very good.

---

# 10.60 Interview scenario

> Account changes in Salesforce must be propagated within seconds.

Answer:

> “I'd look at an event-driven mechanism such as Salesforce Change Data Capture/Pub/Sub rather than a coarse polling schedule, assuming the event retention and replay semantics meet the reliability requirements.”

---

# 10.61 Interview scenario

> Events sometimes arrive twice.

Answer:

> “I'd consider duplicate delivery normal and design the consumer to be idempotent using a stable event or business key. If ordering matters I'd also track version or sequence because idempotency alone doesn't prevent stale events from overwriting newer state.”

That's a particularly strong answer.

---

# Module 10 cheat sheet

```text
SYNCHRONOUS
===========
caller waits
immediate final response

good for:
quick reads
small transactions
immediate decisions


ASYNCHRONOUS
============
caller doesn't wait for completion

often:
publish queue/event
return 202

good for:
long work
large volume
retries
downstream outages
traffic spikes


QUEUE
=====
buffer
load leveling
temporal decoupling


EVENTUAL CONSISTENCY
====================
systems may temporarily differ
but converge later


POLLING
=======
Scheduler
+ watermark
+ changed records


EVENT-DRIVEN
============
CDC
Platform Events
Pub/Sub


DELIVERY
========

at-most-once
at-least-once
exactly-once

practical assumption:
duplicates may happen


IDEMPOTENCY
===========
duplicate delivery
must not create duplicate business effects


ORDERING
========
duplicates and ordering are separate problems

use:
versions
sequence
partition/key where appropriate


RETRIES
=======
bounded

transient failures only


DLQ
===
messages that automatic processing
could not successfully complete


OBSERVABILITY
=============

correlationId
eventId
retry count
queue depth
oldest message age
DLQ count
```

The interview sentence to memorize is:

> **“I choose synchronous processing when the caller genuinely needs the final result immediately. For long-running, high-volume, or outage-tolerant workflows I prefer durable asynchronous messaging, and I design consumers assuming duplicate delivery is possible—so idempotency, ordering, retries, replay, and DLQ handling are part of the design.”**

Next, **Module 11 should be Salesforce Bulk processing and Mule Batch Jobs**: when to use ordinary connector operations versus Bulk API v2, chunking, job lifecycle, partial failures, batch aggregation, and designing a 100k–1M-record synchronization without destroying memory or Salesforce API limits.
