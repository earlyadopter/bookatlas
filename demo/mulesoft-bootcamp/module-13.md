# Module 13 — MUnit

This is the module where your QA background gives you the biggest advantage.

MUnit is MuleSoft’s native testing framework for Mule applications. It supports unit/integration-style testing, mocking processors, assertions, verification of processor calls, tagging, and coverage reporting, and it integrates with Maven/Surefire for CI/CD. ([MuleSoft Documentation][1])

The mental model is:

```text
Arrange
↓
Act
↓
Assert
```

but in MUnit terms it often looks like:

```text
Behavior
↓
Execution
↓
Validation
```

---

## 13.1 What should MUnit test?

For a Mule flow like:

```text
HTTP request
   ↓
Validate
   ↓
Transform
   ↓
Salesforce Upsert
   ↓
Choice
   ↓
Transform response
```

you do **not** want every test calling a real Salesforce sandbox.

Most tests should answer questions like:

```text
Given this input,
does the flow:

- generate the correct Salesforce payload?
- choose the correct branch?
- handle connector failures correctly?
- return the right API response?
- call Salesforce exactly once?
- avoid Salesforce calls when validation fails?
```

That is what MUnit is excellent at.

---

# 13.2 Testing pyramid for Mule

Think roughly:

```text
                 Few
          ┌────────────────┐
          │ Full E2E tests │
          │ Mule → real SF │
          └────────────────┘

             Some
       ┌──────────────────────┐
       │ Integration/contract │
       │ tests                │
       └──────────────────────┘

              Many
    ┌────────────────────────────┐
    │ MUnit                      │
    │ mocked connectors          │
    │ flow logic                 │
    │ DataWeave                  │
    │ error handling             │
    └────────────────────────────┘
```

If all tests require:

```text
real Salesforce
real Billing
real database
real queues
```

they become:

```text
slow
fragile
environment-dependent
hard to diagnose
```

---

# 13.3 Basic MUnit test structure

Conceptually:

```xml
<munit:test name="customer-flow-test">

    <munit:behavior>
        <!-- mocks -->
    </munit:behavior>

    <munit:execution>
        <!-- invoke production flow -->
    </munit:execution>

    <munit:validation>
        <!-- assertions -->
    </munit:validation>

</munit:test>
```

Mentally map this to Playwright/Jest:

```typescript
test('customer flow', async () => {

    // arrange / mocks

    // act

    // assert
});
```

This should feel very familiar.

---

# 13.4 A production flow to test

Let's use:

```text
process-customer-flow
```

Input:

```json
{
  "customerId": "C001",
  "companyName": "Acme"
}
```

Flow:

```text
payload
 ↓
Transform Salesforce Account
 ↓
Salesforce Upsert
 ↓
Transform response
```

Expected API output:

```json
{
  "customerId": "C001",
  "salesforceId": "001ABC",
  "success": true
}
```

Our MUnit test should **not need Salesforce**.

---

# 13.5 Set Event

First we need to create the Mule event that our production flow receives.

Conceptually:

```xml
<munit:set-event>

    <munit:payload
        value='#[{
            customerId: "C001",
            companyName: "Acme"
        }]'
        mediaType="application/json"/>

</munit:set-event>
```

Think:

```typescript
const request = {
    customerId: "C001",
    companyName: "Acme"
};
```

MUnit provides dedicated processors for setting, mocking, validating, and asserting Mule events. ([MuleSoft Documentation][2])

---

# 13.6 Mock Salesforce

Production flow has:

```text
Salesforce Upsert
```

We don't want it connecting externally.

So:

```text
Mock When
```

Conceptually:

```xml
<munit-tools:mock-when
    processor="salesforce:upsert">

    <munit-tools:then-return>

        <munit-tools:payload
            value='#[[
                {
                    id: "001ABC",
                    success: true
                }
            ]]'/>

    </munit-tools:then-return>

</munit-tools:mock-when>
```

Meaning:

> When production flow reaches Salesforce Upsert, don't call Salesforce. Return this instead.

`Mock When` identifies the processor and can return a mocked payload or error. ([MuleSoft Documentation][3])

---

# 13.7 Then execute the real flow

```xml
<munit:execution>

    <flow-ref name="process-customer-flow"/>

</munit:execution>
```

Everything in:

```text
process-customer-flow
```

runs normally except the mocked Salesforce operation.

That's very similar to:

```typescript
salesforce.upsert = jest.fn()
    .mockResolvedValue(...);

await processCustomer();
```

---

# 13.8 Assert the result

MUnit's `Assert That` processor validates the Mule event using matchers. ([MuleSoft Documentation][4])

Example:

```xml
<munit-tools:assert-that
    expression="#[payload.customerId]"
    is="#[MunitTools::equalTo('C001')]"/>
```

Then:

```xml
<munit-tools:assert-that
    expression="#[payload.salesforceId]"
    is="#[MunitTools::equalTo('001ABC')]"/>
```

And:

```xml
<munit-tools:assert-that
    expression="#[payload.success]"
    is="#[MunitTools::equalTo(true)]"/>
```

That's just assertion syntax.

---

# 13.9 Complete mental example

```text
TEST
│
├── Behavior
│     └── Mock Salesforce Upsert
│             → id=001ABC
│
├── Execution
│     ├── Set request payload
│     └── Call process-customer-flow
│
└── Validation
      ├── customerId == C001
      ├── salesforceId == 001ABC
      └── success == true
```

That's MUnit in one picture.

---

# 13.10 Verify Call

Assertions tell you:

```text
what result did I get?
```

But sometimes you need:

```text
was Salesforce actually called?
```

Use:

```text
Verify Call
```

MUnit's Verify processor can assert that a particular processor was called a specific number of times or with matching attributes. ([MuleSoft Documentation][5])

Example conceptually:

```xml
<munit-tools:verify-call
    processor="salesforce:upsert"
    times="1"/>
```

Think Jest:

```typescript
expect(salesforce.upsert)
    .toHaveBeenCalledTimes(1);
```

This should be instantly familiar.

---

# 13.11 State verification vs behavior verification

Two different tests:

### State

```text
payload.success == true
```

### Behavior

```text
Salesforce Upsert called exactly once
```

Good tests often use both when behavior matters.

But don't verify every internal processor call.

Otherwise tests become tightly coupled to implementation.

---

# 13.12 Bad over-verification

Suppose flow currently is:

```text
Set Variable
↓
Transform
↓
Logger
↓
Salesforce
```

Test verifies:

```text
Set Variable called once
Transform called once
Logger called once
Salesforce called once
```

Then you refactor implementation without changing behavior.

Every test breaks.

That's not useful.

Prefer verifying meaningful boundaries:

```text
Salesforce called
Billing not called
specific subflow selected
event published
```

---

# 13.13 Test DataWeave output indirectly

Suppose input:

```json
{
  "customerId": "C001",
  "companyName": "Acme",
  "phone": null
}
```

Production transformation should create:

```json
{
  "External_Customer_ID__c": "C001",
  "Name": "Acme"
}
```

without:

```text
Phone
```

How do you test it?

One approach:

```text
mock Salesforce
but inspect what Mule attempted to send
```

Depending on flow design, you can:

```text
Spy processor
capture variables
test transformation subflow
```

or separate DataWeave enough that the transformation can be tested cleanly.

---

# 13.14 Spy

MUnit can **Spy** processors as well as mock them. ([MuleSoft Documentation][1])

Conceptually, Spy lets the real component/process execute while giving you visibility around it.

Think:

```typescript
jest.spyOn(...)
```

rather than:

```typescript
jest.mock(...)
```

Use it when you want to observe:

```text
payload before processor
payload after processor
```

without replacing the processor's behavior.

---

# 13.15 Mock vs Spy

Memorize:

```text
Mock
====
replace behavior


Spy
===
observe real behavior
```

Same concept you're already familiar with from normal automation frameworks.

---

# 13.16 Test Choice branches

Production flow:

```text
Choice

operation == DELETE
   ↓
deactivate-account-subflow

otherwise
   ↓
upsert-account-subflow
```

You need separate tests.

### Test 1

```json
{
  "operation": "DELETE"
}
```

Verify:

```text
deactivate subflow called
upsert subflow NOT called
```

### Test 2

```json
{
  "operation": "UPSERT"
}
```

Verify inverse.

This is classic branch coverage.

---

# 13.17 Example

Conceptually:

```text
Given:
operation=DELETE

When:
process-customer-flow executes

Then:
deactivate Salesforce operation called once
upsert operation called zero times
```

That is exactly how you would test business routing in Playwright/API automation—just at a lower level.

---

# 13.18 Testing validation

Suppose required:

```text
customerId
companyName
```

Test:

```json
{
  "companyName": "Acme"
}
```

Expected:

```text
validation error
```

Critically verify:

```text
Salesforce NOT called
```

because this catches a potentially dangerous defect where invalid input produces side effects before validation.

---

# 13.19 The important negative assertion

Sometimes the best test assertion is:

> **This should never happen.**

For invalid request:

```text
Verify Salesforce Upsert = 0 calls
```

That's often more valuable than merely asserting:

```text
status = 400
```

because maybe flow returns 400 **after already modifying Salesforce**.

---

# 13.20 Fail processor

MUnit also has a processor that deliberately fails the test if execution reaches it. ([MuleSoft Documentation][6])

Conceptually:

```text
If code reaches here:
TEST SHOULD FAIL
```

Useful for proving:

```text
this branch must never execute
```

although most of the time explicit assertions/verifications are clearer.

---

# 13.21 Mock Salesforce error

This is where MUnit becomes extremely valuable.

Instead of waiting for Salesforce to actually fail:

```text
Mock Salesforce Upsert
↓
throw SALESFORCE:CONNECTIVITY
```

MUnit's mock processor can be configured to return a Mule error type, allowing you to trigger the application's real error handling. ([MuleSoft Documentation][3])

Conceptually:

```xml
<munit-tools:mock-when
    processor="salesforce:upsert">

    <munit-tools:then-return>
        <munit-tools:error
            typeId="#['SALESFORCE:CONNECTIVITY']"/>
    </munit-tools:then-return>

</munit-tools:mock-when>
```

Now your production error handler runs.

---

# 13.22 Test the actual error behavior

Production:

```text
Salesforce Upsert
 ↓
CONNECTIVITY
 ↓
Until Successful
 ↓
retry exhausted
 ↓
503 response
```

MUnit should verify:

```text
HTTP/business status = 503

error contract correct

correlationId present

Salesforce called correct number of times
```

where applicable.

You can exercise failure logic deterministically without turning off Salesforce.

---

# 13.23 Test business validation error differently

Mock:

```text
SALESFORCE:INVALID_INPUT
```

Expected:

```text
do NOT retry
```

Then verify:

```text
Salesforce call count = 1
```

and output:

```json
{
  "code": "INVALID_CUSTOMER"
}
```

This tests your Module 7 error classification.

---

# 13.24 Retry test

Suppose production has retry logic.

You want:

```text
attempt 1 → timeout
attempt 2 → timeout
attempt 3 → success
```

For more dynamic mocks, MUnit supports `then-call`, where a mock delegates to another flow that can vary its behavior based on state. ([MuleSoft Documentation][3])

Conceptually:

```text
mock flow

if attempt == 1
   error
if attempt == 2
   error
if attempt == 3
   success
```

Then verify final success.

---

# 13.25 But don't over-test Mule itself

You don't need a test proving:

```text
Until Successful retries
```

because MuleSoft already tests Mule.

Test **your configured behavior**:

```text
configured retry scope eventually returns correct result

permanent error doesn't enter retry path

retry exhaustion maps correctly
```

Don't re-test framework internals.

---

# 13.26 Assert entire objects

You can compare the entire payload:

```xml
<munit-tools:assert-that
    expression="#[payload]"
    is="#[
      MunitTools::equalTo({
        customerId: 'C001',
        salesforceId: '001ABC',
        success: true
      })
    ]"/>
```

For small stable structures, that's fine.

For larger payloads, asserting every irrelevant field creates brittle tests.

---

# 13.27 Assert important contract fields

Instead of comparing:

```text
37 fields
```

you might assert:

```text
customerId
status
salesforceId
errorCode
```

unless full payload equality is the contract you're intentionally testing.

Same test-design judgment as elsewhere.

---

# 13.28 Modern DataWeave assertions

Current MUnit also provides an `Assert Expression` processor using the DataWeave assertions library (`dw::test::Asserts`) for richer expressions and custom matchers. Those matchers are distinct from the older `MunitTools` matcher set. ([MuleSoft Documentation][7])

Conceptually:

```dataweave
payload must [
    $.customerId must equalTo("C001"),
    $.success must equalTo(true)
]
```

You do not need to memorize both assertion syntaxes for the interview.

Know:

```text
Assert That
→ MUnit matchers

Assert Expression
→ DataWeave assertions
```

---

# 13.29 MUnit 2026 detail

Current MUnit 3.7.0, released February 3, 2026, changed assertion failures to the native Mule error type:

```text
MUNIT-TOOLS:ASSERTION_ERROR
```

rather than the older Java `AssertionError` behavior. It supports Mule runtime 4.3+ and current Java versions including 17 and 21. ([MuleSoft Documentation][8])

You probably won't be asked this, but don't be confused if you see:

```text
MUNIT-TOOLS:ASSERTION_ERROR
```

in recent logs/docs.

---

# 13.30 Testing subflows

Remember:

```text
upsert-account-subflow
```

You can test it directly.

Test:

```text
input Mule event
↓
invoke subflow
↓
verify result
```

This is analogous to testing a helper/service method independently from your HTTP controller.

Great for:

```text
DataWeave mappings
Choice logic
local error handling
```

---

# 13.31 A good decomposition for testability

Production:

```text
customer-api-flow
      ↓
validate-customer
      ↓
map-salesforce-account
      ↓
upsert-account
      ↓
build-response
```

Instead of one enormous flow.

Then MUnit can separately exercise:

```text
mapping behavior
business routing
error behavior
top-level orchestration
```

Clear responsibilities make testing easier.

---

# 13.32 But don't create subflows only because you want tests

You don't need:

```text
one component
=
one subflow
```

just so it can be tested.

Maintainable architecture first.

Test at meaningful behavioral boundaries.

---

# 13.33 Testing Scatter-Gather

Production:

```text
Scatter-Gather
 ┌─────┼─────┐
 ↓     ↓     ↓
SF  Billing Loyalty
```

MUnit:

```text
mock all three downstream boundaries
```

Test success:

```text
SF      → Acme
Billing → 100
Loyalty → Gold
```

Verify aggregated response:

```json
{
  "name": "Acme",
  "balance": 100,
  "loyaltyLevel": "Gold"
}
```

---

# 13.34 Then test partial failure

Mock:

```text
Salesforce → success
Billing → HTTP timeout
Loyalty → success
```

If contract says degraded response:

```json
{
  "name": "Acme",
  "balance": null,
  "loyaltyLevel": "Gold",
  "warnings": [...]
}
```

assert exactly that.

This is much easier in MUnit than intentionally breaking a real Billing environment.

---

# 13.35 Testing For Each

Suppose:

```text
3 customers
↓
For Each
↓
process-customer-subflow
```

Verify:

```text
process-customer-subflow
called 3 times
```

MUnit's verification processors support call-count checks. ([MuleSoft Documentation][5])

Then test:

```text
customer #2 fails
```

and your expected partial-failure semantics.

---

# 13.36 Mocking different loop iterations

Sometimes you need:

```text
item 1 → success
item 2 → failure
item 3 → success
```

MUnit can use `then-call` to invoke mocked logic whose return varies by iteration/state. MuleSoft documents this pattern specifically for mocks inside For Each. ([MuleSoft Documentation][9])

You don't need exact syntax memorized.

Just know it's possible.

---

# 13.37 Testing idempotency

This is very important.

At MUnit level, you can test:

```text
same logical input
↓
flow twice
```

with mocked/persistent state as appropriate.

But real idempotency often depends on:

```text
Salesforce unique External ID
database unique constraint
Object Store
message broker
```

So not all of it belongs in pure unit tests.

This leads to the key distinction:

> MUnit proves your flow logic. Integration tests prove the real infrastructure semantics.

---

# 13.38 What should be mocked?

Usually mock:

```text
Salesforce
HTTP APIs
databases where DB behavior isn't under test
email
queues
external services
```

when testing:

```text
flow logic
routing
mapping
error handling
```

---

# 13.39 What should NOT always be mocked?

Some tests need real integration infrastructure.

Examples:

```text
Does this SOQL actually work?

Does Salesforce External ID really enforce uniqueness?

Does restricted integration user have the required permissions?

Does the real Salesforce validation rule reject this record?

Does OAuth configuration work?

Does Bulk API handle our actual object schema?
```

MUnit mocks cannot prove those.

---

# 13.40 The big testing trap

Imagine this MUnit test:

```text
mock Salesforce
→ success
```

All tests green.

Production:

```text
INVALID_FIELD:
Customer_Status__c doesn't exist
```

Why?

Because you mocked the thing that validates schema.

That's why you need both:

```text
fast MUnit tests
+
targeted real Salesforce integration tests
```

---

# 13.41 Suggested test split

For our Salesforce customer API:

### MUnit — many

```text
DataWeave mapping
Choice branches
validation
error mapping
retry decision logic
response transformation
connector invocation
partial failure behavior
```

### Salesforce sandbox integration — some

```text
authentication
SOQL
Account Upsert
External ID
Contact relationships
permissions
validation rules
real response structures
```

### E2E — fewer

```text
HTTP API
↓
Mule deployed environment
↓
Salesforce Sandbox
↓
verify Salesforce state
```

That's a mature strategy.

---

# 13.42 Contract tests

Suppose Salesforce System API promises:

```json
{
  "customerId": "string",
  "status": "string"
}
```

MUnit can assert the System API's output.

External automation can validate against OpenAPI schema.

Both layers are valuable:

```text
MUnit
→ internal implementation correctness

API contract test
→ consumer-facing contract correctness
```

---

# 13.43 MUnit coverage

MUnit supports coverage reporting. ([MuleSoft Documentation][1])

You may encounter metrics around:

```text
flow coverage
processor coverage
```

But don't fall into:

> “95% MUnit coverage = good integration.”

Coverage tells you:

```text
which code/processors executed
```

not:

```text
whether important scenarios were tested
```

Given your QA background, this is a strong point to make.

---

# 13.44 Better than chasing coverage

Prioritize:

```text
critical business paths
error branches
Salesforce failures
timeouts
duplicate/retry behavior
partial failures
permission/schema failures
boundary volumes
```

Then look at coverage for blind spots.

Not the reverse.

---

# 13.45 Test naming

Good:

```text
customer_upsert_existing_customer_updates_account

customer_missing_id_does_not_call_salesforce

salesforce_timeout_after_retries_returns_service_unavailable

delete_operation_deactivates_account
```

Bad:

```text
test1
test2
customerTest
```

Same principles as any mature test suite.

---

# 13.46 Test fixtures

You already know fixtures from Playwright.

Use test resource files for representative payloads:

```text
src/test/resources/

customers/
    valid-customer.json
    missing-id.json
    premium-customer.json

salesforce/
    upsert-success.json
    validation-error.json
```

Then tests don't contain giant inline JSON documents everywhere.

---

# 13.47 Test DataWeave with known input/output fixtures

Example:

```text
input:
customer.json

expected:
salesforce-account.json
```

Then:

```text
run transformation
↓
assert expected structure
```

This is one of the safest ways to refactor complex DataWeave.

---

# 13.48 Golden-file caution

If expected JSON is huge:

```text
expected-output.json
```

one small legitimate output change may cause noisy failures.

Use golden files when full contract equality matters.

Otherwise assert meaningful structures/fields.

---

# 13.49 Avoid environment dependence in MUnit

Bad unit test:

```text
requires:
QA Salesforce
VPN
specific Account C001 already exists
```

That's not really a unit test.

Good MUnit tests should generally:

```text
run locally
run in CI
repeat reliably
require no manually prepared external data
```

---

# 13.50 CI/CD

Because MUnit integrates with Maven/Surefire, it fits normal pipelines. ([MuleSoft Documentation][1])

Conceptually:

```text
GitHub PR
   ↓
mvn test
   ↓
MUnit
   ↓
coverage/report
   ↓
build artifact
   ↓
deploy
```

If MUnit fails:

```text
don't deploy
```

Same pattern you're already familiar with from Playwright/Jest pipelines.

---

# 13.51 A realistic test suite

For:

```text
POST /customers
```

I'd expect tests approximately like:

```text
1. valid new customer
2. valid existing customer
3. missing customerId
4. missing companyName
5. optional phone omitted
6. DELETE operation
7. unsupported operation
8. Salesforce invalid input
9. Salesforce connectivity failure
10. retry exhaustion
11. Salesforce success response mapping
12. Contacts correctly mapped to Account
13. one Contact failure
14. repeated request behavior
```

Not necessarily all as MUnit; some belong at integration level.

---

# 13.52 Example interview question

> How would you test a Mule flow without calling Salesforce?

Answer:

> “I'd use MUnit `Mock When` around the Salesforce connector operation, return a controlled connector result, execute the real flow, then assert the resulting Mule event and use Verify Call where it matters to confirm Salesforce was invoked correctly.”

Perfect.

---

# 13.53 “How would you test error handling?”

> “I'd configure the mock to throw the same Mule error type the connector can produce—for example a Salesforce connectivity error—then let the production error handler execute and assert the resulting error mapping, response and retry behavior.”

Very strong.

---

# 13.54 “Would you mock everything?”

> “No. I'd mock external boundaries heavily for fast deterministic flow tests, but I'd retain integration tests against a Salesforce sandbox for things mocks can't prove—authentication, SOQL, schema, permissions, External ID behavior, Salesforce validation rules, and actual connector compatibility.”

Exactly right.

---

# 13.55 “What's Verify Call?”

> “It's behavior verification. It lets me assert that a particular Mule processor was called with matching attributes and an expected number of times.” ([MuleSoft Documentation][5])

---

# 13.56 “What's Assert That?”

> “It asserts the state of the Mule event using MUnit matchers—for example checking payload values, nullability, or other expected conditions.” ([MuleSoft Documentation][4])

---

# 13.57 “What's Mock When?”

> “It replaces the behavior of a matching Mule processor during the test and can return controlled payloads or errors. That lets me test flow behavior without invoking the real external dependency.” ([MuleSoft Documentation][3])

---

# 13.58 QA-to-developer connection

Your existing test instincts translate almost one-to-one:

```text
Playwright/API test concept     MUnit

fixture                     →   Set Event/test resources

API mock                    →   Mock When

expect(...)                 →   Assert That

spy/mock verification       →   Verify Call

helper                      →   test flow/subflow

simulate 500               →   mock connector error

test branch                →   Choice-path MUnit test
```

The main difference is that you're now testing **inside the Mule application** rather than only through its external endpoint.

---

# 13.59 The test I most want you to describe in an interview

Suppose flow:

```text
POST customer
 ↓
validate
 ↓
Salesforce Upsert
```

Tell them:

> “I'd have an MUnit test where Salesforce Upsert is mocked to return success and assert the response mapping. Then I'd have negative tests where Salesforce throws connectivity versus invalid-input errors to prove transient and permanent failures take different handlers. I'd also verify that invalid inbound requests never invoke Salesforce. Separately, I'd keep a smaller Salesforce sandbox suite proving the actual SOQL, permissions, external-ID upsert and validation-rule behavior.”

That answer demonstrates both:

```text
MUnit knowledge
+
real-world testing judgment
```

---

# Module 13 cheat sheet

```text
MUNIT
=====

native Mule testing framework


TEST STRUCTURE
==============

Behavior
  mocks

Execution
  invoke flow

Validation
  assertions/verifications


SET EVENT
=========

create input:
payload
attributes
vars


MOCK WHEN
=========

replace processor behavior

Salesforce
HTTP
DB
etc.

can return:
payload
error


ASSERT THAT
===========

assert Mule event state


VERIFY CALL
===========

did processor execute?
how many times?


SPY
===

observe real processor
without replacing it


IMPORTANT TESTS
===============

happy path
Choice branches
validation
DataWeave mappings
error handlers
retry exhaustion
partial failures
negative side-effect checks


DO NOT MOCK EVERYTHING
======================

real Salesforce tests still needed for:

SOQL
schema
permissions
OAuth
validation rules
External ID uniqueness
real connector behavior


CI
==

MUnit + Maven
run on PR/build


COVERAGE
========

useful signal
not proof of quality
```

The interview sentence to memorize:

> **“I use MUnit to isolate Mule flow behavior by mocking external processors, asserting the resulting Mule event, and verifying meaningful downstream calls. I keep real Salesforce integration tests separately because mocks cannot prove SOQL, schema, permissions, authentication, validation rules, or true External-ID behavior.”**

Next is **Module 14: external automated testing of Mule integrations** — this will map directly to your current skillset: API tests from Playwright/TypeScript, test-data setup through APIs, verifying Mule responses plus Salesforce state, schema validation, eventual-consistency polling, idempotency tests, negative/error tests, and deciding what belongs in MUnit versus external end-to-end automation.

[1]: https://docs.mulesoft.com/munit/latest/?utm_source=chatgpt.com "MUnit Overview | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/munit/latest/event-processors?utm_source=chatgpt.com "MUnit Event Processors | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/munit/2.3/mock-event-processor?utm_source=chatgpt.com "Mock When Event Processor | MuleSoft Documentation"
[4]: https://docs.mulesoft.com/munit/latest/assertion-event-processor?utm_source=chatgpt.com "Assert That Event Processor | MuleSoft Documentation"
[5]: https://docs.mulesoft.com/munit/latest/verify-event-processor?utm_source=chatgpt.com "Verify Event Processor | MuleSoft Documentation"
[6]: https://docs.mulesoft.com/munit/latest/fail-event-processor?utm_source=chatgpt.com "Fail Event Processor | MuleSoft Documentation"
[7]: https://docs.mulesoft.com/munit/latest/assertion-expression-processor?utm_source=chatgpt.com "Assert Expression | MuleSoft Documentation"
[8]: https://docs.mulesoft.com/release-notes/munit/munit-3.7.0-release-notes?utm_source=chatgpt.com "MUnit 3.7.0 Release Notes | MuleSoft Documentation"
[9]: https://docs.mulesoft.com/munit/latest/mock-before-after-foreach-cookbook?utm_source=chatgpt.com "Mocking a Message Before and Inside a Foreach Processor | MuleSoft Documentation"
