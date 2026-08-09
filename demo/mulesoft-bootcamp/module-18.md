# Module 18 — Interview Coding Scenarios

This is the final technical module: the goal is not to make you memorize all Mule XML, but to make sure you can sketch credible code and explain what every part is doing.

The most likely things they may ask you to write are:

```text
1. A basic Mule flow
2. DataWeave transformation
3. SOQL query
4. Choice routing
5. Salesforce Upsert
6. Error handling
7. A small MUnit test
8. A complete mini-integration
```

The key interview rule is:

> **If you forget exact Mule XML syntax, write structurally correct pseudocode/XML and explain the architecture clearly.**

A good interviewer should care much more that you understand what belongs where than whether you remember every namespace attribute.

---

# 18.1 Scenario 1 — Build a simple Mule API flow

Prompt:

> “Write a Mule flow that accepts a customer request and creates or updates an Account in Salesforce.”

Input:

```json
{
  "customerId": "C001",
  "companyName": "Acme Corporation",
  "phone": "305-555-1234"
}
```

You can sketch:

```xml
<flow name="create-or-update-customer">

    <http:listener
        config-ref="HTTP_Listener_Config"
        path="/customers"
        allowedMethods="POST"/>

    <set-variable
        variableName="originalCustomer"
        value="#[payload]"/>

    <ee:transform>
        <ee:message>
            <ee:set-payload>
                <![CDATA[
                %dw 2.0
                output application/java
                ---
                [{
                    External_Customer_ID__c: payload.customerId,
                    Name: payload.companyName,
                    (Phone: payload.phone)
                        if (payload.phone != null)
                }]
                ]]>
            </ee:set-payload>
        </ee:message>
    </ee:transform>

    <salesforce:upsert
        config-ref="Salesforce_Config"
        type="Account"
        externalIdFieldName="External_Customer_ID__c"/>

    <ee:transform>
        <ee:message>
            <ee:set-payload>
                <![CDATA[
                %dw 2.0
                output application/json
                ---
                {
                    customerId:
                        vars.originalCustomer.customerId,

                    salesforceId:
                        payload[0].id,

                    success:
                        payload[0].success
                }
                ]]>
            </ee:set-payload>
        </ee:message>
    </ee:transform>

</flow>
```

You do **not** need to memorize every `<ee:message>` wrapper.

Memorize the architecture:

```text
HTTP Listener
↓
save original payload
↓
DataWeave
↓
Salesforce Upsert
↓
DataWeave response
```

---

# 18.2 What to say while coding

Don't silently type.

Explain:

> “I'm preserving the inbound model before the Salesforce connector because connector operations typically replace the current payload with their result. Then I'm mapping the API contract into the Salesforce Account shape and using Upsert with a stable external ID so the operation is safe for retries and doesn't require query-before-create.”

That explanation may matter more than the XML.

---

# 18.3 Scenario 2 — DataWeave mapping

Prompt:

> “Transform this customer into Salesforce Account format.”

Input:

```json
{
  "id": "C001",
  "name": "Acme Corporation",
  "address": {
    "city": "Orlando",
    "state": "FL"
  },
  "phone": null
}
```

Write:

```dataweave
%dw 2.0
output application/java
---
{
    External_Customer_ID__c: payload.id,
    Name: payload.name,
    BillingCity: payload.address.city,
    BillingState: payload.address.state,
    (Phone: payload.phone)
        if (payload.phone != null)
}
```

If Salesforce connector expects a collection:

```dataweave
%dw 2.0
output application/java
---
[{
    External_Customer_ID__c: payload.id,
    Name: payload.name,
    BillingCity: payload.address.city,
    BillingState: payload.address.state,
    (Phone: payload.phone)
        if (payload.phone != null)
}]
```

The important thing is that you understand:

```text
payload.foo
nested access
conditional fields
application/java
```

---

# 18.4 Scenario 3 — Map an array

Prompt:

> “You receive an array of Contacts. Convert them to Salesforce Contacts.”

Input:

```json
[
  {
    "id": "P001",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com"
  },
  {
    "id": "P002",
    "firstName": "Sarah",
    "lastName": "Jones",
    "email": "sarah@example.com"
  }
]
```

Write:

```dataweave
%dw 2.0
output application/java
---
payload map (contact) -> {
    External_Contact_ID__c: contact.id,
    FirstName: contact.firstName,
    LastName: contact.lastName,
    Email: contact.email
}
```

If Account ID is already stored:

```dataweave
%dw 2.0
output application/java
---
payload map (contact) -> {
    External_Contact_ID__c: contact.id,
    FirstName: contact.firstName,
    LastName: contact.lastName,
    Email: contact.email,
    AccountId: vars.accountId
}
```

This one is worth memorizing exactly.

---

# 18.5 Scenario 4 — Filter and map

Prompt:

> “Only send active customers to Salesforce.”

Input:

```json
[
  {
    "id": "C001",
    "name": "Acme",
    "active": true
  },
  {
    "id": "C002",
    "name": "Old Corp",
    "active": false
  }
]
```

Write:

```dataweave
%dw 2.0
output application/java
---
payload
    filter (customer) -> customer.active == true
    map (customer) -> {
        External_Customer_ID__c: customer.id,
        Name: customer.name
    }
```

If they ask you:

> “What's the difference between `filter` and `map`?”

Answer:

```text
filter
→ chooses records

map
→ transforms records
```

---

# 18.6 Scenario 5 — Handle missing value

Prompt:

> “Use UNKNOWN when state is missing.”

```dataweave
%dw 2.0
output application/json
---
{
    state: payload.state default "UNKNOWN"
}
```

Memorize:

```text
default
```

It comes up constantly.

---

# 18.7 Scenario 6 — Type conversion

Input:

```json
{
  "annualRevenue": "2500000",
  "active": "true"
}
```

Transformation:

```dataweave
%dw 2.0
output application/java
---
{
    AnnualRevenue:
        payload.annualRevenue as Number,

    Active__c:
        payload.active as Boolean
}
```

Simple.

---

# 18.8 Scenario 7 — Conditional business value

Prompt:

> “Map customers with revenue over $1M to Enterprise.”

```dataweave
%dw 2.0
output application/java
---
{
    Name: payload.name,

    Customer_Type__c:
        if ((payload.revenue default 0) > 1000000)
            "Enterprise"
        else
            "Standard"
}
```

---

# 18.9 Scenario 8 — SOQL by External ID

Prompt:

> “Query the Salesforce Account for customer C001.”

Write:

```sql
SELECT
    Id,
    Name,
    Phone,
    BillingCity,
    BillingState
FROM Account
WHERE External_Customer_ID__c = :customerId
```

Then explain:

> “I'd parameterize the value rather than concatenating it into the SOQL string.”

---

# 18.10 Scenario 9 — Contact plus Account

Prompt:

> “Find active contacts and return the parent Account name.”

```sql
SELECT
    Id,
    FirstName,
    LastName,
    Email,
    Account.Id,
    Account.Name
FROM Contact
WHERE Account.Customer_Status__c = 'ACTIVE'
```

This demonstrates relationship traversal.

---

# 18.11 Scenario 10 — Account with Contacts

Prompt:

> “Retrieve Accounts and their Contacts.”

```sql
SELECT
    Id,
    Name,
    (
        SELECT
            Id,
            FirstName,
            LastName,
            Email
        FROM Contacts
    )
FROM Account
```

Remember:

```text
child → parent
Account.Name

parent → children
(SELECT ... FROM Contacts)
```

---

# 18.12 Scenario 11 — Incremental SOQL

Prompt:

> “Get Accounts changed since the previous synchronization.”

```sql
SELECT
    Id,
    Name,
    External_Customer_ID__c,
    LastModifiedDate
FROM Account
WHERE LastModifiedDate > :watermark
ORDER BY LastModifiedDate
```

Then immediately say:

> “I'd also think about equal timestamps, crashes and watermark advancement. I usually prefer a small overlap plus idempotent processing rather than assuming a perfectly gapless timestamp boundary.”

That turns a simple SQL question into a senior answer.

---

# 18.13 Scenario 12 — Choice routing

Prompt:

> “If operation is DELETE, deactivate the customer; otherwise upsert it.”

Conceptually:

```xml
<choice>

    <when expression="#[payload.operation == 'DELETE']">

        <flow-ref name="deactivate-customer"/>

    </when>

    <otherwise>

        <flow-ref name="upsert-customer"/>

    </otherwise>

</choice>
```

You can explain:

```text
Choice
≈ if / else
```

---

# 18.14 Scenario 13 — More than two Choice branches

```xml
<choice>

    <when expression="#[payload.operation == 'CREATE']">
        <flow-ref name="create-customer"/>
    </when>

    <when expression="#[payload.operation == 'UPDATE']">
        <flow-ref name="update-customer"/>
    </when>

    <when expression="#[payload.operation == 'DELETE']">
        <flow-ref name="deactivate-customer"/>
    </when>

    <otherwise>
        <raise-error
            type="APP:INVALID_OPERATION"/>
    </otherwise>

</choice>
```

But if CREATE and UPDATE can both use:

```text
Upsert
```

you should question whether separate branches are needed.

Good interview comment:

> “I wouldn't create separate CREATE and UPDATE branches if Salesforce Upsert already models the business requirement.”

---

# 18.15 Scenario 14 — Raise custom business error

Prompt:

> “Reject customers missing customerId.”

Conceptually:

```xml
<choice>

    <when expression="#[payload.customerId == null]">

        <raise-error
            type="APP:INVALID_CUSTOMER"
            description="customerId is required"/>

    </when>

</choice>
```

You can also use Mule Validation components.

The point is:

```text
business/domain error
→ APP:INVALID_CUSTOMER
```

rather than leaking a random Java exception.

---

# 18.16 Scenario 15 — On Error Continue

Prompt:

> “Loyalty service is optional. If it fails, return null.”

Conceptually:

```xml
<try>

    <http:request
        config-ref="Loyalty_API"
        path="/customers/#{vars.customerId}"/>

    <error-handler>

        <on-error-continue type="HTTP:*">

            <set-variable
                variableName="loyalty"
                value="#[null]"/>

        </on-error-continue>

    </error-handler>

</try>
```

Exact `HTTP:*` matching syntax/configuration can vary, but architecture is:

```text
Try
 ↓
optional call
 ↓
On Error Continue
 ↓
recover
```

---

# 18.17 Scenario 16 — On Error Propagate

Prompt:

> “Salesforce failure must cause the request to fail.”

Conceptually:

```xml
<error-handler>

    <on-error-propagate
        type="SALESFORCE:CONNECTIVITY">

        <logger
            level="ERROR"
            message="Salesforce unavailable"/>

    </on-error-propagate>

</error-handler>
```

Explain:

> “The handler can log or normalize the error, but Propagate keeps the flow failed.”

---

# 18.18 Scenario 17 — Error-to-HTTP mapping

A clean conceptual design:

```text
APP:INVALID_CUSTOMER
→ 400

APP:CUSTOMER_NOT_FOUND
→ 404

SALESFORCE:CONNECTIVITY
→ 503

ANY
→ 500
```

You might use:

```text
vars.httpStatus
```

and set a normalized response:

```dataweave
%dw 2.0
output application/json
---
{
    code: "CUSTOMER_SERVICE_UNAVAILABLE",
    message: "Customer service is temporarily unavailable",
    correlationId: correlationId
}
```

Do not expose raw connector internals unnecessarily.

---

# 18.19 Scenario 18 — Retry

Prompt:

> “Salesforce occasionally has temporary network failures.”

Sketch:

```xml
<until-successful
    maxRetries="3"
    millisBetweenRetries="2000">

    <salesforce:upsert ... />

</until-successful>
```

Then add the critical explanation:

> “I'd only wrap a safe/idempotent operation here. If this were a non-idempotent Create, a timeout could mean Salesforce committed but Mule never got the response.”

That sentence is more important than the XML.

---

# 18.20 Scenario 19 — Don't wrap too much in retry

Avoid:

```text
Until Successful
    Create Account
    Send Email
    Charge Payment
```

because retry could duplicate multiple side effects.

Better:

```text
smallest meaningful
idempotent retry boundary
```

If they ask why:

> “Until Successful retries the contained work, so I want the scope narrow and replay-safe.”

---

# 18.21 Scenario 20 — Parallel calls

Prompt:

> “Fetch Salesforce, Billing and Loyalty data concurrently.”

Sketch:

```xml
<scatter-gather>

    <route>
        <flow-ref name="get-salesforce-customer"/>
    </route>

    <route>
        <flow-ref name="get-billing-customer"/>
    </route>

    <route>
        <flow-ref name="get-loyalty-customer"/>
    </route>

</scatter-gather>
```

Then transform the route results.

The interview point:

```text
Scatter-Gather
=
same logical request
→ multiple independent routes
```

---

# 18.22 Scenario 21 — Parallel processing of array

Prompt:

> “Process 20 independent customer IDs concurrently.”

Conceptually:

```xml
<parallel-foreach
    collection="#[payload]">

    <flow-ref name="process-customer"/>

</parallel-foreach>
```

But say:

> “Before using Parallel For Each I'd check whether the downstream supports bulk operations and whether concurrency could cause rate limits or Salesforce record locking.”

Excellent.

---

# 18.23 Scenario 22 — For Each or DataWeave?

Prompt:

> “Convert 100 objects into another shape.”

Do not use:

```text
For Each
```

just for transformation.

Use:

```dataweave
payload map (item) -> ...
```

Use `For Each` when you need repeated **side effects/processors**.

Memorize:

```text
map
= data transformation

For Each
= repeated orchestration
```

---

# 18.24 Scenario 23 — Account then Contacts

Prompt:

> “Write pseudocode for creating/updating an Account and then Contacts.”

Write:

```text
POST /customer

Validate request

vars.original = payload

Transform Account

Salesforce Upsert Account
by External_Customer_ID__c

vars.accountId = payload[0].id

Transform:
vars.original.contacts
map Contact with AccountId = vars.accountId

Salesforce Upsert Contacts
by External_Contact_ID__c

Build response
```

That's perfectly acceptable whiteboard code.

---

# 18.25 Scenario 24 — What if Contacts partially fail?

Say:

> “I'd first clarify the API contract. If partial success is allowed, I'd capture per-contact results and return/report the failed source IDs. If Contacts are mandatory for onboarding, I'd propagate the failure but also recognize that the Account may already have committed, so recovery needs retry, reconciliation, or compensation rather than an assumed distributed rollback.”

That's the kind of follow-up they want.

---

# 18.26 Scenario 25 — APIKit

Prompt:

> “You have an OpenAPI/RAML specification. How do you connect it to Mule?”

High-level answer:

```text
HTTP Listener
↓
APIKit Router
↓
operation-specific flows
```

Example:

```text
GET /customers/{id}
→ get-customer flow

POST /customers
→ create-customer flow
```

Then:

> “I'd keep the implementation aligned with the API contract and run contract tests externally as well.”

You don't need to memorize generated flow names.

---

# 18.27 Scenario 26 — MUnit happy-path test

Prompt:

> “Write a unit test for the customer flow.”

Conceptually:

```xml
<munit:test name="customer-upsert-success">

    <munit:behavior>

        <munit-tools:mock-when
            processor="salesforce:upsert">

            <munit-tools:then-return>

                <munit-tools:payload
                    value="#[[
                        {
                            id: '001ABC',
                            success: true
                        }
                    ]]"/>

            </munit-tools:then-return>

        </munit-tools:mock-when>

    </munit:behavior>


    <munit:execution>

        <munit:set-event>
            <munit:payload
                value="#[{
                    customerId: 'C001',
                    companyName: 'Acme'
                }]"/>
        </munit:set-event>

        <flow-ref name="process-customer-flow"/>

    </munit:execution>


    <munit:validation>

        <munit-tools:assert-that
            expression="#[payload.salesforceId]"
            is="#[MunitTools::equalTo('001ABC')]"/>

        <munit-tools:verify-call
            processor="salesforce:upsert"
            times="1"/>

    </munit:validation>

</munit:test>
```

Again, exact XML details matter less than:

```text
Mock
↓
Set Event
↓
Call real flow
↓
Assert
↓
Verify
```

---

# 18.28 Scenario 27 — MUnit negative test

Prompt:

> “Test that an invalid customer does not call Salesforce.”

Conceptually:

```text
Given:
customerId missing

When:
flow executes

Then:
APP:INVALID_CUSTOMER

AND:

Salesforce Upsert
called 0 times
```

This is an especially good test.

Because:

```text
400 response
```

alone doesn't prove Salesforce wasn't already modified.

---

# 18.29 Scenario 28 — MUnit connector failure

Mock:

```text
Salesforce Upsert
→ SALESFORCE:CONNECTIVITY
```

Then verify:

```text
expected error handler runs
status/error mapping correct
```

If retry is configured:

```text
verify attempt count
```

as appropriate.

---

# 18.30 Scenario 29 — Idempotency test in TypeScript

If they shift from MUnit to your stronger area:

```typescript
test('repeated customer request does not duplicate Account', async ({ request }) => {
  const customer = {
    customerId: `IDEMP-${Date.now()}`,
    companyName: 'Acme'
  };

  const first = await request.post('/customers', {
    data: customer
  });

  expect(first.ok()).toBeTruthy();

  const second = await request.post('/customers', {
    data: customer
  });

  expect(second.ok()).toBeTruthy();

  const accounts =
    await salesforce.findAccountsByExternalId(
      customer.customerId
    );

  expect(accounts).toHaveLength(1);
});
```

And the stronger concurrency version:

```typescript
await Promise.all(
  Array.from({ length: 10 }, () =>
    request.post('/customers', {
      data: customer
    })
  )
);

const accounts =
  await salesforce.findAccountsByExternalId(
    customer.customerId
  );

expect(accounts).toHaveLength(1);
```

This is excellent interview material for you.

---

# 18.31 Scenario 30 — Async integration test

Endpoint:

```text
POST /customers
→ 202
```

Then:

```typescript
const response = await request.post('/customers', {
  data: customer
});

expect(response.status()).toBe(202);

const account = await pollUntil(
  () => salesforce.findAccount(customer.customerId),
  account => account !== null,
  { timeoutMs: 30_000 }
);

expect(account.Name).toBe(customer.companyName);
```

Explain:

> “I poll the completion condition with a bounded timeout rather than use a fixed sleep.”

---

# 18.32 Scenario 31 — Bulk design

Prompt:

> “Sketch code for importing 500,000 customers.”

Don't attempt to hand-write huge XML.

Whiteboard:

```text
Scheduler
 ↓
read delta records
 ↓
Batch Job

    Step 1:
    validate

    Step 2:
    DataWeave transform

    Step 3:
    Batch Aggregator
    ↓
    Salesforce Bulk API v2 Upsert

On Complete:
metrics + failed-record report
```

Then mention:

```text
External ID
streaming
partial failures
reconciliation
```

That is enough.

---

# 18.33 Scenario 32 — A DataWeave challenge likely to appear

Input:

```json
{
  "customers": [
    {
      "id": "C001",
      "name": " Acme ",
      "active": true,
      "revenue": "1200000"
    },
    {
      "id": "C002",
      "name": "Old Corp",
      "active": false,
      "revenue": "500000"
    }
  ]
}
```

Requirement:

> Return only active customers; trim company name; convert revenue to number; classify Enterprise over $1M.

Answer:

```dataweave
%dw 2.0
output application/json
---
payload.customers
    filter (customer) -> customer.active == true
    map (customer) -> {
        customerId: customer.id,
        name: trim(customer.name),
        revenue: customer.revenue as Number,
        type:
            if ((customer.revenue as Number) > 1000000)
                "Enterprise"
            else
                "Standard"
    }
```

This is worth practicing manually a couple of times.

---

# 18.34 Another DataWeave challenge — group by customer

Input:

```json
[
  {
    "customerId": "C001",
    "amount": 100
  },
  {
    "customerId": "C001",
    "amount": 50
  },
  {
    "customerId": "C002",
    "amount": 25
  }
]
```

High-level:

```dataweave
payload groupBy $.customerId
```

produces groups keyed by customer ID.

If they push into aggregation, you can build from there.

You don't need advanced DataWeave gymnastics unless the role explicitly emphasizes it.

---

# 18.35 What DataWeave syntax should you memorize?

These are enough for your interview:

```dataweave
%dw 2.0
output application/json
---
```

and:

```text
payload.foo

vars.foo

attributes.foo

payload map (x) -> ...

payload filter (x) -> ...

value default "..."

value as Number

if (...) ... else ...

(field: value) if (...)

array ++ array

object ++ object
```

If you know those, you can construct most common interview mappings.

---

# 18.36 What SOQL should you memorize?

These three:

### Normal lookup

```sql
SELECT Id, Name
FROM Account
WHERE External_Customer_ID__c = :customerId
```

### Child → Parent

```sql
SELECT Id, FirstName, LastName, Account.Name
FROM Contact
WHERE Account.Customer_Status__c = 'ACTIVE'
```

### Parent → Children

```sql
SELECT
    Id,
    Name,
    (
        SELECT
            Id,
            FirstName,
            LastName
        FROM Contacts
    )
FROM Account
```

That's enough to demonstrate real familiarity.

---

# 18.37 What Mule components should you be able to name without thinking?

Memorize this list:

```text
HTTP Listener

HTTP Request

Transform Message

Set Variable

Logger

Choice

For Each

Parallel For Each

Scatter-Gather

Flow Reference

Try

Until Successful

Raise Error

Salesforce Query

Salesforce Upsert

Scheduler

Batch Job

Batch Step

Batch Aggregator
```

If they describe a problem, you should be able to choose from that toolbox.

---

# 18.38 Component selection drill

### “If/else?”

```text
Choice
```

### “Repeat side-effect operation sequentially over records?”

```text
For Each
```

### “Process independent records concurrently?”

```text
Parallel For Each
```

### “Call three different systems concurrently?”

```text
Scatter-Gather
```

### “Reusable internal logic?”

```text
Subflow + Flow Reference
```

### “Localized error handling?”

```text
Try
```

### “Retry an operation?”

```text
Until Successful
```

### “Transform JSON?”

```text
DataWeave / Transform Message
```

### “Large ETL workload?”

```text
Batch Job
```

### “Large Salesforce write?”

```text
Bulk API
```

---

# 18.39 The coding-interview trap: overengineering

Prompt:

> “Take this JSON and save it as Salesforce Account.”

Don't immediately design:

```text
Experience API
↓
Kafka
↓
Process API
↓
System API
↓
Batch Job
↓
Salesforce Bulk API
```

for one record.

Start simple:

```text
Listener
↓
Transform
↓
Upsert
```

Then say what you would add for production requirements.

This shows judgment.

---

# 18.40 Another trap: underengineering

Conversely:

> “Load 2 million Accounts nightly.”

Do not say:

```text
For Each
↓
Salesforce Update
```

Recognize scale.

---

# 18.41 Another trap: exact syntax panic

If you forget whether the attribute is:

```text
externalIdFieldName
```

versus some nearby variation, don't freeze.

Say:

> “I'm writing this approximately because I'd normally let Studio/Code Builder provide connector metadata, but this is an Upsert on Account using `External_Customer_ID__c` as the external ID.”

Then continue.

That sounds normal.

Professional developers use IDE completion and documentation.

---

# 18.42 You are not expected to memorize generated XML namespaces

Mule XML often includes:

```xml
xmlns:http="..."
xmlns:salesforce="..."
xmlns:ee="..."
xmlns:munit="..."
```

Do not waste prep time memorizing these.

If someone tests namespace memorization, that's not a meaningful development skill.

Know the processors and architecture.

---

# 18.43 What to say if you've never implemented that exact Mule component

For example they ask:

> “Have you configured Salesforce CDC in Mule?”

A good answer is:

> “I've worked with the Mule-to-Salesforce integration behavior and understand CDC as an event-driven source rather than polling. I haven't personally configured that connector source from scratch, so I'd use the connector metadata/docs for the exact subscription configuration. Architecturally I'd handle replay, duplicate delivery, ordering/versioning and downstream idempotency.”

That's much better than pretending.

---

# 18.44 What to say if they ask you to write code from memory

You can frame it naturally:

> “I'll sketch the Mule structure rather than trying to reproduce every generated connector attribute from memory.”

Then write:

```text
HTTP Listener
↓
Transform Message
↓
Salesforce Upsert
↓
Transform Response
```

and fill in meaningful details.

---

# 18.45 The mini-project you should be able to build from memory

If you have time before the interview, practice exactly this one application:

```text
POST /customers
```

Input:

```json
{
  "customerId": "C001",
  "companyName": "Acme",
  "phone": "3055551234",
  "contacts": [
    {
      "contactId": "P001",
      "firstName": "John",
      "lastName": "Smith"
    }
  ]
}
```

Flow:

```text
HTTP Listener
↓
Validate
↓
Save original request
↓
Transform Account
↓
Salesforce Upsert Account
↓
Save Account ID
↓
Transform Contacts
↓
Salesforce Upsert Contacts
↓
Response
```

Add:

```text
error handler
MUnit happy path
MUnit Salesforce error
```

If you can explain/build that, most of the interview topics emerge naturally.

---

# 18.46 The corresponding DataWeave

Account:

```dataweave
%dw 2.0
output application/java
---
[{
    External_Customer_ID__c:
        payload.customerId,

    Name:
        payload.companyName,

    (Phone: payload.phone)
        if (payload.phone != null)
}]
```

Contacts after Account upsert:

```dataweave
%dw 2.0
output application/java
---
vars.originalCustomer.contacts
    map (contact) -> {
        External_Contact_ID__c:
            contact.contactId,

        FirstName:
            contact.firstName,

        LastName:
            contact.lastName,

        AccountId:
            vars.accountId
    }
```

Those two snippets are worth knowing cold.

---

# 18.47 The corresponding MUnit story

Say:

> “For the happy path, I'd set the inbound customer event, mock Salesforce Account Upsert to return a known Account ID, mock Contact Upsert, execute the real flow, assert the API response and verify both connector operations. Then I'd have separate tests for missing customer ID, Salesforce connectivity failure, Account success plus Contact failure, and invalid Salesforce data.”

That's sufficient even if they don't ask for XML.

---

# 18.48 The corresponding external test

```typescript
test('customer and contact are linked in Salesforce', async ({ request }) => {
  const customerId = `AUTO-${crypto.randomUUID()}`;
  const contactId = `CONTACT-${crypto.randomUUID()}`;

  const response = await request.post('/customers', {
    data: {
      customerId,
      companyName: 'Acme',
      contacts: [{
        contactId,
        firstName: 'John',
        lastName: 'Smith'
      }]
    }
  });

  expect(response.ok()).toBeTruthy();

  const account =
    await salesforce.getAccountByExternalId(customerId);

  const contact =
    await salesforce.getContactByExternalId(contactId);

  expect(contact.AccountId).toBe(account.Id);
});
```

That's where you can leverage your strongest coding skill if the discussion moves toward test automation.

---

# 18.49 Final interview drill: one-minute answers

If they ask:

**“What is DataWeave?”**

> Mule's transformation language. I use it to map payloads between external API models and downstream system models, as well as filter/map arrays, perform type conversions and build response objects.

**“What's a Mule Event?”**

> The data moving through the flow: message payload and attributes plus event variables.

**“Payload vs vars?”**

> Payload is the current body/result and often changes after processors; vars are named values I preserve across the event.

**“What's a flow?”**

> A sequence of Mule processors, optionally with an event source like HTTP Listener or Scheduler.

**“Why Salesforce Upsert?”**

> It combines insert/update based on a stable External ID, reducing calls and improving idempotency and concurrency behavior.

**“Choice vs Scatter-Gather?”**

> Choice selects one branch based on a condition; Scatter-Gather executes independent routes concurrently and aggregates their results.

**“On Error Continue vs Propagate?”**

> Continue handles the error and considers the containing scope successful; Propagate runs handling logic but keeps the operation failed and passes the error upward.

**“MUnit?”**

> Mule's native testing framework for setting events, mocking processors, asserting resulting event state and verifying meaningful calls.

---

# 18.50 The five snippets I would memorize

### 1. DataWeave object

```dataweave
%dw 2.0
output application/java
---
{
    External_Customer_ID__c: payload.customerId,
    Name: payload.companyName
}
```

### 2. DataWeave array

```dataweave
payload map (item) -> {
    Id__c: item.id,
    Name: item.name
}
```

### 3. SOQL

```sql
SELECT Id, Name
FROM Account
WHERE External_Customer_ID__c = :customerId
```

### 4. Choice

```text
Choice
when condition
  → flow A
otherwise
  → flow B
```

### 5. Main flow

```text
Listener
→ Validate
→ Transform
→ Salesforce Upsert
→ Transform Response
```

Everything else can be reconstructed around those.

---

# Module 18 Cheat Sheet

```text
MULE FLOW
=========

HTTP Listener
↓
Validate
↓
Set Variable
↓
Transform Message
↓
Salesforce
↓
Transform Response


DATAWEAVE
=========

payload.foo

vars.foo

map

filter

default

as Number

if / else

conditional field


SOQL
====

SELECT Id, Name
FROM Account
WHERE External_ID__c = :id


SALESFORCE
==========

Query
Create
Update
Upsert

Prefer Upsert
when stable External ID exists


ROUTING
=======

Choice
= if / else

For Each
= sequential items

Parallel For Each
= concurrent items

Scatter-Gather
= independent routes


ERROR
=====

Try
On Error Continue
On Error Propagate
Raise Error

Until Successful
= bounded retry


MUNIT
=====

Mock
↓
Set Event
↓
Flow Ref
↓
Assert
↓
Verify Call


HIGH VOLUME
===========

Mule Batch
+
Salesforce Bulk API


INTERVIEW RULE
==============

Exact XML forgotten?

Sketch structure
+
explain semantics.
```

## The most important thing for your interview

You do **not** need to impersonate someone who has spent five years hand-writing Mule XML.

What you now need to demonstrate is that if they hand you a requirement such as:

> “Receive a customer payload, transform it, upsert Account and Contacts in Salesforce, handle Salesforce outages, and test it,”

you can immediately reason:

```text
Listener
↓
validation
↓
preserve original event
↓
DataWeave
↓
Account Upsert by External ID
↓
capture Account ID
↓
Contact transformation
↓
Contact Upsert
↓
normalized response

+ typed error handling
+ bounded/idempotent retries
+ MUnit mocks
+ real-Salesforce integration tests
+ secure externalized configuration
+ CI/CD/observability
```

At this point, the highest-value next step is no longer another Mule module. It is a **1–2 screen “morning of the interview” cheat sheet covering Modules 1–18**, followed by a **mock technical interview with short questions where you answer first and I correct/strengthen the answer**.
