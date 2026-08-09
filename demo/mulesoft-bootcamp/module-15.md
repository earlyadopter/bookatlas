# Module 15 — Deployment and Operations

This module answers:

> **“I wrote and tested the Mule application. How does it actually get built, deployed, configured, monitored, and promoted to production?”**

The short lifecycle is:

```text
Code
  ↓
Maven build
  ↓
MUnit
  ↓
Mule application artifact
  ↓
Deploy
  ↓
CloudHub 2.0 / Runtime Fabric / on-prem
  ↓
Runtime Manager
  ↓
logs + alerts + monitoring
```

Mule applications can currently be deployed to CloudHub, CloudHub 2.0, Runtime Fabric, or on-prem Mule runtimes. CloudHub and CloudHub 2.0 manage the Mule runtime instances for you. ([MuleSoft Documentation][1])

---

## 15.1 Mule is a Maven project

A typical project looks roughly like:

```text
customer-salesforce-api/
│
├── pom.xml
├── mule-artifact.json
│
├── src/
│   ├── main/
│   │   ├── mule/
│   │   │   ├── customer-api.xml
│   │   │   ├── salesforce.xml
│   │   │   └── global.xml
│   │   │
│   │   └── resources/
│   │       ├── config-dev.yaml
│   │       ├── config-qa.yaml
│   │       └── config-prod.yaml
│   │
│   └── test/
│       ├── munit/
│       └── resources/
│
└── target/
```

The important file:

```text
pom.xml
```

is Maven configuration.

If you've worked with Java projects, this concept is familiar.

---

# 15.2 What `pom.xml` contains

Conceptually:

```xml
<project>

    <groupId>com.company</groupId>

    <artifactId>customer-salesforce-api</artifactId>

    <version>1.2.3</version>

    <dependencies>
        Salesforce Connector
        HTTP Connector
        MUnit
        ...
    </dependencies>

    <build>
        Mule Maven Plugin
    </build>

</project>
```

Think:

```text
package.json
```

in a TypeScript project, except Maven/XML/JVM ecosystem.

It defines:

```text
project identity
version
dependencies
plugins
build behavior
deployment configuration
```

---

# 15.3 Basic Maven commands

You don't need to become a Maven expert.

Know these concepts:

```bash
mvn clean
```

remove previous build output.

```bash
mvn test
```

run tests.

```bash
mvn package
```

build/package application.

And Mule deployments often use something like:

```bash
mvn clean deploy -DmuleDeploy
```

The current Mule Maven Plugin documentation uses that command to build and deploy to CloudHub 2.0. ([MuleSoft Documentation][2])

---

# 15.4 What gets built?

Your Mule source:

```text
XML flows
DataWeave
configuration/resources
dependencies
```

gets packaged into a deployable Mule application artifact.

Conceptually:

```text
source repository
      ↓
mvn package
      ↓
customer-salesforce-api-1.2.3.jar
```

Don't think:

> “It's just XML uploaded to Salesforce.”

The Mule runtime executes the packaged application.

---

# 15.5 `mule-artifact.json`

You'll encounter:

```text
mule-artifact.json
```

This contains Mule application metadata.

Conceptually it tells Mule things such as:

```text
required Mule runtime version
application configuration metadata
exported resources/packages
secure-property metadata
```

You don't need to memorize its schema for the interview.

Know that:

```text
pom.xml
```

is largely Maven/build/dependency configuration,

while:

```text
mule-artifact.json
```

describes the Mule artifact itself.

---

# 15.6 Local execution

During development:

```text
Anypoint Studio
or
Anypoint Code Builder
```

can run the application locally against an embedded/development Mule runtime.

You might call:

```text
http://localhost:8081/api/customers
```

with Postman.

That's development.

It is **not** the production runtime model.

MuleSoft explicitly says the embedded IDE runtime isn't intended as the production deployment target. ([MuleSoft Documentation][3])

---

# 15.7 Main deployment targets

Know these three:

```text
CloudHub 2.0
Runtime Fabric
On-prem Mule Runtime
```

Plus legacy/current CloudHub 1.0 environments you may encounter.

### CloudHub 2.0

Managed MuleSoft cloud deployment.

### Runtime Fabric

Mule applications running on containerized infrastructure under the customer's infrastructure/cloud setup.

### On-prem

Organization manages Mule runtime servers itself.

For interview survival, CloudHub 2.0 is the one I'd understand best.

---

# 15.8 CloudHub 2.0 mental model

Think:

```text
Mule application artifact
       ↓
CloudHub 2.0
       ↓
containerized replica(s)
       ↓
Mule Runtime
       ↓
your flows
```

CloudHub 2.0 is MuleSoft's managed containerized integration platform. Applications can be deployed into shared or private spaces. ([MuleSoft Documentation][4])

---

# 15.9 Replica

CloudHub 2.0 terminology includes:

```text
replica
```

Conceptually:

```text
instance of your running Mule application
```

If you deploy multiple replicas:

```text
           load
            ↓
       ┌────┴────┐
       ↓         ↓
 Replica 1   Replica 2
```

This gives:

```text
availability
scaling
load distribution
```

The exact infrastructure behavior is managed by CloudHub.

---

# 15.10 Stateless design becomes important

If you have multiple replicas:

```text
request 1 → replica A
request 2 → replica B
```

don't assume:

```text
local in-memory variable from request 1
```

exists on replica B.

This applies to:

```text
caches
dedupe state
watermarks
locks
session-like state
```

Durable/shared state needs an appropriate external mechanism such as:

```text
Object Store
database
Redis
queue
```

depending on architecture.

---

# 15.11 Runtime Manager

This is another term you should know cold.

**Anypoint Runtime Manager** is where teams manage deployed Mule applications.

It provides a unified view across supported deployment environments and can be used to:

```text
deploy/update applications
start/stop applications
view application status
monitor/troubleshoot
configure alerts
```

CloudHub 2.0 applications can be managed there. ([MuleSoft Documentation][5])

Think:

```text
AWS Console / Kubernetes dashboard
```

but specifically for Mule runtimes/applications.

---

# 15.12 Deployment status

A successful CloudHub 2.0 deployment eventually reaches:

```text
RUNNING
```

Before that you may see:

```text
PENDING
DEPLOYING
```

or a failure state/reason.

Current CloudHub 2.0 docs explicitly describe applications progressing toward `RUNNING`, with replica state/reason available when they don't. ([MuleSoft Documentation][4])

---

# 15.13 CI/CD pipeline

A mature development pipeline might look like:

```text
Developer
   ↓
feature branch
   ↓
Pull Request
   ↓
CI
   ├── compile/build
   ├── MUnit
   ├── static checks
   └── coverage
   ↓
merge
   ↓
build versioned artifact
   ↓
publish artifact
   ↓
deploy DEV/QA
   ↓
smoke tests
   ↓
approval
   ↓
deploy PROD
```

This should be familiar from your Jenkins/GitHub Actions experience.

---

# 15.14 Maven Plugin deployment

The Mule Maven Plugin can deploy applications programmatically.

Current CloudHub 2.0 docs show:

```bash
mvn clean deploy -DmuleDeploy
```

for build + deployment, and:

```bash
mvn mule:deploy
```

when deploying an already-built artifact. ([MuleSoft Documentation][2])

So CI might execute:

```text
GitHub Actions / Jenkins
        ↓
Maven
        ↓
CloudHub 2.0
```

---

# 15.15 Deployment authentication

The CI system itself must authenticate to Anypoint Platform.

Current MuleSoft Maven deployment documentation supports approaches including:

```text
authorization token
Maven server credentials
Connected App credentials
```

among others. ([MuleSoft Documentation][2])

For CI/CD, I'd favor a machine/service identity rather than a developer's personal username/password.

Same principle as Salesforce integration auth.

---

# 15.16 Don't put deployment credentials in `pom.xml`

Bad:

```xml
<username>bob@company.com</username>
<password>SuperSecret123</password>
```

committed to Git.

Better:

```text
CI secret
       ↓
environment variable
       ↓
Maven property
       ↓
deployment
```

For example conceptually:

```text
ANYPOINT_CLIENT_ID
ANYPOINT_CLIENT_SECRET
```

in the CI secret store.

---

# 15.17 Artifact promotion

One of the most important deployment principles:

```text
Build once
promote same artifact
```

Example:

```text
customer-api-1.2.3
      ↓
DEV
      ↓
QA
      ↓
PROD
```

Not:

```text
compile DEV version
compile QA version
compile PROD version
```

because then:

> The thing tested in QA may not literally be the thing deployed in production.

---

# 15.18 Configuration still changes

Same artifact:

```text
1.2.3
```

can run with:

```text
QA:
env=qa
Salesforce sandbox
QA secrets

PROD:
env=prod
Salesforce production
production secrets
```

Remember Module 8:

```text
same code/artifact
different configuration
```

---

# 15.19 Versioning

Typical artifact versions:

```text
1.0.0
1.0.1
1.1.0
2.0.0
```

Semantic versioning may be used organizationally.

Maven also uses:

```text
1.2.4-SNAPSHOT
```

for development snapshots.

Current MuleSoft CloudHub 2.0 documentation warns against deploying changeable snapshot assets into production. ([MuleSoft Documentation][2])

So interview answer:

> “I'd deploy immutable release versions to production, not mutable snapshots.”

Good.

---

# 15.20 Exchange

Another MuleSoft term you'll hear:

```text
Anypoint Exchange
```

Think:

> MuleSoft's asset catalog/repository.

Organizations publish/reuse things such as:

```text
APIs
connectors
templates
examples
application artifacts/assets
```

For the deployment flow, artifacts may be published to Exchange and then deployed.

You don't need to become an Exchange expert.

---

# 15.21 Runtime version matters

Your application targets a Mule runtime version.

For example conceptually:

```text
Mule Runtime 4.x
Java 17
```

A connector can impose minimum runtime/Java requirements.

We already saw one example:

```text
Salesforce Connector 12
→ Java 17
```

So when upgrading connectors, ask:

```text
Does runtime support it?
Does Java version support it?
Does CI build support it?
```

This is dependency compatibility, not simply changing one version string.

---

# 15.22 LTS vs Edge

You'll encounter Mule runtime release-channel terminology such as:

```text
LTS
Edge
```

High level:

### LTS

More stability/support-oriented.

### Edge

Newer/faster-moving release stream.

You do **not** need exact current versions memorized.

For production:

> Choose the runtime channel/version according to the organization's support policy and connector compatibility.

Current Mule Maven deployment docs explicitly distinguish release channels and Java versions in runtime configuration. ([MuleSoft Documentation][2])

---

# 15.23 Deployment isn't complete when upload succeeds

Bad pipeline:

```text
deploy command exited 0
→ declare SUCCESS
```

Better:

```text
deploy
 ↓
application reaches RUNNING
 ↓
health/smoke checks pass
 ↓
deployment considered successful
```

CloudHub 2.0 exposes deployment/application status specifically for this reason. ([MuleSoft Documentation][4])

---

# 15.24 Health endpoint

A Mule API may expose:

```http
GET /health
```

Simple response:

```json
{
  "status": "UP"
}
```

But think carefully about what this proves.

---

# 15.25 Liveness vs readiness

Good operational distinction:

### Liveness

> Is this Mule application process alive?

### Readiness

> Is it ready to handle meaningful traffic?

Suppose Mule process runs, but Salesforce authentication is broken.

```text
liveness = true
readiness = false
```

Potentially.

The exact implementation/platform may vary, but understand the concept.

---

# 15.26 Don't make health checks destructive

Bad:

```text
/health
 ↓
create Salesforce Account
```

every 30 seconds.

Obviously no.

Health/readiness checks should use:

```text
lightweight
safe
non-destructive
```

checks.

Perhaps:

```text
application is initialized
essential connectivity/config state
```

depending on requirements.

---

# 15.27 Post-deployment smoke test

After QA deploy:

```text
1. health
2. authenticated API call
3. simple Salesforce read
4. controlled Salesforce upsert
5. verify target
```

This catches:

```text
wrong config
bad secret
OAuth failure
missing field
permission issue
wrong Salesforce org
```

immediately.

---

# 15.28 Logs

Production Mule application should emit useful structured logs:

```json
{
  "event": "customer_upsert",
  "customerId": "C001",
  "correlationId": "abc-123",
  "status": "SUCCESS",
  "durationMs": 217
}
```

Error:

```json
{
  "event": "salesforce_error",
  "correlationId": "abc-123",
  "errorType": "SALESFORCE:CONNECTIVITY"
}
```

Not:

```text
something went wrong
```

---

# 15.29 Runtime Manager troubleshooting

When application fails after deployment, first check things such as:

```text
application status
replica state
startup logs
runtime version
environment properties
secure properties
connector initialization
network connectivity
```

Runtime Manager is specifically intended for monitoring/troubleshooting running Mule apps. ([MuleSoft Documentation][5])

---

# 15.30 Startup failure vs runtime failure

Different categories.

### Startup

Application never reaches RUNNING.

Think:

```text
bad config
missing secret
connector initialization
runtime incompatibility
invalid Mule configuration
dependency problem
port/config problem
```

### Runtime

Application starts fine, then requests fail.

Think:

```text
Salesforce down
bad data
credential expiration
rate limits
timeouts
unexpected payload
memory pressure
```

Different troubleshooting path.

---

# 15.31 Alerts

You want alerts for meaningful conditions such as:

```text
application down
replica unavailable
high error rate
retry exhaustion
Salesforce connectivity failures
queue backlog
slow responses
batch failures
```

Runtime Manager supports application alerts for CloudHub 2.0 applications. ([MuleSoft Documentation][5])

---

# 15.32 Alert on symptoms, not every exception

Bad:

```text
one invalid customer
→ wake engineer at 3 AM
```

Better:

```text
one customer validation error
→ log/metric

500 validation failures in 5 minutes
→ alert
```

or:

```text
Salesforce connectivity failures > threshold
→ alert
```

Operational signal quality matters.

---

# 15.33 Metrics

For a synchronous Mule API:

```text
request count
error rate
latency
p95/p99
Salesforce latency
timeouts
retry count
```

For async:

```text
queue depth
message age
consumer failures
DLQ
processing duration
```

For batch:

```text
records processed
failure count
throughput
job duration
```

Tie metrics to architecture.

---

# 15.34 Correlation IDs in production

User reports:

> “Customer C001 failed around 4:20.”

You want:

```text
correlationId
```

to trace:

```text
API gateway
 ↓
Experience API
 ↓
Process API
 ↓
Salesforce System API
 ↓
Salesforce
```

Without correlation:

```text
grep customer name everywhere
```

and pray.

---

# 15.35 Deployment rollback

Suppose:

```text
1.2.4
```

deploys and error rate immediately spikes.

You need a rollback strategy.

Conceptually:

```text
stop routing traffic to 1.2.4
 ↓
restore known-good 1.2.3
```

Exact mechanisms depend on environment and deployment process.

The important point:

> **Rollback should use a known-good immutable artifact, not emergency code editing in production.**

---

# 15.36 But rollback isn't always enough

Suppose version 1.2.4 incorrectly updated:

```text
50,000 Salesforce Accounts
```

Rolling application back to 1.2.3 doesn't undo those records.

You now need:

```text
data remediation
reconciliation
compensation
```

This is why deployment safety for integrations is harder than ordinary stateless web code.

---

# 15.37 Database/schema compatibility analogy

Suppose version 2 changes Salesforce expectations:

```text
new field required
```

Deployment ordering might be:

```text
1. deploy Salesforce schema
2. verify permissions
3. deploy Mule code using field
```

If reversed:

```text
Mule v2
 ↓
INVALID_FIELD
```

Therefore cross-system deployment dependencies matter.

---

# 15.38 Backward-compatible deployment

A safer pattern may be:

```text
Step 1:
add new Salesforce field

Step 2:
deploy Mule that can use it

Step 3:
later remove old behavior
```

rather than making incompatible changes simultaneously.

Think:

```text
expand
↓
migrate
↓
contract
```

This concept is very useful for integrations.

---

# 15.39 Feature flags

Sometimes you want to deploy code without immediately enabling behavior.

Example:

```yaml
features:
  newCustomerMapping: false
```

Then enable in QA/prod according to controlled rollout.

Good for:

```text
risky integration changes
new downstream system
migration
gradual rollout
```

But don't turn configuration into an impossible matrix of hidden behavior.

---

# 15.40 Blue/green or rolling deployment concepts

You may hear:

```text
rolling deployment
blue/green
```

High level:

### Rolling

Replace application instances gradually.

### Blue/green

Old version and new version coexist; traffic switches between them.

Purpose:

```text
reduce downtime
reduce deployment risk
enable fast rollback
```

You don't need CloudHub-specific knobs memorized unless they ask.

---

# 15.41 Beware duplicate consumers during deployment

This is a very important integration-specific concern.

Suppose both old and new app versions temporarily consume:

```text
same queue
```

during rollout.

Could both process the same message?

Depends on broker/deployment semantics.

Or suppose both run:

```text
Scheduler every 5 minutes
```

during overlapping deployment.

Could the nightly sync run twice?

This is why:

```text
idempotency
locking
scheduler semantics
consumer design
```

matter during deployments too.

Great interview point.

---

# 15.42 Multiple replicas + Scheduler

Imagine two replicas:

```text
Replica A
Replica B
```

Does every replica run:

```text
Scheduler
```

or does platform coordination ensure one trigger?

This is something you verify for the selected runtime/deployment configuration rather than assume.

General principle:

> Stateful/scheduled workloads need special attention when horizontally scaled.

---

# 15.43 Multiple replicas + local filesystem

Bad:

```text
Replica A downloads file to /tmp/customer.csv
```

then assume:

```text
Replica B can read it
```

No.

Replica-local storage isn't shared state.

For shared integration data use:

```text
object storage
database
shared durable store
```

according to architecture.

---

# 15.44 Cloud-native mindset

With CloudHub/containerized deployment, think:

```text
application instances are replaceable
```

Don't depend on:

```text
manual local files
SSH-based fixes
state only stored in process memory
```

Design for disposable runtime instances.

---

# 15.45 Production debugging

Suppose customer request failed.

Recommended investigation flow:

```text
1. Get correlation ID

2. Find Mule request/error log

3. Identify failing processor/system

4. Determine error category

5. Check retries

6. Check Salesforce state

7. Determine:
   did operation commit?

8. Decide:
   retry / reconcile / fix data / fix config
```

Don't immediately replay request until you know whether the first write committed.

Module 12 again.

---

# 15.46 Incident: Salesforce timeout

Logs:

```text
SALESFORCE:TIMEOUT
customerId=C001
```

First instinct should **not** be:

```text
rerun CREATE C001
```

Instead:

```text
query Salesforce by External ID
```

Determine resulting state.

If design uses idempotent Upsert:

```text
safe bounded retry/replay
```

much easier.

---

# 15.47 Incident: sudden `INVALID_FIELD`

If hundreds of requests suddenly fail:

```text
INVALID_FIELD
```

after deployment, think:

```text
Salesforce metadata mismatch
wrong environment
deployment order
field renamed/not deployed
API name incorrect
```

Don't retry.

This is configuration/release failure.

---

# 15.48 Incident: permission failures only in prod

Check:

```text
production integration user
permission sets
field-level security
record access
OAuth client
environment configuration
```

Don't fix it by giving:

```text
System Administrator
```

unless that's genuinely approved.

---

# 15.49 Incident: error rate rises gradually

Could be:

```text
Salesforce rate pressure
increased volume
connection pool saturation
memory pressure
downstream degradation
record lock contention
```

This is where monitoring trends help more than individual logs.

---

# 15.50 Deployment pipeline example

A good concrete interview answer:

```text
GitHub PR
   ↓
GitHub Actions / Jenkins
   ↓
mvn clean test
   ↓
MUnit passes
   ↓
mvn package
   ↓
publish versioned artifact
   ↓
deploy QA using Mule Maven Plugin
   ↓
wait for RUNNING
   ↓
run smoke/API tests
   ↓
approval
   ↓
promote same artifact to PROD
   ↓
production health/smoke validation
   ↓
monitor error/latency metrics
```

That is enough to sound completely comfortable with the lifecycle.

---

# 15.51 A realistic `pom.xml` concept

You may see something roughly like:

```xml
<properties>
    <app.runtime>...</app.runtime>
    <mule.maven.plugin.version>...</mule.maven.plugin.version>
</properties>

<dependencies>

    <dependency>
        <!-- Salesforce Connector -->
    </dependency>

    <dependency>
        <!-- HTTP Connector -->
    </dependency>

</dependencies>

<build>

    <plugins>

        <plugin>
            <groupId>org.mule.tools.maven</groupId>
            <artifactId>mule-maven-plugin</artifactId>

            <configuration>
                <cloudhub2Deployment>
                    ...
                </cloudhub2Deployment>
            </configuration>

        </plugin>

    </plugins>

</build>
```

Again, don't memorize XML.

Understand what it represents.

---

# 15.52 Runtime properties in deployment

CloudHub 2.0 Maven deployment configuration supports application properties as part of deployment configuration. ([MuleSoft Documentation][2])

Conceptually:

```text
env = qa
salesforce.instance = sandbox
logging.level = INFO
```

with secrets injected separately.

That ties directly into Module 8.

---

# 15.53 CI/CD gates

Good gates might be:

```text
PR:
MUnit must pass

Merge:
build must pass

QA deploy:
application reaches RUNNING

QA:
smoke tests pass

Production:
approval/change control if required

Post-prod:
health checks pass
```

Potential additional gates:

```text
MUnit coverage threshold
security scans
API contract checks
performance checks
```

depending on organization.

---

# 15.54 Coverage gate caveat

Don't tell a manager:

> “We can't ship because coverage is 79.9% instead of 80%”

without understanding context.

Coverage is a useful guardrail.

But release confidence should come from:

```text
risk
critical scenarios
production behavior
integration compatibility
```

not a single number.

---

# 15.55 Production release verification

After deploying:

```text
RUNNING
```

is necessary but not sufficient.

I'd want:

```text
health endpoint

one representative authenticated request

Salesforce connectivity

critical system dependencies

logs show expected version/environment

error rate remains normal
```

This is where QA and operations overlap.

---

# 15.56 Version information endpoint

A useful application can expose:

```http
GET /info
```

returning something like:

```json
{
  "version": "1.2.3",
  "environment": "QA"
}
```

without secrets.

Then automation immediately knows:

```text
What version am I actually testing?
```

Very useful for release validation.

---

# 15.57 Don't rely solely on manually checking Runtime Manager

Better:

```text
deployment pipeline
↓
automatically verify status
↓
automatically run smoke
```

Humans should handle judgment/approval where appropriate, not repetitive checking.

---

# 15.58 “Works locally” doesn't mean deployable

Local environment may have:

```text
your credentials
open network
local configuration
admin Salesforce user
```

Cloud runtime may have:

```text
different network
different DNS
restricted identity
different secrets
different TLS trust
```

So deployment readiness requires environmental testing.

---

# 15.59 Network architecture

Enterprise Mule apps may need to reach:

```text
Salesforce internet endpoint
private database
internal SAP
private REST API
```

Cloud deployments may require:

```text
private networking
VPN
VPC/private space
firewall allowlists
DNS
```

You don't need networking implementation details for the interview.

But if something works locally and not CloudHub:

> **Network path is one of the first things to investigate.**

---

# 15.60 Deployment target selection

If interviewer asks:

> Why CloudHub 2.0 vs Runtime Fabric?

High-level answer:

### CloudHub 2.0

```text
MuleSoft-managed cloud platform
less infrastructure management
```

### Runtime Fabric

```text
run Mule applications in organization's chosen infrastructure
more infrastructure/network control
```

### On-prem

```text
organization manages Mule runtime servers directly
```

Don't claim one is universally superior.

---

# 15.61 Interview question: “How do you deploy a Mule app?”

Good answer:

> “It's normally a Maven-built Mule application artifact. In CI I'd run MUnit and package the application, then use the Mule Maven Plugin or Anypoint tooling to deploy a versioned artifact to CloudHub 2.0 or the organization's target runtime. Environment-specific properties and secrets are injected separately. After deployment I'd verify the application reaches RUNNING and run smoke tests.”

Very solid.

---

# 15.62 “What is Runtime Manager?”

> “It's the Anypoint Platform interface for deploying, managing, monitoring and troubleshooting Mule applications across supported runtimes. For CloudHub applications I'd use it to inspect application status, manage deployments and view operational information and alerts.” ([MuleSoft Documentation][5])

---

# 15.63 “How do QA and production differ?”

> “Ideally by environment-specific endpoints, identities, secrets, data and capacity—not by application source code. I'd promote the same immutable artifact from QA to production.”

Excellent.

---

# 15.64 “Deployment completed. Are you done?”

> “No. I'd verify the runtime reaches its healthy/running state, execute a deployment smoke suite against critical integrations, confirm the expected artifact/environment is running, and watch error and latency signals after rollout.”

---

# 15.65 “What if the production release is broken?”

> “I'd have a known-good artifact available for rollback, but because integrations create external side effects I'd also determine whether the bad version already changed Salesforce or other systems. Rolling code back doesn't automatically undo downstream data, so remediation or reconciliation may be necessary.”

That's a **very strong integration-specific answer**.

---

# Module 15 Cheat Sheet

```text
PROJECT
=======

pom.xml
  Maven dependencies/build/deploy

mule-artifact.json
  Mule application metadata


BUILD
=====

mvn test
mvn package

Deploy commonly:
mvn clean deploy -DmuleDeploy


TARGETS
=======

CloudHub 2.0
Runtime Fabric
On-prem


CLOUDHUB 2.0
============

managed/containerized
application replicas


RUNTIME MANAGER
===============

deploy
start/stop
status
monitor
troubleshoot
alerts


CI/CD
=====

PR
 ↓
MUnit
 ↓
build
 ↓
versioned artifact
 ↓
QA
 ↓
smoke tests
 ↓
PROD


CONFIGURATION
=============

same artifact

different:
endpoints
credentials
secrets
environment properties


OPERATIONS
==========

correlation IDs
structured logging
metrics
alerts
health/readiness


ROLLBACK
========

restore known-good artifact

BUT:

rollback does NOT
undo Salesforce/data side effects


SCALING
=======

multiple replicas
→ don't depend on local state


RELEASE SAFETY
==============

verify:
RUNNING
correct version
correct environment
Salesforce connectivity
smoke tests
error rate
```

The interview sentence to memorize is:

> **“I treat Mule deployment as a standard immutable-artifact CI/CD process: Maven build and MUnit first, deploy the same versioned artifact across environments with configuration and secrets injected separately, verify the runtime reaches RUNNING, execute smoke tests, and monitor the integration afterward. For rollback I also account for downstream side effects because reverting code doesn't undo Salesforce data.”**

Next should be **Module 16 — Production Engineering and Observability**: timeouts, connection pools, retries, rate limiting, correlation IDs, logs, metrics, Salesforce API consumption, performance, alerting, runbooks, and how to diagnose “Mule is slow” without guessing.

[1]: https://docs.mulesoft.com/mule-runtime/latest/deploying?utm_source=chatgpt.com "Deploy Mule Applications | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/mule-runtime/latest/deploy-to-cloudhub-2?utm_source=chatgpt.com "Deploy Applications to CloudHub 2.0 Using the Mule Maven Plugin | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/runtime-manager/deployment-strategies?utm_source=chatgpt.com "Deployment Options | MuleSoft Documentation"
[4]: https://docs.mulesoft.com/cloudhub-2/ch2-deploy?utm_source=chatgpt.com "Deploying Apps to CloudHub 2.0 | MuleSoft Documentation"
[5]: https://docs.mulesoft.com/runtime-manager/managing-deployed-applications?utm_source=chatgpt.com "Manage Deployed Applications | MuleSoft Documentation"
