# Module 5 — Salesforce Data Model + SOQL

You do **not** need to become a Salesforce developer in two days. You need enough Salesforce fluency that when somebody says:

> “Query Contacts whose Accounts are active, then update a custom field on those Contacts”

you immediately understand the object relationships and can write or reason about the SOQL.

SOQL is Salesforce’s query language. It looks like SQL, but it is object/relationship-oriented rather than a general relational query language. Salesforce explicitly recommends SOQL when you know which objects/fields contain the data and when you need to query related Salesforce objects. ([Developer][1])

---

# 5.1 First: Salesforce is basically an object database

Think:

```text
Salesforce org
   │
   ├── Account
   ├── Contact
   ├── Opportunity
   ├── Case
   ├── Lead
   ├── User
   └── Custom_Object__c
```

Each object contains records.

Conceptually:

```text
Account
--------------------------------
Id
Name
Phone
BillingCity
Industry
External_Customer_ID__c
```

Very roughly, if you're coming from SQL:

```text
Salesforce Object ≈ table
Salesforce Record ≈ row
Salesforce Field  ≈ column
```

But don't push the analogy too far because Salesforce relationships and APIs behave differently.

---

# 5.2 The four objects you should know

## Account

Usually represents a:

```text
company
organization
business customer
```

Typical fields:

```text
Id
Name
Phone
Website
Industry
BillingCity
BillingState
```

Example:

```text
Account
--------------------------------
Id:       001ABC...
Name:     Acme Corporation
Industry: Manufacturing
```

---

## Contact

Usually represents a person associated with an Account.

```text
Contact
--------------------------------
Id
FirstName
LastName
Email
Phone
AccountId
```

Example:

```text
Contact

John Smith
    │
    │ AccountId
    ↓
Acme Corporation
```

The critical relationship:

```text
Contact.AccountId
      ↓
Account.Id
```

---

# 5.3 Opportunity

An Opportunity normally represents a potential sale/deal.

Typical concepts:

```text
Opportunity
--------------------------------
Id
Name
AccountId
StageName
Amount
CloseDate
```

Example:

```text
Acme Corporation
      │
      ├── Opportunity
      │      Name: Enterprise Renewal
      │      Amount: $500,000
      │      Stage: Negotiation
      │
      └── Opportunity
             Name: Support Contract
```

In an integration, you might receive:

```json
{
  "customerId": "C001",
  "dealId": "DEAL-982",
  "amount": 500000
}
```

and map that into Salesforce Account + Opportunity.

---

# 5.4 Case

A Case usually represents a customer service/support issue.

Salesforce describes Case as representing a customer issue/problem and connects it to Account and Contact. ([Developer][2])

Typical fields:

```text
Id
CaseNumber
AccountId
ContactId
Subject
Status
Priority
Origin
```

Example:

```text
Account: Acme
    │
    └── Contact: John Smith
            │
            └── Case #00014827
                  "Unable to login"
```

---

# 5.5 Standard versus custom objects

Salesforce standard object:

```text
Account
Contact
Opportunity
Case
```

Custom object:

```text
Insurance_Policy__c
Patient_Enrollment__c
External_Order__c
```

The giveaway:

```text
__c
```

Custom object names typically end in:

```text
__c
```

Likewise custom fields:

```text
External_Customer_ID__c
Member_Number__c
Integration_Status__c
```

This should become automatic:

```text
Something__c
        ↓
probably custom Salesforce field/object
```

---

# 5.6 Don't confuse labels with API names

The Salesforce UI might display:

```text
External Customer ID
```

but integration code uses:

```text
External_Customer_ID__c
```

Likewise:

```text
Customer Enrollment
```

might actually be:

```text
Customer_Enrollment__c
```

Your Mule/DataWeave/SOQL code normally needs the **API name**.

This is a common source of integration failures:

```text
INVALID_FIELD
```

because somebody used a display label instead of the API field name.

---

# 5.7 Salesforce IDs

Salesforce assigns an `Id` to every record.

Example:

```text
001xx000003DGbY
```

You do not generally create that yourself.

Objects have characteristic prefixes, but **don't waste interview-study time memorizing prefixes**.

What's important:

```text
Salesforce Id
= Salesforce's internal identity

External ID
= business/source-system identity
```

Example:

```text
Salesforce Account

Id:
001ABC...

External_Customer_ID__c:
CUST-81725
```

For integrations, both are useful for different reasons.

---

# 5.8 Lookup relationships

Imagine:

```text
Contact
   │
   │ AccountId
   ↓
Account
```

That's a relationship.

Salesforce commonly models relationships through:

```text
Lookup
```

and:

```text
Master-Detail
```

For your interview, the most important practical point is:

> A relationship field stores/references another Salesforce record.

Example:

```text
Contact.AccountId
```

references:

```text
Account.Id
```

Likewise:

```text
Opportunity.AccountId
Case.AccountId
Case.ContactId
```

---

# 5.9 Lookup vs Master-Detail

Don't go too deep unless asked.

### Lookup

Looser relationship.

Conceptually:

```text
child ─────→ parent
```

The child may often exist more independently.

### Master-Detail

Stronger parent-child ownership relationship.

The parent can influence things such as:

```text
ownership
sharing
roll-up summaries
lifecycle behavior
```

depending on configuration.

For Mule integration work, what usually matters first is:

```text
What field links these objects?
What Salesforce Id must I supply?
```

---

# 5.10 SOQL basics

Basic syntax:

```sql
SELECT Id, Name
FROM Account
```

Looks familiar.

Filter:

```sql
SELECT Id, Name
FROM Account
WHERE Industry = 'Technology'
```

Sort:

```sql
SELECT Id, Name
FROM Account
WHERE Industry = 'Technology'
ORDER BY Name
```

Limit:

```sql
SELECT Id, Name
FROM Account
LIMIT 100
```

SOQL supports the familiar `SELECT`, `FROM`, `WHERE`, `ORDER BY`, and `LIMIT` concepts. ([Developer][3])

---

# 5.11 One major difference from SQL

Don't instinctively write:

```sql
SELECT *
FROM Account
```

SOQL does **not** use ordinary SQL-style `*` to select everything. Salesforce supports explicit field lists and, in supported contexts, constructs such as `FIELDS(ALL)`. ([Developer][4])

In integration code, explicit fields are usually better anyway:

```sql
SELECT
    Id,
    Name,
    Phone,
    External_Customer_ID__c
FROM Account
```

Why?

```text
less data
clear contract
less accidental exposure
better stability
```

---

# 5.12 Query by External ID

This should look completely natural now:

```sql
SELECT
    Id,
    Name,
    Phone
FROM Account
WHERE External_Customer_ID__c = 'C001'
```

In Mule, prefer parameterization rather than string concatenation.

Conceptually:

```sql
SELECT Id, Name
FROM Account
WHERE External_Customer_ID__c = :customerId
```

with:

```text
customerId = vars.customerId
```

---

# 5.13 WHERE conditions

You'll recognize:

```sql
WHERE Status__c = 'Active'
```

Multiple conditions:

```sql
WHERE Status__c = 'Active'
AND BillingState = 'FL'
```

OR:

```sql
WHERE Industry = 'Technology'
OR Industry = 'Healthcare'
```

I recommend using parentheses when logic gets more complicated:

```sql
WHERE Status__c = 'Active'
AND (
    BillingState = 'FL'
    OR BillingState = 'GA'
)
```

Same reason you would in normal SQL: readability.

---

# 5.14 `IN`

Very useful for Mule integration.

Suppose you have:

```text
C001
C002
C003
```

Rather than three queries:

```sql
WHERE External_ID__c = 'C001'
```

etc., query:

```sql
SELECT Id, External_Customer_ID__c
FROM Account
WHERE External_Customer_ID__c
IN ('C001', 'C002', 'C003')
```

Think about API efficiency:

```text
bad:

100 records
→ 100 Salesforce queries


better:

collect IDs
→ query using IN
→ correlate results
```

This is a very important integration optimization.

---

# 5.15 NULL

Example:

```sql
SELECT Id, Name
FROM Account
WHERE Phone = NULL
```

or:

```sql
WHERE Phone != NULL
```

The important business question remains:

```text
Does NULL mean unknown?
not provided?
explicitly cleared?
```

Don't just mechanically transform it.

---

# 5.16 Dates

Typical Salesforce date/date-time fields include:

```text
CreatedDate
LastModifiedDate
CloseDate
```

Example:

```sql
SELECT Id, Name, LastModifiedDate
FROM Account
WHERE LastModifiedDate >= 2026-08-01T00:00:00Z
```

A synchronization job commonly looks like:

```text
Give me everything modified
since my previous successful run.
```

Conceptually:

```sql
WHERE LastModifiedDate > :lastSyncTime
```

This leads to incremental synchronization.

---

# 5.17 Incremental synchronization

Naive approach:

```text
every night:
query ALL 2 million Accounts
```

Better:

```text
last successful sync:
2026-08-06 02:00

next query:
records changed after that
```

Conceptually:

```sql
SELECT ...
FROM Account
WHERE LastModifiedDate > :lastSuccessfulSync
```

Then:

```text
store new high-water mark
```

This is often called:

```text
watermark
high-water mark
incremental sync
delta load
```

Great integration vocabulary.

---

# 5.18 Be careful with watermarks

Suppose your job runs:

```text
02:00
```

retrieves records through:

```text
02:07
```

and then crashes.

If you blindly save:

```text
02:07
```

as the watermark before completing, you could skip records.

So:

```text
query range
↓
process successfully
↓
only then advance checkpoint
```

Or use overlapping windows plus idempotent upsert.

QA thinking helps enormously here.

---

# 5.19 SOQL relationship queries

This is the **most important difference from traditional SQL** for this module.

Salesforce supports relationship traversal rather than forcing you into conventional table JOIN syntax. Relationship queries work through lookup/master-detail relationships and can traverse both child→parent and parent→children directions. ([Developer][5])

Let's make this easy.

---

# 5.20 Child → Parent

We're querying Contact:

```text
Contact
    │
    ↓
 Account
```

We want:

```text
Contact first name
Contact last name
Account name
```

SOQL:

```sql
SELECT
    Id,
    FirstName,
    LastName,
    Account.Name
FROM Contact
```

Notice:

```text
Account.Name
```

Think JavaScript property traversal:

```javascript
contact.account.name
```

That's much simpler than thinking in SQL JOINs.

---

# 5.21 Filtering using the parent

Suppose interviewer says:

> Get all Contacts whose Account is in Florida.

```sql
SELECT
    Id,
    FirstName,
    LastName,
    Email,
    Account.Name
FROM Contact
WHERE Account.BillingState = 'FL'
```

This is the answer I want you to immediately recognize.

No:

```sql
JOIN Account...
```

Instead:

```text
Contact → Account relationship
```

---

# 5.22 Interview scenario

> Find Contacts belonging to active enterprise Accounts.

Assume Account fields:

```text
Status__c
Customer_Tier__c
```

Then:

```sql
SELECT
    Id,
    FirstName,
    LastName,
    Email,
    Account.Id,
    Account.Name
FROM Contact
WHERE Account.Status__c = 'Active'
AND Account.Customer_Tier__c = 'Enterprise'
```

That's a very realistic integration query.

---

# 5.23 Parent → Children

Now go the other direction.

```text
Account
  │
  ├── Contact
  ├── Contact
  └── Contact
```

Question:

> Get Accounts and their Contacts.

You use a subquery:

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

Key detail:

```text
FROM Contacts
```

not necessarily:

```text
FROM Contact
```

because here you use the **child relationship name**.

This is something Salesforce developers often have to inspect from metadata rather than guess for custom relationships.

---

# 5.24 Child relationship names with custom objects

Imagine:

```text
Account
    ↓
Order__c
```

Maybe the parent-to-child relationship name is:

```text
Orders__r
```

A custom relationship commonly uses:

```text
__r
```

when traversing the relationship.

So you might encounter:

```sql
SELECT
    Id,
    Name,
    (
        SELECT Id, Order_Number__c
        FROM Orders__r
    )
FROM Account
```

Don't memorize the precise relationship name.

Look it up from Salesforce metadata/schema.

But recognize:

```text
__c = custom field/object
__r = custom relationship traversal
```

That's useful.

---

# 5.25 Parent relationship on a custom lookup

Suppose:

```text
Invoice__c
```

has:

```text
Customer__c
```

which is a lookup.

When traversing relationship fields, you might see:

```sql
SELECT
    Id,
    Customer__r.Name
FROM Invoice__c
```

Again:

```text
Customer__c
```

is the stored lookup field.

```text
Customer__r
```

is relationship traversal.

That's a good pair to recognize.

---

# 5.26 Your SQL instincts can hurt you

SQL brain:

```sql
SELECT *
FROM Contact c
JOIN Account a
ON c.AccountId = a.Id
```

SOQL brain:

```sql
SELECT
    Id,
    FirstName,
    Account.Name
FROM Contact
```

Salesforce relationship traversal is the key mental shift.

---

# 5.27 Semi-joins

Suppose we want Accounts that have Contacts meeting a condition.

Conceptually:

```sql
SELECT Id, Name
FROM Account
WHERE Id IN (
    SELECT AccountId
    FROM Contact
    WHERE Email LIKE '%@acme.com'
)
```

That's a **semi-join** style query.

Salesforce documentation also uses semi-join patterns to filter objects based on related records. ([Developer][6])

Useful for:

```text
Accounts with Contacts
Accounts with Opportunities
Accounts with Cases
```

matching criteria.

---

# 5.28 `LIKE`

Example:

```sql
SELECT Id, Name
FROM Account
WHERE Name LIKE 'Acme%'
```

Meaning approximately:

```text
starts with Acme
```

Or:

```sql
WHERE Email LIKE '%@example.com'
```

Again, resembles SQL.

---

# 5.29 ORDER BY

```sql
SELECT Id, Name, CreatedDate
FROM Account
ORDER BY CreatedDate DESC
```

For deterministic pagination/integration logic, sorting can matter.

You don't want to implicitly assume retrieval order.

---

# 5.30 LIMIT

```sql
SELECT Id, Name
FROM Account
ORDER BY CreatedDate DESC
LIMIT 100
```

Great during:

```text
development
debugging
validation
```

but don't accidentally leave:

```text
LIMIT 100
```

inside synchronization logic intended to retrieve everything.

Your QA brain should immediately ask:

> What happens when record 101 exists?

---

# 5.31 COUNT

Example:

```sql
SELECT COUNT()
FROM Account
WHERE Status__c = 'Active'
```

Salesforce supports aggregation such as `COUNT()` in SOQL. ([Developer][7])

Useful for:

```text
validation
reconciliation
monitoring
```

For example:

```text
source reports: 8,421 active customers
Salesforce reports: 8,419 active accounts
```

That doesn't prove two records are missing correctly—but it tells you to investigate.

---

# 5.32 Other aggregate concepts

Recognize:

```text
COUNT
SUM
AVG
MIN
MAX
GROUP BY
```

Example:

```sql
SELECT StageName, COUNT(Id)
FROM Opportunity
GROUP BY StageName
```

Conceptual result:

```text
Prospecting       127
Proposal           48
Negotiation        32
Closed Won         89
```

For Mule integration development, aggregate SOQL tends to matter more for:

```text
reporting
reconciliation
monitoring
decision logic
```

than basic CRUD.

---

# 5.33 A great QA/developer use case: reconciliation

Say Mule imports:

```text
10,000 customer records
```

Don't test only:

```text
request returned success
```

You might perform:

```text
count target records
sample IDs
compare key fields
find missing IDs
find unexpected duplicates
```

SOQL:

```sql
SELECT COUNT()
FROM Account
WHERE Import_Batch_ID__c = 'BATCH-817'
```

Then:

```sql
SELECT
    External_Customer_ID__c,
    Name
FROM Account
WHERE Import_Batch_ID__c = 'BATCH-817'
```

This is directly useful for both development debugging and automation.

---

# 5.34 Avoid querying unnecessary fields

Bad:

```text
retrieve giant Account representation
even though you only need Id
```

Better:

```sql
SELECT Id
FROM Account
WHERE External_Customer_ID__c = :externalId
```

Benefits:

```text
smaller payload
less memory
less serialization
clearer intent
```

Especially important inside integrations handling volume.

---

# 5.35 Avoid query-per-record

Classic N+1 problem.

Bad:

```text
For Each customer
    ↓
Salesforce Query
```

Input:

```text
500 customers
```

produces:

```text
500 queries
```

Instead:

```text
extract external IDs
       ↓
single/batched SOQL query with IN
       ↓
map result by external ID
       ↓
process
```

If your interviewer wants architectural thinking, mention:

> “I'd avoid an N+1 query pattern and retrieve related Salesforce state in batches where practical.”

Strong answer.

---

# 5.36 Building a lookup map in DataWeave

Suppose Salesforce returns:

```json
[
  {
    "Id": "001A",
    "External_Customer_ID__c": "C001"
  },
  {
    "Id": "001B",
    "External_Customer_ID__c": "C002"
  }
]
```

Conceptually you want:

```json
{
  "C001": "001A",
  "C002": "001B"
}
```

Then you can efficiently associate source records with Salesforce IDs.

This is where DataWeave tools such as:

```text
map
mapObject
groupBy
```

become relevant.

You don't need to memorize the exact one-liner yet; understand the optimization strategy.

---

# 5.37 SOQL versus SOSL

Know the distinction.

### SOQL

Use when:

```text
I know what objects/fields I need.
```

Example:

```sql
SELECT Id, Name
FROM Account
WHERE Name = 'Acme'
```

### SOSL

More search-oriented.

Use when:

```text
I need to search text across potentially multiple objects/fields.
```

Salesforce describes SOSL as search-index based and SOQL as the right choice when you know where your data lives or want relational/aggregate queries. ([Developer][1])

Think:

```text
SOQL
≈ structured database query

SOSL
≈ Salesforce search
```

For Mule integrations, SOQL is much more likely to dominate.

---

# 5.38 Object security matters

Just because:

```text
Account.Secret_Field__c
```

exists doesn't mean your integration user can read it.

Likewise, having an Update operation doesn't mean the integration user can modify every field.

Potential problems:

```text
object permission
field-level security
record access
sharing
API permissions
```

So:

```text
works for admin
```

does not prove:

```text
works for Mule integration user
```

That's important both in development and testing.

---

# 5.39 Sandbox versus production schema drift

Imagine QA Salesforce:

```text
New_Status__c
```

exists.

Production:

```text
field not deployed
```

Your Mule code deploys successfully.

First production request:

```text
INVALID_FIELD
```

This is why schema/environment consistency is an integration concern.

Things to verify:

```text
object exists
field exists
API name matches
field type matches
external ID configured
permissions configured
validation rules aligned
```

---

# 5.40 Salesforce validation rules

A perfectly valid Mule request can still fail downstream.

Example Account data:

```json
{
  "Name": "Acme",
  "Customer_Type__c": "Enterprise"
}
```

Salesforce has rule:

```text
Enterprise customer
requires AnnualRevenue
```

Connector gets a Salesforce validation failure.

So validation can exist at multiple layers:

```text
API contract validation
       ↓
Mule business validation
       ↓
Salesforce field constraints
       ↓
Salesforce validation rules
       ↓
Salesforce triggers/automation
```

You need to understand that a Salesforce write isn't just:

```text
database INSERT
```

It can trigger substantial Salesforce business logic.

---

# 5.41 Salesforce automation can surprise you

A Mule upsert may cause:

```text
validation rules
flows
triggers
workflow
duplicate rules
other automation
```

which might:

```text
reject record
change additional fields
create related records
send events
```

Therefore, when testing integration:

```text
request
  ↓
Mule
  ↓
Salesforce write
```

don't necessarily verify only the fields Mule sent.

You may need to validate the **resulting Salesforce state**.

---

# 5.42 Scenario 1 — find the Account

Requirement:

> Find the Salesforce Account corresponding to upstream customer C001.

```sql
SELECT
    Id,
    Name
FROM Account
WHERE External_Customer_ID__c = :customerId
```

Expected:

```text
0 results
→ not found

1 result
→ normal

>1
→ serious data integrity problem
```

---

# 5.43 Scenario 2 — retrieve Contacts

Requirement:

> Retrieve all Contacts for C001.

Option A:

First find Account ID:

```sql
SELECT Id
FROM Account
WHERE External_Customer_ID__c = :customerId
```

then:

```sql
SELECT Id, FirstName, LastName, Email
FROM Contact
WHERE AccountId = :accountId
```

But you may be able to make it one query:

```sql
SELECT
    Id,
    FirstName,
    LastName,
    Email
FROM Contact
WHERE Account.External_Customer_ID__c = :customerId
```

Cleaner.

---

# 5.44 Scenario 3 — Account and Contacts together

```sql
SELECT
    Id,
    Name,
    External_Customer_ID__c,
    (
        SELECT
            Id,
            FirstName,
            LastName,
            Email
        FROM Contacts
    )
FROM Account
WHERE External_Customer_ID__c = :customerId
```

Result conceptually:

```json
{
  "Id": "001ABC",
  "Name": "Acme",

  "Contacts": {
    "records": [
      {
        "Id": "003A",
        "FirstName": "John"
      },
      {
        "Id": "003B",
        "FirstName": "Sarah"
      }
    ]
  }
}
```

Then DataWeave turns that into your public API contract.

---

# 5.45 Scenario 4 — Open Opportunities

> Retrieve open Opportunities over $100,000 for active Accounts.

Conceptually:

```sql
SELECT
    Id,
    Name,
    Amount,
    StageName,
    Account.Id,
    Account.Name
FROM Opportunity
WHERE Amount > 100000
AND IsClosed = FALSE
AND Account.Status__c = 'Active'
```

You don't need to know every standard Opportunity field by memory; the relationship/query pattern is the important part.

---

# 5.46 Scenario 5 — Cases

> Retrieve open high-priority Cases for customer C001.

Conceptually:

```sql
SELECT
    Id,
    CaseNumber,
    Subject,
    Status,
    Priority,
    Contact.Name
FROM Case
WHERE Account.External_Customer_ID__c = :customerId
AND Priority = 'High'
AND IsClosed = FALSE
```

Now you sound perfectly comfortable traversing Salesforce relationships.

---

# 5.47 Scenario 6 — incremental Mule job

Every 15 minutes:

```text
Scheduler
 ↓
read lastSuccessfulSync
 ↓
Salesforce Query
 ↓
process changed Accounts
 ↓
upsert downstream
 ↓
store watermark
```

SOQL:

```sql
SELECT
    Id,
    Name,
    External_Customer_ID__c,
    LastModifiedDate
FROM Account
WHERE LastModifiedDate > :lastSuccessfulSync
ORDER BY LastModifiedDate
```

But immediately ask:

```text
What if records have exactly the same timestamp?

What if Mule crashes halfway?

What about deleted records?

What about overlap?

Can downstream processing safely repeat?
```

That's why integration design is much more than writing a query.

---

# 5.48 The interview question I promised

Interviewer:

> “We need Contacts belonging to Accounts where `Status__c = Active` and `Customer_Type__c = Premium`. How would you retrieve them?”

You can answer:

```sql
SELECT
    Id,
    FirstName,
    LastName,
    Email,
    Account.Id,
    Account.Name
FROM Contact
WHERE Account.Status__c = 'Active'
AND Account.Customer_Type__c = 'Premium'
```

And explain:

> “Because Contact has a parent relationship to Account, I can traverse that relationship directly in SOQL instead of doing a relational-style JOIN or necessarily issuing two separate queries.”

That is the key answer.

---

# 5.49 Questions they may ask

### Q: Is SOQL just SQL?

> “It's SQL-like, but designed specifically around Salesforce objects and relationships. Rather than arbitrary SQL joins, you usually traverse defined Salesforce parent/child relationships.”

Excellent.

---

### Q: What's `Account.Name` in a Contact query?

> “That's child-to-parent relationship traversal: I'm querying Contact but retrieving a field from its parent Account.”

---

### Q: How do I query Account with all its Contacts?

> “Use a parent-to-child relationship subquery, such as `SELECT Id, Name, (SELECT Id, Email FROM Contacts) FROM Account`.”

---

### Q: What's `__c`?

> “A custom Salesforce field or object API name typically ends in `__c`.”

---

### Q: What's `__r`?

> “It's commonly used when traversing a custom relationship rather than directly accessing the custom lookup field.”

---

### Q: What's SOQL vs SOSL?

> “SOQL is structured querying when I know the objects and fields; SOSL is more appropriate for text-search scenarios across potentially multiple objects.”

---

### Q: Would you issue a Salesforce query inside a Mule `For Each` for 1,000 input records?

> “I'd try hard not to. That's an N+1 API pattern. I'd generally collect identifiers and query Salesforce in batches using `IN` or another appropriate bulk strategy.”

That answer sounds experienced.

---

# 5.50 What you actually need to memorize

This:

```sql
SELECT Id, Name
FROM Account
WHERE External_Customer_ID__c = :customerId
```

This:

```sql
SELECT
    Id,
    FirstName,
    LastName,
    Account.Name
FROM Contact
WHERE Account.Status__c = 'Active'
```

And this:

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

Plus:

```text
Account
    ↓
Contacts

Account
    ↓
Opportunities

Account
    ↓
Cases
```

and:

```text
__c
custom field/object

__r
custom relationship
```

If those become familiar, you have enough Salesforce data-model literacy for a Mule integration interview.

---

## Module 5 condensed cheat sheet

```text
SALESFORCE MODEL
-----------------

Account
  company/customer organization

Contact
  person
  AccountId → Account

Opportunity
  potential deal
  AccountId → Account

Case
  support/customer issue
  AccountId → Account
  ContactId → Contact


CUSTOMIZATION
-------------

Foo__c
  custom field/object

Foo__r
  custom relationship traversal


SOQL
----

SELECT Id, Name
FROM Account
WHERE ...

No normal SQL-style JOIN thinking.


CHILD → PARENT

SELECT
    FirstName,
    Account.Name
FROM Contact


PARENT → CHILD

SELECT
    Name,
    (SELECT Email FROM Contacts)
FROM Account


INTEGRATION CONCERNS
--------------------

External IDs
N+1 queries
batch querying
incremental synchronization
watermarks
permissions
Salesforce validation rules
partial failures
schema drift
idempotency
```

The next module should be **Module 6: Mule routing and orchestration — Choice, For Each, Parallel For Each, Scatter-Gather, Flow Reference, subflows, and when NOT to use each one.** This is important because once an interviewer gives you anything more complex than “transform and upsert,” those are the components you'll use to actually assemble the business process.

[1]: https://developer.salesforce.com/docs/service/salesforce-knowledge-dev-guide/guide/sforce-api-calls-sosl-about.html?utm_source=chatgpt.com "About SOSL | SOQL and SOSL | Salesforce Knowledge Developer Guide | Salesforce Developers"
[2]: https://developer.salesforce.com/docs/platform/data-models/guide/case.html?utm_source=chatgpt.com "Case | Data 360 | Data Model Gallery | Salesforce Developers"
[3]: https://developer.salesforce.com/docs/marketing/marketing-cloud-growth/guide/mc-manage-objects-query-soql.html?utm_source=chatgpt.com "Understand SOQL Queries | Manage Records | Marketing Cloud Next | Salesforce Developers"
[4]: https://developer.salesforce.com/docs/data/data-cloud-query-guide/guide/dc-soql.html?utm_source=chatgpt.com "SOQL With Apex | Query Data in Data 360 | Data 360 Query Guide | Salesforce Developers"
[5]: https://developer.salesforce.com/blogs/developer-relations/2013/05/basic-soql-relationship-queries?utm_source=chatgpt.com "Basic SOQL Relationship Queries | Salesforce Developers Blog"
[6]: https://developer.salesforce.com/docs/platform/graphql/guide/query-record-examples.html?utm_source=chatgpt.com "Query Objects Examples | Query Records | GraphQL API | Salesforce Developers"
[7]: https://developer.salesforce.com/docs/platform/webconsole/guide/query-builder.html?utm_source=chatgpt.com "Query Builder | Query Records (Beta) | Web Console (Beta) | Salesforce Developers"
