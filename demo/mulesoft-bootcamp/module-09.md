# Module 9 — API-Led Architecture

This is very interview-heavy because MuleSoft uses the term **API-led connectivity** constantly.

The classic three layers are:

```text
Experience API
      ↓
Process API
      ↓
System API
```

The goal is to avoid brittle point-to-point integrations and create reusable boundaries around systems and business processes.

---

## 9.1 Start with the problem API-led architecture solves

Bad architecture:

```text
Web App ─────→ Salesforce
Mobile App ──→ Salesforce
Partner App ─→ Salesforce
Billing ─────→ Salesforce
Support ─────→ Salesforce
```

Then later:

```text
Salesforce field changes
```

and suddenly five integrations break.

Worse:

```text
Web App → Salesforce
Web App → Billing
Web App → ERP
Web App → Marketing
```

Now every consumer understands every backend system.

That's tight coupling.

API-led architecture inserts reusable abstraction layers.

---

# 9.2 The three layers

Think:

```text
Experience API
    "What does this consumer need?"

Process API
    "What business process are we implementing?"

System API
    "How do we talk to this backend system?"
```

That is the simplest useful definition.

---

# 9.3 System API

A **System API** wraps a backend system.

Examples:

```text
Salesforce System API
SAP System API
Billing System API
Customer DB System API
```

Its job is to hide backend-specific details.

For Salesforce:

```text
Consumer
   ↓
Salesforce System API
   ↓
Salesforce Connector
   ↓
Salesforce
```

Instead of making every other Mule application know:

```text
SOQL
Account
Contact
__c fields
Salesforce IDs
OAuth details
Salesforce error formats
```

the System API exposes a cleaner internal contract.

---

# 9.4 Example Salesforce System API

Backend:

```text
Salesforce Account
```

with fields:

```text
Id
External_Customer_ID__c
Name
BillingState
Customer_Status__c
```

System API might expose:

```http
GET /customers/{customerId}
```

Response:

```json
{
  "customerId": "C001",
  "name": "Acme",
  "state": "FL",
  "status": "ACTIVE"
}
```

Internally it runs:

```sql
SELECT
    Id,
    Name,
    BillingState,
    Customer_Status__c
FROM Account
WHERE External_Customer_ID__c = :customerId
```

The caller doesn't care.

That's abstraction.

---

# 9.5 Why this is useful

Suppose Salesforce changes:

```text
Customer_Status__c
```

to:

```text
Lifecycle_Status__c
```

Without abstraction:

```text
10 consumers need changes
```

With a System API:

```text
Salesforce System API changes internally

consumers still call:
GET /customers/C001
```

Much better.

---

# 9.6 System APIs should be system-oriented

A System API shouldn't usually contain giant business workflows.

Good:

```text
get customer
upsert customer
get contacts
create case
query opportunities
```

Less good:

```text
approve mortgage
calculate customer eligibility
orchestrate five systems
```

Those belong at another layer.

Think:

> System API = reusable access layer to a system of record.

---

# 9.7 Process API

A **Process API** implements business orchestration.

Example business requirement:

> Build a customer profile using Salesforce, billing, and loyalty data.

Architecture:

```text
Customer Profile Process API
         ↓
   ┌─────┼─────┐
   ↓     ↓     ↓
SF API Billing Loyalty
```

The Process API decides:

```text
which systems to call
in what order
how to combine data
what business rules apply
what happens on partial failures
```

This is where orchestration typically lives.

---

# 9.8 Example Process API

Request:

```http
GET /customer-profile/C001
```

Process API:

```text
receive customerId
      ↓
Scatter-Gather
 ┌────┼────────┐
 ↓    ↓        ↓
Salesforce   Billing   Loyalty
System API  System API System API
 └────┼────────┘
      ↓
DataWeave aggregation
      ↓
response
```

Result:

```json
{
  "customerId": "C001",
  "name": "Acme",
  "balance": 4320.50,
  "loyaltyLevel": "Gold"
}
```

The process layer is where the business view is assembled.

---

# 9.9 Process APIs hide orchestration

The consumer should not need to know:

```text
first call Salesforce
then Billing
then Loyalty
then merge responses
```

It simply asks:

```text
GET /customer-profile/C001
```

That is exactly the benefit.

---

# 9.10 Experience API

An **Experience API** adapts data and behavior for a particular consumer experience.

Examples:

```text
Mobile Experience API

Web Experience API

Partner Experience API

Call Center Experience API
```

Different consumers may need different data shapes even if they rely on the same underlying business process.

---

# 9.11 Example

Process API returns:

```json
{
  "customerId": "C001",
  "name": "Acme Corporation",
  "billingBalance": 1234.56,
  "accountStatus": "ACTIVE",
  "contacts": [
    ...
  ],
  "opportunities": [
    ...
  ]
}
```

Mobile app only needs:

```json
{
  "name": "Acme",
  "balance": 1234.56,
  "status": "ACTIVE"
}
```

Mobile Experience API:

```text
Process API response
       ↓
DataWeave
       ↓
mobile-specific response
```

---

# 9.12 Why not let mobile call Process API directly?

Sometimes it absolutely can.

This is important.

Do **not** treat the three layers as mandatory bureaucracy.

If:

```text
one consumer
simple contract
no meaningful consumer-specific adaptation
```

then:

```text
Experience API
```

may add little value.

A mature answer is:

> “I see System, Process, and Experience APIs as separation-of-concerns patterns, not layers that must exist for every use case.”

That is much better than blindly repeating MuleSoft marketing terminology.

---

# 9.13 The canonical picture

Memorize this:

```text
           MOBILE
              │
              ↓
      Mobile Experience API
              │
              ↓
       Customer Process API
          ┌────┼────┐
          ↓    ↓    ↓
     Salesforce Billing Loyalty
      System API APIs   API
          ↓
     Salesforce
```

Now you can explain the whole model.

---

# 9.14 Another example: order processing

Consumers:

```text
Web storefront
Mobile app
Partner portal
```

Business process:

```text
submit order
```

Backend systems:

```text
Salesforce
Inventory
Payment
ERP
```

Architecture:

```text
Web Experience API ──┐
Mobile Experience API├→ Order Process API
Partner Experience API┘
                           │
              ┌────────────┼─────────────┐
              ↓            ↓             ↓
        Salesforce       Inventory     Payment
        System API       System API    System API
```

That's a very clean example for interviews.

---

# 9.15 What belongs where?

A useful decision table:

| Concern                      | Layer          |
| ---------------------------- | -------------- |
| Salesforce SOQL              | System API     |
| Salesforce field mappings    | System API     |
| Salesforce connector auth    | System API     |
| Combine Salesforce + Billing | Process API    |
| Business eligibility rules   | Process API    |
| Mobile-specific response     | Experience API |
| Partner-specific field names | Experience API |

This distinction is worth memorizing.

---

# 9.16 Salesforce System API should hide Salesforce IDs where possible

Suppose Process API only understands:

```text
customerId = C001
```

It ideally shouldn't care that Salesforce internally uses:

```text
0018X00001ABC
```

System API can translate:

```text
C001
↓
External_Customer_ID__c
↓
Salesforce Id
```

That keeps Salesforce details contained.

---

# 9.17 Hide Salesforce field names too

Bad Process API logic:

```text
payload.Customer_Status__c
payload.External_Customer_ID__c
```

Now Process API understands Salesforce schema.

Better Salesforce System API output:

```json
{
  "customerId": "C001",
  "status": "ACTIVE"
}
```

Now Salesforce field changes stay inside:

```text
Salesforce System API
```

This is one of the clearest examples of decoupling.

---

# 9.18 Error normalization at System API boundary

Salesforce might return:

```text
SALESFORCE:INVALID_INPUT
```

The System API could translate it into:

```text
APP:CUSTOMER_VALIDATION_ERROR
```

or standardized response:

```json
{
  "code": "CUSTOMER_INVALID"
}
```

Then Process API doesn't need Salesforce-specific error knowledge.

Again:

```text
backend semantics
↓
normalized system boundary
```

---

# 9.19 Don't over-hide useful backend capabilities

There's also a tradeoff.

Suppose System API becomes so generic that every Salesforce capability gets reduced to:

```text
POST /execute
```

with arbitrary input.

You've lost useful abstraction.

Good APIs are not:

```text
generic tunnel into backend
```

They expose meaningful reusable operations.

---

# 9.20 Reuse is the major goal

Suppose three processes need customer data:

```text
Order Process API
Case Process API
Billing Process API
```

Instead of each implementing:

```text
Salesforce Connector
SOQL
OAuth
error handling
mapping
```

they all call:

```text
Customer Salesforce System API
```

That is real reuse.

---

# 9.21 But reuse has a cost

If every internal call becomes:

```text
Process API
↓ HTTP
System API
↓ Salesforce
```

you add:

```text
latency
network failure possibilities
deployment dependencies
operational complexity
versioning needs
```

So again:

> Reuse must justify the extra distributed-service boundary.

This is exactly the nuance interviewers like from senior candidates.

---

# 9.22 System API as separate deployable app vs reusable subflow

This is an architectural question.

Suppose only one Mule application talks to Salesforce.

You could build:

```text
customer-app
    ↓
salesforce-subflow
```

instead of deploying:

```text
customer-process-api
      ↓ HTTP
salesforce-system-api
```

Why?

Because separate APIs introduce operational overhead.

A System API becomes more compelling when:

```text
multiple consumers need it
independent lifecycle matters
central security/policy is useful
reusability matters
backend complexity deserves isolation
```

---

# 9.23 Interview trap: “Should every Salesforce call go through a System API?”

Don't answer:

> Yes.

Better:

> “If Salesforce is a shared system of record used by multiple processes, a Salesforce System API is a strong reusable boundary. If one simple application is the only consumer, splitting it into another network service may be unnecessary. I'd use the API-led layers where they create real reuse and decoupling.”

Excellent answer.

---

# 9.24 API-led vs point-to-point

Point-to-point:

```text
System A → System B
System A → System C
System D → System B
System D → System C
```

As systems grow:

```text
number of integrations explodes
```

API-led tries to turn:

```text
N × M integrations
```

into reusable interfaces.

Example:

```text
        Process A
        Process B
        Process C
            │
            ↓
   Salesforce System API
            ↓
       Salesforce
```

Much easier to govern.

---

# 9.25 API-led doesn't eliminate point-to-point internally

Important nuance:

Eventually something still calls:

```text
Salesforce API
```

So API-led architecture doesn't magically eliminate integration connections.

It organizes them into stable reusable boundaries.

---

# 9.26 API contract matters more than implementation

System API contract:

```http
GET /customers/{id}
```

could internally use:

```text
Salesforce today
```

and someday:

```text
Dynamics tomorrow
```

Consumers shouldn't need to change if contract semantics remain stable.

That's the abstraction promise.

---

# 9.27 API specification

In MuleSoft environments you'll commonly encounter:

```text
RAML
OpenAPI
```

for API contracts.

Example:

```yaml
/customers/{customerId}:
  get:
    responses:
      200:
        body:
          application/json:
```

The contract defines:

```text
paths
methods
request schema
response schema
status codes
```

Then Mule implementation fulfills it.

Since you already know OpenAPI from testing, treat this as the same contract-first principle applied to Mule development.

---

# 9.28 API-first development

A good workflow can be:

```text
define API contract
      ↓
review with consumers
      ↓
generate/scaffold implementation
      ↓
implement Mule flows
      ↓
test against contract
```

rather than:

```text
build random Mule flow
      ↓
later invent API shape
```

This improves consumer/provider alignment.

---

# 9.29 APIKit

You may hear:

```text
APIKit
```

In MuleSoft, APIKit can help generate routing/scaffolding from an API specification.

Conceptually:

```text
OpenAPI/RAML
      ↓
APIKit router
      ↓
GET /customers
POST /customers
etc.
```

Each operation routes to the corresponding implementation flow.

You don't need to memorize APIKit XML yet.

Know what it does.

---

# 9.30 Example APIKit architecture

API spec:

```text
GET /customers/{id}
POST /customers
```

Mule:

```text
HTTP Listener
      ↓
APIKit Router
   ┌────────────┐
   ↓            ↓
GET flow      POST flow
```

The router validates/routes requests according to the API definition.

Very common Mule pattern.

---

# 9.31 Contract validation

If OpenAPI says:

```text
customerId: required
companyName: required
```

then API boundary validation should reject invalid requests before you attempt:

```text
Salesforce Upsert
```

This connects directly to your previous API schema-validation experience.

---

# 9.32 Versioning

Suppose:

```text
GET /customers
```

response changes incompatibly.

Don't casually break consumers.

Options include:

```text
/v1/customers
/v2/customers
```

or API-management/versioning conventions.

The exact organizational approach varies.

Main principle:

> Breaking contract changes require lifecycle/version strategy.

---

# 9.33 Avoid leaking Process API internals into Experience APIs

If Process API exposes:

```json
{
  "salesforce": {...},
  "billing": {...},
  "loyalty": {...}
}
```

you may simply be forwarding backend structure.

Better:

```json
{
  "customerId": "C001",
  "availableCredit": 12000,
  "accountHealth": "GOOD"
}
```

if that's the business concept consumers actually need.

Process API should model a process/domain view, not merely concatenate raw downstream payloads.

---

# 9.34 System API granularity

Too fine-grained:

```text
GET /account-name
GET /account-phone
GET /account-city
```

Then consumers need three calls.

Too coarse:

```text
GET /dump-entire-salesforce-account
```

with 300 fields.

Better:

```text
GET /customers/{id}
```

with an intentionally designed resource representation.

API design fundamentals still apply.

---

# 9.35 Process API granularity

Bad:

```text
POST /doEverything
```

Good:

```text
POST /orders
POST /customer-onboarding
POST /claims/{id}/approve
```

Model actual business capabilities.

---

# 9.36 Experience APIs may perform presentation-oriented transformation

Example:

Process API:

```json
{
  "firstName": "John",
  "lastName": "Smith",
  "accountBalance": 12742.15,
  "currency": "USD"
}
```

Mobile Experience API:

```json
{
  "displayName": "John Smith",
  "balance": {
    "value": 12742.15,
    "currency": "USD"
  }
}
```

That's consumer adaptation.

---

# 9.37 Don't put core business rules in Experience API

Bad:

```text
Mobile Experience API
decides customer credit eligibility
```

Now:

```text
Web API may implement different rule
```

Better:

```text
Credit Process API
```

owns the business rule.

Experience APIs adapt presentation/consumer needs.

---

# 9.38 Reuse example

Suppose both:

```text
Mobile onboarding
Branch onboarding
```

need:

```text
customer eligibility
```

Correct:

```text
Mobile Experience API ─┐
                       ├→ Onboarding Process API
Branch Experience API ─┘
```

Don't duplicate business logic in each Experience API.

---

# 9.39 An interview scenario

> We have Salesforce, SAP, and a billing platform. Mobile and web both need a unified customer view. How would you structure it?

Good answer:

```text
Mobile Experience API
Web Experience API
        ↓
Customer Profile Process API
        ↓
 ┌──────┼───────┐
 ↓      ↓       ↓
Salesforce SAP Billing
System API API API
```

Then explain:

> “The System APIs isolate backend-specific connectors, schemas, and authentication. The Process API orchestrates and normalizes the unified customer view. Experience APIs adapt that view where mobile and web contracts genuinely differ.”

Excellent.

---

# 9.40 Another scenario

> Only one internal application talks to Salesforce. Should we create System, Process, and Experience APIs?

Answer:

> “Probably not automatically. If there is no real reuse or consumer-specific need, three deployable services can be unnecessary complexity. I'd still separate concerns cleanly in code, but I wouldn't create network boundaries just to satisfy the three-layer diagram.”

That answer will distinguish you from somebody repeating a training course.

---

# 9.41 Performance concern

Three layers can mean:

```text
Experience
  ↓ network
Process
  ↓ network
System
  ↓ network
Salesforce
```

Every hop adds:

```text
latency
serialization
TLS
failure possibilities
observability needs
```

So architecture should consider SLAs.

Sometimes an Experience API can call a System API directly if no process orchestration is required.

---

# 9.42 Experience → System directly?

Yes, potentially.

Example:

Mobile needs simply:

```text
GET customer contact information
```

No business process.

Architecture:

```text
Mobile Experience API
       ↓
Customer System API
```

You don't need:

```text
empty Process API
```

sitting between them.

Again, three layers are conceptual separation—not mandatory hop count.

---

# 9.43 Process → multiple Process APIs?

Also possible.

Large business domains may compose processes:

```text
Order Process API
      ↓
Payment Process API
      ↓
Fulfillment Process API
```

But watch for excessive distributed call chains.

---

# 9.44 APIs vs messaging

API-led doesn't mean:

> Everything must use synchronous HTTP.

A Process API might:

```text
accept request
↓
publish event to queue
↓
return 202
```

System integrations may consume events.

So:

```text
API-led
```

and:

```text
event-driven
```

can coexist.

We'll dig into this in Module 10.

---

# 9.45 API Management

MuleSoft's Anypoint Platform can apply policies around APIs such as:

```text
authentication
rate limiting
client access
logging
analytics
governance
```

So API boundaries are useful not only for code reuse but also for centralized management.

You don't need to become an Anypoint API Manager expert for this interview.

Recognize the role.

---

# 9.46 System API security

Suppose the Salesforce System API is internal.

Don't assume:

```text
internal = no security
```

You may still need:

```text
client authentication
authorization
rate limits
network restrictions
auditing
```

because internal consumers can cause plenty of damage.

---

# 9.47 Process API shouldn't pass Salesforce auth through

Bad architecture:

```text
Mobile
 ↓ Salesforce token
Experience API
 ↓
Process API
 ↓
System API
 ↓
Salesforce
```

The consumer shouldn't normally need backend credentials.

The System API owns its Salesforce authentication.

That's another decoupling benefit.

---

# 9.48 Fault isolation

Suppose Salesforce fails.

System API can expose normalized failure:

```text
CUSTOMER_SYSTEM_UNAVAILABLE
```

Process API can decide:

```text
customer profile cannot be built
```

or:

```text
return degraded response using billing only
```

Experience API can decide how to present that.

Each layer owns appropriate semantics.

---

# 9.49 Observability across API layers

If a request traverses:

```text
Experience
↓
Process
↓
System
↓
Salesforce
```

you need one trace/correlation ID propagated through all of them.

Otherwise debugging becomes:

> “We saw an error somewhere around 2 PM.”

Instead:

```text
correlationId = abc-123
```

appears in logs across each layer.

This ties directly to Module 7.

---

# 9.50 Don't create a “distributed monolith”

You can architect 30 Mule APIs that are technically separate but where:

```text
API A can't deploy without B
B can't deploy without C
C can't operate without D
```

and every request traverses ten services.

That's a distributed monolith.

So APIs should have meaningful:

```text
ownership
contracts
reuse
independent lifecycle
```

not just separate deployment packages.

---

# 9.51 Testing each layer

### System API tests

Focus:

```text
Salesforce connector
SOQL
field mappings
backend errors
permissions
```

### Process API tests

Focus:

```text
business rules
orchestration
multi-system combinations
partial failures
```

### Experience API tests

Focus:

```text
consumer contract
presentation mapping
consumer-specific authorization
```

Then end-to-end tests cover the full path selectively.

This is especially useful given your automation role.

---

# 9.52 Don't make every automated test end-to-end

Bad:

```text
all tests:
Mobile API
↓ Process
↓ System
↓ Salesforce
↓ Billing
↓ ERP
```

Slow, brittle, hard to diagnose.

Better testing pyramid:

```text
many:
MUnit/unit/component tests

many:
API contract tests

some:
integration tests against real Salesforce sandbox

fewer:
full end-to-end workflows
```

We'll formalize this in the MUnit/testing modules.

---

# 9.53 Contract testing between layers

Suppose:

```text
Process API expects System API response:
{
  customerId,
  status
}
```

System API team changes:

```text
status
```

to:

```text
customerStatus
```

Even if System API tests pass, Process breaks.

Contract validation/testing catches this.

Your OpenAPI background translates directly here.

---

# 9.54 API-led connectivity interview definition

If asked:

> “What is API-led connectivity?”

Use:

> “It's a way of organizing integrations around reusable API boundaries rather than direct point-to-point connections. System APIs abstract systems of record, Process APIs implement business orchestration across systems, and Experience APIs adapt capabilities for particular consumers. I treat those as separation-of-concerns patterns rather than forcing all three layers into every use case.”

That's an excellent answer.

---

# 9.55 “What's a System API?”

> “A reusable boundary around a backend system that hides system-specific schemas, authentication, query language, connector behavior, and error details.”

---

# 9.56 “What's a Process API?”

> “It implements business logic and orchestration, often combining multiple System APIs into a business capability.”

---

# 9.57 “What's an Experience API?”

> “It adapts APIs to the needs of a particular consumer or channel—mobile, web, partner, and so on—without duplicating core business logic.”

---

# 9.58 “Does every application need all three?”

> “No. I'd only introduce separate deployable layers where they provide useful reuse, decoupling, governance, consumer adaptation, or independent lifecycle. Otherwise they add latency and operational complexity.”

That's probably the most important nuance in the entire module.

---

# Module 9 cheat sheet

```text
SYSTEM API
==========
backend abstraction

Salesforce
SAP
database
billing

owns:
connector
authentication
SOQL
backend schema mapping
backend error normalization


PROCESS API
===========
business orchestration

combines systems
owns business rules
handles workflow


EXPERIENCE API
==============
consumer adaptation

mobile
web
partner
call center


CLASSIC MODEL
=============

Experience
    ↓
Process
    ↓
System
    ↓
backend


BUT:
not every use case needs 3 hops.


GOOD ARCHITECTURE
=================

Salesforce details stay
inside Salesforce System API

Business rules stay
inside Process API

Consumer-specific formatting stays
inside Experience API


MAIN GOAL
=========

reuse
decoupling
stable contracts
governance


MAIN RISK
=========

too many layers
latency
distributed monolith
unnecessary operational complexity
```

The one sentence to remember:

> **“System APIs hide backend details, Process APIs own business orchestration, and Experience APIs adapt capabilities to consumers—but I wouldn't create all three layers unless the separation creates real value.”**

Next is **Module 10: synchronous vs asynchronous integrations**—HTTP request/response, schedulers, queues, event-driven flows, Salesforce Platform Events/CDC, polling, retries, DLQs, eventual consistency, and how to decide whether an integration should respond immediately or finish later.
