## Module 2 — Building a Real Mule Flow

We’ll build this:

```text
POST /customers
      ↓
HTTP Listener
      ↓
Validate / preserve request
      ↓
Transform JSON → Salesforce Account
      ↓
Salesforce Upsert
      ↓
Transform Salesforce result → API response
      ↓
HTTP 200/201
```

This is a very typical MuleSoft pattern. MuleSoft’s own Salesforce examples use essentially the same sequence: **HTTP Listener → Transform Message → Salesforce operation → Transform Message**. ([MuleSoft Documentation][1])

---

# 2.1 Our requirement

Assume another system sends this:

```json
{
  "customerId": "CUST-10042",
  "companyName": "Acme Corporation",
  "phone": "305-555-1234",
  "billing": {
    "city": "Miami",
    "state": "FL"
  }
}
```

Our Mule API:

```http
POST /customers
Content-Type: application/json
```

needs to create or update this Salesforce Account.

Salesforce representation:

```json
{
  "External_Customer_ID__c": "CUST-10042",
  "Name": "Acme Corporation",
  "Phone": "305-555-1234",
  "BillingCity": "Miami",
  "BillingState": "FL"
}
```

We're going to use:

```text
External_Customer_ID__c
```

as the Salesforce **External ID**.

Therefore:

```text
customer exists → UPDATE
customer doesn't exist → INSERT
```

using one operation:

```text
UPSERT
```

Salesforce Connector's Upsert operation is specifically designed to create or update objects based on a custom field; MuleSoft recommends it over blind `create` in many cases to avoid duplicates. ([MuleSoft Documentation][2])

---

# 2.2 What the flow looks like in Anypoint Studio

Imagine these boxes on the canvas:

```text
┌────────────────┐
│ HTTP Listener  │
│ POST /customers│
└───────┬────────┘
        ↓
┌───────────────────┐
│ Set Variable      │
│ originalCustomer  │
└────────┬──────────┘
         ↓
┌────────────────────┐
│ Transform Message  │
│ JSON → Salesforce  │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Salesforce Upsert  │
│ Account            │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Transform Message  │
│ SF → API Response  │
└─────────┬──────────┘
          ↓

      HTTP response
```

Now let's understand every box.

---

# 2.3 HTTP Listener

The first component is the **source** of the flow.

Conceptually:

```typescript
app.post("/customers", async (req, res) => {
    ...
});
```

In Mule XML you'll see something resembling:

```xml
<http:listener
    config-ref="HTTP_Listener_config"
    path="/customers"
    allowedMethods="POST"/>
```

The Listener configuration might be:

```xml
<http:listener-config name="HTTP_Listener_config">

    <http:listener-connection
        host="0.0.0.0"
        port="8081"/>

</http:listener-config>
```

So locally:

```text
http://localhost:8081/customers
```

starts the flow.

---

# 2.4 What happens when the request arrives?

For:

```http
POST /customers
Content-Type: application/json
X-Correlation-ID: abc-123

{
  "customerId": "CUST-10042",
  "companyName": "Acme Corporation"
}
```

Mule creates a Mule Event.

Conceptually:

```text
Mule Event

payload:
{
   customerId: "CUST-10042",
   companyName: "Acme Corporation"
}

attributes:
{
   method: "POST",
   requestPath: "/customers",
   headers: ...
}

vars:
{}
```

Therefore:

```dataweave
payload.customerId
```

returns:

```text
CUST-10042
```

and:

```dataweave
attributes.headers."x-correlation-id"
```

could return:

```text
abc-123
```

---

# 2.5 Preserve the original request

This is one of the first development habits I'd use.

Add:

```text
Set Variable
```

Variable name:

```text
originalCustomer
```

Value:

```dataweave
#[payload]
```

Now:

```text
vars.originalCustomer
```

contains the incoming request.

Why bother?

Because our next operations will change `payload`.

Interview answer:

> “I tend to preserve important input state in variables when later connector operations are going to replace the payload.”

That's a very Mule-native thing to say.

---

# 2.6 Transform Message

Now we transform our API contract into Salesforce's contract.

Input:

```json
{
  "customerId": "CUST-10042",
  "companyName": "Acme Corporation",
  "phone": "305-555-1234",
  "billing": {
    "city": "Miami",
    "state": "FL"
  }
}
```

DataWeave:

```dataweave
%dw 2.0
output application/java
---
[
    {
        External_Customer_ID__c: payload.customerId,
        Name: payload.companyName,
        Phone: payload.phone,
        BillingCity: payload.billing.city,
        BillingState: payload.billing.state
    }
]
```

Notice:

```text
[
   {
      ...
   }
]
```

Why an **array**?

Because Salesforce Connector operations commonly operate on collections of records, even when you're sending only one.

MuleSoft's own Salesforce examples similarly transform incoming data into an `application/java` array before calling Salesforce. ([MuleSoft Documentation][3])

---

# 2.7 Why `application/java`?

This can look strange.

You might expect:

```dataweave
output application/json
```

But we're not sending a raw HTTP JSON request ourselves.

We're passing an internal Java/Mule structure to:

```text
Salesforce Connector
```

So:

```dataweave
output application/java
```

is common.

Think:

```text
JSON request

        ↓ parse

Mule object

        ↓ DataWeave

Java/Mule object structure

        ↓

Salesforce Connector

        ↓ serialize/call Salesforce API

Salesforce
```

The connector abstracts away much of the low-level REST work.

---

# 2.8 Salesforce Upsert

Next box:

```text
Salesforce
    ↓
Upsert
```

Configuration:

```text
Object Type:
Account

External ID Field Name:
External_Customer_ID__c
```

Conceptually:

```typescript
salesforce.accounts.upsert(
    records,
    "External_Customer_ID__c"
);
```

The Mule XML is approximately:

```xml
<salesforce:upsert
    config-ref="Salesforce_Config"
    type="Account"
    externalIdFieldName="External_Customer_ID__c"/>
```

Don't obsess over memorizing exact XML attributes. Studio generates much of this.

What matters for an interview is that you understand:

```text
type
     ↓
which Salesforce object?

Account


externalIdFieldName
     ↓
how do we identify the existing record?

External_Customer_ID__c
```

---

# 2.9 Salesforce global configuration

Like HTTP, Salesforce needs a reusable connector configuration.

Conceptually:

```xml
<salesforce:sfdc-config name="Salesforce_Config">

    authentication settings here

</salesforce:sfdc-config>
```

Then individual operations reference it:

```xml
config-ref="Salesforce_Config"
```

This prevents every operation from containing credentials/configuration.

Think dependency injection:

```typescript
const salesforce = new SalesforceClient(config);
```

and then:

```typescript
salesforce.query(...)
salesforce.upsert(...)
salesforce.update(...)
```

---

# 2.10 Now something important happens to `payload`

Before Salesforce:

```text
payload

[
   {
      External_Customer_ID__c: "CUST-10042",
      Name: "Acme Corporation"
   }
]
```

After Salesforce Upsert:

```text
payload
```

is now the **Salesforce operation result**.

Something conceptually like:

```json
[
  {
    "id": "001xx000003DGbYAAW",
    "success": true
  }
]
```

This is exactly why we earlier stored:

```text
vars.originalCustomer
```

The original customer data is still available.

---

# 2.11 Build the API response

We don't want the consumer receiving some raw Salesforce connector object.

Instead:

```dataweave
%dw 2.0
output application/json
---
{
    customerId: vars.originalCustomer.customerId,
    salesforceId: payload[0].id,
    success: payload[0].success
}
```

Response:

```json
{
  "customerId": "CUST-10042",
  "salesforceId": "001xx000003DGbYAAW",
  "success": true
}
```

This is an important architectural principle:

```text
External API contract

should NOT equal

Salesforce internal contract
```

Because tomorrow Salesforce may change, or the backend may become:

```text
Dynamics
```

or:

```text
SAP
```

Your consumer shouldn't care.

---

# 2.12 Put the entire flow together

Conceptually:

```xml
<flow name="customer-api-flow">

    <http:listener
        config-ref="HTTP_Listener_config"
        path="/customers"
        allowedMethods="POST"/>

    <set-variable
        variableName="originalCustomer"
        value="#[payload]"/>

    <ee:transform doc:name="Map Customer to Salesforce Account">
        <ee:message>
            <ee:set-payload><![CDATA[
%dw 2.0
output application/java
---
[
    {
        External_Customer_ID__c: payload.customerId,
        Name: payload.companyName,
        Phone: payload.phone,
        BillingCity: payload.billing.city,
        BillingState: payload.billing.state
    }
]
            ]]></ee:set-payload>
        </ee:message>
    </ee:transform>

    <salesforce:upsert
        config-ref="Salesforce_Config"
        type="Account"
        externalIdFieldName="External_Customer_ID__c"/>

    <ee:transform doc:name="Build API Response">
        <ee:message>
            <ee:set-payload><![CDATA[
%dw 2.0
output application/json
---
{
    customerId: vars.originalCustomer.customerId,
    salesforceId: payload[0].id,
    success: payload[0].success
}
            ]]></ee:set-payload>
        </ee:message>
    </ee:transform>

</flow>
```

Again:

**Don't memorize the XML.**

Memorize:

```text
Listener
   ↓
preserve
   ↓
transform
   ↓
connector
   ↓
transform
```

---

# 2.13 Let's make it slightly more realistic

A developer probably wouldn't just blindly accept:

```json
{
}
```

So we might add validation.

```text
HTTP Listener
      ↓
Validation
      ↓
Set Variable
      ↓
Transform
      ↓
Salesforce Upsert
```

For example:

```text
customerId required
companyName required
```

Conceptually:

```text
if customerId missing
    → HTTP 400

if companyName missing
    → HTTP 400
```

We'll cover validation/error handling much more deeply later.

---

# 2.14 Add logging

Another realistic flow:

```text
Listener
   ↓
Logger
   ↓
Validation
   ↓
Transform
   ↓
Logger
   ↓
Salesforce
   ↓
Logger
   ↓
Response
```

Example Logger expression:

```dataweave
#[%dw 2.0
output application/json
---
{
    message: "Processing customer",
    customerId: payload.customerId,
    correlationId: correlationId
}]
```

Do **not** simply log:

```text
payload
```

in production if it can contain:

```text
PII
PHI
credentials
tokens
financial data
```

This is a strong QA/security talking point.

---

# 2.15 What if we need Account + Contact?

Now we start getting closer to real Mule work.

Input:

```json
{
  "customerId": "CUST-10042",
  "companyName": "Acme Corporation",

  "contact": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@acme.com"
  }
}
```

We need:

```text
Account
   ↓
Contact
```

where:

```text
Contact.AccountId = Account.Id
```

Possible flow:

```text
HTTP Listener
      ↓
Save original request
      ↓
Transform Account
      ↓
Upsert Account
      ↓
Save account ID
      ↓
Transform Contact
      ↓
Upsert Contact
      ↓
Response
```

This introduces another very important Mule pattern:

```text
payload
↓
save result into variable
↓
change payload
↓
continue
```

---

# 2.16 Saving the Salesforce Account ID

After Account Upsert:

```text
payload[0].id
```

might be:

```text
001ABCD1234
```

Set:

```text
vars.salesforceAccountId
```

to:

```dataweave
#[payload[0].id]
```

Now transform Contact:

```dataweave
%dw 2.0
output application/java
---
[
    {
        FirstName: vars.originalCustomer.contact.firstName,
        LastName: vars.originalCustomer.contact.lastName,
        Email: vars.originalCustomer.contact.email,
        AccountId: vars.salesforceAccountId
    }
]
```

Now Salesforce understands:

```text
This Contact belongs to this Account.
```

---

# 2.17 Your first integration orchestration

The whole flow becomes:

```text
                    POST /customers
                          │
                          ↓
                  ┌────────────────┐
                  │ HTTP Listener  │
                  └───────┬────────┘
                          ↓
                  ┌────────────────┐
                  │ Validate input │
                  └───────┬────────┘
                          ↓
               vars.originalCustomer
                          │
                          ↓
                 Transform Account
                          │
                          ↓
                Salesforce Upsert
                      Account
                          │
                          ↓
              vars.salesforceAccountId
                          │
                          ↓
                 Transform Contact
                          │
                          ↓
                Salesforce Upsert
                      Contact
                          │
                          ↓
                  Build response
                          │
                          ↓
                       HTTP
```

This is **orchestration**.

Mule isn't merely transferring data.

It's coordinating business operations.

---

# 2.18 A developer question you're likely to get

Interviewer:

> Why don't you just query Salesforce first and determine whether to create or update?

You can say:

> “If the source system provides a reliable external identifier and Salesforce has that field configured appropriately, I'd normally prefer upsert. It reduces the round trip, eliminates explicit query/create/update branching, and helps make retries idempotent.”

Excellent answer.

Instead of:

```text
Query
 ↓
Choice
 ├─ found → Update
 └─ missing → Create
```

you get:

```text
Upsert
```

MuleSoft itself describes Upsert as creating or updating based on a custom identifier and recommends it in many situations to avoid duplicate records. ([MuleSoft Documentation][2])

---

# 2.19 But sometimes you DO query first

Example requirement:

> Only update premium customers if their Salesforce Account is currently Active.

Now:

```text
Query Salesforce
       ↓
Choice
       ↓

status = Active?
    ↓ yes       ↓ no
  Update       Ignore/Error
```

SOQL:

```sql
SELECT
    Id,
    Name,
    Status__c
FROM Account
WHERE External_Customer_ID__c = :customerId
```

Then:

```text
payload
```

contains query results.

We'll cover SOQL properly in Module 5.

---

# 2.20 Three ways integrations often become messy

### Bad pattern #1

Everything in one gigantic flow:

```text
Listener
↓
Transform
↓
Query
↓
Choice
↓
Transform
↓
HTTP
↓
Salesforce
↓
Choice
↓
Database
↓
Transform
↓
...
```

500 components later:

```text
customer-processing-flow
```

becomes impossible to reason about.

Better:

```text
customer-api-flow

   ↓

upsert-account-subflow

   ↓

upsert-contact-subflow
```

---

### Bad pattern #2

Data transformation scattered everywhere.

For example:

```text
Set Variable
Set Payload
Set Variable
Transform
Set Payload
Transform
```

Prefer transformations with explicit purposes:

```text
Map API Customer → Salesforce Account

Map API Contact → Salesforce Contact

Map Salesforce Result → API Response
```

---

### Bad pattern #3

Letting Salesforce leak through the API.

Bad:

```json
[
  {
    "id": "001...",
    "success": true,
    "errors": []
  }
]
```

Better public response:

```json
{
  "customerId": "CUST-10042",
  "status": "updated"
}
```

The integration layer should provide abstraction.

---

# 2.21 What your previous QA work was actually testing

This is worth recognizing because you are closer to development than it might feel.

When you tested:

```text
MuleSoft
   ↓
Salesforce
```

you were probably indirectly validating things like:

```text
HTTP request contract
        ↓
Mule routing
        ↓
DataWeave mappings
        ↓
Salesforce Connector configuration
        ↓
SOQL / object model
        ↓
field mapping
        ↓
upsert semantics
        ↓
Salesforce response
```

As a developer, you're simply moving **one layer inside the box**.

Instead of:

```text
Send request
↓
verify Salesforce
```

you're implementing:

```text
Receive request
↓
transform
↓
call Salesforce
↓
handle result
```

That transition is quite manageable.

---

# 2.22 Interview vocabulary from this module

Be comfortable naturally using:

```text
Mule application
flow
subflow

event source
HTTP Listener

message processor

payload
attributes
variables

Transform Message
DataWeave

connector configuration
Salesforce Connector

Account
Contact
external ID
upsert

SOQL

orchestration
API contract
mapping

idempotency
correlation ID
```

You don't need to say all of those.

But none of them should sound foreign.

---

# 2.23 Five likely interview questions

**Q: What happens to the Mule payload after a Salesforce operation?**

> The operation generally produces a new payload containing its result, so I preserve earlier data in variables when I'll need it downstream.

---

**Q: Why use Transform Message before Salesforce?**

> The incoming API contract normally shouldn't be identical to the Salesforce object model. DataWeave maps the external representation into the structure expected by the Salesforce Connector.

---

**Q: Why use Salesforce Connector instead of HTTP Request directly against Salesforce REST API?**

> The connector abstracts authentication, Salesforce operations, object metadata and many API details. I'd use raw HTTP only when I specifically needed functionality or behavior not appropriately exposed through the connector.

---

**Q: Create or upsert?**

> For integration-controlled entities that have a stable external identifier, I'd normally prefer upsert because it naturally supports retries and reduces duplicate creation.

---

**Q: Why store something in `vars`?**

> Variables let me preserve application state across processors even as those processors replace or transform the current payload.

---

# The picture to memorize

If the interviewer hands you a blank screen and says:

> “How would you build a Mule API that puts customers into Salesforce?”

Start drawing:

```text
HTTP Listener
      ↓
Validate
      ↓
Save original request
      ↓
Transform Message
    DataWeave
      ↓
Salesforce
    Upsert
      ↓
Transform Message
      ↓
HTTP Response
```

Then say:

> “I'd use an external customer ID for idempotent Salesforce upserts, keep the public API model decoupled from the Salesforce object model, preserve any input I need later in variables, and add structured error handling and correlation-aware logging.”

That already sounds substantially more like a **MuleSoft developer** than someone who only tested Mule integrations.

## Module 3 is the important one: DataWeave

Next we should spend the largest chunk of Day 1 on **DataWeave 2.0**. We'll go from simple field mapping to arrays, `map`, `filter`, conditional fields, defaults/nulls, flattening/nesting, dates, strings, Salesforce records, and the DataWeave questions you're realistically likely to encounter in an interview.

[1]: https://docs.mulesoft.com/salesforce-connector/10.22/salesforce-connector-examples?utm_source=chatgpt.com "Salesforce Connector 10.22 Examples | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/salesforce-connector/latest/salesforce-connector-reference?utm_source=chatgpt.com "Salesforce Connector 12.0 Reference | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/salesforce-connector/10.19/salesforce-connector-examples?utm_source=chatgpt.com "Salesforce Connector 10.19 Examples | MuleSoft Documentation"
