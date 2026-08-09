# Module 11 — Salesforce Bulk Processing + Mule Batch Jobs

This module is about what changes when the requirement is no longer:

```text
“process 1 customer”
```

but:

```text
“process 100,000 customers”
```

At that point, a normal synchronous flow with a `For Each` and one Salesforce call per record is usually the wrong design.

The two concepts to separate are:

```text
Salesforce Bulk API
vs
Mule Batch Job
```

They solve related but different problems.

---

## 11.1 The simplest mental model

Think:

```text
Mule Batch
==========
How Mule processes a large collection reliably

Salesforce Bulk API
===================
How Salesforce accepts/processes large record volumes efficiently
```

They can be used together.

Example:

```text
CSV with 500,000 customers
        ↓
Mule Batch Job
        ↓
transform / validate / partition
        ↓
Salesforce Bulk API v2
        ↓
Salesforce
```

Mule batch processing is explicitly designed for reliable asynchronous processing of large datasets and can persist work so batch executions can survive crashes/redeployments. ([MuleSoft Documentation][1])

---

# 11.2 Why normal CRUD stops scaling

Suppose:

```text
250,000 Accounts
```

Naive implementation:

```text
For Each
   ↓
Salesforce Upsert
```

That's potentially:

```text
250,000 connector operations
```

Problems:

```text
API limits
network overhead
very long runtime
Salesforce throttling
memory
error recovery
restartability
```

Instead, large data movement should usually be **batch-oriented**.

---

# 11.3 Salesforce Bulk API

The Salesforce Connector exposes Bulk API functionality, including current **Bulk API v2** operations for insert, update, upsert, delete, and bulk query jobs. ([MuleSoft Documentation][2])

The basic Bulk API mental model is:

```text
Create job
   ↓
send dataset
   ↓
Salesforce processes asynchronously
   ↓
check job state
   ↓
retrieve success/failure results
```

This is very different from:

```text
Upsert one Account
↓
wait for immediate result
```

---

# 11.4 Bulk API v2 write example

Requirement:

> Upsert 200,000 Accounts by `External_Customer_ID__c`.

Conceptually:

```text
source data
   ↓
DataWeave → Salesforce shape
   ↓
Bulk API v2 job
operation = UPSERT
object = Account
external ID = External_Customer_ID__c
   ↓
Salesforce processes job
```

The current connector exposes `create-job-bulk-api-v2` for operations including insert, update, delete, hard delete, and upsert. ([MuleSoft Documentation][2])

---

# 11.5 Why Bulk API is asynchronous

If Salesforce had to synchronously return after processing:

```text
500,000 rows
```

you'd have enormous timeout problems.

Instead:

```text
submit
 ↓
receive job ID
 ↓
Salesforce keeps working
```

Something like:

```text
jobId = 750ABC...
```

Then later:

```text
Get Job State
```

The connector has a Bulk API v2 operation specifically for retrieving job state. ([MuleSoft Documentation][2])

---

# 11.6 Job lifecycle

Conceptually:

```text
OPEN / submitted
      ↓
processing
      ↓
job complete
```

Then inspect:

```text
successful records
failed records
possibly unprocessed records
```

Don't obsess over exact status strings for the interview.

Think:

> **Bulk work is job-oriented.**

---

# 11.7 Bulk query

Bulk isn't only for writes.

Suppose:

> Extract 2 million Accounts from Salesforce.

Normal synchronous query may be inappropriate.

Bulk Query API:

```text
Create Query Job
      ↓
Salesforce runs SOQL asynchronously
      ↓
check status
      ↓
retrieve pages/results
```

The current connector supports `Create Query Job Bulk API V2`, including `QUERY` and `QUERY_ALL`. ([MuleSoft Documentation][2])

---

# 11.8 Bulk query scenario

Example:

```sql
SELECT
    Id,
    Name,
    External_Customer_ID__c,
    LastModifiedDate
FROM Account
WHERE LastModifiedDate >= :startDate
```

If that returns:

```text
3,000 records
```

ordinary Query may be perfectly fine.

If it returns:

```text
3,000,000 records
```

Bulk Query becomes much more interesting.

---

# 11.9 Pagination and memory

Current MuleSoft documentation notes that Bulk API v2 query-result retrieval supports paging and that page size affects both API call count and memory usage. The connector can automatically retrieve the pages. ([MuleSoft Documentation][2])

This is a very important engineering tradeoff:

```text
larger pages
→ fewer requests
→ more memory per page

smaller pages
→ more requests
→ less memory pressure
```

Don't answer:

> “Always use the largest page size.”

Think in tradeoffs.

---

# 11.10 Streaming

With large data, the word:

```text
streaming
```

becomes important.

Bad approach:

```text
read 5 million rows
↓
construct one giant in-memory array
↓
transform everything
```

Potential result:

```text
OutOfMemoryError
```

Better architecture processes data incrementally where the connectors and use case permit.

The Bulk API v2 query result operation exposes streaming strategies including in-memory, file-store, and non-repeatable-stream options. ([MuleSoft Documentation][2])

---

# 11.11 Repeatable vs non-repeatable streams

High-level only:

### Repeatable

Data can effectively be read again.

May require:

```text
memory
or
temporary file storage
```

### Non-repeatable

Consume once.

Potentially lighter-weight.

But if downstream logic tries to read it twice:

```text
problem
```

For interview purposes:

> “For large payloads I'd pay attention to streaming strategy rather than automatically materializing the entire result in memory.”

Excellent.

---

# 11.12 Mule Batch Job

Now let's switch from Salesforce to Mule.

Mule Batch Job is designed for:

```text
large collections
ETL
synchronization
large API/file/database imports
```

MuleSoft explicitly lists examples like synchronization between business applications and large ETL workloads. ([MuleSoft Documentation][1])

Architecture:

```text
Batch Job
   ↓
Batch Step 1
   ↓
Batch Step 2
   ↓
...
   ↓
On Complete
```

---

# 11.13 Batch Job internals

Imagine input:

```text
100,000 customers
```

Mule Batch takes those records and manages their processing in blocks/queues rather than treating them as one giant normal flow payload.

Conceptually:

```text
Batch Job

Load records
   ↓

Customer 1
Customer 2
Customer 3
...
Customer 100,000

   ↓

Batch Step
   ↓

Batch Step
   ↓

On Complete
```

The current docs describe Batch Job as splitting source data into records and using persistent queues for reliability. ([MuleSoft Documentation][1])

---

# 11.14 Batch Step

A **Batch Step** defines processing applied to records.

Example:

```text
Batch Job
   ↓
Step 1:
validate customer
   ↓
Step 2:
transform customer
   ↓
Step 3:
send to downstream
```

Each record moves through the steps according to success/failure policies.

---

# 11.15 Record-level processing

Inside a Batch Step:

```text
payload
```

represents the current batch record.

You can use:

```text
payload
vars
```

inside batch components.

One detail worth knowing: MuleSoft's current Batch reference says message `attributes` are not available inside Batch Step/Aggregator processing; they resolve as `null`. ([MuleSoft Documentation][3])

Nice Mule-specific interview fact.

---

# 11.16 Batch failures don't necessarily stop everything

This is one of the best features.

Suppose:

```text
100,000 records
```

and customer #432 is bad.

You usually don't want:

```text
record #432 fails
↓
entire 100k job stops
```

Mule Batch tracks record success/failure and can continue processing other records based on step policies. ([MuleSoft Documentation][4])

That's ideal for:

```text
data migration
large synchronization
ETL
```

---

# 11.17 `maxFailedRecords`

Mule Batch lets you define how many record failures are acceptable before stopping the job.

Conceptually:

```text
maxFailedRecords = 100
```

If:

```text
3 fail
```

continue.

If:

```text
101 fail
```

stop job.

MuleSoft documents `maxFailedRecords` as the property controlling how many failures can occur before the batch stops. ([MuleSoft Documentation][4])

---

# 11.18 Why this matters

Imagine source file:

```text
500,000 customers
```

and one has:

```text
email = "not-an-email"
```

It would be absurd to discard:

```text
499,999 good customers
```

automatically.

Batch architectures usually support **record-level failure isolation**.

---

# 11.19 Batch Step accept policies

Suppose Step 1 validates.

Some records fail.

Step 2 might say:

```text
only process records that succeeded previously
```

or potentially target failed records depending on design.

Conceptually:

```text
Step 1: validate

   valid → SUCCESS
   invalid → FAILED


Step 2:
accept only SUCCESS
```

This lets you build pipelines where bad records are filtered from later processing.

The current docs describe subsequent steps skipping failed records according to the step `acceptPolicy`. ([MuleSoft Documentation][4])

---

# 11.20 Example batch pipeline

Let's design:

> Sync 200,000 source customers into Salesforce.

```text
Scheduler
   ↓
Read customers
   ↓
Batch Job
   ↓

Step 1
Validate
   ↓

Step 2
Normalize / DataWeave
   ↓

Step 3
Group records
   ↓

Salesforce Bulk Upsert
   ↓

On Complete
report counts
```

This is a legitimate enterprise pattern.

---

# 11.21 Batch Aggregator

This one matters a lot.

If Mule Batch processes records individually, but Salesforce prefers arrays/batches, you need to aggregate records.

Enter:

```text
Batch Aggregator
```

Conceptually:

```text
record
record
record
record
...
   ↓
Aggregator size = 200
   ↓
[200 records]
   ↓
Salesforce operation
```

MuleSoft describes Batch Aggregator as grouping processed records so a processor capable of handling an array can operate on them. ([MuleSoft Documentation][1])

---

# 11.22 Why Aggregator is important

Bad:

```text
Batch processes 100,000 records

for each record:
Salesforce call
```

Still potentially:

```text
100,000 calls
```

Better:

```text
aggregate e.g. 200 records
        ↓
Salesforce batch/bulk operation
```

Now you're using Mule Batch for record management while also using downstream batching efficiently.

---

# 11.23 Aggregator fixed size

Conceptually:

```text
size = 200
```

Then:

```text
records 1–200
→ array

201–400
→ array

401–600
→ array
```

etc.

The last batch may be smaller.

That's exactly how MuleSoft documents fixed-size Batch Aggregator behavior. ([MuleSoft Documentation][5])

---

# 11.24 Aggregator streaming mode

A Batch Aggregator can also operate in streaming mode instead of waiting for a fixed-size block.

You don't need the exact implementation details for interview survival.

Know that you can choose between:

```text
fixed-size aggregation
```

and:

```text
streaming aggregation
```

depending on how you need to feed downstream processors. ([MuleSoft Documentation][4])

---

# 11.25 Mule Batch vs Salesforce Bulk API again

Let's make the distinction crystal clear.

### Mule Batch

Controls:

```text
how Mule processes records
```

Example:

```text
validate
transform
route failures
aggregate
report
```

### Salesforce Bulk API

Controls:

```text
how Salesforce processes large record sets
```

Example:

```text
Bulk upsert 100,000 Accounts
```

They complement each other.

---

# 11.26 You don't always need both

Case:

```text
Input CSV
→ already perfectly Salesforce-ready
→ 100,000 records
```

Maybe simply:

```text
read/stream CSV
↓
Bulk API v2
```

is enough.

No reason to create elaborate Mule Batch stages if you're merely passing clean data through.

Conversely:

```text
complex validation
multiple transformations
different routing
multiple downstream systems
```

makes Mule Batch more valuable.

---

# 11.27 Normal Connector vs Bulk API

A useful interview heuristic:

### Normal Salesforce operation

Use for:

```text
interactive request
small number of records
latency-sensitive transaction
```

### Bulk API

Use for:

```text
large migration
mass sync
ETL
hundreds of thousands/millions of records
```

Don't quote a magical number like:

> “At 10,001 records you must use Bulk API.”

There isn't one universal threshold.

Say:

> “I'd base it on volume, latency requirements, API limits, recovery needs, and whether the workload is transactional or data-movement oriented.”

Much better.

---

# 11.28 Batch size tuning

If you aggregate:

```text
10 records
```

you might make too many downstream calls.

If you aggregate:

```text
100,000 records
```

you might use too much memory or hit Salesforce/API payload limits.

So tune:

```text
batch size
```

based on:

```text
record size
memory
Salesforce limits
downstream throughput
failure granularity
```

---

# 11.29 Failure granularity tradeoff

Imagine batch size:

```text
1
```

One bad record affects one operation.

But overhead is huge.

Batch size:

```text
10,000
```

Efficient, but error handling may become more complicated.

You want a practical compromise.

---

# 11.30 Salesforce partial failures

Suppose a bulk upsert contains:

```text
10,000 Accounts
```

Salesforce result:

```text
9,950 success
50 failed
```

Your job is not:

```text
log “Bulk job finished”
```

and walk away.

You need to capture:

```text
which 50
why
whether retryable
source identifiers
```

Example error output:

```json
{
  "externalId": "C01982",
  "errorCode": "FIELD_CUSTOM_VALIDATION_EXCEPTION",
  "message": "AnnualRevenue is required"
}
```

---

# 11.31 Separate transient vs permanent bulk errors

Same rule as Module 7.

### Permanent/data

```text
missing required field
bad picklist value
validation rule
invalid lookup
duplicate external ID/data problem
```

Don't blindly retry.

### Transient/platform

```text
temporary connectivity
service unavailable
some locking/throttling conditions
```

Potentially retry.

But preferably retry only failed records, not all 100k.

---

# 11.32 Don't replay successful records unnecessarily

Suppose:

```text
100,000 submitted
98,000 succeed
2,000 fail transiently
```

Bad recovery:

```text
retry all 100,000
```

Even if upsert is idempotent, you're wasting:

```text
time
Salesforce capacity
API resources
```

Better:

```text
identify failed transient records
↓
retry only those
```

---

# 11.33 External IDs are even more valuable in bulk

Imagine bulk job times out from Mule's perspective.

You don't know whether Salesforce processed some/all records.

If you're using:

```text
CREATE
```

replay can create duplicates.

If you're using:

```text
UPSERT
by External_Customer_ID__c
```

replay is much safer.

Same idempotency principle, now at scale.

---

# 11.34 Parent-child bulk load

Suppose you need:

```text
100,000 Accounts
500,000 Contacts
```

Contacts need Account relationships.

One strategy:

```text
1. Bulk upsert Accounts

2. obtain / correlate Account IDs

3. transform Contacts

4. Bulk upsert Contacts
```

But this can be simplified if Salesforce external-ID relationships fit your schema.

Either way, **load ordering and relationship resolution matter**.

---

# 11.35 Don't assume all entities can load in parallel

Example:

```text
Contact.AccountId
```

requires an Account.

If Salesforce relationship resolution depends on parent records being present:

```text
Account load
must precede
Contact load
```

Same with:

```text
Opportunity → Account
Case → Account/Contact
```

Think dependency graph.

---

# 11.36 Large synchronization design

Requirement:

> Every night synchronize 1 million customer records into Salesforce.

I'd immediately ask:

```text
Do all 1 million change daily?
```

Probably not.

Better:

```text
incremental/delta sync
```

using:

```text
LastModifiedDate
watermark
CDC
source change log
```

Then maybe only:

```text
25,000
```

actually need processing tonight.

The best bulk optimization is often:

> Don't process data that hasn't changed.

---

# 11.37 Full reload vs delta load

### Full load

```text
all records every time
```

Simple.

But expensive.

### Delta/incremental

```text
only changed records
```

More efficient.

But requires:

```text
watermark correctness
deletion handling
reconciliation
replay strategy
```

This ties Modules 5 and 10 together.

---

# 11.38 Deletes are the awkward part

Suppose source record disappears.

Your query:

```text
WHERE LastModifiedDate > watermark
```

won't necessarily tell you:

```text
this record was deleted
```

You may need:

```text
source tombstone/change event
Query All
CDC
explicit active/inactive flag
periodic reconciliation
```

This is why sync design often gets complicated.

---

# 11.39 Reconciliation

Even a beautifully designed delta sync can drift.

Therefore periodically compare:

```text
source
vs
Salesforce
```

Example:

```text
count by status
missing external IDs
unexpected duplicates
sample checks
hash/checksum strategies
```

A mature integration includes:

```text
normal sync
+
reconciliation
```

not just optimistic assumptions.

---

# 11.40 On Complete

Mule Batch has an `On Complete` phase after record processing finishes.

This is where you might log/report:

```text
total records
successful
failed
elapsed time
job ID
```

Mule Batch produces a completion result summarizing record success/failure. ([MuleSoft Documentation][1])

Example:

```json
{
  "job": "customer-nightly-sync",
  "processed": 200000,
  "successful": 199842,
  "failed": 158
}
```

---

# 11.41 Don't use On Complete for every record

`On Complete` is job-level reporting.

Don't wait until the very end to preserve all failure details only in memory.

For large jobs, failed record information should be written appropriately:

```text
error table
object store
error file
DLQ
monitoring system
```

depending on design.

---

# 11.42 Batch Jobs are asynchronous

An important behavioral point:

A Batch Job is naturally asynchronous in relation to the flow that launches it.

Think:

```text
Scheduler/API
   ↓
start batch
   ↓
batch runs independently
```

That makes it inappropriate when the client expects:

```text
“process 500k records and return the final results now”
```

Use the async/status pattern we covered in Module 10.

---

# 11.43 Batch restartability

One reason Mule Batch is attractive is reliability.

The docs describe batch records being stored in persistent queues so a job can resume after runtime failure/redeploy rather than necessarily restarting the entire dataset. ([MuleSoft Documentation][1])

That matters enormously for:

```text
8-hour migration
```

You don't want:

```text
hour 7 crash
→ start again at record #1
```

if the framework can recover more intelligently.

---

# 11.44 Parallelism inside Mule Batch

Batch steps can process record blocks in parallel. ([MuleSoft Documentation][6])

That increases throughput.

But remember Module 6:

```text
parallelism
≠ automatically better
```

You still need to respect:

```text
Salesforce limits
record locking
database capacity
external service capacity
CPU
memory
```

---

# 11.45 Salesforce record locking at scale

Example:

```text
10,000 Contact updates
```

all touch:

```text
same Account
```

Concurrent writes may produce locking/contention.

Possible approaches:

```text
reduce concurrency
group by parent
process serially where necessary
retry lock-related transient failures
```

This is why bulk concurrency mode/settings can matter.

The current connector's classic Bulk job configuration supports concurrency modes such as serial and parallel. ([MuleSoft Documentation][2])

---

# 11.46 Serial vs parallel

High level:

### Parallel

```text
higher throughput
more potential lock contention
```

### Serial

```text
slower
less concurrency
may reduce locking conflicts
```

Don't always choose Parallel.

A good answer:

> “If records share heavily contended Salesforce parents, I would consider reducing concurrency or serial processing rather than maximizing throughput blindly.”

---

# 11.47 Don't put an HTTP call inside each Batch record casually

Imagine:

```text
1 million records
```

and Batch Step:

```text
call customer-score API
```

That's:

```text
1 million HTTP requests
```

Maybe unavoidable.

But first ask:

```text
Does scoring API support bulk?
Can scores be preloaded?
Can we batch requests?
Can we cache repeated lookups?
```

The best optimization is architectural.

---

# 11.48 N+1 at bulk scale is catastrophic

With normal API work:

```text
100 records
× 1 extra query
```

is annoying.

With bulk:

```text
1,000,000 records
× 1 query each
```

is disastrous.

So before large jobs:

```text
pre-fetch lookup data
batch queries
create in-memory/file-store mapping where reasonable
use external IDs
```

rather than query one-by-one.

---

# 11.49 Memory is an architectural constraint

Suppose each customer record averages:

```text
5 KB
```

1 million records ≈ roughly:

```text
5 GB raw data
```

before runtime/object overhead.

Obviously:

```text
payload = giant array
```

is bad.

Think:

```text
streams
pages
record blocks
persistent queues
batch aggregation
```

This is exactly why these frameworks exist.

---

# 11.50 Interview scenario

> We have 500,000 records to load into Salesforce overnight. How would you build it?

A strong answer:

> “I'd treat it as asynchronous data movement, not a synchronous API. I'd first see whether I can make it an incremental load rather than moving all 500k every night. For large writes I'd use Salesforce Bulk API v2, probably with external-ID-based upsert for replay safety. If Mule needs per-record validation, transformation, failure routing, or multi-step processing, I'd consider a Mule Batch Job with Batch Steps and aggregation. I'd capture Salesforce row-level failures, retry only transient failed records, and report/reconcile the final result.”

That's excellent.

---

# 11.51 Interview scenario

> Why not Parallel For Each?

Answer:

> “Parallel For Each is useful for a normal collection of independent operations, but for hundreds of thousands of records I'd prefer purpose-built batch semantics—persistent record processing, restartability, failure tracking, aggregation, and downstream bulk APIs—rather than creating huge numbers of individual connector calls.”

Perfect.

---

# 11.52 Interview scenario

> One record in 100,000 is invalid. What happens?

Answer:

> “For a bulk/data synchronization job I'd normally want record-level isolation rather than failing the entire job. Mule Batch tracks failed records, subsequent steps can exclude them, and I'd capture enough source identifiers/error details to report or repair them. I'd only stop the job if the failure rate crosses an agreed threshold or indicates a systemic issue.”

Very good.

---

# 11.53 Interview scenario

> 15% of the job suddenly fails with `INVALID_FIELD`.

Don't retry.

Think:

```text
schema deployment problem
wrong Salesforce environment
field renamed
permission/schema drift
bad release
```

A 15% sudden common error often indicates:

```text
systemic failure
```

not 15% unrelated bad records.

You may want to abort to avoid more damage.

---

# 11.54 Error-rate thresholds

This is an excellent production idea.

If:

```text
1 out of 100,000
```

fails validation:

```text
continue
```

If:

```text
70,000 / 100,000
```

fail:

```text
stop!
```

Something systemic is probably wrong.

That's why:

```text
maxFailedRecords
failure percentage alerts
```

are useful.

---

# 11.55 Testing bulk integrations

You should test more than happy-path count.

### Boundary volumes

```text
0
1
batchSize - 1
batchSize
batchSize + 1
multiple full batches
final partial batch
```

Example if aggregator size = 200:

```text
199
200
201
399
400
401
```

Classic QA boundary testing.

---

# 11.56 Test mixed outcomes

Dataset:

```text
97 valid
1 missing required field
1 invalid lookup
1 transient mock failure
```

Verify:

```text
valid records succeed
bad records captured
transient handling correct
counts correct
job completion correct
```

---

# 11.57 Test restart/replay

Simulate:

```text
job processing
↓
runtime interruption
↓
restart
```

Verify:

```text
no duplicate business records
job resumes/reprocesses safely
external IDs preserve idempotency
```

This is especially important for an automation role.

---

# 11.58 Test relationship ordering

Example:

```text
Account
↓
Contacts
```

Test:

```text
parent exists
parent missing
parent fails
child references wrong external ID
multiple children same parent
```

Don't simply test row counts.

---

# 11.59 Test reconciliation

After job:

```text
source expected IDs
vs
Salesforce actual IDs
```

Verify:

```text
missing
extra
duplicates
field mismatches
```

This is where your SQL/SOQL automation skills become very valuable.

---

# 11.60 Batch performance metrics

Measure:

```text
records/second
job duration
Salesforce job duration
failure rate
retry rate
memory
CPU
queue/backlog
API consumption
lock failures
```

Don't optimize only:

```text
total wall-clock time
```

if faster processing causes Salesforce failures.

---

# 11.61 Your production dashboard

For a nightly sync, I would want something like:

```text
Job: CustomerSync-2026-08-07

Input:       248,394
Succeeded:   248,310
Failed:           84

Transient:         12
Permanent:         72

Duration:      19m 42s
Retries:           12

SF Bulk Job: COMPLETE
```

Plus links/identifiers for failures.

That's useful operational quality.

---

# 11.62 Mule Batch vs Salesforce Bulk interview summary

If asked:

> “What is the difference between Mule Batch and Salesforce Bulk API?”

Say:

> “Mule Batch is Mule's framework for reliably processing large record sets through steps, tracking record failures, aggregating data, and supporting restartable asynchronous jobs. Salesforce Bulk API is Salesforce's optimized API for high-volume data operations. In a large Salesforce synchronization I might use Mule Batch for orchestration and record handling, and Bulk API v2 for the actual Salesforce ingestion.”

Exactly right.

---

# Module 11 Cheat Sheet

```text
NORMAL CRUD
===========
small / transactional
interactive
immediate response


SALESFORCE BULK API
===================
large data volume
job-based
asynchronous

Bulk v2:
insert
update
upsert
delete
query


MULE BATCH
==========
large record processing

Batch Job
   ↓
Batch Step
   ↓
Batch Step
   ↓
On Complete


BATCH AGGREGATOR
================
records
↓
group into arrays
↓
bulk-capable downstream call


FAILURES
========
record-level failure isolation

maxFailedRecords

don't retry permanent errors


IDEMPOTENCY
===========
external IDs
upsert

critical for replay/restart


PERFORMANCE
===========
avoid N+1

stream/page data

don't load millions
into one in-memory array

respect Salesforce
concurrency and locking


SYNCHRONIZATION
===============
prefer delta loads

watermarks / CDC

handle deletes

periodic reconciliation
```

The interview sentence to memorize is:

> **“For high-volume Salesforce synchronization I'd separate Mule's batch-processing responsibility from Salesforce's Bulk API responsibility: Mule Batch can manage record-level processing, failures, aggregation, and restartability, while Bulk API v2 handles the high-volume Salesforce operation itself. I'd design the whole pipeline around external IDs, incremental loads, streaming, partial-failure recovery, and reconciliation.”**

That is a very credible developer answer.

Next is **Module 12: Idempotency and duplicate prevention**. We've referenced it constantly, but now we should make it concrete: idempotency keys, Salesforce external IDs, duplicate event handling, race conditions, request replay, Object Store/database-based deduplication, versioning, and what happens when two Mule workers process the same customer simultaneously.

[1]: https://docs.mulesoft.com/mule-runtime/4.4/batch-processing-concept?utm_source=chatgpt.com "Batch Processing | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/salesforce-connector/latest/salesforce-connector-reference?utm_source=chatgpt.com "Salesforce Connector 12.0 Reference | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/mule-runtime/latest/batch-reference?utm_source=chatgpt.com "Batch Component Reference | MuleSoft Documentation"
[4]: https://docs.mulesoft.com/mule-runtime/latest/batch-phases?utm_source=chatgpt.com "Batch Job Phases | MuleSoft Documentation"
[5]: https://docs.mulesoft.com/mule-runtime/4.6/batch-phases?utm_source=chatgpt.com "Batch Job Phases | MuleSoft Documentation"
[6]: https://docs.mulesoft.com/mule-runtime/4.3/batch-processing-concept?utm_source=chatgpt.com "Batch Processing | MuleSoft Documentation"
