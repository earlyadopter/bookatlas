# Module 6 — Mule Routing and Orchestration

This module answers:

> “How do I make the Mule flow actually make decisions, loop, run things in parallel, or reuse logic?”

The core components to know are:

```text
Choice
For Each
Parallel For Each
Scatter-Gather
Flow Reference
Subflow
```

These are the tools that turn a simple linear pipeline into orchestration.

---

## 6.1 Start with the mental model

A trivial flow is linear:

```text
HTTP Listener
   ↓
Transform
   ↓
Salesforce Upsert
   ↓
Response
```

A realistic flow branches:

```text
HTTP Listener
   ↓
Validate
   ↓
Choice
 ┌───────────────┐
 │               │
new customer   existing customer
 │               │
Create          Update
 └───────┬───────┘
         ↓
      Response
```

Or loops:

```text
Customers[]
    ↓
For Each
    ↓
process customer
```

Or performs independent operations:

```text
              ┌→ Salesforce
Input → Split ┼→ Database
              └→ Logging API
```

That is orchestration.

---

# 6.2 Choice

`Choice` is Mule's equivalent of:

```typescript
if (...) {
   ...
} else if (...) {
   ...
} else {
   ...
}
```

Example requirement:

> Premium customers go through one Salesforce process, standard customers another.

Conceptually:

```text
Choice
  │
  ├── when customerType == "Premium"
  │       ↓
  │    premium flow
  │
  ├── when customerType == "Standard"
  │       ↓
  │    standard flow
  │
  └── otherwise
          ↓
       error/default
```

Mule XML conceptually:

```xml
<choice>

    <when expression="#[payload.customerType == 'Premium']">
        ...
    </when>

    <when expression="#[payload.customerType == 'Standard']">
        ...
    </when>

    <otherwise>
        ...
    </otherwise>

</choice>
```

The expression is DataWeave.

---

# 6.3 Real Salesforce Choice example

Suppose upstream sends:

```json
{
  "customerId": "C001",
  "operation": "DELETE"
}
```

Business rule:

```text
CREATE / UPDATE
→ upsert Salesforce

DELETE
→ mark Account inactive
```

Not actually delete.

So:

```text
Choice

operation == "DELETE"
   ↓
Update Status__c = "Inactive"

otherwise
   ↓
Upsert Account
```

This is exactly where Choice belongs.

---

# 6.4 Don't use Choice when Upsert already solves the problem

Bad:

```text
Query Account
   ↓
Choice

exists?
  ↓ yes       ↓ no
Update       Create
```

when all you needed was:

```text
Upsert
```

Choice is useful when **business logic differs**.

It's not automatically needed just because two outcomes exist.

Strong interview answer:

> “I wouldn't introduce a Choice just to reproduce behavior already provided safely by an upsert. I'd use Choice when the downstream behavior genuinely depends on data or business state.”

---

# 6.5 Multiple conditions

Example:

```dataweave
payload.active == true
and
payload.customerType == "Premium"
```

You may see:

```xml
<when expression="#[
    payload.active
    and payload.customerType == 'Premium'
]">
```

You don't need to memorize XML syntax.

Think:

```typescript
if (
    customer.active &&
    customer.customerType === "Premium"
)
```

---

# 6.6 For Each

`For Each` processes every element in a collection.

Input:

```json
[
  {"id": "C001"},
  {"id": "C002"},
  {"id": "C003"}
]
```

Flow:

```text
payload[]
   ↓
For Each
   │
   ├── C001 → processors
   ├── C002 → processors
   └── C003 → processors
```

Conceptually:

```typescript
for (const customer of customers) {
    await processCustomer(customer);
}
```

The important characteristic:

> **For Each is sequential.**

---

# 6.7 For Each example

Suppose each customer requires complicated individualized work:

```text
For Each customer
     ↓
Query special configuration
     ↓
Call external service
     ↓
Transform
     ↓
Update Salesforce
```

This may legitimately require record-by-record processing.

But be careful.

If you have:

```text
10,000 records
```

and inside each iteration:

```text
Salesforce Query
Salesforce Update
```

you've probably designed something inefficient.

---

# 6.8 Avoid For Each for simple Salesforce bulk operations

Bad:

```text
For Each 1,000 customers

   Salesforce Upsert customer
```

You have:

```text
1,000 connector calls
```

Better where possible:

```text
DataWeave map all customers
        ↓
Salesforce Upsert collection
```

This distinction matters.

### DataWeave `map`

Transforms data:

```text
array
 ↓
array
```

### Mule `For Each`

Executes processors repeatedly:

```text
item
 ↓
HTTP call
 ↓
Salesforce call
 ↓
other flow logic
```

Memorize:

> `map` transforms values. `For Each` orchestrates repeated side effects.

That is a very good interview distinction.

---

# 6.9 For Each and payload

Inside the For Each scope, the current item becomes what your processors work with conceptually.

Suppose original payload:

```json
[
  {"id": "C001"},
  {"id": "C002"}
]
```

Inside an iteration, you're dealing with:

```json
{"id": "C001"}
```

then:

```json
{"id": "C002"}
```

afterward.

This means you need to understand what state you're preserving and where.

---

# 6.10 Variables inside loops

Suppose you want to count failures.

Conceptually:

```text
vars.failureCount = 0

For Each
    ↓
process item
    ↓
if failed
   increment failure count
```

However, mutable state becomes trickier when parallelism enters the picture.

That's one reason to avoid casual use of shared variables in concurrent processing.

---

# 6.11 Parallel For Each

Now suppose the items are independent.

Instead of:

```text
C001
 ↓
wait
 ↓
C002
 ↓
wait
 ↓
C003
```

you may use:

```text
Parallel For Each

C001 ─────→ process
C002 ─────→ process
C003 ─────→ process
```

Conceptually:

```typescript
await Promise.all(
    customers.map(processCustomer)
);
```

Mule's `Parallel For Each` processes collection elements concurrently and then routes the aggregated result onward. ([docs.mulesoft.com](https://docs.mulesoft.com/mule-runtime/latest/parallel-foreach-scope?utm_source=chatgpt.com))

---

# 6.12 When Parallel For Each is attractive

Example:

You have 20 independent documents and need to call:

```text
document verification API
```

for each.

Sequential:

```text
20 × 500ms ≈ 10 seconds
```

Parallel execution may reduce wall-clock time substantially.

Likewise:

```text
several independent customer records
```

can potentially be processed concurrently.

---

# 6.13 But parallelism is not “make it faster” magic

This is a very important interview point.

Suppose Salesforce allows only so much concurrency or your downstream service has a rate limit.

Then:

```text
Parallel For Each 10,000 items
```

could hammer the downstream system.

Potential problems:

```text
rate limits
connection pool exhaustion
API limits
CPU/memory pressure
thread pressure
locking
Salesforce record contention
out-of-order updates
```

So say:

> “I would use concurrency deliberately and with downstream capacity in mind rather than assuming more parallelism is always better.”

Strong answer.

---

# 6.14 Record locking is especially relevant in Salesforce

Imagine 20 Contacts all update the same Account at once.

Or several Mule workers simultaneously change children associated with one parent.

Salesforce can hit record locking/contention problems.

So:

```text
independent records
```

are good candidates for concurrency.

But:

```text
operations touching shared parent records
```

deserve caution.

---

# 6.15 For Each vs Parallel For Each

Memorize this table:

|                        | For Each                   | Parallel For Each         |
| ---------------------- | -------------------------- | ------------------------- |
| Processing             | Sequential                 | Concurrent                |
| Ordering               | Predictable                | Completion order may vary |
| Downstream load        | Lower                      | Potentially much higher   |
| Shared-state reasoning | Easier                     | More difficult            |
| Best use               | Dependencies/order matters | Truly independent work    |

Interview phrase:

> “If processing order or shared downstream state matters, I'd prefer For Each. If items are independent and latency matters, Parallel For Each can help, but I'd bound it based on downstream limits.”

---

# 6.16 Scatter-Gather

This is another key component.

Suppose one incoming request needs information from three independent systems:

```text
                 ┌→ Salesforce
Request → Mule ──┼→ Billing API
                 └→ Customer Preferences API
```

Then combine the answers.

That's exactly the kind of problem Scatter-Gather solves.

Conceptually:

```typescript
const [salesforce, billing, preferences] =
    await Promise.all([
        getSalesforce(),
        getBilling(),
        getPreferences()
    ]);

return combine(...);
```

Mule's Scatter-Gather router sends the event to multiple routes in parallel and aggregates their results. ([docs.mulesoft.com](https://docs.mulesoft.com/mule-runtime/latest/scatter-gather-concept?utm_source=chatgpt.com))

---

# 6.17 Scatter-Gather example

Requirement:

> GET `/customer-profile/C001` should return Salesforce Account details, outstanding billing balance, and loyalty status.

Flow:

```text
HTTP Listener
      ↓
Scatter-Gather
   ┌───────┼─────────┐
   ↓       ↓         ↓
Salesforce Billing  Loyalty
Query      API      API
   └───────┼─────────┘
           ↓
     Aggregate result
           ↓
      DataWeave
           ↓
        Response
```

Output:

```json
{
  "customerId": "C001",
  "companyName": "Acme",
  "balance": 4725.50,
  "loyaltyLevel": "Gold"
}
```

---

# 6.18 Scatter-Gather vs Parallel For Each

This distinction is important.

### Parallel For Each

Same logic applied to **many items**:

```text
customer 1
customer 2
customer 3

all run through the same processing scope
```

### Scatter-Gather

Different routes applied to **the same event**:

```text
same customer request

→ Salesforce route
→ Billing route
→ Loyalty route
```

Think:

```text
Parallel For Each
= parallelize collection processing

Scatter-Gather
= parallelize independent branches
```

Memorize that.

---

# 6.19 What Scatter-Gather returns

Each route produces a result.

Conceptually:

```text
route 0 → Salesforce result
route 1 → Billing result
route 2 → Loyalty result
```

Then your DataWeave transformation combines them.

You don't need exact runtime payload syntax memorized for the interview. Be comfortable saying:

> “Scatter-Gather aggregates the route results, and I then normalize those into the output contract with DataWeave.”

---

# 6.20 What if one Scatter-Gather route fails?

Now things get interesting.

Suppose:

```text
Salesforce → success
Billing    → timeout
Loyalty    → success
```

Question:

> Should `/customer-profile` fail completely?

Maybe.

Maybe not.

This is business semantics.

Possible policy:

```text
billing data mandatory
→ fail entire request
```

or:

```text
billing data optional
→ return partial response
```

such as:

```json
{
  "customerId": "C001",
  "companyName": "Acme",
  "balance": null,
  "loyaltyLevel": "Gold",
  "warnings": [
    "Billing information unavailable"
  ]
}
```

The orchestration primitive does not decide your business semantics.

You do.

---

# 6.21 Flow Reference

Suppose you have:

```text
customer-api-flow
```

and want to call reusable internal logic:

```text
upsert-account-subflow
```

Use a Flow Reference.

Conceptually:

```typescript
await upsertAccount();
```

Mule:

```text
Flow Reference
      ↓
upsert-account-subflow
```

XML conceptually:

```xml
<flow-ref name="upsert-account-subflow"/>
```

---

# 6.22 Why Flow Reference matters

Without reuse:

```text
POST /customer
  ↓
duplicate Account upsert logic

POST /order
  ↓
duplicate Account upsert logic

POST /case
  ↓
duplicate Account upsert logic
```

Better:

```text
POST /customer ─┐
POST /order    ─┼→ ensure-account-subflow
POST /case     ─┘
```

Same reason you use helper functions/classes in normal code.

---

# 6.23 Flow vs Subflow

From Module 1:

### Flow

Can have its own source:

```text
HTTP Listener
Scheduler
queue listener
```

### Subflow

Cannot have its own event source.

It's reusable processing logic invoked by another flow.

Conceptually:

```text
Flow
= endpoint/event handler

Subflow
= reusable function
```

That's good enough for an interview.

---

# 6.24 Example decomposition

Instead of this monster:

```text
customer-flow
 ↓
validate
 ↓
transform account
 ↓
upsert account
 ↓
extract id
 ↓
transform contacts
 ↓
upsert contacts
 ↓
call marketing
 ↓
build response
```

I'd likely structure:

```text
customer-api-flow
      ↓
validate-customer-subflow
      ↓
upsert-account-subflow
      ↓
upsert-contacts-subflow
      ↓
publish-customer-event-subflow
      ↓
build response
```

Now each part has a clear responsibility.

---

# 6.25 But don't over-fragment either

Bad Mule architecture can become:

```text
flow
 ↓
subflow
 ↓
subflow
 ↓
subflow
 ↓
subflow
```

where each one contains one trivial component.

That's the equivalent of creating:

```typescript
function getName() {
   return customer.name;
}
```

for everything.

Good decomposition follows meaningful responsibilities.

---

# 6.26 Flow Reference is synchronous

Conceptually:

```text
parent flow
   ↓
flow-ref
   ↓
called flow/subflow
   ↓
returns
   ↓
parent continues
```

Think function call.

Don't confuse it with:

```text
publish event
queue
async handoff
```

Those are different patterns.

---

# 6.27 Choice + subflows

A common mature design:

```text
Choice

operation == CREATE
   ↓
create-customer-subflow

operation == UPDATE
   ↓
update-customer-subflow

operation == DELETE
   ↓
deactivate-customer-subflow
```

This keeps the top-level orchestration readable.

Your top flow describes:

```text
what happens
```

while subflows contain:

```text
how it happens
```

---

# 6.28 Realistic orchestration scenario

Let's design something interview-worthy.

Requirement:

> Receive an order. Ensure the customer exists in Salesforce, create/update Opportunity, call an external credit service, and publish an event if approved.

Flow:

```text
POST /orders
      ↓
Validate
      ↓
Save original order
      ↓
ensure-account-subflow
      ↓
Scatter-Gather
   ┌───────┴────────┐
   ↓                ↓
Credit API     Existing SF data
   └───────┬────────┘
           ↓
        Choice
     ┌─────┴─────┐
     ↓           ↓
 approved      rejected
     ↓           ↓
upsert opp.   update status
     ↓
publish event
     ↓
response
```

Now you're doing actual orchestration rather than a simple pipeline.

---

# 6.29 When NOT to parallelize this example

Suppose Opportunity creation requires:

```text
credit decision
```

Then these cannot happen simultaneously:

```text
Credit API
Opportunity creation
```

because one depends on the other.

You need:

```text
Credit API
   ↓
Choice
   ↓
Opportunity
```

not:

```text
Scatter-Gather
Credit + Opportunity
```

Rule:

> Parallelize only operations without required ordering/dependencies.

Simple but important.

---

# 6.30 A dependency graph is useful

Before choosing Mule components, think like this:

```text
A = validate input

B = upsert account

C = get credit score

D = create opportunity

E = notify marketing
```

Dependencies:

```text
A → B
A → C

B + C → D

D → E
```

Then orchestration becomes obvious:

```text
Validate
   ↓
parallel B + C
   ↓
wait for both
   ↓
D
   ↓
E
```

That's much better than randomly dragging components onto the Studio canvas.

---

# 6.31 Scatter-Gather might fit that dependency graph

Example:

```text
Validate
   ↓
Scatter-Gather
  ┌─────┴─────┐
  ↓           ↓
Upsert       Credit
Account      API
  └─────┬─────┘
        ↓
   Opportunity
```

provided the two branches are truly independent.

Good design reasoning.

---

# 6.32 Batch processing vs For Each

Don't confuse Mule Batch Jobs with For Each.

For Each:

```text
collection already in flow
      ↓
iterate over it
```

Batch processing:

```text
large data processing workload
      ↓
records processed in stages
      ↓
better suited to substantial volumes
```

You'll see Mule Batch when processing:

```text
large migrations
nightly imports
data synchronization
```

We'll touch it more in the bulk/async module.

For now:

```text
small/normal collection logic
→ For Each

large ETL-style workload
→ consider Batch / Bulk API / async architecture
```

---

# 6.33 Sequential consistency

Suppose input says:

```json
[
  {
    "customerId": "C001",
    "sequence": 1,
    "status": "Active"
  },
  {
    "customerId": "C001",
    "sequence": 2,
    "status": "Suspended"
  }
]
```

Parallel processing could yield:

```text
sequence 2 completes first
sequence 1 completes later
```

Final Salesforce state:

```text
Active
```

which is wrong.

So if updates for the same entity must preserve order:

```text
Parallel For Each
```

could be dangerous.

This is a great interview example.

---

# 6.34 Ordering and event design

For integrations, always ask:

```text
Do updates depend on order?
```

If yes:

```text
sequential processing
queue partitioning/keying
version checks
timestamps
sequence numbers
```

may matter.

This becomes very important with event-driven systems later.

---

# 6.35 Choice vs validation

Suppose:

```json
{
  "customerId": null
}
```

Should you use Choice?

```text
if customerId != null
   process
otherwise
   error
```

You can.

But semantically, that's more appropriately:

```text
validation
```

Choice should generally express meaningful routing/business decisions, not replace all validation.

---

# 6.36 Choice vs error handling

Likewise:

```text
Salesforce failed
```

shouldn't generally be modeled as:

```text
Choice
if success...
else...
```

if the connector is already throwing a Mule error.

That's what error handling is for.

We'll cover that next.

---

# 6.37 For Each error semantics

Suppose:

```text
customer 1 success
customer 2 success
customer 3 fails
customer 4 ?
```

You need to decide:

```text
stop entire processing immediately?
continue and record failure?
retry item?
send failed item elsewhere?
```

Don't casually assume loop semantics meet the business requirement.

For bulk-style flows, **partial success** is often required.

---

# 6.38 Pattern: capture record-level errors

Conceptually:

```text
For Each customer

    Try
      ↓
    process customer

    Error handler
      ↓
    capture {
       id,
       error
    }
      ↓
    continue
```

At the end:

```json
{
  "processed": 100,
  "successful": 97,
  "failed": 3
}
```

This is a very common integration requirement.

We'll cover the `Try` scope and error handlers in Module 7.

---

# 6.39 Pattern: fail fast

Sometimes partial success is unacceptable.

For example:

```text
financial transaction
```

Requirement:

> If any mandatory step fails, do not continue.

Then:

```text
step A
 ↓
step B
 ↓
step C fails
 ↓
error
```

But note:

If A and B performed external writes, Mule cannot magically rollback arbitrary remote systems.

This leads to distributed transaction/compensation concerns.

We'll get there.

---

# 6.40 Scatter-Gather and side effects

Be careful using Scatter-Gather for multiple writes:

```text
              ┌→ Salesforce create
Request → SG ─┼→ Billing create
              └→ ERP create
```

What if:

```text
Salesforce success
Billing success
ERP failure
```

You now have partial state across systems.

Scatter-Gather doesn't magically give you:

```text
distributed ACID transaction
```

You may need:

```text
compensation
retry
reconciliation
saga-style design
```

This is an important senior-level integration concept.

---

# 6.41 Distributed transaction reality

Suppose:

```text
Salesforce Account created
   ↓
Billing customer creation fails
```

Possible strategies:

```text
1. retry billing

2. mark Salesforce record Integration_Status__c = "Pending"

3. publish repair/reconciliation event

4. compensate by deleting/deactivating Account

5. queue operation and finish asynchronously
```

Which one depends on business requirements.

Strong interview phrase:

> “For cross-system writes I wouldn't assume atomicity. I'd define failure and compensation semantics explicitly.”

Excellent answer.

---

# 6.42 Orchestration vs choreography

You might hear these terms.

### Orchestration

One central workflow tells components what to do:

```text
Mule
 ↓
Salesforce
 ↓
Billing
 ↓
ERP
```

Mule knows the overall process.

### Choreography

Systems react to events:

```text
OrderCreated
   ↓
Salesforce consumer

OrderCreated
   ↓
Billing consumer

OrderCreated
   ↓
Analytics consumer
```

No single component necessarily drives the entire process.

For this bootcamp:

```text
Mule flow
→ orchestration
```

is the main model.

Later asynchronous event patterns introduce more choreography.

---

# 6.43 A good high-level Mule flow

The top-level flow should ideally read almost like a business process:

```text
receive-request
   ↓
validate-order
   ↓
ensure-customer
   ↓
obtain-credit-decision
   ↓
process-order
   ↓
publish-result
   ↓
build-response
```

Rather than:

```text
Set Payload
Set Variable
Transform
Logger
Choice
Set Payload
Flow Ref
Set Variable
...
```

The implementation details live inside meaningful subflows.

This improves maintainability and testability.

---

# 6.44 Orchestration also improves MUnit testing

Suppose you have:

```text
process-order-flow
```

that calls:

```text
check-credit-subflow
upsert-salesforce-subflow
```

In MUnit, you can mock boundaries and test:

```text
given credit approved
→ Salesforce upsert called

given credit rejected
→ Salesforce not called
```

This becomes much cleaner than testing a giant monolithic flow.

We'll exploit this in the MUnit module.

---

# 6.45 Interview scenario

Interviewer:

> We receive 100 customer IDs. For each we must call an independent scoring service, then update Salesforce. What would you use?

Good answer:

> “First I'd ask whether the scoring service supports bulk input, because batching may be better than 100 calls. If it doesn't and the records are independent, Parallel For Each may be appropriate, but I'd bound concurrency according to both the scoring service and Salesforce limits. If ordering or shared Salesforce records matter, I'd use sequential processing instead.”

That's much stronger than:

> “Parallel For Each.”

---

# 6.46 Another interview scenario

> We need Account data from Salesforce, open invoices from billing, and subscription state from another API before returning a customer summary.

Answer:

> “Those are independent reads, so Scatter-Gather is a good fit. I'd call the three systems in parallel, then use DataWeave to aggregate the route results into our API contract. I'd also define whether failure of any route is fatal or whether the API supports degraded/partial responses.”

Excellent.

---

# 6.47 Another scenario

> We need to route customer changes differently based on operation type.

Answer:

> “I'd use Choice with branches for the meaningful business operations, probably invoking dedicated subflows for create/update/deactivation behavior.”

---

# 6.48 Another scenario

> We have reusable Salesforce Account upsert logic called from four APIs.

Answer:

> “I'd extract that into a reusable subflow and invoke it with Flow Reference, assuming the API boundaries and transaction/error semantics are compatible.”

---

# 6.49 Component cheat sheet

```text
CHOICE
------
if / else routing
based on DataWeave conditions


FOR EACH
--------
repeat processors
for every collection item
sequential


PARALLEL FOR EACH
-----------------
repeat processors concurrently
for independent items


SCATTER-GATHER
--------------
same event
sent to multiple independent routes
in parallel
results aggregated


FLOW REFERENCE
--------------
call another flow/subflow
like a synchronous function call


SUBFLOW
-------
reusable internal processor sequence
no event source
```

---

# 6.50 The distinctions you absolutely need to know

### `map` vs `For Each`

```text
map:
transform data

For Each:
perform processing/side effects per item
```

### `For Each` vs `Parallel For Each`

```text
For Each:
sequential

Parallel For Each:
concurrent
```

### `Parallel For Each` vs `Scatter-Gather`

```text
Parallel For Each:
same processing over many items

Scatter-Gather:
different processing routes over same event
```

### `Flow Reference` vs async messaging

```text
Flow Reference:
synchronous function-like call

Queue/event:
asynchronous handoff
```

---

# 6.51 The senior-level questions to ask before choosing a router

Before selecting a Mule component, ask:

```text
Are these operations dependent?

Does ordering matter?

Are the records independent?

Can the downstream system handle concurrency?

Can I batch instead?

What happens on partial failure?

Do writes need compensation?

Should one route failure fail the entire request?

Does this need to be synchronous at all?

Can retries produce duplicates?
```

Those questions matter much more than memorizing component names.

---

# Interview-ready summary

If they ask:

> “How do you orchestrate logic in Mule?”

You can answer:

> “For conditional routing I'd use Choice. For repeated record processing I'd distinguish between sequential For Each and Parallel For Each depending on ordering and downstream capacity. For several independent operations on the same request, Scatter-Gather can reduce latency by running routes concurrently and then aggregating the results. I keep reusable responsibilities in subflows invoked through Flow Reference, and I avoid parallelizing dependent writes or assuming that cross-system operations are transactional.”

That is a **very solid Mule developer answer**.

## Next: Module 7 — Error Handling

This is one of the most interview-important modules. We'll cover **Mule error types, global vs flow-level handlers, `On Error Continue` vs `On Error Propagate`, Try scopes, retries/Until Successful, Salesforce transient vs permanent errors, partial failures, HTTP status mapping, correlation IDs, and how not to create duplicate Salesforce records during recovery**.
