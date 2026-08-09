# Module 7 — Error Handling in Mule

This is one of the most important interview modules because integrations fail constantly in ways normal application code often doesn’t:

```text
network timeout
Salesforce unavailable
bad credentials
rate limit
invalid Salesforce field
validation rule failure
partial batch failure
downstream API returns 500
request succeeded but response was lost
```

Your job is not merely to catch errors. It is to decide:

> **Which errors should stop the flow, which should be converted into a business response, and which are safe to retry?**

Mule 4 handles flow-level errors through Error Handlers containing `On Error Continue` and `On Error Propagate`. Mule selects the **first matching handler** based on error type or expression. ([MuleSoft Documentation][1])

---

## 7.1 The mental model

Imagine:

```text
HTTP Listener
     ↓
Validate
     ↓
Salesforce Upsert
     ↓
Billing API
     ↓
Response
```

Salesforce throws:

```text
SALESFORCE:CONNECTIVITY
```

Mule creates an error object and looks for the applicable handler.

Conceptually:

```typescript
try {
    await salesforce.upsert();
}
catch (error) {
    ...
}
```

But Mule gives errors structured **types** rather than forcing you to parse exception strings.

---

# 7.2 Mule error types

You'll encounter names like:

```text
HTTP:NOT_FOUND

HTTP:TIMEOUT

DB:CONNECTIVITY

SALESFORCE:CONNECTIVITY

SALESFORCE:INVALID_INPUT

MULE:RETRY_EXHAUSTED
```

Conceptually:

```text
namespace:error-type
```

For example:

```text
SALESFORCE:CONNECTIVITY
```

means:

```text
connector = Salesforce
category  = connectivity
```

Connectors define their own error hierarchies; Mule documentation notes that connector hierarchies include common types such as `CONNECTIVITY` and `RETRY_EXHAUSTED`. ([MuleSoft Documentation][1])

---

# 7.3 The `error` object

Inside an error handler you can inspect:

```text
error.errorType
error.description
error.detailedDescription
error.cause
```

Conceptually:

```dataweave
{
    type: error.errorType as String,
    message: error.description
}
```

Don't memorize every property.

Know that:

> `error` gives you structured information about the failure.

---

# 7.4 On Error Continue

This is Mule's:

> “I handled this problem. Treat this scope as successful.”

Example:

```text
Salesforce lookup fails to find an optional marketing preference
       ↓
On Error Continue
       ↓
use default preference
       ↓
continue flow
```

Mule documentation defines `On Error Continue` as handling the error and making its owning Flow/Try scope behave as though it completed successfully. ([MuleSoft Documentation][2])

Conceptually:

```typescript
try {
    result = await optionalService();
}
catch {
    result = defaultValue;
}

// continue
```

---

# 7.5 On Error Propagate

This means:

> “Run my error-handling logic, but the operation is still considered failed.”

Example:

```text
Salesforce Upsert
      ↓
CONNECTIVITY error
      ↓
log meaningful context
      ↓
On Error Propagate
      ↓
flow fails
```

Mule rethrows/propagates the error to its parent context. If the handler owns a transaction, propagation can cause that transaction to roll back. ([MuleSoft Documentation][3])

Conceptually:

```typescript
catch (error) {
    log(error);
    throw error;
}
```

---

# 7.6 The distinction to memorize

```text
ON ERROR CONTINUE
-----------------
error handled
owner considered successful
processing may continue


ON ERROR PROPAGATE
------------------
handler runs
error remains failure
propagates upward
```

Interview question:

> What's the difference between On Error Continue and On Error Propagate?

Answer:

> “Continue handles the error and treats the containing flow or Try scope as successful. Propagate executes its handling logic but keeps the operation failed and rethrows the error to the containing scope or caller.”

That's exactly what they want.

---

# 7.7 Flow-level Error Handler

You can attach an Error Handler to a flow.

Conceptually:

```xml
<flow name="customer-flow">

    <http:listener .../>

    <salesforce:upsert .../>

    <error-handler>

        <on-error-propagate
            type="SALESFORCE:CONNECTIVITY">
            ...
        </on-error-propagate>

        <on-error-continue
            type="SALESFORCE:INVALID_INPUT">
            ...
        </on-error-continue>

    </error-handler>

</flow>
```

Think:

```text
try {
    ENTIRE FLOW
}
catch specific errors {
    ...
}
```

---

# 7.8 Handler order matters

Mule routes to the **first matching handler**. ([MuleSoft Documentation][4])

So this is risky:

```text
ANY
↓
specific Salesforce error
```

because:

```text
ANY
```

already catches it.

Better:

```text
specific errors
specific errors
fallback ANY
```

Same idea as:

```typescript
catchSpecificFirst();
catchGenericLast();
```

---

# 7.9 `ANY`

`ANY` means essentially:

```text
catch everything handleable
```

Example:

```xml
<on-error-propagate type="ANY">
```

Useful as the final fallback.

But don't design everything as:

```text
ANY
→ return 500
```

because then you throw away useful semantics.

---

# 7.10 Error categories are more useful

For an integration API, think:

```text
BAD INPUT
→ 400

NOT FOUND
→ 404

AUTHORIZATION
→ 401 / 403

CONFLICT / business rule
→ 409 / 422 depending on contract

DOWNSTREAM TEMPORARY FAILURE
→ 502 / 503 / 504

UNEXPECTED BUG
→ 500
```

Your API shouldn't expose:

```text
SALESFORCE:INVALID_INPUT
```

directly to consumers.

That's implementation detail.

---

# 7.11 Normalize errors into your API contract

Bad response:

```json
{
  "error": "SALESFORCE:INVALID_INPUT",
  "description": "INVALID_FIELD_FOR_INSERT_UPDATE..."
}
```

Better:

```json
{
  "code": "INVALID_CUSTOMER",
  "message": "Customer could not be processed.",
  "correlationId": "abc-123"
}
```

Internally you log enough diagnostic detail.

Externally you expose your API contract.

Same principle we used with successful responses:

```text
Salesforce contract
≠
public API contract
```

---

# 7.12 Example error handler

Conceptually:

```xml
<error-handler>

    <on-error-continue
        type="VALIDATION:*">

        <set-variable
            variableName="httpStatus"
            value="400"/>

        <set-payload value="#[{
            code: 'INVALID_REQUEST',
            message: error.description
        }]"/>

    </on-error-continue>

    <on-error-propagate
        type="SALESFORCE:CONNECTIVITY">

        <logger
            level="ERROR"
            message="Salesforce connectivity failure"/>

    </on-error-propagate>

</error-handler>
```

Exact production XML will vary.

The architecture is what matters.

---

# 7.13 Why On Error Continue can be dangerous

Imagine:

```text
Salesforce Upsert fails
       ↓
On Error Continue
       ↓
flow considered successful
       ↓
HTTP Listener returns 200
```

Oops.

If the client believes the customer was stored but it wasn't, that's terrible.

So don't think:

```text
Continue = good
Propagate = bad
```

Instead:

```text
Continue
= failure has genuinely been converted into a successful business outcome

Propagate
= caller/parent still needs to know the operation failed
```

---

# 7.14 Good use of Continue

Requirement:

> Loyalty data is optional.

Flow:

```text
Get Account
    ↓
Get Loyalty
    ↓ fails
On Error Continue
    ↓
loyalty = null
    ↓
return customer
```

Response:

```json
{
  "customerId": "C001",
  "name": "Acme",
  "loyaltyStatus": null,
  "warnings": [
    "Loyalty information unavailable"
  ]
}
```

This can be legitimate.

---

# 7.15 Bad use of Continue

Requirement:

> Customer must be created in Salesforce.

```text
Salesforce unavailable
    ↓
On Error Continue
    ↓
return {
   status: "SUCCESS"
}
```

No.

You've hidden a real failure.

---

# 7.16 The Try scope

Sometimes you don't want an error handler covering the entire flow.

You want:

```text
only THIS operation
```

to have special behavior.

Use:

```text
Try
```

Mule's Try scope allows a subset of processors to have their own error handler. ([MuleSoft Documentation][5])

Conceptually:

```typescript
try {
    optionalBillingLookup();
}
catch (...) {
    ...
}

continueMainFlow();
```

---

# 7.17 Example Try scope

```text
HTTP Listener
     ↓
Salesforce Account Query
     ↓
Try
 ┌───────────────────┐
 │ Loyalty API call  │
 │                   │
 │ error handler:    │
 │ On Error Continue │
 └───────────────────┘
     ↓
Build Response
```

If Loyalty fails:

```text
Try scope handles it
↓
flow continues
```

Salesforce errors aren't swallowed because they're outside that Try.

That's cleaner than one giant flow-level handler with complicated condition logic.

---

# 7.18 Important Try behavior

If a processor inside Try fails:

```text
processor A
↓
processor B FAILS
↓
processor C
```

`processor C` does **not** execute inside that Try.

Mule jumps into the Try's error handler. If handled with Continue, execution resumes **after the Try scope**, not after the failed component. ([MuleSoft Documentation][5])

This matters.

---

# 7.19 Example

```text
Try

    Salesforce Query
       ↓
    DataWeave
       ↓
    Billing API
       ↓
    Logger
```

Billing fails.

Even with:

```text
On Error Continue
```

you do **not** resume at:

```text
Logger
```

inside Try.

You resume:

```text
after Try
```

Good interview trivia.

---

# 7.20 Nested error handling

You can have:

```text
Flow error handler
     ↑
Try error handler
```

Example:

```text
main flow

Try
  ↓
Billing API
  ↓
On Error Continue for HTTP:NOT_FOUND

Flow handler:
On Error Propagate for HTTP:CONNECTIVITY
```

The inner handler gets first chance for errors in that scope.

If it propagates, the containing flow can handle it.

Think exception stack.

---

# 7.21 Global Error Handler

If every API flow repeats:

```text
CONNECTIVITY → standardized response
UNAUTHORIZED → standardized response
ANY → standardized response
```

you can define a reusable/global error handler and reference it.

This helps enforce consistent behavior.

Good candidates:

```text
common logging
standard HTTP error schema
correlation ID
generic unexpected-error mapping
```

But business-specific failures may still belong locally.

---

# 7.22 Custom application errors

Suppose Salesforce says:

```text
record doesn't exist
```

but in your domain that's:

```text
CUSTOMER_NOT_FOUND
```

Mule supports mapping errors to custom application error types. MuleSoft specifically describes error mapping as a way to distinguish otherwise-similar component errors and route them to appropriate handlers. ([MuleSoft Documentation][1])

Conceptually:

```text
SALESFORCE:NOT_FOUND
        ↓
APP:CUSTOMER_NOT_FOUND
```

Then the rest of your application reasons about:

```text
APP:CUSTOMER_NOT_FOUND
```

rather than Salesforce implementation details.

Excellent architecture.

---

# 7.23 Why custom errors matter

Today:

```text
customer-system = Salesforce
```

Tomorrow:

```text
customer-system = Dynamics
```

If everything knows:

```text
SALESFORCE:NOT_FOUND
```

you have tight coupling.

Better:

```text
APP:CUSTOMER_NOT_FOUND
```

The connector implementation can change.

---

# 7.24 Until Successful

This is Mule's important retry scope.

Conceptually:

```text
try operation
 ↓ failure
wait
 ↓
try again
 ↓
...
```

Mule's current documentation states that `Until Successful` runs synchronously and retries the **processors inside the scope** until all succeed or the configured retry count is exhausted. If retries are exhausted it produces `MULE:RETRY_EXHAUSTED`. ([MuleSoft Documentation][6])

Example:

```text
Until Successful

    Salesforce Upsert

maxRetries = 3
delay = ...
```

---

# 7.25 Critical Until Successful behavior

Suppose scope contains:

```text
Operation A
 ↓
Operation B
```

A succeeds.

B fails.

Retry means Mule can retry **the processors in the scope**, not merely pretend A never happened. Current Mule documentation explicitly warns that the processors inside the scope are retried until they all complete successfully. ([MuleSoft Documentation][6])

Therefore this can be dangerous:

```text
Until Successful
    ↓
CREATE Account
    ↓
Create Billing Customer
```

Billing fails.

Retry:

```text
CREATE Account AGAIN
```

Potential duplicate.

This is why scope boundaries matter enormously.

---

# 7.26 Better retry scope

Instead:

```text
Upsert Account
     ↓
Until Successful
    └→ Call Billing Customer Upsert
```

if each operation has separate idempotency semantics.

Or make the entire sequence idempotent.

The point:

> Don't casually wrap complex multi-side-effect workflows in `Until Successful`.

---

# 7.27 Retryable errors

Typical candidates:

```text
temporary network failure
connection reset
timeout
service temporarily unavailable
some throttling conditions
```

Potential policy:

```text
attempt
↓
wait
↓
attempt
↓
wait longer
↓
attempt
```

But don't mechanically retry everything.

---

# 7.28 Non-retryable errors

Examples:

```text
invalid Salesforce field
required field missing
bad DataWeave transformation
Salesforce validation rule violation
bad SOQL
insufficient permissions
invalid business data
```

Retrying:

```text
INVALID_FIELD
```

100 times does not create the missing field.

Classify first.

---

# 7.29 Timeout doesn't mean failure

One of the most important lessons in integration development:

```text
Mule
  ↓ create Account
Salesforce
  ↓
Account successfully committed
  ↓
response travels back
  X network timeout
Mule
```

Mule sees:

```text
TIMEOUT
```

Question:

> Did Salesforce execute it?

Answer:

```text
maybe
```

So a timeout means:

> “I don't know whether the operation completed.”

Not necessarily:

> “It failed.”

---

# 7.30 Therefore retries require idempotency

This is why these belong together:

```text
TIMEOUT
   ↓
RETRY
   ↓
IDEMPOTENT OPERATION
```

For Salesforce:

```text
CREATE
```

may be unsafe.

```text
UPSERT using stable External ID
```

is much safer.

Interview phrase worth memorizing:

> “I treat ambiguous failures like timeouts differently from known business failures because a timeout doesn't prove the downstream operation wasn't committed. Retries therefore need idempotent semantics.”

Excellent.

---

# 7.31 Exponential backoff

You may hear:

```text
retry with exponential backoff
```

Instead of:

```text
1 sec
1 sec
1 sec
1 sec
```

you do something conceptually like:

```text
1 sec
2 sec
4 sec
8 sec
```

Often with jitter.

Why?

If a service has an outage and 500 workers retry simultaneously every second:

```text
thundering herd
```

can worsen the outage.

You don't need to prove Mule syntax for exponential backoff during this interview. Understand the resilience concept.

---

# 7.32 Limit retries

Never:

```text
while true
    retry Salesforce
```

because:

```text
permanent outage
→ worker stuck forever
```

You need:

```text
max attempts
timeout budget
failure policy
```

After exhaustion:

```text
fail request
queue for retry
DLQ
alert
manual reconciliation
```

depending on architecture.

---

# 7.33 Retry exhaustion

With Until Successful, after maximum retries are exhausted Mule produces:

```text
MULE:RETRY_EXHAUSTED
```

according to Mule's current documentation. ([MuleSoft Documentation][6])

Then you can handle:

```text
MULE:RETRY_EXHAUSTED
```

separately.

Example:

```text
Retry exhausted
 ↓
log structured event
 ↓
send to error queue
 ↓
mark Integration_Status__c = "FAILED"
```

---

# 7.34 Retry should usually be narrow

Good:

```text
Until Successful
    ↓
HTTP Request to temporarily unreliable service
```

Less good:

```text
Until Successful

    Query
    Create
    Send email
    Publish event
    Update database
```

because now you have to reason about what gets duplicated on each attempt.

Rule:

> Keep retry scopes as small and idempotent as practical.

---

# 7.35 Partial failures

Suppose request contains:

```text
100 Contacts
```

Salesforce processes:

```text
97 success
3 fail
```

Is that:

```text
success?
failure?
partial success?
```

The answer depends on your API contract.

One useful response:

```json
{
  "status": "PARTIAL_SUCCESS",
  "processed": 100,
  "succeeded": 97,
  "failed": 3,
  "errors": [
    {
      "contactId": "P019",
      "code": "INVALID_EMAIL"
    }
  ]
}
```

This is often much more useful than:

```text
500 Internal Server Error
```

for the entire batch.

---

# 7.36 Record-level Try pattern

For individually processed records:

```text
For Each contact

    Try
      ↓
    process contact

      error?
      ↓
    On Error Continue
      ↓
    record failure
```

This allows later records to continue.

At end:

```text
build summary
```

But remember what we discussed earlier:

> Don't use record-by-record connector calls when Salesforce supports a better batching approach.

Error requirements and performance requirements need to be balanced.

---

# 7.37 Fail-fast pattern

Some operations require:

```text
all mandatory steps must succeed
```

Then:

```text
Step A
 ↓
Step B
 ↓
Step C fails
 ↓
Propagate
```

But be very careful with external writes.

---

# 7.38 Mule cannot magically roll back Salesforce

This is crucial.

Suppose:

```text
Salesforce Account create SUCCESS
     ↓
Billing API create SUCCESS
     ↓
ERP create FAILS
```

Then:

```text
On Error Propagate
```

does **not** automatically travel back in time and delete:

```text
Salesforce Account
Billing Customer
```

Mule transaction rollback semantics apply only to resources participating in the relevant transaction mechanism. External SaaS calls are not automatically one giant distributed transaction. Mule's transaction docs make transaction ownership/boundaries explicit. ([MuleSoft Documentation][7])

So you may need compensation.

---

# 7.39 Compensation

Example:

```text
create Salesforce
      ↓
create Billing
      ↓ FAIL
```

Possible compensating action:

```text
deactivate Salesforce record
```

or:

```text
set Integration_Status__c = "PENDING_BILLING"
```

or:

```text
queue billing operation for later retry
```

This is similar to a **Saga** pattern.

Strong sentence:

> “For cross-system side effects I assume partial state is possible and design compensation or reconciliation rather than assuming an exception gives me distributed rollback.”

Senior answer.

---

# 7.40 Better architecture: async recovery

Instead of:

```text
HTTP request
 ↓
Salesforce
 ↓
Billing
 ↓
ERP
 ↓
wait for everything
```

perhaps:

```text
HTTP request
 ↓
validate
 ↓
persist command/event
 ↓
202 Accepted
```

Then:

```text
worker
 ↓
Salesforce
 ↓
Billing
 ↓
ERP
```

Failures can be retried independently.

That enters Module 10 territory—sync vs async architecture.

---

# 7.41 HTTP status mapping

An API should return meaningful status codes.

Typical thinking:

```text
bad JSON/request
→ 400

authentication missing/invalid
→ 401

authenticated but forbidden
→ 403

customer not found
→ 404

business conflict
→ 409

Salesforce temporarily unavailable
→ 503

downstream timeout
→ possibly 504

unexpected application failure
→ 500
```

Your organization may define its own standards.

Important:

> Don't expose every downstream 500 as your own arbitrary 500 without understanding semantics.

---

# 7.42 HTTP Listener response variables

A common Mule design is:

```text
vars.httpStatus
```

Default:

```text
200
```

Error handler changes:

```text
vars.httpStatus = 400
```

or:

```text
503
```

The Listener response/error response then uses that variable.

Conceptually:

```typescript
res.status(vars.httpStatus).json(payload);
```

You don't need exact Listener XML memorized.

---

# 7.43 Correlation IDs

Every integration request should ideally be traceable.

Example:

```text
API Gateway:
correlationId = 7f82-abc...
```

Then:

```text
Mule logs
Salesforce call
Billing call
error log
response
```

all reference it.

This lets operations answer:

> “What happened to customer C001's request at 10:14:32?”

---

# 7.44 Don't invent correlation IDs everywhere

If upstream already sends one:

```text
X-Correlation-ID
```

you generally want to preserve/propagate it according to your organization's tracing convention.

If not, generate one at your boundary.

Goal:

```text
one logical transaction
→ traceable across systems
```

---

# 7.45 Structured logging

Bad:

```text
ERROR SOMETHING FAILED
```

Better:

```json
{
  "level": "ERROR",
  "event": "salesforce_upsert_failed",
  "customerId": "C001",
  "correlationId": "7f82...",
  "errorType": "SALESFORCE:CONNECTIVITY",
  "retryAttempt": 2
}
```

Then Datadog/Splunk/ELK can answer:

```text
How many Salesforce timeouts today?

Which customer IDs were affected?

Which failures exhausted retries?
```

This connects strongly to quality engineering.

---

# 7.46 Don't log secrets

Never casually log:

```text
Authorization header
OAuth token
client secret
password
```

And be careful with:

```text
PII
PHI
financial information
```

Prefer identifiers needed for troubleshooting, subject to security requirements.

---

# 7.47 Logging the whole payload is often bad

Easy developer shortcut:

```text
message="#[payload]"
```

This can result in:

```text
customer DOB
email
address
medical data
token
credit information
```

sitting in logging infrastructure.

Interview phrase:

> “I prefer structured, allow-listed operational fields rather than dumping entire request payloads into logs.”

Very good.

---

# 7.48 A realistic Salesforce error strategy

Suppose:

```text
POST /customers
```

We might classify:

```text
API validation error
    ↓
400

Salesforce business validation failure
    ↓
422 or domain-specific response

Salesforce connectivity
    ↓
retry
    ↓
if exhausted → 503

Salesforce authentication/config issue
    ↓
don't keep retrying indefinitely
    ↓
500/503 + operational alert

unexpected DataWeave/runtime bug
    ↓
500
```

The exact HTTP choices depend on your contract.

The important thing is **classification**.

---

# 7.49 Salesforce validation failure

Imagine Mule sends:

```json
{
  "Name": "Acme",
  "Customer_Type__c": "Enterprise"
}
```

Salesforce rule says:

```text
Enterprise customers require AnnualRevenue
```

That's not:

```text
Salesforce unavailable
```

It's:

```text
data/business validation failure
```

So don't retry.

Return meaningful information or reject upstream appropriately.

---

# 7.50 Authentication failures

Suppose Mule's OAuth credential is invalid.

Retrying:

```text
10 times
```

probably won't help.

This is usually:

```text
configuration/security incident
```

Things to check:

```text
credentials rotated?
client secret expired?
certificate expired?
integration user disabled?
permissions changed?
```

Different category entirely from temporary network failure.

---

# 7.51 Rate limits

Suppose Salesforce says effectively:

```text
too many requests / limit exceeded
```

Possible response:

```text
backoff
reduce concurrency
batch requests
queue workload
wait for limit recovery
```

Don't simply:

```text
immediately retry 100 times
```

That makes pressure worse.

---

# 7.52 Error mapping example

Suppose you call two downstream APIs:

```text
Credit API
Shipping API
```

Both can produce:

```text
HTTP:INTERNAL_SERVER_ERROR
```

But business semantics differ.

Mule supports mapping errors:

```text
Credit failure
→ APP:CREDIT_SERVICE_FAILURE

Shipping failure
→ APP:SHIPPING_SERVICE_FAILURE
```

Then your main handler can make different decisions. This is one reason MuleSoft explicitly recommends error mapping when otherwise-identical connector errors need to be distinguished. ([MuleSoft Documentation][1])

---

# 7.53 Error handling hierarchy

Think:

```text
component
   ↓
Try scope handler
   ↓ if propagated
Flow handler
   ↓ if propagated
calling Flow Reference / outer flow
   ↓
HTTP boundary
```

Each level should handle what it actually owns.

Don't centralize every business decision at the very top.

---

# 7.54 Retry hierarchy

Likewise:

```text
connector reconnection strategy
        ↓
Until Successful
        ↓
queue-level retry/redelivery
        ↓
business replay
```

can all exist.

Don't accidentally layer:

```text
3 connector retries
×
5 Until Successful attempts
×
10 queue redeliveries
```

and discover one bad record causes:

```text
150 downstream attempts
```

This is a very good production concern.

---

# 7.55 Interview question: "How do you handle Salesforce outages?"

Strong answer:

> “I'd classify the failure first. For transient connectivity/timeouts I'd use bounded retries with appropriate delay/backoff, ideally around a narrow idempotent operation. If retries are exhausted, I'd propagate or queue the work depending on whether the API is synchronous. I wouldn't retry validation, permissions, or schema errors. I'd also preserve correlation IDs and monitor retry exhaustion.”

Excellent.

---

# 7.56 Interview question: "When use On Error Continue?"

> “When the error has genuinely been handled and the containing scope can legitimately be considered successful—for example, an optional enrichment service fails and the API supports a degraded response.”

---

# 7.57 "When use On Error Propagate?"

> “When I want to log, transform, or classify the error locally but the caller or outer scope still needs to consider the operation failed.”

---

# 7.58 "When use Try?"

> “When a specific subset of processors needs local error semantics that differ from the rest of the flow.”

---

# 7.59 "How do you prevent retry duplicates?"

> “Use idempotent operations—such as Salesforce upsert against a stable External ID—or maintain an idempotency key/state where the downstream API doesn't naturally support idempotency. I also keep retry scopes narrow because ambiguous failures like timeouts don't tell me whether the previous write committed.”

That's one of your best interview answers.

---

# 7.60 "What happens after On Error Continue inside Try?"

> “The remainder of the Try isn't resumed. The Try is considered successfully handled and processing continues after the Try scope.”

This is a nice Mule-specific answer. ([MuleSoft Documentation][5])

---

# 7.61 Full example

Let's design our customer integration:

```text
POST /customers
      ↓
Validate
      ↓
Transform Account
      ↓

Until Successful
 ┌──────────────────┐
 │ Salesforce       │
 │ Account UPSERT   │
 └──────────────────┘
      ↓
Save Account ID
      ↓

Try
 ┌────────────────────┐
 │ Marketing API      │
 │ optional enrichment│
 │                    │
 │ on HTTP failure    │
 │ On Error Continue  │
 └────────────────────┘
      ↓
Response
```

Flow-level handler:

```text
Validation failure
→ 400

Salesforce retry exhausted
→ 503

Unexpected error
→ 500
```

All responses include:

```text
correlationId
```

This is a credible production design.

---

# 7.62 But improve it further

Ask:

> Should a synchronous user request really wait while Salesforce retries several times?

Maybe:

```text
yes
```

if latency expectations allow.

Maybe better:

```text
POST /customers
 ↓
validate
 ↓
queue request
 ↓
202 Accepted
```

Then worker retries Salesforce independently.

That distinction—**synchronous error recovery vs asynchronous processing**—is exactly what we'll cover later.

---

# 7.63 Developer error-handling checklist

Whenever you add an external call, ask:

```text
What can fail?

Is failure transient or permanent?

Did failure definitely mean nothing was committed?

Can I safely retry?

How many attempts?

What delay/backoff?

What happens after retries exhaust?

Does caller need immediate failure?

Could work be queued?

Do we support partial success?

Do we need compensation?

How do we trace it?

What do we log?

What must NOT be logged?
```

If you ask those questions during the interview, you will sound much more experienced than somebody who simply knows Mule component syntax.

---

# Module 7 cheat sheet

```text
ON ERROR CONTINUE
-----------------
handled
scope considered success


ON ERROR PROPAGATE
------------------
handle locally
but remain failed
rethrow upward


TRY
---
localized error boundary


ANY
---
generic catch-all
put specific handlers first


ERROR MAPPING
-------------
connector error
→ APP/domain error


UNTIL SUCCESSFUL
----------------
synchronous retry scope
bounded attempts
MULE:RETRY_EXHAUSTED on exhaustion


RETRY RULE
----------
retry transient failures

don't blindly retry:
bad input
schema errors
permission errors
business validation


TIMEOUT
-------
does NOT prove write failed


IDEMPOTENCY
-----------
required for safe retries


CROSS-SYSTEM WRITES
-------------------
do not assume distributed rollback
design compensation/reconciliation


OBSERVABILITY
-------------
correlation ID
structured logs
no secrets / sensitive payload dumps
```

If you remember just one sentence from this module, use:

> **“A timeout is an ambiguous outcome, so I design retries together with idempotency rather than assuming the downstream write failed.”**

That's an excellent integration-developer talking point.

**Next should be Module 8: Configuration and Security** — properties by environment, secure configuration properties, OAuth credentials, External Client Apps/connected-app concepts, TLS, secret management, and how to keep dev/QA/prod Mule deployments identical except for configuration.

[1]: https://docs.mulesoft.com/mule-runtime/4.4/intro-error-handlers?utm_source=chatgpt.com "Introduction to Mule 4: Error Handlers | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/mule-runtime/latest/on-error-scope-concept?utm_source=chatgpt.com "On-Error Components | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/anypoint-code-builder/acb-component-error-handler?utm_source=chatgpt.com "Error Handler (<error-handler/>) | MuleSoft Documentation"
[4]: https://docs.mulesoft.com/mule-runtime/4.6/try-scope-xml-reference?utm_source=chatgpt.com "Try Scope XML Reference | MuleSoft Documentation"
[5]: https://docs.mulesoft.com/mule-runtime/4.4/try-scope-concept?utm_source=chatgpt.com "Try Scope | MuleSoft Documentation"
[6]: https://docs.mulesoft.com/mule-runtime/latest/until-successful-scope?utm_source=chatgpt.com "Until Successful Scope | MuleSoft Documentation"
[7]: https://docs.mulesoft.com/mule-runtime/4.9/transaction-management?utm_source=chatgpt.com "Transaction Management | MuleSoft Documentation"
