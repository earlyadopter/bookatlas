# Module 4 — Salesforce Connector

This module is where MuleSoft stops being abstract and becomes:

> **“How exactly does my Mule application talk to Salesforce?”**

The current Salesforce Connector 12.0 supports Salesforce SOAP, REST, Bulk, and Streaming APIs depending on the operation, while handling HTTPS setup, headers, and much of the protocol plumbing for you. ([MuleSoft Documentation][1])

For your interview, you should be comfortable with these operations:

```text
Query
Query All

Create
Update
Upsert
Delete

Bulk API / Bulk API v2

+ event/pub-sub patterns
```

Let's work through them as a developer would.

---

## 4.1 The Salesforce Connector's job

Without a connector, you would have to write something conceptually like:

```text
obtain OAuth token
        ↓
construct Salesforce URL
        ↓
set Authorization headers
        ↓
serialize request
        ↓
send HTTPS request
        ↓
handle status codes
        ↓
parse Salesforce response
        ↓
refresh token
        ↓
retry connection failures
```

With Mule:

```text
Salesforce Connector
        ↓
Query / Upsert / Update / etc.
```

So instead of treating Salesforce as an arbitrary HTTP endpoint, Mule gives you Salesforce-specific operations.

That's why I would normally start with the connector rather than manually calling Salesforce REST endpoints.

---

# 4.2 Connector configuration

Individual Salesforce operations normally point to a reusable global configuration:

```xml
<salesforce:sfdc-config
    name="Salesforce_Config">
    ...
</salesforce:sfdc-config>
```

Then:

```xml
<salesforce:query
    config-ref="Salesforce_Config">
```

or:

```xml
<salesforce:upsert
    config-ref="Salesforce_Config">
```

Conceptually:

```typescript
const salesforce =
    new SalesforceConnection(config);

salesforce.query(...);

salesforce.upsert(...);
```

You don't authenticate separately for every flow step.

---

# 4.3 Authentication: what you should know in 2026

This is worth knowing because the current connector changed very recently.

Salesforce Connector **12.0.0 was released July 21, 2026**, requires **Java 17**, and removed its OAuth Username Password connection type because Salesforce is retiring that flow. MuleSoft currently points users toward alternatives including OAuth 2.0, Client Credentials, JWT, and SAML. ([MuleSoft Documentation][2])

For machine-to-machine Mule integrations, the two patterns I'd especially recognize are:

```text
OAuth Client Credentials

OAuth JWT
```

### Client Credentials

Think:

```text
Mule application
     ↓
client ID + client secret
     ↓
Salesforce
     ↓
access token
```

No interactive human login.

Client Credentials is specifically designed for applications acting on their own behalf, making it appropriate for machine-to-machine scenarios. ([MuleSoft Documentation][3])

### JWT

Conceptually:

```text
Mule
 ↓
signed JWT assertion
 ↓
Salesforce OAuth endpoint
 ↓
access token
```

This avoids storing a Salesforce user's plaintext password.

### Interview answer

If asked:

> “How would you authenticate MuleSoft to Salesforce?”

I'd say:

> “For a new server-to-server integration I'd expect OAuth-based authentication, commonly Client Credentials or JWT depending on the organization's Salesforce security model. I would keep credentials outside the Mule XML and externalize secrets by environment.”

That is enough unless the role specifically expects Salesforce identity expertise.

---

# 4.4 QUERY

This is probably the Salesforce operation you'll use most besides Upsert.

Imagine:

```text
GET /customers/CUST-123
```

Mule needs to find the corresponding Salesforce Account.

Flow:

```text
HTTP Listener
      ↓
Salesforce Query
      ↓
Transform response
```

SOQL:

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

The connector's Query operation accepts SOQL and supports parameters.

Conceptually:

```text
query:
SELECT Id, Name
FROM Account
WHERE External_Customer_ID__c = :customerId

parameters:
{
    customerId: vars.customerId
}
```

This is preferable to dynamically constructing:

```text
"... WHERE External_Customer_ID__c = '"
    ++ vars.customerId
    ++ "'"
```

for exactly the reasons you'd expect from other database/API development:

```text
safer
cleaner
escaping handled correctly
easier to maintain
```

---

# 4.5 What Query returns

Suppose Salesforce contains:

```text
Account

Id: 001ABC
Name: Acme
External_Customer_ID__c: CUST-123
```

Your connector result is conceptually a collection:

```json
[
  {
    "Id": "001ABC",
    "Name": "Acme",
    "External_Customer_ID__c": "CUST-123"
  }
]
```

So this is important:

```dataweave
payload[0].Id
```

might retrieve the first Account.

But don't blindly do:

```dataweave
payload[0]
```

unless your business logic guarantees one record.

You need to think about three cases:

```text
0 records
1 record
>1 records
```

For a supposedly unique external ID:

```text
0 → not found
1 → normal
>1 → data-integrity problem
```

That is exactly the kind of observation that makes a QA engineer sound like a developer rather than someone merely wiring components together.

---

# 4.6 QUERY ALL

There is also:

```text
Query All
```

The distinction is important.

Regular Query retrieves normal records.

**Query All can include records that have been deleted.**

The current connector describes `query-all` as retrieving objects whether or not they've been deleted. ([MuleSoft Documentation][4])

When would you care?

For example:

```text
Data warehouse synchronization

source-of-truth reconciliation

audit pipeline

replication

detect Salesforce deletions
```

Interview question:

> What's Query versus Query All?

Answer:

> “Query operates on the normal active Salesforce dataset; Query All is useful for synchronization scenarios because it can return deleted records as well.”

Good enough.

---

# 4.7 CREATE

Suppose you're creating a Contact:

```dataweave
[
    {
        FirstName: "John",
        LastName: "Smith",
        Email: "john@acme.com"
    }
]
```

Then:

```text
Salesforce Create
Object Type = Contact
```

Conceptually:

```typescript
salesforce.create(
    "Contact",
    contacts
);
```

Result:

```json
[
  {
    "id": "003ABC...",
    "success": true
  }
]
```

Create is perfectly appropriate when:

```text
this genuinely must be a new record
```

Examples:

```text
new immutable event

new transaction

new Case

new audit record
```

The mistake is using Create when you don't know whether the business entity already exists.

---

# 4.8 UPDATE

Update means:

> “I know which Salesforce record I'm changing.”

Usually you have:

```text
Salesforce Id
```

Example:

```dataweave
[
    {
        Id: vars.accountId,
        Phone: vars.newPhone
    }
]
```

Then:

```text
Update Account
```

Mentally:

```text
Create
requires data for a new record

Update
requires existing Salesforce ID

Upsert
uses an external identifier to decide
insert versus update
```

Memorize that distinction.

---

# 4.9 UPSERT — probably your favorite operation

Suppose upstream gives us:

```text
customerId = CUST-10042
```

Salesforce field:

```text
External_Customer_ID__c
```

Then:

```text
Upsert Account
External ID:
External_Customer_ID__c
```

Input:

```dataweave
[
    {
        External_Customer_ID__c:
            payload.customerId,

        Name:
            payload.companyName
    }
]
```

Salesforce effectively does:

```text
Does External_Customer_ID__c = CUST-10042 exist?

YES
 ↓
UPDATE

NO
 ↓
INSERT
```

The current MuleSoft connector documentation explicitly says that Upsert creates or updates using a custom field to identify existing records and recommends it over Create in many cases to avoid unwanted duplicates. ([MuleSoft Documentation][4])

---

# 4.10 Upsert and idempotency

Here's why this matters enormously.

Suppose Mule receives:

```text
CUST-10042
```

and successfully writes Salesforce.

Before Mule returns HTTP response:

```text
network timeout
```

The caller assumes failure and retries.

With blind Create:

```text
request #1
→ Account CUST-10042

request #2
→ another Account CUST-10042
```

Bad.

With Upsert:

```text
request #1
→ insert CUST-10042

request #2
→ update CUST-10042
```

Much safer.

This is called:

# **Idempotency**

Conceptually:

```text
perform operation once
≈
perform same operation repeatedly
```

from the perspective of unwanted side effects.

Interview phrase:

> “I try to design retryable integrations around stable external identifiers and upsert semantics where the business model allows it.”

That's a strong sentence.

---

# 4.11 External ID

Do not confuse:

```text
Salesforce Id
```

with:

```text
External ID
```

Salesforce ID:

```text
001K000001ABCDEF
```

belongs to Salesforce.

External ID might be:

```text
CUST-10042
```

belonging to your source system.

Example:

```text
ERP

customerId
CUST-10042

       ↓ Mule

Salesforce

Id:
001A...

External_Customer_ID__c:
CUST-10042
```

Why is that valuable?

Because Mule doesn't need to somehow remember:

```text
CUST-10042 → 001ABC
```

in its own database just to identify the Account later.

Salesforce itself can maintain that relationship.

---

# 4.12 DELETE

Delete is straightforward conceptually.

Usually:

```text
Salesforce ID
       ↓
Salesforce Delete
```

But business requirements matter enormously.

If upstream sends:

```text
customer deleted
```

do you really:

```text
DELETE Salesforce Account
```

?

Maybe not.

Often requirements are:

```text
mark inactive

close Account

set status

archive

soft-delete in application logic
```

rather than destroying data.

A developer shouldn't simply translate:

```text
DELETE request
```

into:

```text
Salesforce delete
```

without understanding lifecycle requirements.

---

# 4.13 Salesforce deletes aren't necessarily permanent

Salesforce has its own deletion/recycle-bin semantics.

That's one reason `Query All` can matter.

A synchronization process may need to know:

```text
record was present yesterday
record has now been deleted
```

and replicate that state downstream.

Think ETL/reconciliation more than standard application API.

---

# 4.14 Target Variable — useful Mule trick

Remember in Module 2 we said Salesforce changes the payload.

For example:

```text
payload = Account data

Salesforce Query
       ↓

payload = query result
```

Sometimes you **don't want the connector operation to replace your current payload**.

Mule operations support a **Target Variable**.

The current Salesforce connector exposes `Target Variable` and `Target Value` on many operations. ([MuleSoft Documentation][4])

Conceptually:

```text
Salesforce Query

Target Variable:
sfAccounts
```

Now instead of replacing:

```text
payload
```

you can have:

```text
vars.sfAccounts
```

while the payload remains available.

That's extremely useful.

---

# 4.15 Why this is better than endless Set Variable

Earlier we did:

```text
Set Variable originalCustomer
       ↓
Salesforce Query
```

Another option is:

```text
Salesforce Query
Target = sfResults
```

Then:

```text
payload
```

can stay as your original customer while:

```text
vars.sfResults
```

contains Salesforce data.

This can make a flow substantially easier to read.

### Interview phrase

> “If I need the connector result without replacing the current payload, I can put the operation result into a target variable rather than constantly copying payloads around.”

Very good Mule-specific answer.

---

# 4.16 Parent → child creation

Let's revisit:

```text
Account
  ↓
Contact
```

Input:

```json
{
  "customerId": "C001",
  "company": "Acme",

  "contacts": [
    {
      "id": "P001",
      "firstName": "John",
      "lastName": "Smith"
    }
  ]
}
```

Flow:

```text
Transform Account
      ↓
Upsert Account
      ↓
obtain Salesforce Account.Id
      ↓
Transform Contacts
      ↓
Upsert Contacts with AccountId
```

Contacts:

```dataweave
vars.original.contacts map (contact) -> {
    External_Contact_ID__c: contact.id,
    FirstName: contact.firstName,
    LastName: contact.lastName,
    AccountId: vars.accountId
}
```

This is basic Salesforce relationship orchestration.

---

# 4.17 Salesforce operations usually handle collections

A major performance mistake would be:

```text
For Each customer
       ↓
Salesforce Upsert one record
```

For 1,000 records:

```text
1000 connector calls
```

Not ideal.

Better, where appropriate:

```text
Transform 1000 records
        ↓
Salesforce operation
        ↓
collection
```

Example:

```dataweave
payload.customers map (customer) -> {
    External_Id__c: customer.id,
    Name: customer.name
}
```

Then one connector operation can process the collection according to the operation's semantics and limits.

---

# 4.18 But “just send everything” isn't good either

Suppose:

```text
500,000 customers
```

You don't want:

```text
HTTP request
 ↓
hold 500,000 giant objects in memory
 ↓
normal synchronous upsert
```

Now we're entering **Bulk API** territory.

---

# 4.19 Normal API versus Bulk API

Think of it this way:

### Normal Salesforce operations

Great for:

```text
individual transactions

small/medium request batches

interactive APIs

low latency
```

Example:

```text
POST /customer
 ↓
upsert Account
 ↓
return response immediately
```

### Bulk API

Designed for:

```text
large datasets

ETL

nightly imports

migration

mass synchronization
```

Example:

```text
500,000 Accounts
```

Now you submit a job.

Conceptually:

```text
Create Bulk Job
      ↓
upload records
      ↓
Salesforce processes asynchronously
      ↓
check job status
      ↓
retrieve results/errors
```

The current connector exposes both classic bulk-job operations and **Bulk API v2** operations, including create/upsert/update/delete jobs and bulk query jobs. ([MuleSoft Documentation][4])

---

# 4.20 Bulk API V2 mental model

Say we need to synchronize:

```text
250,000 Accounts
```

Conceptually:

```text
Mule Scheduler
      ↓
retrieve source records
      ↓
DataWeave
      ↓
Create Bulk API V2 job
      ↓
Salesforce processes data
      ↓
Get job state/results
      ↓
handle failed rows
```

The important word is:

# asynchronous

Don't expect:

```text
250,000 records
 ↓
1 REST transaction
 ↓
200 OK
```

like a simple API.

---

# 4.21 Bulk processing introduces partial failures

Suppose:

```text
10,000 records
```

are submitted.

Result:

```text
9,943 successful
57 failed
```

Production code needs to answer:

```text
Which 57?

Why?

Can they be retried?

Were failures validation errors?

Were failures transient?

Do we move them to a DLQ/error file?

Do we retry the whole batch?
```

This is where your QA background is very valuable.

You should immediately think about:

```text
record-level success/failure

not merely:
HTTP 200 means success
```

---

# 4.22 Salesforce errors

The connector exposes typed Salesforce/Mule errors.

Current connector documentation includes examples such as:

```text
SALESFORCE:CONNECTIVITY
SALESFORCE:TIMEOUT
SALESFORCE:LIMIT_EXCEEDED
SALESFORCE:INVALID_INPUT
SALESFORCE:NOT_FOUND
SALESFORCE:INSUFFICIENT_PERMISSIONS
SALESFORCE:RETRY_EXHAUSTED
```

among others. ([MuleSoft Documentation][4])

Don't memorize every one.

Instead categorize them.

---

# 4.23 Retryable versus non-retryable

This is an excellent interview topic.

Suppose:

```text
SALESFORCE:TIMEOUT
```

Potentially:

```text
retry
```

Suppose:

```text
SALESFORCE:CONNECTIVITY
```

Potentially:

```text
retry
```

But suppose Salesforce says:

```text
INVALID_FIELD
```

because you referenced:

```text
Foo_Bar__c
```

which doesn't exist.

Retrying 10 times is pointless.

Likewise:

```text
required field missing

invalid email

validation rule failed

insufficient permission
```

normally requires configuration/data correction.

So divide failures into:

```text
Transient
---------
timeout
temporary connectivity
service unavailable
rate pressure

Potentially retry


Permanent / business / config
-----------------------------
invalid field
missing required data
validation rule violation
bad object
permission issue

Don't blindly retry
```

---

# 4.24 Retry + idempotency belong together

This is crucial.

Never say:

> “We retry failures three times.”

without thinking:

> “What happens if the first attempt actually succeeded but the response was lost?”

Example:

```text
Mule → Salesforce

Salesforce creates Account

Salesforce → Mule response lost

Mule sees timeout
```

Then:

```text
retry CREATE
```

creates another Account.

That's why:

```text
retry strategy
+
idempotency
```

must be designed together.

Great interview sentence:

> “I don't consider retries independently from idempotency, because a timeout doesn't prove the downstream operation wasn't committed.”

That's senior-level integration thinking.

---

# 4.25 Salesforce limits

Salesforce isn't an unlimited database sitting behind Mule.

You need to think about:

```text
API call limits

concurrent operations

query volume

record count

payload sizes

batch size

timeouts
```

You do **not** need to memorize Salesforce's exact numerical limits for this interview unless they specifically expect a Salesforce developer certification level.

Better answer:

> “I'd verify the org's applicable Salesforce limits and design to minimize unnecessary API round trips, batch operations appropriately, and monitor limit consumption.”

Don't invent numbers.

---

# 4.26 This is why query-before-upsert may be wasteful

Bad pattern:

```text
For every customer:

QUERY
 ↓
does it exist?
 ↓
UPDATE / CREATE
```

100 customers means potentially:

```text
100 queries
+
100 writes
```

If you already have a reliable external ID:

```text
UPSERT
```

can remove the existence-query round trip entirely.

That's performance **and** simpler logic.

---

# 4.27 When Query first still makes sense

Suppose requirements say:

> Only update customers whose Salesforce Account has `Allow_External_Update__c = true`.

Now:

```text
Query
 ↓
inspect state
 ↓
Choice
 ↓
Upsert/Update
```

is completely justified.

Don't optimize API calls at the expense of required business behavior.

---

# 4.28 Don't confuse Salesforce API with SOQL

Important conceptual distinction:

```text
Salesforce Connector
```

provides operations.

One of those operations is:

```text
Query
```

The **query language** is:

```text
SOQL
```

So:

```text
Connector = communication mechanism

SOQL = Salesforce query language
```

Similar to:

```text
JDBC driver
versus
SQL
```

That's a useful analogy.

---

# 4.29 Mule's Salesforce Connector isn't always REST

Another interview trap.

Don't say:

> “The Salesforce Connector is basically a REST wrapper.”

The current connector can use Salesforce:

```text
SOAP API
REST API
Bulk API
Streaming API
```

depending on the configured operation. ([MuleSoft Documentation][1])

So say:

> “The connector abstracts several Salesforce APIs; which underlying API is involved depends on the operation.”

Much better.

---

# 4.30 Event-driven Salesforce integration

Not every integration is:

```text
Mule → Salesforce
```

Sometimes Salesforce changes something and Mule reacts:

```text
Salesforce
    ↓
event
    ↓
Mule
    ↓
ERP
```

Example:

```text
Opportunity becomes Closed Won
       ↓
Mule receives event
       ↓
create customer in billing system
```

You may encounter:

```text
Platform Events
Change Data Capture
Pub/Sub API
```

For now, just understand:

```text
Polling model:

Mule:
"Anything changed?"
"Anything changed?"
"Anything changed?"


Event model:

Salesforce:
"Something changed."
        ↓
Mule
```

We'll go deeper into sync versus async later.

---

# 4.31 A realistic developer flow

Requirement:

> Receive a customer. If valid, upsert Account and all Contacts. Return useful business result.

Architecture:

```text
POST /customers
      ↓
Validate input
      ↓
vars.originalRequest
      ↓
Transform Account
      ↓
Upsert Account
      ↓
Get Account ID
      ↓
Transform contacts[]
      ↓
Upsert Contacts
      ↓
Inspect per-record results
      ↓
Transform response
```

Possible success:

```json
{
  "customerId": "C001",
  "salesforceAccountId": "001ABC",
  "contactsProcessed": 3,
  "status": "SUCCESS"
}
```

Partial failure:

```json
{
  "customerId": "C001",
  "salesforceAccountId": "001ABC",
  "contactsProcessed": 2,
  "contactsFailed": 1,
  "status": "PARTIAL_SUCCESS"
}
```

Notice:

```text
HTTP operation succeeded
```

does not automatically equal:

```text
business transaction completely succeeded
```

This distinction will matter when we cover error handling.

---

# 4.32 What would you automate as a tester?

This is where you can connect your existing expertise directly.

For an Upsert integration I'd want tests for:

```text
new external ID
→ Salesforce record created

existing external ID
→ same record updated

same request repeated
→ no duplicate

optional field missing
→ existing Salesforce field preserved

explicit clearing operation
→ field cleared if contract permits it

invalid required field
→ useful error

Salesforce unavailable
→ retry/error behavior

mixed-validity collection
→ partial failures correctly reported

Account + Contacts
→ relationships correct
```

Those tests are basically the **developer acceptance criteria** for your connector design.

---

# 4.33 Likely interview question

### “What's the difference between Create, Update and Upsert?”

Answer:

> “Create always intends to insert a new Salesforce record. Update targets an existing Salesforce record, normally by Salesforce ID. Upsert uses an external identifier to decide whether to insert or update, which is especially useful for repeatable integration synchronization and idempotency.”

---

### “Why use an External ID?”

> “It lets the integration address Salesforce records using the source system's stable business identifier rather than maintaining a separate Salesforce-ID mapping, and it enables upsert behavior.”

---

### “Would you query before every upsert?”

> “No. If the sole purpose of the query is determining whether the record exists and I have a reliable External ID, that's exactly what upsert removes. I'd query first when downstream state is actually needed for a business decision.”

---

### “Normal API or Bulk API?”

> “For transactional and relatively small synchronous operations I'd use the normal connector operations. For large imports, migrations, or synchronization workloads I'd consider Bulk API v2 because the workload is job-oriented and designed for large record volumes.”

---

### “What do you retry?”

> “Primarily transient failures such as connectivity and timeouts. I wouldn't blindly retry validation or schema errors, and I'd make sure the operation is idempotent because a timeout doesn't guarantee Salesforce didn't already commit the request.”

That last answer is particularly good.

---

# 4.34 Your Salesforce Connector cheat sheet

```text
QUERY
-----
Read Salesforce records
Uses SOQL


QUERY ALL
---------
Read including deleted records
Useful for synchronization/reconciliation


CREATE
------
New record
Risk of duplicates on retries


UPDATE
------
Modify known Salesforce record
Usually uses Salesforce Id


UPSERT
------
External ID
insert OR update
Preferred for many synchronization flows
Excellent for idempotency


DELETE
------
Delete known records
Confirm business lifecycle semantics first


BULK API
--------
Large volumes
Asynchronous/job-oriented
Handle row-level failures


TARGET VARIABLE
---------------
Keep connector result in vars.x
without replacing current payload
```

And this relationship:

```text
External system
       │
       │ customerId=C001
       ↓
     Mule
       │
       │ DataWeave
       ↓
Salesforce Connector
       │
       │ Upsert Account
       ↓
Salesforce
       │
       ├── Id = 001ABC
       │
       └── External_ID__c = C001
```

---

## The developer mindset I want you to keep

When somebody gives you a Mule/Salesforce requirement, don't immediately think:

> “Which connector box do I drag onto the canvas?”

Run through these questions:

```text
What identifies this entity?

Create / Update / Upsert?

Do I need Salesforce state before writing?

What should happen on retry?

Can this operation produce duplicates?

One record or collection?

Transactional volume or Bulk API volume?

Are there parent/child relationships?

What counts as partial failure?

What should replace payload?
Or should I use a target variable?

Which failures are retryable?

What information is safe to log?
```

If you naturally start asking those questions, **you already sound much more like an integration developer than someone who simply knows MuleSoft syntax**.

## Next — Module 5: Salesforce data model + SOQL

This one should be quite practical. We'll cover **Account, Contact, Opportunity, Case, standard vs custom objects/fields, Salesforce IDs, lookup/master-detail relationships, SOQL syntax, relationship queries, filtering, `IN`, aggregate queries, date predicates, and how Mule safely supplies SOQL parameters**.

That will give you enough Salesforce knowledge to survive the inevitable interviewer question: **“Okay, you need the Contacts belonging to Accounts meeting X condition—how would you retrieve them?”**

[1]: https://docs.mulesoft.com/salesforce-connector/latest/?utm_source=chatgpt.com "Salesforce Connector 12.0 | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/release-notes/connector/salesforce-connector-release-notes-mule-4?utm_source=chatgpt.com "Salesforce Connector Release Notes | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/mule-sdk/latest/client-credentials?utm_source=chatgpt.com "Client Credentials | MuleSoft Documentation"
[4]: https://docs.mulesoft.com/salesforce-connector/latest/salesforce-connector-reference?utm_source=chatgpt.com "Salesforce Connector 12.0 Reference | MuleSoft Documentation"
