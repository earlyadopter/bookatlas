# Module 8 — Configuration and Security

This module is less about coding syntax and more about making sure your Mule application can safely move from:

```text
DEV → QA → STAGING → PROD
```

without changing the actual integration code.

The key principle is:

> **Code stays the same. Environment-specific configuration changes. Secrets never belong in source code.**

MuleSoft supports environment-specific YAML/properties files and Secure Configuration Properties for encrypted values. ([MuleSoft Documentation][1])

---

## 8.1 What should be configuration?

Suppose your Mule code talks to:

```text
Salesforce
Billing API
Database
Kafka
```

Things that differ by environment include:

```text
Salesforce endpoint
OAuth client ID
OAuth secret / certificate
HTTP host
HTTP port
database URL
queue names
timeouts
retry counts
feature flags
logging levels
```

You do **not** want:

```xml
<http:request host="qa.billing.mycompany.com"/>
```

hardcoded.

Instead:

```xml
<http:request host="${billing.host}"/>
```

Then configuration supplies the value.

---

# 8.2 A typical configuration layout

Conceptually:

```text
src/main/resources/

    config-dev.yaml
    config-qa.yaml
    config-prod.yaml
```

Example:

```yaml
salesforce:
  instanceUrl: "https://test.salesforce.com"

billing:
  host: "billing-qa.company.com"
  port: "443"

api:
  port: "8081"
```

Production:

```yaml
salesforce:
  instanceUrl: "https://login.salesforce.com"

billing:
  host: "billing.company.com"
  port: "443"

api:
  port: "8081"
```

Same Mule application.

Different configuration.

---

# 8.3 Select configuration by environment

A common pattern is:

```text
env=dev
```

or:

```text
env=qa
```

or:

```text
env=prod
```

Then Mule loads something conceptually like:

```text
config-${env}.yaml
```

MuleSoft specifically documents dynamic property files such as:

```xml
file="${env}-properties.yaml"
```

where `env` is supplied through a runtime/system/environment property. ([MuleSoft Documentation][1])

So deployment becomes:

```text
DEV
env=dev
      ↓
dev-properties.yaml


QA
env=qa
      ↓
qa-properties.yaml


PROD
env=prod
      ↓
prod-properties.yaml
```

---

# 8.4 Why this matters

Bad deployment process:

```text
developer checks out code

changes:
salesforce.url = QA

deploys

later edits code:
salesforce.url = PROD

deploys again
```

This creates risk that:

```text
QA credentials go to PROD
wrong database used
wrong Salesforce org updated
config differences aren't versioned correctly
```

Better:

```text
one application artifact
        ↓
DEV configuration
QA configuration
PROD configuration
```

Interview phrase:

> “I prefer immutable application artifacts promoted between environments with environment-specific configuration injected at deployment time.”

That's a strong DevOps/integration answer.

---

# 8.5 Basic property reference syntax

You will commonly see:

```text
${property.name}
```

Example:

```xml
host="${billing.host}"
port="${billing.port}"
```

Conceptually:

```typescript
process.env.BILLING_HOST
```

although Mule's configuration mechanisms aren't literally Node environment variables.

Think:

> `${...}` = resolve configuration property.

---

# 8.6 Properties versus Mule variables

Don't confuse:

```text
${salesforce.host}
```

with:

```text
vars.salesforceId
```

They solve completely different problems.

### Configuration property

```text
${salesforce.host}
```

Usually:

```text
static for application/environment
```

Example:

```text
qa-salesforce.company.com
```

### Mule variable

```text
vars.salesforceId
```

belongs to one event/request.

Example:

```text
001ABC123
```

So:

```text
${...}
→ application configuration

vars...
→ current Mule event state
```

---

# 8.7 Don't put secrets into normal configuration

This is bad:

```yaml
salesforce:
  clientId: "abc123"
  clientSecret: "SuperSecretPassword!"
```

and then:

```text
git add .
git commit
git push
```

Now the secret exists forever in repository history.

Instead, use secure configuration or an external secret mechanism.

---

# 8.8 Mule Secure Configuration Properties

Mule has a Secure Configuration Properties extension.

It lets you store encrypted values in YAML or `.properties` files.

Encrypted values look conceptually like:

```yaml
salesforce:
  clientSecret: "![encrypted-value-here]"
```

MuleSoft requires encrypted values to be wrapped in:

```text
![...]
```

and allows YAML or properties files. ([MuleSoft Documentation][1])

Then your Mule configuration refers to the secure property.

---

# 8.9 Secure property access

You'll see syntax like:

```text
${secure::salesforce.clientSecret}
```

The:

```text
secure::
```

prefix tells Mule:

> Resolve this value through Secure Configuration Properties.

MuleSoft explicitly documents using `secure::` for values in a secure-properties file. ([MuleSoft Documentation][1])

Example:

```xml
clientSecret="${secure::salesforce.clientSecret}"
```

---

# 8.10 But where does the decryption key live?

This is the critical part.

If you store:

```text
encrypted secret
+
decryption key
```

in the same repository, you've accomplished very little.

Instead:

```text
Git repository
    ↓
encrypted values only

Deployment environment
    ↓
decryption key
```

The key might be injected through:

```text
environment/system property
deployment configuration
secret manager
CI/CD secret store
```

MuleSoft's documented pattern passes the decryption key into Mule Runtime as a runtime/system environment property rather than embedding it in the secure-properties file. ([MuleSoft Documentation][1])

---

# 8.11 Important nuance: encryption isn't magic

MuleSoft's documentation makes an important point: decrypted values necessarily exist in application memory at runtime, so someone with sufficiently privileged OS/JVM access may be able to see them. ([MuleSoft Documentation][1])

So security is not:

```text
encrypted file
→ problem solved
```

You still need:

```text
least privilege
deployment access controls
secret rotation
restricted logs
restricted Runtime Manager access
```

---

# 8.12 Salesforce authentication

The current Salesforce Connector 12.0 supports:

```text
Basic authentication
OAuth 2.0
OAuth JWT
OAuth Client Credentials
OAuth SAML
```

depending on configuration/API support. ([MuleSoft Documentation][2])

For new machine-to-machine integrations, the two you should be most comfortable discussing are:

```text
OAuth Client Credentials

OAuth JWT
```

---

# 8.13 Client Credentials mental model

For an integration service:

```text
Mule application
      ↓
client ID
client secret
      ↓
Salesforce OAuth endpoint
      ↓
access token
      ↓
Salesforce API
```

There's no human typing a username/password.

That's why it's attractive for:

```text
server-to-server integration
```

---

# 8.14 JWT mental model

JWT authentication looks conceptually like:

```text
Mule
   ↓
private key signs JWT assertion
   ↓
Salesforce
   ↓
verifies signature
   ↓
issues OAuth token
```

Instead of sharing a client secret/password, you work with:

```text
private key
public certificate
```

The private key must obviously be protected.

This pattern is common in enterprise integrations because it works well for automated server-to-server authentication.

---

# 8.15 Which one should you choose?

Don't answer:

> “JWT is always better.”

or:

> “Client Credentials is always better.”

Say:

> “I'd use the authentication mechanism approved by the organization's Salesforce security architecture. For machine-to-machine integrations I'd expect something like OAuth Client Credentials or JWT, and I'd keep the credentials externalized and independently rotatable.”

Good answer.

---

# 8.16 A current 2026 detail worth remembering

Salesforce Connector **12.0.0**, released July 21, 2026, removed the old OAuth Username Password connection type because Salesforce is retiring that flow. It also requires Java 17. MuleSoft recommends moving to supported flows such as OAuth 2.0, Client Credentials, JWT, or SAML. ([MuleSoft Documentation][3])

This means don't walk into the interview enthusiastically proposing:

```text
username
password
security token
```

as your preferred new production design.

---

# 8.17 Salesforce External Client Apps

You may hear:

```text
Connected App
```

or newer Salesforce terminology around:

```text
External Client App
```

Think of these as Salesforce-side configuration that establishes:

```text
Which external application is this?

Which OAuth flows can it use?

What permissions/scopes does it have?

Which user/context does it run as?
```

You don't need to become a Salesforce OAuth administrator.

If somebody says:

> “We need to configure the Salesforce app for Mule authentication”

you should understand what they're talking about.

---

# 8.18 Integration user

Typically, you don't want Mule operating as:

```text
Bob Smith, Salesforce administrator
```

You want a dedicated identity:

```text
mulesoft-integration-user
```

or equivalent service identity.

Why?

```text
clear audit trail
controlled permissions
independent credential lifecycle
no impact when employee leaves
least privilege
easier troubleshooting
```

---

# 8.19 Least privilege

Bad:

```text
Mule integration user
→ Salesforce System Administrator
```

just because:

> “Then everything works.”

Better:

```text
read Account:
Id
Name
External ID

write Account:
Phone
Billing fields
Integration fields

read/write Contact:
only what integration needs
```

Give the integration only the permissions required.

---

# 8.20 This creates a testing requirement

Suppose development is done using an admin account.

Everything works.

Production uses:

```text
restricted integration user
```

Suddenly:

```text
INSUFFICIENT_PERMISSIONS
```

So test using the **same permission model** expected in production.

Strong QA/developer talking point:

> “I want non-production integration credentials to approximate production permissions rather than developing entirely with Salesforce admin access.”

---

# 8.21 Field-Level Security

Even if Mule can access:

```text
Account
```

it may not be allowed to access:

```text
Account.Sensitive_Field__c
```

Salesforce security can apply at:

```text
object level
field level
record level
```

So this query:

```sql
SELECT Id, Secret_Field__c
FROM Account
```

may fail or behave differently depending on access.

Again:

```text
schema exists
```

doesn't mean:

```text
integration identity can access it
```

---

# 8.22 OAuth scopes

OAuth configuration may restrict what the client can do.

Think:

```text
OAuth token
```

not as:

> “universal Salesforce key”

but:

> “credential representing specific approved access.”

The exact scopes depend on your Salesforce setup.

You don't need to memorize scope names here.

Just understand the principle:

```text
minimum required OAuth access
```

---

# 8.23 TLS

Mule ↔ Salesforce communication runs over HTTPS; the Salesforce Connector handles the required HTTPS connection setup for its API calls. ([MuleSoft Documentation][2])

For custom HTTP integrations:

```text
Mule → Billing API
```

you should think:

```text
HTTPS
certificate trust
TLS
possibly mutual TLS
```

not simply:

```text
http://production-server:8080
```

---

# 8.24 Server TLS vs mutual TLS

Normal HTTPS:

```text
Mule
   ↓
verifies server certificate
   ↓
Billing API
```

Mutual TLS:

```text
Mule verifies Billing
AND
Billing verifies Mule certificate
```

Conceptually:

```text
both sides prove identity
```

You'll see:

```text
mTLS
```

often in enterprise API environments.

---

# 8.25 API credentials versus TLS

Don't confuse these:

```text
TLS
→ secures transport / proves endpoint identity

OAuth
→ application/user authorization
```

You often use both:

```text
HTTPS/TLS
+
OAuth access token
```

They solve different security problems.

---

# 8.26 Certificate management

JWT or mTLS may introduce:

```text
private keys
certificates
expiration dates
trust stores
key stores
```

The production question becomes:

```text
When does this certificate expire?
```

because otherwise one morning:

```text
all Mule → Salesforce calls fail
```

due to an expired certificate.

Production teams should monitor certificate expiry and rotation.

---

# 8.27 Secret rotation

Assume:

```text
client secret
```

will eventually change.

Design so that rotating it doesn't require developers to:

```text
edit Mule XML
recompile source
commit secret
```

Better:

```text
update deployment secret
restart/redeploy if needed
```

The code hasn't changed.

---

# 8.28 Don't make environment differences into code branches

Bad:

```dataweave
if (vars.env == "prod")
    call Salesforce A
else
    call Salesforce B
```

for configuration differences.

Better:

```text
${salesforce.endpoint}
```

Different configuration provides the correct value.

Code branches should represent:

```text
business behavior
```

not:

```text
where the application was deployed
```

unless there's a strong reason.

---

# 8.29 Environment parity

You want:

```text
DEV
QA
PROD
```

to differ primarily in:

```text
configuration
credentials
data
capacity
```

not fundamentally different code.

Otherwise:

```text
QA tested build ≠ production build
```

which undermines testing.

---

# 8.30 Salesforce Sandbox vs Production

A common setup:

```text
DEV Mule
   ↓
Salesforce Developer/Sandbox

QA Mule
   ↓
Salesforce QA/UAT Sandbox

PROD Mule
   ↓
Salesforce Production
```

Your config determines which one.

Risk worth testing:

```text
QA Mule accidentally points to PROD Salesforce
```

This is a serious incident.

Environment isolation deserves explicit validation.

---

# 8.31 Defensive environment controls

Organizations may add safeguards like:

```text
production credentials only available to production
network restrictions
different OAuth clients
different Salesforce integration users
deployment access controls
environment-specific DNS
```

So even if somebody accidentally deploys:

```text
QA config
```

they don't automatically gain production access.

This is defense in depth.

---

# 8.32 API endpoint configuration

Suppose Mule calls:

```text
fraud-service
```

Don't scatter:

```text
https://fraud-prod.company.com/v2
```

through flows.

Use:

```yaml
fraud:
  host: fraud-prod.company.com
  basePath: /v2
  timeoutMs: 5000
```

then:

```text
${fraud.host}
${fraud.basePath}
${fraud.timeoutMs}
```

This makes tuning much safer.

---

# 8.33 Timeouts belong in configuration too

Bad:

```text
timeout = 60000
```

hardcoded in ten connectors.

Better:

```yaml
salesforce:
  timeoutMs: 10000

billing:
  timeoutMs: 3000
```

Why?

Different downstream services have different SLAs.

And you may discover in production:

```text
Billing 3 seconds
→ reasonable

Salesforce Bulk operation
→ completely different expectation
```

---

# 8.34 Retry configuration

Likewise:

```yaml
retry:
  salesforce:
    attempts: 3
    delayMs: 2000
```

rather than magic numbers scattered throughout.

But remember Module 7:

> Configurability does not excuse bad retry semantics.

Don't solve:

```text
duplicate creation
```

by changing:

```text
attempts: 3 → 2
```

Fix idempotency.

---

# 8.35 Logging levels by environment

You may have:

```text
DEV:
DEBUG

QA:
INFO/DEBUG as needed

PROD:
INFO/WARN
```

But don't assume `DEBUG` allows secrets.

Sensitive data must remain protected regardless of log level.

---

# 8.36 What belongs in Git?

Generally safe:

```text
Mule XML
DataWeave
property names
non-secret defaults
example configuration
MUnit tests
API specifications
```

Usually not:

```text
client secrets
passwords
private keys
decryption keys
production tokens
```

Encrypted secret values may be versioned depending on organizational design, but the **decryption key must remain separately protected**.

---

# 8.37 `.gitignore` isn't secret management

A common mistake:

```text
secret.properties
```

added to `.gitignore`.

That's better than intentionally committing it, but:

```text
local plaintext file
```

can still:

```text
be backed up
be emailed
be copied
be accidentally committed
sit on developer laptops
```

Enterprise design should use real secret controls.

---

# 8.38 CI/CD and secrets

Typical deployment:

```text
GitHub
   ↓
CI pipeline
   ↓
build Mule artifact
   ↓
deployment job
   ↓
CloudHub
```

Secrets can be stored in the CI/CD or platform secret mechanisms and injected only during deployment.

Conceptually:

```text
source code
      ↓
build
      ↓
artifact
      +
runtime secrets
      ↓
deployment
```

The build artifact doesn't need plaintext production secrets baked into it.

---

# 8.39 CloudHub deployment properties

We'll go deeper later, but conceptually CloudHub/Runtime Manager can provide:

```text
environment properties
secure deployment properties
runtime configuration
```

to the application.

That allows:

```text
same artifact
```

to be deployed differently.

---

# 8.40 Secure properties vs secret manager

Don't become dogmatic.

You may encounter:

```text
Mule Secure Configuration Properties

AWS Secrets Manager

Azure Key Vault

HashiCorp Vault

platform-specific secret storage
```

The architectural goal is the same:

```text
don't hardcode
limit access
audit access
rotate credentials
inject at runtime
```

If asked:

> “Would you always use Mule encrypted property files?”

Good answer:

> “They're one option. If the organization already has centralized secret management, I'd integrate with that rather than inventing another secret lifecycle.”

---

# 8.41 An interview scenario

Interviewer:

> “How would you manage Salesforce credentials across dev, QA and production?”

Strong answer:

> “I'd use separate Salesforce integration identities and OAuth client configuration per environment, externalize all endpoints and credentials, and inject secrets through secure configuration or the organization's secrets platform. I'd promote the same application artifact between environments rather than modifying code. Production credentials would only be accessible from the production deployment context.”

Very strong.

---

# 8.42 Another scenario

> “Can we put an encrypted password in Git?”

Answer:

> “Potentially an encrypted property value can be versioned, but the decryption key must be independently protected and injected at runtime. I would also follow the organization's secret-management standard rather than assuming encrypted files are automatically the best approach.”

Good.

---

# 8.43 Another scenario

> “Why not just use a Salesforce admin account?”

Answer:

> “I'd prefer a dedicated integration identity with least-privilege object and field access. That improves security, auditing, credential lifecycle, and prevents an employee account or overly broad admin permissions from becoming an integration dependency.”

---

# 8.44 Another scenario

> “The Mule flow works in QA but fails in production with `INSUFFICIENT_PERMISSIONS`. What do you investigate?”

Walk through:

```text
1. Which production integration identity is being used?

2. Object permissions?

3. Field-level security?

4. Record-level access/sharing?

5. OAuth/client configuration?

6. Did schema or permission-set deployment differ?

7. Is the Mule configuration pointing to the correct org?

8. Compare with QA identity/configuration.
```

That is a very credible troubleshooting answer.

---

# 8.45 Another scenario

> “It works locally but not in CloudHub.”

Think configuration first:

```text
environment property missing?
secure key unavailable?
wrong secret?
DNS/network issue?
certificate/trust issue?
OAuth configuration?
different Salesforce user?
permissions?
```

Not immediately:

> “Mule has a bug.”

---

# 8.46 Another scenario: Salesforce auth suddenly fails

Yesterday:

```text
everything worked
```

Today:

```text
all Salesforce calls fail authentication
```

Think:

```text
secret rotated
certificate expired
OAuth client changed
integration user disabled/frozen
permissions changed
token/auth policy changed
Salesforce-side configuration changed
```

This is the operational mindset they may expect.

---

# 8.47 Configuration validation on startup

A mature application should preferably fail early if mandatory config is missing.

Bad:

```text
application deploys successfully
```

then three hours later first request discovers:

```text
salesforce.clientId missing
```

Better operational behavior:

```text
missing mandatory config
→ deployment/startup fails visibly
```

Exact implementation varies, but the principle is:

> **fail fast on configuration errors.**

---

# 8.48 Don't print secrets to diagnose configuration

A junior debugging reaction:

```text
logger:
"clientSecret = ${secure::salesforce.clientSecret}"
```

Absolutely not.

Better:

```text
Salesforce configuration loaded
client ID suffix: ****1234
endpoint: sandbox
```

if even that information is permitted.

Never debug auth by exposing the secret itself.

---

# 8.49 Security and DataWeave

Remember:

```text
payload
```

may contain secrets too.

Example inbound webhook:

```json
{
  "authorizationToken": "...",
  "customer": {...}
}
```

Don't accidentally transform that into:

```text
logger payload
```

or propagate it into Salesforce.

Use explicit field mapping:

```dataweave
{
    Name: payload.customer.name,
    External_Id__c: payload.customer.id
}
```

rather than blindly passing the original object through.

Explicit mapping can be a security boundary.

---

# 8.50 API input should be considered untrusted

Even if it's an internal API:

```text
Mule receives data
```

Do not assume:

```text
caller is internal
→ input is safe
```

Validate:

```text
required fields
allowed values
size limits
formats
unexpected fields if contract requires strictness
```

Then transform only what should flow downstream.

---

# 8.51 Security also means preventing accidental destructive access

Suppose integration only needs:

```text
Account read/write
Contact read/write
```

It probably doesn't need:

```text
Delete All Data
Modify All Data
Manage Users
```

Least privilege limits blast radius if:

```text
bug occurs
credentials leak
developer makes mistake
```

---

# 8.52 A useful production incident example

Imagine a DataWeave bug produces:

```text
External_Customer_ID__c = null
```

for thousands of records.

Security won't fix your data mapping.

But if integration permissions and Salesforce validation are properly constrained:

```text
Salesforce required/external-ID rules
+
limited permissions
+
monitoring
```

can reduce the damage.

Security isn't just hacker prevention.

It's also limiting consequences of software defects.

---

# 8.53 Authentication vs authorization

Memorize:

```text
Authentication
--------------
Who are you?


Authorization
-------------
What are you allowed to do?
```

OAuth proves/establishes identity and token context.

Salesforce permissions determine allowed operations.

A Mule application can:

```text
authenticate successfully
```

and then get:

```text
INSUFFICIENT_PERMISSIONS
```

because authorization failed.

---

# 8.54 Security testing you should mention

Given your QA background, this is a great bridge.

For Mule → Salesforce I'd test:

```text
valid credentials
→ succeeds

invalid credentials
→ rejected

expired/rotated credential behavior

restricted integration identity
→ allowed fields succeed

forbidden field/object
→ fails predictably

QA Mule
→ cannot reach/use PROD credentials

logs
→ no secrets

error responses
→ don't expose downstream tokens/internal details

TLS/certificate failures
→ handled appropriately
```

And also:

```text
Does a debug-level incident dump an Authorization header?
```

Excellent thing to check.

---

# 8.55 Modern configuration architecture

A good mental model:

```text
                  SOURCE CONTROL
                       │
              Mule application code
                       │
                       ↓
                    ARTIFACT
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
         DEV           QA          PROD
          │            │            │
     dev config    qa config    prod config
          │            │            │
    dev secrets    qa secrets    prod secrets
          │            │            │
    SF Sandbox     SF Sandbox    SF Production
```

The artifact remains the same.

That picture is worth remembering.

---

# 8.56 What changes per environment?

Typically:

```text
YES:

hostnames
credentials
OAuth client configuration
queue names
database names
timeouts sometimes
logging configuration
feature/config flags


NO:

business logic
DataWeave mappings
flow behavior
compiled application code
```

Ideally.

---

# 8.57 Interview-ready answer: configuration

If asked:

> “How do you handle Mule configuration across environments?”

Say:

> “I externalize environment-specific values into configuration properties and select or inject them at deployment time. Sensitive values go through secure properties or the organization's secret-management platform, while the same built application artifact is promoted across dev, QA and production. I avoid environment-specific source-code branches.”

Excellent.

---

# 8.58 Interview-ready answer: Salesforce security

> “I'd use a dedicated Salesforce integration identity with least privilege and OAuth-based machine-to-machine authentication, such as Client Credentials or JWT depending on the organization's security model. Client secrets, certificates and other credentials should be externalized, independently rotatable and never logged or committed in plaintext.”

Also excellent.

---

# 8.59 Interview-ready answer: troubleshooting

> “If the integration works in QA but not production, before changing code I'd compare configuration, endpoint selection, OAuth client setup, integration-user permissions, field-level security, Salesforce schema, and certificate or secret state between environments.”

Very realistic.

---

# Module 8 Cheat Sheet

```text
CONFIGURATION
=============

${foo}
→ application/environment property

vars.foo
→ current Mule event variable


ENVIRONMENTS
============

dev / qa / prod

same artifact
different configuration


SECRETS
=======

Never hardcode

Secure Properties:
![encrypted value]

Access:
${secure::foo}

decryption key:
injected separately


SALESFORCE AUTH
===============

Current Connector 12:

OAuth 2.0
OAuth Client Credentials
OAuth JWT
OAuth SAML
Basic auth in supported scenarios

Old OAuth Username-Password flow:
removed from Connector 12


SECURITY
========

dedicated integration identity
least privilege

object permissions
field-level security
record access

TLS protects transport
OAuth handles identity/access context

Never log:
tokens
passwords
secrets
private keys


DEPLOYMENT MODEL
================

        Mule artifact
             ↓
     ┌───────┼───────┐
     ↓       ↓       ↓
    DEV      QA     PROD
     ↓       ↓       ↓
 separate configuration
 separate credentials
```

The main sentence to remember is:

> **“I want one immutable Mule artifact promoted across environments, with endpoints, credentials and secrets injected through environment-specific secure configuration.”**

That immediately communicates that you understand both Mule development and production deployment practices.

## Next: Module 9 — API-led architecture

This one will be more conceptual but very interview-heavy: **System APIs vs Process APIs vs Experience APIs, when the three-layer model is genuinely useful, when it becomes unnecessary architecture, how Salesforce System APIs should hide Salesforce specifics, and how to design reusable Mule APIs rather than point-to-point spaghetti.**

[1]: https://docs.mulesoft.com/mule-runtime/latest/secure-configuration-properties?utm_source=chatgpt.com "Secure Configuration Properties | MuleSoft Documentation"
[2]: https://docs.mulesoft.com/salesforce-connector/latest/?utm_source=chatgpt.com "Salesforce Connector 12.0 | MuleSoft Documentation"
[3]: https://docs.mulesoft.com/release-notes/connector/salesforce-connector-release-notes-mule-4?utm_source=chatgpt.com "Salesforce Connector Release Notes | MuleSoft Documentation"
