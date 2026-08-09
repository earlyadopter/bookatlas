Yes. The goal in two days is **not** to become a MuleSoft architect. It is to become dangerous enough that, when somebody says:

> “We need to receive this payload, transform it, look up something in Salesforce, upsert records, handle partial failures, and expose the result through an API,”

you know exactly how you would build it and can discuss the tradeoffs.

Your testing background is actually an advantage because a Mule integration is essentially a programmable pipeline of inputs → transformations → calls → decisions → outputs, with a lot of observable intermediate state. ([MuleSoft Documentation][1])

## Two-day MuleSoft → Salesforce Developer Bootcamp

### DAY 1 — “I can build a Mule integration”

| Module | Topic                        | You need to be able to…                                                                                    |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **1**  | MuleSoft mental model        | Explain Mule Runtime, applications, flows, subflows, events, payload, attributes, variables and connectors |
| **2**  | Anatomy of a Mule flow       | Build `HTTP Listener → Transform → Salesforce → Transform → HTTP response`                                 |
| **3**  | DataWeave 2.0                | Transform realistic JSON/XML/CSV/Salesforce structures                                                     |
| **4**  | Salesforce Connector         | Query, create, update, upsert and delete Salesforce objects                                                |
| **5**  | SOQL + Salesforce data model | Work intelligently with Account, Contact, Opportunity and custom objects                                   |
| **6**  | Routing/orchestration        | Use Choice, For Each, Parallel For Each, Scatter-Gather and subflows                                       |
| **7**  | Error handling               | Handle Salesforce/API errors without turning every problem into HTTP 500                                   |
| **8**  | Configuration/security       | Properties, secrets, Salesforce authentication and environment configuration                               |

### DAY 2 — “I can build it like a production developer”

| Module | Topic                              | You need to be able to…                                                         |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| **9**  | API-led architecture               | Explain System / Process / Experience APIs and when they make sense             |
| **10** | Sync vs async integrations         | Understand request/response, polling, queues, events and batch processing       |
| **11** | Bulk Salesforce integration        | Know when normal operations stop scaling and Bulk API becomes appropriate       |
| **12** | Idempotency & duplicate prevention | Safely retry integrations without creating duplicate Salesforce records         |
| **13** | MUnit                              | Unit/integration test Mule flows, mock connectors, verify calls and assertions  |
| **14** | End-to-end automation              | Test Mule → Salesforce from Playwright/API automation                           |
| **15** | Deployment & operations            | Understand Maven, CloudHub 2.0, Runtime Manager, logs and environment promotion |
| **16** | Production engineering             | Timeouts, retries, API limits, correlation IDs, logging and observability       |
| **17** | Interview system-design scenarios  | Design integrations on the whiteboard                                           |
| **18** | Interview coding scenarios         | Read/build DataWeave and Mule XML without looking lost                          |

And we'll finish with a **one-screen interview cheat sheet**.

---

# Module 1 — MuleSoft Mental Model

Forget the marketing terminology initially.

Think of MuleSoft as:

> **A server that runs integration pipelines.**

A Mule application receives something from system A, manipulates it, talks to systems B/C/D, makes decisions, and produces some result.

Mule Runtime Engine is the execution engine. Mule applications provide message routing, mapping, orchestration, security, reliability and connectivity between systems. ([MuleSoft Documentation][1])

A typical integration might be:

```text
Client
   ↓
HTTP API
   ↓
MuleSoft
   ↓
Validate request
   ↓
Transform data
   ↓
Query Salesforce
   ↓
Decision
 ┌─────────────┐
 exists?       doesn't exist?
 ↓             ↓
Update       Create
 └──────┬──────┘
        ↓
Transform response
        ↓
Client
```

In MuleSoft that pipeline is generally called a **flow**.

---

# 1. Mule Application

One deployable Mule project is a **Mule application**.

Imagine this repository:

```text
customer-salesforce-integration/
│
├── pom.xml
├── mule-artifact.json
│
└── src/
    └── main/
        ├── mule/
        │   ├── customer-api.xml
        │   ├── salesforce.xml
        │   └── global.xml
        │
        └── resources/
            ├── dev.yaml
            ├── qa.yaml
            └── prod.yaml
```

The important idea:

```text
repository/project
       ↓
Mule application
       ↓
contains flows
       ↓
flows contain processors
```

Very similar conceptually to:

```text
Playwright project
    ↓
spec files
    ↓
tests
    ↓
steps
```

---

# 2. Flow

A Mule flow is an executable sequence of components.

Example:

```text
HTTP Listener
      ↓
Transform Message
      ↓
Salesforce Query
      ↓
Choice
      ↓
Salesforce Upsert
      ↓
Transform Message
```

Conceptually:

```javascript
async function createCustomer(request) {

    const customer = transformRequest(request);

    const existing =
        await salesforce.query(customer.email);

    if (existing) {
        return await salesforce.update(customer);
    } else {
        return await salesforce.create(customer);
    }
}
```

Mule represents this graphically in Anypoint Studio/Code Builder and underneath as XML.

Something approximately like:

```xml
<flow name="customer-flow">

    <http:listener
        config-ref="HTTP_Listener"
        path="/customers"/>

    <ee:transform>
       ...
    </ee:transform>

    <salesforce:query
        config-ref="Salesforce_Config">
       ...
    </salesforce:query>

</flow>
```

Don't be intimidated by the XML.

**The XML is simply configuration describing the pipeline.**

---

# 3. Processor

Every box inside the flow is basically a **message processor**.

Examples:

```text
HTTP Listener
Transform Message
Logger
Set Variable
Salesforce Query
Salesforce Upsert
Choice
For Each
HTTP Request
Database Select
```

Think:

```text
input
  ↓
processor
  ↓
modified Mule event
  ↓
next processor
```

---

# 4. Mule Event

This is one of the most important Mule concepts.

Data moves through a Mule flow as a **Mule Event**.

Mentally picture:

```text
Mule Event
│
├── message
│     ├── payload
│     └── attributes
│
└── variables
```

If you remember that structure, a surprising amount of Mule code starts making sense.

---

# 5. `payload`

This will probably be the thing you reference most frequently.

`payload` means:

> **the current body/data being processed.**

For an incoming request:

```http
POST /customers

{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com"
}
```

Initially:

```text
payload =
{
    firstName: "John",
    lastName: "Smith",
    email: "john@example.com"
}
```

Then you execute Salesforce Query.

Suddenly:

```text
payload =
[
   {
      Id: "003ABC...",
      Email: "john@example.com"
   }
]
```

Why?

Because **many Mule processors replace the payload with their result**.

This is extremely important when writing integrations.

---

# 6. `attributes`

Attributes describe metadata associated with the message.

For an HTTP request, attributes might contain:

```text
attributes.method
attributes.requestPath
attributes.queryParams
attributes.headers
attributes.uriParams
```

Example:

```http
GET /customers/123?details=true
Authorization: Bearer abc
```

You might access:

```dataweave
attributes.uriParams.id

attributes.queryParams.details

attributes.headers.authorization
```

So:

```text
payload    = request BODY
attributes = request METADATA
```

That distinction is worth memorizing.

---

# 7. `vars`

Variables let you preserve information while the payload changes.

This solves the problem I just described.

Imagine:

```text
Original request
       ↓
Salesforce Query
       ↓
payload now contains query result
```

But you still need the original request.

Before querying Salesforce:

```text
Set Variable
customer = payload
```

Then later:

```text
vars.customer
```

still contains:

```json
{
  "firstName": "John",
  "lastName": "Smith"
}
```

even though:

```text
payload
```

contains the Salesforce query response.

### Interview phrase

A very good sentence to use:

> “Since connector operations frequently replace the current payload with their result, I use variables to preserve data that I'll need later in the flow rather than relying on payload remaining unchanged.”

That sounds like somebody who has actually built Mule applications.

---

# 8. DataWeave

Whenever you see:

```text
%dw 2.0
```

you're looking at **DataWeave**, MuleSoft's transformation language.

Example input:

```json
{
  "firstName": "Yourname",
  "lastName": "Yoursurname",
  "email": "yourname@example.com"
}
```

Salesforce expects:

```json
{
  "FirstName": "Yourname",
  "LastName": "Yoursurname",
  "Email": "yourname@example.com"
}
```

DataWeave:

```dataweave
%dw 2.0
output application/json
---
{
    FirstName: payload.firstName,
    LastName: payload.lastName,
    Email: payload.email
}
```

This language is **critical**.

If you have only enough time to learn one Mule-specific technical skill deeply, make it DataWeave.

We are going to spend substantial time on it in Module 3.

---

# 9. Connector

Connectors are effectively adapters/SDKs for external systems.

Instead of manually writing:

```text
POST https://salesforce.com/services/...
Authorization: Bearer ...
```

you configure the Salesforce connector and use:

```text
Salesforce Query
Salesforce Create
Salesforce Update
Salesforce Upsert
```

Likewise there are connectors for things such as:

```text
HTTP
Salesforce
Database
SFTP
Amazon S3
Kafka
JMS
Email
etc.
```

The Salesforce connector exposes Salesforce APIs through Mule operations. The current Salesforce Connector documentation includes operations such as query, create, update, upsert, Bulk API V2 jobs and many others. ([MuleSoft Documentation][2])

---

# 10. Source vs processor

A useful distinction.

Something needs to **start** the flow.

That's its source/trigger.

For example:

```text
HTTP Listener
Scheduler
Salesforce event
Queue listener
File listener
```

Then processors execute afterward.

Example:

```text
SOURCE
HTTP Listener
     ↓
PROCESSOR
Transform
     ↓
PROCESSOR
Salesforce Query
     ↓
PROCESSOR
Logger
```

---

# 11. Flow vs Subflow

You will encounter both.

### Flow

Can have an event source:

```text
HTTP Listener
Scheduler
etc.
```

### Subflow

Reusable internal sequence of processors.

For example:

```text
customer-flow
   ↓
validate-customer-subflow
   ↓
salesforce-customer-subflow
```

You might create:

```text
subflow: upsert-salesforce-account
```

and call it from multiple flows.

Think of a subflow approximately like a reusable function.

```typescript
async function upsertSalesforceAccount(customer) {
   ...
}
```

---

# 12. A realistic integration

Suppose your application receives:

```http
POST /customers
```

with:

```json
{
  "customerId": "C92834",
  "name": "Acme Corporation",
  "email": "info@acme.com"
}
```

The Mule implementation could be:

```text
HTTP Listener
      ↓
Validate request
      ↓
Set Variable
vars.originalCustomer
      ↓
Transform Message
      ↓
Salesforce Upsert Account
      ↓
Transform Message
      ↓
HTTP 201
```

DataWeave prepares:

```json
{
  "External_Customer_ID__c": "C92834",
  "Name": "Acme Corporation"
}
```

And Salesforce might return:

```json
{
  "id": "0018X000012345",
  "success": true
}
```

Then Mule transforms that into your public API contract:

```json
{
  "customerId": "C92834",
  "salesforceId": "0018X000012345",
  "status": "created"
}
```

Notice something architecturally important:

**The consumer shouldn't necessarily know what Salesforce's response looks like.**

Mule provides an abstraction boundary.

---

# 13. Why `upsert` matters so much

You should expect this to come up.

Suppose the integration runs twice.

Using Salesforce `create`:

```text
run #1 → Account created

run #2 → Another Account created
```

Oops.

Instead you have:

```text
External_Customer_ID__c
```

configured as an external ID.

Then:

```text
upsert
using External_Customer_ID__c
```

means:

```text
does C92834 exist?

YES → update
NO  → insert
```

MuleSoft's current Salesforce Connector documentation specifically recommends upsert over create in many scenarios to avoid unwanted duplicate records. ([MuleSoft Documentation][2])

This leads into a major integration-development concept we'll cover later:

> **idempotency**

Same request repeated → no unintended side effects.

Your QA instincts should immediately recognize why that's valuable.

---

# 14. MuleSoft isn't just Salesforce

Your interviewers may deliberately move away from your known scenario.

For example:

```text
HTTP
 ↓
Mule
 ↓
PostgreSQL
 ↓
Mule
 ↓
Salesforce
 ↓
Mule
 ↓
Kafka
```

or:

```text
Salesforce
    ↓
Mule
 ┌──┼─────────┐
 ↓  ↓         ↓
ERP billing  Data Warehouse
```

That's why your mental model should be:

> MuleSoft orchestrates **systems**, rather than “MuleSoft sends things to Salesforce.”

---

# 15. API-led connectivity

You'll almost certainly hear this phrase.

MuleSoft encourages avoiding gigantic point-to-point integrations:

```text
App A → Salesforce
App B → Salesforce
App C → Salesforce
App D → Salesforce
```

Instead, commonly:

```text
                 Experience API
                       ↓
                  Process API
                  ↙         ↘
       Salesforce API      ERP API
            ↓                 ↓
       Salesforce            ERP
```

The conventional layers are:

```text
Experience API
     ↓
Process API
     ↓
System API
```

MuleSoft describes this API-led approach as separating application/process/system integration layers and emphasizing reuse, especially through System APIs. ([MuleSoft Documentation][3])

We'll dissect this in Module 9 because interviewers love asking about it.

---

# 16. Where MuleSoft development happens

Historically you'll hear constantly about:

**Anypoint Studio**

It's the Eclipse-based Mule IDE.

MuleSoft's newer development path also includes **Anypoint Code Builder**. MuleSoft's current official tutorial uses Code Builder to design an API, implement it, test locally, deploy it to CloudHub 2.0 and monitor it with Runtime Manager. ([MuleSoft Documentation][4])

So don't get confused if the interviewer says either:

```text
Anypoint Studio
```

or:

```text
Anypoint Code Builder
```

Your job experience may still be heavily Studio-based.

---

# 17. What runs in production?

Usually conceptually:

```text
Your Mule code
      ↓
Mule Runtime
      ↓
CloudHub / Runtime Fabric / on-prem
```

For our interview preparation, the most useful cloud scenario is:

```text
Source repository
      ↓
Maven build
      ↓
CI/CD
      ↓
CloudHub 2.0
      ↓
Runtime Manager
      ↓
logs / monitoring
```

We'll cover it on Day 2.

---

# An important 2026 interview detail

There's a recent Salesforce/MuleSoft change worth knowing because it makes you sound current.

Salesforce says creation of new traditional **Connected Apps is restricted as of Spring '26**, and recommends **External Client Apps** for new integrations. Existing Connected Apps continue working. ([Developer][5])

And MuleSoft released Salesforce Connector **12.0.0 on July 21, 2026**. It requires Java 17 and removed the OAuth Username Password connection type because Salesforce is retiring that OAuth flow. Current alternatives include OAuth 2.0, Client Credentials, JWT and SAML. ([MuleSoft Documentation][6])

You don't need to volunteer all that immediately, but if authentication comes up:

> “For a new implementation I'd expect OAuth using an External Client App rather than designing around the old username/password OAuth flow. I know Salesforce has been moving away from newly created Connected Apps and MuleSoft's latest Salesforce Connector removed its OAuth username-password connection option.”

That is a **very strong 2026 answer**.

---

# The five things to remember from Module 1

If you remember nothing else tonight:

```text
1. Mule application
   = deployable integration application

2. Flow
   = pipeline of processing steps

3. Mule Event
   = payload + attributes + variables

4. DataWeave
   = transformation language

5. Connector
   = adapter used to communicate with external systems
```

And memorize this picture:

```text
                      MULE EVENT
                          │
              ┌───────────┼───────────┐
              ↓           ↓           ↓
           PAYLOAD    ATTRIBUTES     VARS
              │
              ↓
         DataWeave
              │
              ↓
          Connector
              │
              ↓
         Salesforce
```

---

## Your end-of-bootcamp target

By the end of these two days, I want you to be comfortable solving something like this verbally and in code:

> “Build an API that receives 1–500 customer records. Validate them, map the external schema to Salesforce Account/Contact, upsert them using external IDs, preserve parent/child relationships, handle partial Salesforce failures, retry transient failures without duplicates, return useful error information, log everything with correlation IDs, and provide automated MUnit plus external API tests.”

That's sufficiently close to real MuleSoft development that you won't have to bluff your way through the interview.

### Next: Module 2 — actually building a Mule flow

We'll build a realistic **HTTP → Mule → Salesforce Account/Contact** integration and I'll show you both the graphical mental model **and the Mule XML underneath it**. Then Module 3 will be the DataWeave crash course, which is probably the single most important part of these two days.

[1]: https://docs.mulesoft.com/mule-runtime/latest/?utm_source=chatgpt.com "Mule Runtime Engine Overview | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/salesforce-connector/latest/salesforce-connector-reference?utm_source=chatgpt.com "Salesforce Connector 12.0 Reference | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/accelerators-home/simplifying-assets?utm_source=chatgpt.com "Considerations for Simplifying Accelerator Assets | MuleSoft Documentation"
[4]: https://docs.mulesoft.com/general/api-led-overview?utm_source=chatgpt.com "Tutorial: Build an API from Start to Finish | MuleSoft Documentation"
[5]: https://developer.salesforce.com/docs/platform/mobile-sdk/guide/connected-apps.html?utm_source=chatgpt.com "Connected Apps | Authentication, Security, and Identity in Mobile Apps | Mobile SDK Development Guide | Salesforce Developers"
[6]: https://docs.mulesoft.com/release-notes/connector/salesforce-connector-release-notes-mule-4?utm_source=chatgpt.com "Salesforce Connector Release Notes | MuleSoft Documentation"
