# Module 14 — External Automated Testing of Mule Integrations

This is where your existing API/UI automation background maps almost directly onto Mule development.

The key difference from MUnit is:

> **MUnit tests inside the Mule application. External automation tests the deployed integration from the outside.**

For example:

```text
Playwright/API test
      ↓
Mule API
      ↓
Salesforce
      ↓
verify final Salesforce state
```

That is a true integration or end-to-end test.

---

## 14.1 What belongs in external automation?

Use external automation to prove things MUnit cannot:

```text
real deployed Mule endpoint works

real authentication works

real Salesforce connector works

real SOQL/schema/permissions work

real environment configuration is correct

Salesforce records are actually created/updated

asynchronous processing really completes

idempotency works against real infrastructure
```

MUnit can simulate Salesforce.

External tests prove Salesforce actually participates correctly.

---

# 14.2 The basic test pattern

Suppose we have:

```http
POST /customers
```

Request:

```json
{
  "customerId": "AUTO-928374",
  "companyName": "Automation Test Company",
  "phone": "4075551234"
}
```

Expected workflow:

```text
test
 ↓
POST Mule
 ↓
Mule DataWeave
 ↓
Salesforce Upsert
 ↓
Account created
```

Your automated test does two levels of verification:

```text
1. API response

2. Salesforce resulting state
```

That distinction is important.

---

# 14.3 Why response-only testing is insufficient

Suppose Mule responds:

```json
{
  "success": true
}
```

But due to a defect:

```text
BillingState → Phone
Phone → BillingState
```

The API response may still look perfect.

So:

```text
HTTP 200
```

does not prove:

```text
Salesforce state is correct
```

For important flows, verify both.

---

# 14.4 Playwright can be used purely as an API client

You don't need a browser.

A TypeScript test could conceptually be:

```typescript
import { test, expect } from '@playwright/test';

test('creates Salesforce Account', async ({ request }) => {
  const customerId = `AUTO-${Date.now()}`;

  const response = await request.post('/customers', {
    data: {
      customerId,
      companyName: 'Automation Test Company',
      phone: '4075551234'
    }
  });

  expect(response.status()).toBe(201);

  const body = await response.json();

  expect(body.customerId).toBe(customerId);
  expect(body.success).toBe(true);
});
```

Then separately query Salesforce.

---

# 14.5 Test data must be unique

Never hardcode every test to:

```text
customerId = C001
```

because:

```text
parallel tests collide
old data contaminates results
reruns behave differently
tests become order-dependent
```

Generate unique business identifiers:

```typescript
const customerId =
  `AUTO-${Date.now()}-${crypto.randomUUID()}`;
```

This is especially important when testing Salesforce upserts.

---

# 14.6 But deterministic IDs are useful for idempotency tests

For an idempotency scenario:

```text
first call:
IDEMP-123

second call:
IDEMP-123
```

must intentionally use the same identifier.

So distinguish:

```text
normal isolation
→ unique test ID

idempotency test
→ deliberate reuse
```

---

# 14.7 Verifying Salesforce

There are several possible approaches.

Best case:

```text
test-only/support API
```

or:

```text
Salesforce API
```

that lets automation query:

```sql
SELECT
    Id,
    Name,
    Phone
FROM Account
WHERE External_Customer_ID__c = :customerId
```

Then assert:

```text
one Account exists
Name correct
Phone correct
```

---

# 14.8 Don't verify Salesforce through its UI unless necessary

Avoid:

```text
Playwright browser
 ↓
log into Salesforce UI
 ↓
search Account
 ↓
inspect fields
```

if API/SOQL access exists.

UI verification is:

```text
slower
more brittle
harder to parallelize
less direct
```

Prefer API-level verification.

Use UI only when the Salesforce UI behavior itself is under test.

---

# 14.9 A good reusable Salesforce helper

Conceptually:

```typescript
async function findAccountByExternalId(
  request,
  customerId: string
) {
  const soql = `
    SELECT Id, Name, Phone
    FROM Account
    WHERE External_Customer_ID__c = '${customerId}'
  `;

  // Salesforce API query here
}
```

In real code, avoid unsafe string concatenation when user-controlled values are possible; encode/query appropriately.

The test intent is:

```text
query target state directly
```

---

# 14.10 Test structure

A clean API integration test might look like:

```typescript
test('customer is mapped to Salesforce Account', async ({ request }) => {

  // Arrange
  const customer = makeCustomer();

  // Act
  const response = await createCustomer(request, customer);

  // Assert API
  expect(response.status()).toBe(201);

  // Assert target system
  const account =
    await salesforce.findAccount(customer.customerId);

  expect(account.Name).toBe(customer.companyName);
  expect(account.Phone).toBe(customer.phone);
});
```

This is simple and strong.

---

# 14.11 Cleanup

Your tests create real Salesforce data.

You need a policy.

Options:

```text
delete after test

mark records as automation data

periodic cleanup job

dedicated Salesforce sandbox refreshed periodically
```

A useful convention:

```text
External ID:
AUTOTEST-...

Test_Data__c:
true
```

if the Salesforce schema permits it.

Then cleanup can safely find automation records.

---

# 14.12 Cleanup must not hide failures

Bad:

```typescript
await create();
await verify();
await delete();
```

If verification throws:

```text
delete never runs
```

Use fixture/`finally` cleanup where appropriate.

Conceptually:

```typescript
try {
   ...
} finally {
   await cleanup();
}
```

But be cautious: when a test fails, keeping the record temporarily may help debugging.

---

# 14.13 Test via the public contract

External tests should generally call:

```text
actual Mule endpoint
```

not internal subflows.

Example:

```http
POST https://qa-api.company.com/customers
```

because you want to validate:

```text
routing
APIKit
security
configuration
DataWeave
Salesforce connector
error mapping
```

as deployed.

---

# 14.14 Schema validation

Suppose OpenAPI says response:

```json
{
  "customerId": "string",
  "salesforceId": "string",
  "success": true
}
```

Your tests should validate the response against the OpenAPI schema, not only individual fields.

Conceptually:

```text
response
 ↓
OpenAPI validator
 ↓
schema valid?
```

This catches accidental changes such as:

```text
salesforceId
→ salesForceId
```

or:

```text
boolean success
→ string "true"
```

---

# 14.15 Contract testing is different from business testing

Schema test:

```text
field exists
correct type
allowed enum
required fields
```

Business assertion:

```text
customerId matches input
Account was created once
status was correctly derived
```

You need both.

---

# 14.16 Negative contract tests

Input schema says:

```text
customerId required
companyName required
```

Test:

```json
{
  "companyName": "Acme"
}
```

Expected:

```text
400
```

But also verify:

```text
no Salesforce Account was created
```

This is a powerful negative test.

---

# 14.17 Test "no side effect"

For invalid input:

```text
POST /customers
→ 400
```

then SOQL:

```sql
SELECT Id
FROM Account
WHERE External_Customer_ID__c = :testId
```

Expected:

```text
0 records
```

This proves validation happens before the write.

---

# 14.18 Upsert test

You should explicitly test both halves of upsert.

### First request

```text
External ID does not exist
```

Expected:

```text
Account created
```

Store Salesforce ID.

### Second request

Same:

```text
customerId
```

but changed:

```text
phone
```

Expected:

```text
same Salesforce Id
new Phone
exactly one Account
```

This is one of the most valuable Mule→Salesforce integration tests.

---

# 14.19 Example

First:

```json
{
  "customerId": "IDEMP-100",
  "companyName": "Acme",
  "phone": "111"
}
```

Query Salesforce:

```text
Id = 001ABC
Phone = 111
```

Second:

```json
{
  "customerId": "IDEMP-100",
  "companyName": "Acme",
  "phone": "222"
}
```

Verify:

```text
Id = 001ABC
Phone = 222
count = 1
```

That proves both update behavior and duplicate prevention.

---

# 14.20 Count matters

Don't merely query:

```sql
SELECT Id
FROM Account
WHERE External_Customer_ID__c = 'IDEMP-100'
LIMIT 1
```

That would still pass with three duplicates.

For idempotency, explicitly verify:

```text
record count = 1
```

Then inspect the one record.

---

# 14.21 Concurrent idempotency test

This is even stronger.

Send the same request:

```text
10 times concurrently
```

Conceptually:

```typescript
await Promise.all(
  Array.from({ length: 10 }, () =>
    createCustomer(request, sameCustomer)
  )
);
```

Then query Salesforce:

```text
count = 1
```

This can reveal the Query→Create race we discussed in Module 12.

---

# 14.22 Eventual consistency changes assertions

Suppose endpoint is asynchronous:

```http
POST /customers
→ 202 Accepted
```

You cannot immediately do:

```text
query Salesforce
→ expect record
```

because Salesforce may not be updated yet.

Instead:

```text
poll until condition
```

---

# 14.23 Polling helper

Conceptually:

```typescript
async function waitForAccount(
  customerId: string,
  timeoutMs = 30000
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const account =
      await findAccount(customerId);

    if (account) return account;

    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error(
    `Account ${customerId} did not appear`
  );
}
```

Then:

```typescript
const account =
  await waitForAccount(customer.customerId);
```

---

# 14.24 Don't use arbitrary sleeps

Bad:

```typescript
await page.waitForTimeout(10000);
```

or:

```typescript
await new Promise(r => setTimeout(r, 10000));
```

Then query once.

Why bad?

```text
sometimes 1 sec was enough
→ tests unnecessarily slow

sometimes 12 sec needed
→ test flakes
```

Better:

```text
poll expected condition
with timeout
```

This is the same principle you already know from UI automation.

---

# 14.25 Poll the business condition, not just record existence

If async flow creates Account first and Contacts later:

```text
Account appears
```

doesn't mean processing is complete.

Poll for:

```text
Account exists
AND
expected Contacts exist
AND
Integration_Status__c = COMPLETE
```

if such a status exists.

Choose a condition representing actual completion.

---

# 14.26 Async status endpoint

Even better if API provides:

```http
GET /requests/{requestId}
```

Then automation can first poll:

```text
status = COMPLETED
```

and afterward verify Salesforce.

This tests the public async contract properly.

---

# 14.27 Timeout behavior

Test async jobs that never complete.

Example:

```text
Mule accepted request
but downstream processing deliberately fails
```

Verify:

```text
status becomes FAILED
```

rather than:

```text
PROCESSING forever
```

Operational lifecycle is part of the contract.

---

# 14.28 Salesforce relationship tests

For input:

```json
{
  "customerId": "C001",
  "contacts": [
    {
      "contactId": "P001",
      "firstName": "John",
      "lastName": "Smith"
    }
  ]
}
```

Verify:

```text
Account exists

Contact exists

Contact.AccountId
==
Account.Id
```

Do not merely verify both records independently.

The relationship is part of the integration.

---

# 14.29 Parent update + child upsert

Test rerun:

```text
same Account
same Contact external IDs
```

with changed:

```text
Contact email
```

Expected:

```text
same Account
same Contact
updated email
no duplicate child
```

This is a high-value realistic test.

---

# 14.30 Optional field semantics

Remember DataWeave conditional fields?

Existing Salesforce:

```text
Phone = 3055551234
```

Request omits phone:

```json
{
  "customerId": "C001",
  "companyName": "Acme"
}
```

If contract means:

> omitted = don't change

verify:

```text
Phone remains 3055551234
```

This catches a very common transformation defect:

```text
missing source field
→ mapped to null
→ clears Salesforce field
```

---

# 14.31 Explicit clear test

If API supports:

```json
{
  "phone": null
}
```

meaning:

> clear Phone

then verify that separately.

You need to distinguish:

```text
field omitted

vs

field explicitly null
```

if the contract distinguishes them.

---

# 14.32 Data type tests

Example Salesforce field:

```text
AnnualRevenue
```

Input:

```json
{
  "annualRevenue": "1500000.50"
}
```

Verify Salesforce stores:

```text
1500000.50 as numeric value
```

Likewise test:

```text
dates
booleans
picklists
decimal precision
```

where mapping matters.

---

# 14.33 Boundary tests

If API accepts:

```text
1–500 customers
```

test:

```text
0
1
499
500
501
```

Expected:

```text
0 maybe invalid
1 success
500 success
501 rejected
```

depending on contract.

This is classic QA, but it's especially important for Mule because implementation might switch between batch/collection behavior.

---

# 14.34 Collection partial failures

Suppose API processes:

```text
3 records
```

Input:

```text
C001 valid

C002 missing required field

C003 valid
```

If contract allows partial success, verify:

```json
{
  "processed": 3,
  "succeeded": 2,
  "failed": 1
}
```

and Salesforce:

```text
C001 exists
C002 absent
C003 exists
```

The response alone isn't enough.

---

# 14.35 Salesforce validation-rule test

Suppose Salesforce has a rule:

```text
Enterprise Account requires AnnualRevenue
```

Send:

```json
{
  "customerId": "C001",
  "customerType": "Enterprise"
}
```

without revenue.

This should prove:

```text
real Salesforce validation
↓
Mule connector error
↓
Mule error mapping
↓
correct API response
```

That cannot be fully proven with a mock.

---

# 14.36 Permission tests

If Mule uses a restricted integration user, external environment tests should prove:

```text
allowed fields
→ work

required object access
→ works
```

You may also deliberately test a forbidden operation in a dedicated environment if appropriate.

This catches:

```text
worked under admin credentials
failed under production-like account
```

---

# 14.37 Schema drift tests

Before or after deployment, a smoke test can query:

```text
required object/field metadata
```

or simply execute representative SOQL/writes.

If:

```text
External_Customer_ID__c
```

wasn't deployed to QA, you'd rather detect that immediately after deployment than from the first customer transaction.

---

# 14.38 Deployment smoke suite

A good post-deployment smoke suite might be only:

```text
health endpoint

one read flow

one Salesforce upsert

one update

one relationship flow

one expected validation error
```

Fast.

Purpose:

> Is this environment fundamentally functional?

Not full regression.

---

# 14.39 Smoke vs regression

### Smoke

```text
minutes
critical integration health
run after deployment
```

### Regression

```text
broader behavior coverage
more data combinations
error scenarios
perhaps nightly
```

Do not make deployment wait an hour for every possible edge case unless risk demands it.

---

# 14.40 Environment-safe testing

Never let automation accidentally hit:

```text
Production Salesforce
```

because someone misconfigured:

```text
BASE_URL
```

Safeguards:

```text
explicit environment check

allowlisted Salesforce org ID

test-data prefix requirement

production credentials unavailable to QA CI

fail test setup if target environment doesn't identify as QA
```

This is worth engineering deliberately.

---

# 14.41 Example safety guard

Your test setup could call:

```text
GET /environment
```

and require:

```json
{
  "environment": "QA"
}
```

before destructive tests start.

Or query Salesforce organization metadata and verify expected org identity.

Don't rely solely on a URL naming convention.

---

# 14.42 Test-data setup APIs

Best tests don't manually prepare Salesforce state.

Create helpers such as:

```text
createSalesforceAccount()
deleteSalesforceAccount()
createSourceCustomer()
publishCustomerEvent()
```

or, better where available:

```text
supported test/setup APIs
```

Then each test owns its setup.

---

# 14.43 Direct setup vs going through the system under test

Suppose you're testing:

```text
update existing customer
```

For setup, should you create the initial Account through:

```text
the same Mule POST /customers
```

or:

```text
Salesforce API directly
```

Both are useful for different goals.

### Through Mule

More realistic but couples setup to functionality under test.

### Directly

Better isolation:

```text
arrange state
without exercising the same code
you're about to test
```

For many tests I'd prefer direct Salesforce/API setup.

---

# 14.44 Example

Testing update:

```text
Arrange:
directly insert Salesforce Account C001

Act:
call Mule update endpoint

Assert:
Salesforce Account changed
```

Now if test fails you know:

```text
update path failed
```

rather than:

```text
maybe setup through create path failed
```

Good test isolation.

---

# 14.45 But setup must respect real schema

Direct Salesforce setup can accidentally bypass:

```text
business pathways
```

So choose setup method based on what you're testing.

Not everything needs maximal isolation.

---

# 14.46 Error injection in external tests

This is harder than MUnit.

You shouldn't randomly shut down Salesforce.

Instead you may use:

```text
mock downstream service in QA

WireMock-like test service

bad but valid test credentials in a dedicated test

known Salesforce validation condition

test-only failure switch
```

Avoid destabilizing shared environments.

---

# 14.47 Test Salesforce unavailable?

Pure end-to-end test:

```text
turn off Salesforce
```

is usually impractical.

That's exactly why MUnit exists.

So split:

```text
MUnit
→ exhaustive connector failure paths

external tests
→ selected real failure cases
```

Good testing strategy is about choosing the right layer.

---

# 14.48 What error scenarios should be external?

Good candidates:

```text
real validation-rule failure

record not found

duplicate/unique constraint

permissions in a controlled test org

bad request schema

business-rule rejection
```

Not necessarily:

```text
simulate internet cable cut
```

in every QA run.

---

# 14.49 Contract mismatch between Mule APIs

From Module 9:

```text
Experience API
↓
Process API
↓
System API
```

You don't need every regression test to traverse all three.

Have contract tests at each boundary.

Example:

```text
Process API assumes
System API response schema v1
```

Validate that contract independently.

Then have fewer true E2E tests through the full stack.

---

# 14.50 Performance testing

External automation is also where you can test:

```text
latency
throughput
concurrency
```

For normal API:

```text
p50
p95
p99
error rate
```

For async:

```text
acceptance latency
processing latency
queue lag
```

For bulk:

```text
records/sec
overall job duration
failure rate
```

Don't mix performance expectations across those models.

---

# 14.51 Load test the integration, not just Mule

If you send:

```text
500 requests/sec
```

and Mule happily accepts them while Salesforce gets destroyed, that's not a successful performance test.

Monitor:

```text
Mule CPU/memory

Mule errors

Salesforce API usage

Salesforce locking

queue depth

downstream latency
```

Integration performance is end-to-end capacity.

---

# 14.52 Rate-limiting tests

If API policy allows:

```text
100 requests/minute
```

test:

```text
within limit
→ accepted

over limit
→ expected rate-limit response
```

And verify rejected requests did not trigger Salesforce side effects.

Again:

```text
negative response
+
negative downstream verification
```

---

# 14.53 Correlation ID tests

Send:

```http
X-Correlation-ID: TEST-123
```

Verify where observable:

```text
response contains/preserves it
```

and in integration/log environments, optionally confirm traceability.

You usually don't want brittle tests scraping logs for every request, but correlation propagation is worth validating.

---

# 14.54 Security-focused API tests

Test:

```text
missing auth
→ 401

invalid token
→ 401

authenticated but unauthorized
→ 403

valid client
→ success
```

Also verify error body does not leak:

```text
Salesforce token
client secret
internal stack trace
SOQL containing sensitive details
```

---

# 14.55 Don't assert raw downstream error messages

Bad test:

```typescript
expect(body.message)
  .toBe('INVALID_FIELD_FOR_INSERT_UPDATE...');
```

if your public API contract intentionally normalizes errors.

Better:

```typescript
expect(body.code)
  .toBe('INVALID_CUSTOMER');
```

Otherwise your tests lock the API to Salesforce implementation details.

---

# 14.56 CI test layers

A useful pipeline might be:

```text
Pull Request
============
MUnit
lint/build
DataWeave/unit tests
contract tests


Deploy QA
=========
smoke integration tests


Nightly
=======
larger Salesforce integration suite
error scenarios
idempotency
relationship tests


Scheduled / pre-release
=======================
full regression
performance if required
```

Don't run everything everywhere.

---

# 14.57 Parallel test execution

External API tests can run in parallel only if test data is isolated.

Otherwise:

```text
test A updates C001
test B deletes C001
```

and chaos follows.

Use:

```text
unique IDs
independent Accounts
independent Contacts
```

unless concurrency interaction itself is the scenario being tested.

---

# 14.58 Avoid shared mutable fixtures

Bad:

```text
All tests use:
Automation Test Account
```

Test 1 changes phone.

Test 2 expects old phone.

Flaky suite.

Prefer:

```text
one logical test
→ owns its data
```

Same principle as Playwright UI automation.

---

# 14.59 Use tags

You might categorize:

```text
@smoke
@salesforce
@integration
@async
@idempotency
@bulk
@destructive
```

Then CI chooses suites appropriately.

Very useful in large integration test repositories.

---

# 14.60 A realistic Playwright/API project structure

Something like:

```text
tests/
  customers/
    create.spec.ts
    update.spec.ts
    validation.spec.ts
    idempotency.spec.ts

  contacts/
    relationships.spec.ts

  async/
    customer-events.spec.ts

helpers/
  mule-api.ts
  salesforce-api.ts
  polling.ts
  test-data.ts

schemas/
  customer-response.schema.json
```

You already know this style well.

---

# 14.61 What the Salesforce helper should hide

Tests shouldn't all contain OAuth/SOQL plumbing.

Instead:

```typescript
const account =
  await salesforce.getAccountByExternalId(id);
```

Helper owns:

```text
Salesforce authentication
query encoding
SOQL execution
response parsing
```

Tests remain about business behavior.

---

# 14.62 But don't create a giant "god helper"

Bad:

```typescript
salesforce.doEverything();
```

Useful helpers expose clear operations:

```typescript
getAccountByExternalId()
countAccountsByExternalId()
createAccount()
deleteTestAccount()
getContactsForAccount()
```

Readable test intent matters.

---

# 14.63 Best interview answer: MUnit vs external automation

If they ask:

> “How would you split Mule testing between MUnit and your automation framework?”

Say:

> “I'd use MUnit heavily for flow logic—DataWeave mappings, Choice branches, mocked connector responses, error handlers, retries and verifying side effects aren't invoked incorrectly. Then I'd use a smaller external API suite against a deployed Mule environment and Salesforce sandbox to prove authentication, SOQL, schema, permissions, real External-ID behavior and actual target state. Full end-to-end tests should be selective because they're slower and more environment-dependent.”

That's a very strong answer.

---

# 14.64 Interview scenario: async integration

> Mule returns 202 and eventually updates Salesforce. How do you automate that?

Answer:

> “I'd assert the 202 contract first, capture the request or correlation ID, then poll either the public status endpoint or Salesforce state until the expected business condition becomes true, using a bounded timeout. I wouldn't use a fixed sleep because that makes the suite slow and flaky.”

Perfect.

---

# 14.65 Interview scenario: idempotency

> How would you prove the integration is idempotent?

Answer:

> “I'd submit the same business request repeatedly—including concurrently—then query Salesforce by the stable External ID. I'd verify there's exactly one record, that its ID remains unchanged, and that its final field state is correct. I'd also inspect other non-idempotent side effects such as events or notifications rather than checking only Salesforce.”

Excellent.

---

# 14.66 Interview scenario: schema validation

> How do you use OpenAPI in testing?

Answer:

> “I validate deployed Mule request and response payloads against the OpenAPI contract so breaking type, required-field, enum, and structural changes are detected automatically. Then I add business assertions separately because schema validity doesn't prove semantic correctness.”

Strong and concise.

---

# 14.67 Interview scenario: API says success but Salesforce is wrong

> How do you catch that?

Answer:

> “For critical integration tests I verify both sides of the boundary: the Mule API response and Salesforce state through its API/SOQL. A successful HTTP response alone doesn't prove the DataWeave mapping or downstream write was correct.”

Exactly.

---

# 14.68 The testing matrix to remember

| Test concern           |    MUnit | External deployed test |
| ---------------------- | -------: | ---------------------: |
| DataWeave mapping      |        ✅ |               selected |
| Choice routing         |        ✅ |               selected |
| Error handler          |        ✅ |               selected |
| Mock timeout           |        ✅ |             usually no |
| Salesforce OAuth       |        ❌ |                      ✅ |
| SOQL validity          |        ❌ |                      ✅ |
| Salesforce permissions |        ❌ |                      ✅ |
| Validation rules       |   mocked |                      ✅ |
| External ID behavior   |   mocked |                      ✅ |
| API schema             | possible |                      ✅ |
| True E2E state         |        ❌ |                      ✅ |
| Concurrent idempotency |  limited |                      ✅ |
| Eventual consistency   |  limited |                      ✅ |

That table is probably the most useful summary of this module.

---

# Module 14 Cheat Sheet

```text
EXTERNAL TEST
=============

client
 ↓
deployed Mule
 ↓
real Salesforce
 ↓
verify target state


VERIFY TWO THINGS
=================

API response

AND

Salesforce result


USE SALESFORCE API / SOQL
=========================

prefer direct backend verification
over Salesforce UI


TEST DATA
=========

unique per test

except when intentionally
testing idempotency


ASYNC
=====

202
↓
poll condition
↓
bounded timeout

never fixed sleep


IDEMPOTENCY
===========

send same request repeatedly
and concurrently

verify:
count = 1
same Salesforce ID
correct final state


NEGATIVE TESTS
==============

bad input
→ proper error

AND

no Salesforce side effect


CONTRACT
========

OpenAPI schema validation
+
business assertions


MUNIT
=====

fast/internal/mocked


EXTERNAL
========

real deployment/config/auth/schema/
permissions/downstream state
```

The interview sentence to memorize is:

> **“For deployed integration tests I don't stop at HTTP assertions—I verify the resulting Salesforce state through API/SOQL. For asynchronous flows I poll the business completion condition rather than sleep, and for idempotency I repeat the same request concurrently and prove there is exactly one downstream business entity.”**

The next module is **Module 15: Deployment and Operations** — Maven project structure, build/deploy lifecycle, CloudHub 2.0, Runtime Manager, environment promotion, CI/CD, runtime properties, logs, health checks, rollback, and what you need to know when someone asks, “Okay, you wrote the Mule flow—how does it actually get into production?”
