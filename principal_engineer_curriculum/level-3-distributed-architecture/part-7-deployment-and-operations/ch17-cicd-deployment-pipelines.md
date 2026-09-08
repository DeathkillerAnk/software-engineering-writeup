# Chapter 17 — CI/CD and Deployment Pipelines

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — Deployment velocity is a competitive advantage. Teams that deploy 50 times per day find bugs faster, ship features faster, and recover from incidents faster than teams that deploy once per sprint. But velocity without safety is chaos. CI/CD is the engineering discipline that makes high-frequency deployment safe: every commit is automatically tested, every build is reproducible, every deployment is auditable, and every bad deploy can be rolled back in under 2 minutes. A Principal Engineer who cannot design a safe deployment pipeline is a Principal Engineer who has handed their reliability to chance.

## Prerequisites
Chapter 10 — Observability (metrics, tracing — the signals that tell you if a deploy is bad)
Chapter 15 — Service Mesh (canary deployments, traffic splitting)
Chapter 16 — Kubernetes (rolling updates, pods, deployments — the deployment target)

## Learning Objectives

By the end of this chapter you will be able to:

1. Distinguish CI (continuous integration), CD (continuous delivery), and CD (continuous deployment) — and explain when each is appropriate.
2. Design a multi-stage CI pipeline: lint, unit test, integration test, security scan, build, and publish.
3. Explain the GitOps model — how Git becomes the source of truth for production state, and how ArgoCD implements it.
4. Design blue-green deployments, canary releases, and feature flags — explaining the trade-offs of each.
5. Implement deployment safety mechanisms: automated rollback, progressive delivery, deploy-gate metrics.
6. Describe supply chain security: signed container images, SBOM (Software Bill of Materials), SLSA provenance.
7. Design a deployment pipeline for a Kubernetes-native platform: image build → scan → push → GitOps apply → progressive rollout → automatic rollback.
8. Explain the Twelve-Factor App principles as they apply to deployment portability.

## Why This Matters

In 2020, a major financial platform deployed a new version of their transaction processing service. The deployment was manual: engineers SSHed into servers and ran deployment scripts. The new version had a misconfiguration — a wrong database connection string. The deployment script didn't validate configuration. The result: 4 hours of partial service degradation while engineers diagnosed the issue and manually rolled back.

With a well-designed CI/CD pipeline:
- The misconfiguration would be caught by integration tests (test with production-like config)
- The deployment would be a canary: 1% of traffic → verify metrics → 100%
- On the first sign of DB connection errors: automatic rollback in 90 seconds
- The entire diagnosis and rollback: automated, no engineer needed at 2 AM

The difference between the incident and the near-miss: a deployment pipeline designed by someone who thought about failure modes.

---

## Mental Model

> **A CI/CD pipeline is a trust machine. Each stage adds evidence that the artifact is safe to deploy further. Lint + unit tests: "the code is syntactically and logically correct." Integration tests: "the service behaves correctly with its dependencies." Security scan: "no known vulnerabilities in this build." Canary deploy: "the service behaves correctly under real traffic." Full rollout: "we have enough evidence to trust this version at scale." The pipeline is not just about automation — it is about systematically building confidence before exposing more users to an unproven change.**

---

## Intuition

Think of CI/CD like an aircraft certification process.

**Without CI/CD (artisanal deployment):** An engineer builds a new plane part in the shop, bolts it directly onto the plane in service, hopes it works. If it breaks mid-flight, the pilots scramble to recover.

**With CI/CD:**
1. **Unit test:** Part tested in isolation on the bench (does it have the right dimensions?).
2. **Integration test:** Part tested with the components it connects to (does it fit? does it interact correctly?).
3. **Staging flight test:** Part installed on a test aircraft. One test flight. Instruments monitored.
4. **Canary production:** Part installed on 1% of the fleet. Real flights, real monitoring.
5. **Full rollout:** Evidence gathered. Rollout to 100%.

Each stage gates the next. Evidence accumulates. The engineer doesn't guess at safety — the process proves it. And if anything fails: the part is pulled. The fleet reverts to the previous certified version.

---

## Visual Explanation

### The Complete Pipeline

```
Developer pushes code → GitHub/GitLab
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CI Pipeline (GitHub Actions / Jenkins)        │
│                                                                 │
│  ┌──────┐  ┌──────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ Lint │→ │Unit Test │→ │ Integration   │→ │ Security     │  │
│  │      │  │ (fast,   │  │ Test (docker- │  │ Scan         │  │
│  │      │  │  ~1 min) │  │  compose,~5m) │  │ (Trivy,      │  │
│  └──────┘  └──────────┘  └───────────────┘  │  Snyk, ~2m)  │  │
│                                              └──────┬───────┘  │
│                                                     │          │
│  ┌────────────────────┐  ┌───────────────────────┐  │          │
│  │ Build & Push Image │← │ FAIL: stop pipeline   │  │          │
│  │ (Docker buildx,    │  │ block PR merge        │  │          │
│  │  multi-arch, ~3m)  │  └───────────────────────┘  │          │
│  └─────────┬──────────┘                             │          │
│            │ image: registry/payment:sha-a1b2c3d    │          │
└────────────┼────────────────────────────────────────┘          │
             │                                                    │
             ▼                                                    │
┌────────────────────────────────────────────────────────────────┐
│              CD Pipeline (ArgoCD / Flux / Spinnaker)           │
│                                                                │
│  Git repo: k8s-manifests/payment/deployment.yaml              │
│  (PR auto-opened: update image tag to sha-a1b2c3d)            │
│                                                                │
│  ┌───────────────┐   ┌──────────────┐   ┌────────────────┐    │
│  │  Deploy to    │→  │ Deploy to    │→  │ Deploy to      │    │
│  │  dev          │   │  staging     │   │  production    │    │
│  │  (auto)       │   │  (auto)      │   │  (manual gate  │    │
│  │               │   │              │   │   or auto)     │    │
│  └───────────────┘   └──────────────┘   └───────┬────────┘    │
│                                                  │             │
│                                      ┌───────────┴──────────┐  │
│                                      │  Progressive Delivery │  │
│                                      │  (Flagger)           │  │
│                                      │  1% → 10% → 25%      │  │
│                                      │  → 50% → 100%        │  │
│                                      │  Auto-rollback on    │  │
│                                      │  error rate > 1%     │  │
│                                      └──────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### GitOps Flow

```
Developer flow:
  1. Push code → feature branch → CI runs → PR opened
  2. PR merged to main → CI runs → image built, tagged with git SHA
  3. Automated commit to k8s-manifests repo: payment/deployment.yaml
     spec.template.spec.containers[0].image: payment-service:sha-a1b2c3d

ArgoCD flow:
  1. ArgoCD watches k8s-manifests repo (polls every 3 minutes or webhook)
  2. Detects: desired state (git) ≠ actual state (cluster)
  3. Syncs: applies kubectl diff → applies changes
  4. Reports: sync status (Synced/OutOfSync/Error)

Result: git commit IS the deployment event.
  - Every change to production is a git commit (auditable, reversible)
  - No direct kubectl apply to production
  - Rolling back: revert the git commit → ArgoCD re-syncs old state
  - Who deployed what when: git log
```

---

## Core Concepts

### 1. Continuous Integration — Build Fast, Fail Fast

CI is the practice of merging code frequently (multiple times per day) and running automated tests on every merge. The goal: detect integration failures immediately, not at the end of a sprint.

**Principles:**
- Every commit on main branch triggers the full CI pipeline
- Pipeline must be fast: engineers wait for CI results. If CI takes 45 minutes, engineers context-switch and lose flow. Target: < 10 minutes for the standard pipeline.
- Pipeline must be reliable: flaky tests are worse than no tests — they train engineers to ignore failures
- Pipeline runs in isolation: no shared state between runs, deterministic

**CI Pipeline stages in order of cost (cheapest first):**

```yaml
# GitHub Actions workflow:
name: CI Pipeline
on:
  push:
    branches: [main, 'feature/**']
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run linter
        run: |
          golangci-lint run ./...      # Go: fast, runs in ~30s
          # or: eslint src/ (Node.js)
          # or: flake8 . (Python)
          # or: ./mvnw checkstyle:check (Java)
    # Fail fast: if lint fails, no point running tests

  unit-test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests with coverage
        run: |
          go test ./... -race -coverprofile=coverage.out -covermode=atomic
          go tool cover -func=coverage.out | tail -1  # print total coverage
      - name: Coverage gate (fail if < 80%)
        run: |
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi
      - uses: codecov/codecov-action@v3  # Upload coverage report
        with:
          files: coverage.out

  integration-test:
    needs: unit-test
    runs-on: ubuntu-latest
    services:  # Spin up dependencies (docker-compose alternative)
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests
        env:
          DB_URL: postgresql://postgres:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379
        run: go test ./integration/... -timeout 10m -v

  security-scan:
    needs: unit-test  # parallel with integration-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Dependency vulnerability scan
        run: |
          trivy fs . --severity HIGH,CRITICAL --exit-code 1
          # or: snyk test --severity-threshold=high
          # or: npm audit --audit-level=high (Node.js)
      - name: SAST (Static Application Security Testing)
        run: |
          semgrep --config=auto --severity=ERROR .
          # or: gosec ./... (Go)
          # or: bandit -r . (Python)

  build-push:
    needs: [integration-test, security-scan]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write  # for OIDC-based registry auth
    steps:
      - uses: actions/checkout@v4
      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/company/payment-service:${{ github.sha }}
            ghcr.io/company/payment-service:latest
          cache-from: type=gha   # GitHub Actions cache → faster builds
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64  # multi-arch (for ARM-based prod)
      
      - name: Container image vulnerability scan
        run: |
          trivy image ghcr.io/company/payment-service:${{ github.sha }} \
            --severity HIGH,CRITICAL --exit-code 1
      
      - name: Sign image (cosign — supply chain security)
        env:
          COSIGN_EXPERIMENTAL: 1
        run: |
          cosign sign ghcr.io/company/payment-service:${{ github.sha }}
          # Generates a transparency log entry (Rekor)
          # Verifiable: anyone can verify the image was signed by this pipeline
      
      - name: Generate SBOM (Software Bill of Materials)
        run: |
          syft ghcr.io/company/payment-service:${{ github.sha }} \
            -o spdx-json > sbom.json
          # SBOM: lists every dependency in the image
          # Used for: compliance, vulnerability tracking, license auditing
```

**Dockerfile best practices for fast, secure builds:**
```dockerfile
# Multi-stage build: separate build environment from runtime image
FROM golang:1.22-alpine AS builder
WORKDIR /app
# Copy go.mod/go.sum first (layer cache: if deps unchanged, no re-download)
COPY go.mod go.sum ./
RUN go mod download
# Copy source after deps (invalidates cache only if source changes)
COPY . .
RUN CGO_ENABLED=0 go build -o payment-service -ldflags="-s -w" ./cmd/server

# Minimal runtime image (no build tools, no shell in production)
FROM gcr.io/distroless/static-nonroot:nonroot
# distroless: no shell, no package manager, no extra binaries
# → smallest attack surface: ~2MB image vs 1GB with Ubuntu base
COPY --from=builder /app/payment-service /payment-service
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/payment-service"]

# Layer optimization:
# - COPY go.mod before source: only re-download deps when go.mod changes
# - .dockerignore: exclude tests, docs, git history
# - --ldflags="-s -w": strip debug symbols (smaller binary)
# - distroless: no CVEs from unnecessary OS packages
```

**.dockerignore — what not to include in the image:**
```
.git
**/*_test.go
docs/
*.md
.env
.env.*
coverage.out
```

### 2. GitOps — Git as the Source of Truth

GitOps is a deployment model where the desired state of production is always a Git commit. The cluster is continuously reconciled to match that commit.

**GitOps principles:**
1. **Declarative:** Desired state expressed as declarative configuration (Kubernetes YAML)
2. **Versioned and immutable:** Configuration stored in Git (immutable history)
3. **Pulled, not pushed:** The cluster pulls changes from Git (not pushed by CI)
4. **Continuously reconciled:** A controller (ArgoCD/Flux) continuously ensures actual = desired

**Repository structure:**
```
k8s-manifests/ (separate repo from application code)
├── apps/
│   ├── payment-service/
│   │   ├── base/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── kustomization.yaml
│   │   └── overlays/
│   │       ├── dev/
│   │       │   └── kustomization.yaml  # dev-specific patches
│   │       ├── staging/
│   │       │   └── kustomization.yaml
│   │       └── production/
│   │           ├── kustomization.yaml  # prod-specific patches
│   │           └── hpa.yaml            # prod-only: HPA
│   └── order-service/
│       └── ...
├── infrastructure/
│   ├── namespaces.yaml
│   ├── rbac.yaml
│   └── network-policies.yaml
└── README.md
```

**ArgoCD Application definition:**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: payment-service-production
  namespace: argocd
spec:
  project: production
  source:
    repoURL: https://github.com/company/k8s-manifests
    targetRevision: main
    path: apps/payment-service/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true         # delete resources removed from git
      selfHeal: true      # revert manual kubectl changes (drift correction)
      allowEmpty: false   # never sync to an empty state (safety guard)
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  
  # Health checks: ArgoCD won't mark sync complete until all resources are healthy
  # (Deployment: all pods Running and Ready)
```

**Image promotion workflow (CI → CD):**
```bash
# Part of CI pipeline (after image build and push):
IMAGE_TAG="${GITHUB_SHA::8}"  # first 8 chars of git SHA

# Update image tag in the k8s-manifests repo:
git clone https://github.com/company/k8s-manifests
cd k8s-manifests

# kustomize sets the image tag (no sed/awk hacks):
cd apps/payment-service/overlays/staging
kustomize edit set image \
  payment-service=ghcr.io/company/payment-service:$IMAGE_TAG

git add .
git commit -m "chore: update payment-service to $IMAGE_TAG [ci skip]"
git push

# ArgoCD detects the change → syncs → deploys new version to staging
# [ci skip]: tells CI to not trigger another CI run for this commit
```

**Why "pulled, not pushed" matters:**
```
Push model (traditional):
  CI pipeline: kubectl apply -f deployment.yaml → production cluster
  
  Problems:
  - CI credentials have full cluster access (huge blast radius if CI is compromised)
  - No drift detection: manual kubectl changes go undetected
  - No single source of truth: what's in git ≠ what's in the cluster (maybe)
  - Rollback: re-run old CI job (assumes old job is reproducible)

Pull model (GitOps):
  ArgoCD in the cluster: pulls from git, applies to cluster
  
  Benefits:
  - CI credentials: only write to git repo (limited blast radius)
  - Drift detection: any manual kubectl change is detected and reverted (selfHeal)
  - Audit: git log is the audit log. Who deployed what = who made the git commit.
  - Rollback: git revert → ArgoCD syncs old state. Clean, atomic, auditable.
```

### 3. Deployment Strategies

#### Blue-Green Deployment

Two identical environments: Blue (current production) and Green (new version). Switch traffic instantaneously.

```
Before deployment:
  Blue (v1): 100% of traffic
  Green (v2): deployed, idle, fully tested

Switch:
  Load balancer: route 100% → Green
  Instant: no gradual rollout, no partial traffic split
  Blue: still running (not terminated yet)

On success:
  Blue: terminated (or kept as rollback target)

On failure:
  Load balancer: route 100% → Blue (instant rollback, ~5 seconds)
  Green: investigate and fix

Kubernetes implementation:
  Service selector: change label selector from app=v1 to app=v2
  kubectl patch service payment-service \
    -p '{"spec":{"selector":{"version":"v2"}}}'
  → 100% instant traffic switch

Trade-offs:
  ✅ Zero-downtime deployment (traffic switches instantly)
  ✅ Instant rollback (switch selector back)
  ✅ Full production testing before switch (green runs full-stack tests)
  ❌ Requires 2× infrastructure (blue and green both running)
  ❌ Database schema changes are dangerous:
     If v2 changes DB schema, and you roll back to v1: v1 may not understand v2's schema
     Mitigation: expand-contract pattern (Chapter 12) — schema changes backward-compatible
  ❌ Session affinity: if users have sessions on Blue, they're lost after switch
```

#### Canary Deployment

Route a small percentage of traffic to the new version. Monitor. Expand gradually.

```
Canary progression:
  v1: 100%
  v1:  99%, v2: 1%   → monitor 5 minutes
  v1:  90%, v2: 10%  → monitor 10 minutes
  v1:  75%, v2: 25%  → monitor 10 minutes
  v1:  50%, v2: 50%  → monitor 10 minutes
  v1:   0%, v2: 100% → deployment complete

Kubernetes implementation (via Istio VirtualService + Flagger):
  See Chapter 15 for the mesh-based canary.
  
  Without mesh: proportional replicas:
  v1: 9 replicas, v2: 1 replica → ~10% canary
  (Less precise: kube-proxy distributes randomly, not exactly 10%)

Flagger (automated progressive delivery):
  Analyzes metrics every 60 seconds:
    error_rate = rate(http_requests_total{version="v2",status!~"2.."}[1m]) /
                 rate(http_requests_total{version="v2"}[1m])
    
    latency_p99 = histogram_quantile(0.99,
                    rate(http_request_duration_seconds_bucket{version="v2"}[1m]))
  
  If error_rate < threshold AND latency < threshold:
    Increment canary weight by stepWeight (e.g., 10%)
  
  If error_rate > threshold OR latency > threshold:
    Rollback: weight → 0%, alert, mark canary as failed
  
  Configuration:
    canaryWeight: 5      # start at 5%
    stepWeight: 10       # increment by 10% each step
    threshold: 5         # 5 analysis intervals to increment
    interval: 1m         # analyze every 1 minute
    analysis:
      metrics:
        - name: request-success-rate
          thresholdRange:
            min: 99      # 99% success rate required
          interval: 1m
        - name: request-duration
          thresholdRange:
            max: 500     # p99 < 500ms
          interval: 1m
```

#### Feature Flags — Decoupling Deploy from Release

Feature flags separate the deployment event (code in production) from the release event (feature enabled for users).

```
Use cases:
  1. Kill switch: deploy new payment processor, feature flag off.
     On bug: flip flag off → instant rollback without deployment.
  
  2. Progressive rollout: enable for 1% of users → 10% → 100% (no redeployment)
  
  3. A/B testing: 50% users get feature A, 50% get feature B → measure conversion rate
  
  4. Trunk-based development: merge incomplete features behind a flag.
     Main branch always deployable (flag keeps incomplete feature hidden).

OpenFeature (open standard for feature flags):
  Provider-agnostic API → pluggable backends (LaunchDarkly, Unleash, Flagsmith, self-hosted)

Implementation (Java / Spring):
  @Inject
  OpenFeatureClient client;
  
  public PaymentResult processPayment(PaymentRequest request) {
    boolean useNewProcessor = client.getBooleanValue(
      "new-payment-processor",
      false,  // default: off
      EvaluationContext.builder()
        .userId(request.getUserId())    // user-level targeting
        .attributes(Map.of(
          "tier", request.getUserTier(),
          "country", request.getCountry()
        ))
        .build()
    );
    
    if (useNewProcessor) {
      return newPaymentProcessor.process(request);
    }
    return legacyPaymentProcessor.process(request);
  }

Flag evaluation (LaunchDarkly targeting rules):
  Rule 1: if user.tier = "premium" → true (enable for premium users first)
  Rule 2: if rollout = 10% of remaining users → true (10% of non-premium users)
  Default: false

Trade-offs of feature flags:
  ✅ Instant rollback (flag off = feature off, no deployment)
  ✅ Progressive rollout without mesh traffic splitting
  ✅ A/B testing without infrastructure changes
  ❌ Code complexity: every flag = one if-statement + eventual cleanup burden
  ❌ Flag debt: flags that are never cleaned up → spaghetti code
  ❌ Flag evaluation adds latency (if evaluated remotely: 1-5ms per request)
      Mitigation: local evaluation with SDK (rules cached in memory)

Flag hygiene rules:
  Every flag has an owner and expiry date.
  Flag removed from code within 2 sprints of full rollout.
  Flag count in production > 50: flag debt alert.
  Never nest feature flags (flag inside flag → combinatorial explosion).
```

### 4. Rollback Strategies

**Fast rollback is not optional — it is a primary design constraint.**

```
Strategy 1: GitOps revert (standard)
  git revert <deploy-commit>     # creates a new commit reverting the image tag
  git push                       # ArgoCD syncs → old image deployed
  Time: ~3 minutes (git push + ArgoCD sync + pod rollout)
  
Strategy 2: Kubernetes rollout undo (emergency)
  kubectl rollout undo deployment/payment-service -n production
  # Kubernetes reverts to previous ReplicaSet (previous image tag stored in rollout history)
  # No git change → ArgoCD will detect drift and re-apply git state (unless selfHeal=false)
  Time: ~90 seconds (immediate pod replacement)
  
  Rollout history:
  kubectl rollout history deployment/payment-service -n production
  # REVISION  CHANGE-CAUSE
  # 1         deploy sha-a1b2c3d (previous)
  # 2         deploy sha-e4f5g6h (current)
  kubectl rollout undo deployment/payment-service --to-revision=1 -n production

Strategy 3: Feature flag disable (instant — no deployment)
  Toggle flag off in LaunchDarkly/Unleash → evaluates to false in SDK
  Time: < 30 seconds (SDK polls flag service every 30s, or webhook push)
  
Strategy 4: Traffic shift (mesh canary)
  FlaggerCanary: rollback weight to 0% for v2
  Time: < 10 seconds (VirtualService update propagated by Istio)

Automated rollback (Flagger):
  Flagger monitors metrics during canary.
  If threshold exceeded: automatically sets canary weight = 0%.
  No human in the loop. Time to rollback: < 60 seconds from metric breach.
  
Post-rollback:
  1. Alert oncall: "Canary rolled back automatically. Reason: error_rate=4.2% > threshold=1%"
  2. Preserve the canary version for investigation (don't delete)
  3. Analyze: what metric triggered rollback? What was the bug?
  4. Fix, re-deploy with a new canary
```

### 5. Environment Strategy

```
Environments:
  dev        → auto-deployed on every merge to main
  staging    → auto-deployed after dev passes, integration tests run
  production → manual approval gate + progressive delivery

Ephemeral environments (preview environments):
  Each PR: CI spins up an ephemeral namespace in the dev cluster
  URL: payment-service-pr-123.dev.company.internal
  
  Use cases:
    - QA testing on the actual PR code
    - Designer review of UI changes
    - Load testing on a specific branch
  
  Cleanup: ephemeral env auto-deleted when PR is merged or closed
  
  Implementation (GitHub Actions + ArgoCD):
    on: pull_request
    - Deploy to namespace: payment-service-pr-${{ github.event.pull_request.number }}
    - Comment PR with URL: "Preview deployed: https://pr-123.dev..."
    
    on: pull_request closed
    - Delete ArgoCD Application for namespace
    - Namespace garbage-collected

Promotion model:
  Image built once (immutable artifact with git SHA tag)
  Promoted through environments (same image, different config)
  
  NEVER:
    - Rebuild the image per environment (different binary = untested code)
    - Parameterize build-time config (env-specific config → runtime env vars)
  
  Kustomize overlay per environment:
    base: deployment.yaml (image: payment-service:PLACEHOLDER)
    overlays/dev/kustomization.yaml: image: payment-service:sha-a1b2c3d
    overlays/prod/kustomization.yaml: image: payment-service:sha-a1b2c3d (same image!)
    overlays/prod/patch-replicas.yaml: replicas: 20 (prod has more replicas)
    overlays/dev/patch-replicas.yaml: replicas: 1 (dev has fewer replicas)
```

### 6. Supply Chain Security

**The SolarWinds lesson:** Build systems are attack vectors. An attacker who compromises your CI pipeline can inject malicious code into your production artifacts. Supply chain security ensures:
- The artifact you deploy is exactly what was built from the code you reviewed
- No unauthorized modification between source code and running container

```
SLSA (Supply-chain Levels for Software Artifacts):
  Level 1: Provenance generated (build + source info in metadata)
  Level 2: Signed provenance (cryptographically signed by build system)
  Level 3: Hardened build platform (no credential access, hermetic build)
  Level 4: Two-person review, hermetic reproducible builds

Sigstore (cosign + rekor + fulcio):
  cosign sign <image>:
    Generates a signature using the CI service's OIDC identity (GitHub Actions, etc.)
    Uploads signature to Rekor (transparency log — public, append-only)
    No private key management needed (keyless signing via OIDC)
  
  cosign verify <image>:
    Checks Rekor for signature
    Verifies the signer identity (must be from our GitHub org, our workflow)
    Fails if image was modified after signing

Policy enforcement (OPA Gatekeeper / Kyverno):
  Kubernetes admission webhook: every new pod must have a signed image.
  
  Kyverno policy:
    apiVersion: kyverno.io/v1
    kind: ClusterPolicy
    metadata:
      name: verify-image-signature
    spec:
      rules:
        - name: check-signature
          match:
            resources:
              kinds: ["Pod"]
          verifyImages:
            - imageReferences:
                - "ghcr.io/company/*"
              attestors:
                - entries:
                    - keyless:
                        subject: "https://github.com/company/payment-service/.github/workflows/ci.yaml@refs/heads/main"
                        issuer: "https://token.actions.githubusercontent.com"
          # → Rejects any pod using an unsigned image or signed by a different workflow
```

**SBOM (Software Bill of Materials):**
```
Why SBOM:
  Log4Shell (2021): critical vulnerability in log4j.
  Organizations scrambled to answer: "Do we use log4j anywhere?"
  Without SBOM: manual audit of every repo, taking days.
  With SBOM: automated query: grep log4j from all SBOMs → affected services identified in minutes.

Generating SBOM:
  syft <image> -o spdx-json > sbom.json
  # Output: list of every OS package, language library, version
  
  Attach to image:
  cosign attach sbom --sbom sbom.json <image>
  
  Scan SBOM for vulnerabilities:
  grype sbom:./sbom.json --fail-on high
  # Matches SBOM packages against CVE databases (NVD, GHSA, OSV)
  # Fails pipeline if high/critical CVEs found
```

### 7. Pipeline Performance Optimization

A slow CI pipeline kills developer productivity. Common optimizations:

```
1. Parallelism:
   lint, unit-test, security-scan: run in parallel (no dependency between them)
   integration-test: can run parallel to lint (but needs unit-test to pass first)
   
   Time without parallelism: 2 + 5 + 3 + 5 = 15 minutes
   Time with parallelism:    max(2, 3, 5) + 5 = 10 minutes (if int-test is parallel)
   Actually: lint(30s) → unit(2m) || security(3m) → integration(5m) → build(3m)
   Total: 0:30 + 2:00 + 5:00 + 3:00 = 10:30 minutes

2. Caching:
   Dependency cache: go mod download cached across runs (hit rate: 95%)
   Docker layer cache: go.mod layer cached unless dependencies change
   Test result cache: if source files unchanged, skip tests (pytest-cache, Go test cache)
   
   Tools:
     GitHub Actions: actions/cache → S3-backed cache (~100 MB/s restore speed)
     Bazel: hermetic, distributed, fine-grained caching (Google's approach)
     Turborepo (Node.js monorepos): only rebuild changed packages

3. Test splitting:
   If integration tests take 20 minutes: split across 4 runners
   --shard=1/4, --shard=2/4, --shard=3/4, --shard=4/4
   Each runner: 5 minutes. Total wall time: 5 minutes.
   Tools: pytest-split, Jest --shard, Go test list + split

4. Smart test selection:
   Instead of running all tests on every commit: run only tests affected by the diff.
   Tools: Bazel (dependency graph → minimal affected tests), pytest-svn-changed, Nx

5. Self-hosted runners:
   GitHub-hosted runners: 2 vCPU, 7 GB RAM ($0.008/minute)
   Self-hosted runners: 16 vCPU, 64 GB RAM (your EC2/GCE cost — 5-10× cheaper for heavy usage)
   Arm64 runners: 2× cheaper for ARM-native builds (Apple Silicon containers)
```

### 8. The Twelve-Factor App — Deployment Portability

The Twelve-Factor App methodology (Heroku, 2012) defines principles for building applications that are portable, deployable, and operable in modern CI/CD environments. The deployment-relevant factors:

```
III. Config — store config in the environment, not in the code
  BAD:  const DB_URL = "postgresql://prod.internal:5432/payments"  (hardcoded!)
  GOOD: DB_URL = os.getenv("DATABASE_URL")  (injected at runtime)
  
  In Kubernetes: ConfigMap (non-sensitive) + Secret (sensitive) → env vars
  envFrom:
    - configMapRef:
        name: payment-service-config
    - secretRef:
        name: payment-service-secrets
  
  Why: same image deployed to dev/staging/prod, different config injected.
       Never rebuild to change a connection string.

IV. Backing services — treat databases, caches, queues as attached resources
  The application doesn't know if PostgreSQL is local or RDS.
  It connects via DATABASE_URL. Swapping implementations: change the URL.
  Enables: easy testing with local PostgreSQL, production with RDS.

VI. Processes — execute as stateless, share-nothing processes
  No local state stored between requests (no files, no in-process cache that matters).
  All state in backing services (DB, Redis, S3).
  Why: any pod can be killed and replaced. Stateless = re-schedulable.

IX. Disposability — maximize robustness with fast startup and graceful shutdown
  Startup: < 30 seconds (readiness probe must pass quickly)
  Shutdown: handle SIGTERM, drain in-flight requests, exit cleanly
  Why: Kubernetes reschedules pods. Fast start + graceful stop = safe rescheduling.

XI. Logs — treat logs as event streams
  Write to stdout/stderr only (no log files).
  Kubernetes collects stdout/stderr from each container.
  Log aggregator (Fluentd/Vector) ships to Elasticsearch/CloudWatch/Datadog.
  Why: applications don't own log rotation, storage, or shipping.
       Stdout is the universal contract.
```

---

## Step-by-Step Execution

### Designing a Production Deployment Pipeline from Scratch

```
Requirements:
  Service: payment-service (Go, Kubernetes)
  Team: 10 engineers, deploy multiple times per day
  SLO: 99.9% uptime, < 200ms p99 latency
  Constraint: PCI-DSS compliance (financial data)

Step 1: Choose CI platform
  GitHub Actions (if on GitHub): zero-infra, fast setup
  Self-hosted runners for: security-sensitive builds, expensive integration tests
  GitLab CI (if on GitLab): built-in, strong security features
  
Step 2: Design CI stages (ordered by fail-fast priority):
  Stage 1: Lint (30s) — catch syntax/style errors before running tests
  Stage 2: Unit tests + coverage gate 80% (2m)
  Stage 2: SAST / secret scan (parallel with unit tests, 2m)
  Stage 3: Integration tests with PostgreSQL + Redis (5m)
  Stage 3: Dependency scan (Trivy fs, parallel with integration tests, 2m)
  Stage 4: Build multi-arch Docker image (3m, with cache)
  Stage 4: Container scan (Trivy image, parallel with build if pre-built, 2m)
  Stage 5: Sign image (cosign, keyless) + generate SBOM (1m)
  
  Total pipeline time: ~14 minutes (parallelized appropriately)

Step 3: Choose CD platform
  ArgoCD: GitOps pull model, Kubernetes-native, strong RBAC
  
Step 4: Environment strategy
  dev → auto-deploy on main merge (no approval)
  staging → auto-deploy after dev is healthy for 15 minutes
  production → manual approval gate + Flagger progressive delivery

Step 5: Define deploy-gate metrics (Flagger):
  success_rate > 99% (error budget: 1%)
  latency_p99 < 200ms
  Analysis interval: 1 minute
  Steps: 5%, 15%, 30%, 60%, 100% (4 increments × 1 min = 4 minutes minimum)
  
Step 6: Rollback strategy
  Automated: Flagger rolls back if metrics breach
  Manual: git revert → PR → ArgoCD syncs
  Emergency: kubectl rollout undo (bypasses GitOps, creates drift)
             → reconcile drift: git revert reflects the rollback
  
Step 7: Compliance requirements (PCI-DSS):
  Image signing (cosign) → provenance for every deployed artifact
  SBOM generation → vulnerability tracking
  Approved image policy (Kyverno) → only signed images from approved repo run
  Audit log: ArgoCD sync history = deployment audit log (who, what, when)
  Secrets: stored in Vault or AWS Secrets Manager, never in git
  Branch protection: main branch requires 2 reviewers + CI passing
```

---

## Deep Dive

### Pipeline-as-Code vs GUI-Based Pipelines

```
GUI-based pipelines (Jenkins traditional, Azure DevOps classic):
  Pipeline defined via web UI
  ❌ Not version-controlled → pipeline changes not audited
  ❌ Not reproducible → "works on Jenkins, not on my machine"
  ❌ Not portable → tied to specific Jenkins instance config
  ❌ Drift between environments: staging pipeline ≠ production pipeline

Pipeline-as-code (GitHub Actions, GitLab CI, Tekton, Argo Workflows):
  Pipeline defined in .github/workflows/*.yaml (in the application repo)
  ✅ Version-controlled: pipeline changes go through PR review
  ✅ Reproducible: YAML defines exact steps, containers, environment
  ✅ Portable: move repos = move pipeline
  ✅ Consistent: same pipeline runs on PR, main branch, release

Tekton (Kubernetes-native pipeline):
  Runs CI tasks as Kubernetes pods (each step is a container)
  Tasks, Pipelines, PipelineRuns defined as CRDs
  Advantage: true isolation (each step in its own pod), native Kubernetes RBAC
  Disadvantage: much more verbose than GitHub Actions YAML
  Use when: need Kubernetes-level security isolation between CI steps,
             or: multi-tenant CI where teams run pipelines in shared cluster

Argo Workflows (Kubernetes-native DAG workflows):
  Defines CI/CD as a DAG (directed acyclic graph) of steps
  More expressive than GitHub Actions (true parallel DAG, conditional branching)
  Use when: complex pipeline topologies, ML training pipelines, batch pipelines
```

### Secrets Management in CI/CD

```
Where secrets live in a CI/CD pipeline:
  CI secrets: API keys, registry credentials, deployment credentials
  CD secrets: database passwords, service API keys, TLS certificates
  
Secrets hierarchy (most to least secure):
  
Level 1: Vault / AWS Secrets Manager (recommended):
  Secrets stored externally, never in git
  CI: requests secret at runtime using OIDC token (workload identity)
    - GitHub Actions: OIDC token → AWS STS AssumeRoleWithWebIdentity → get secret
    - No static credentials in CI → cannot be leaked via repo exposure
  
  GitHub Actions OIDC → AWS Secrets Manager:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
        aws-region: us-east-1
    # Role policy: secretsmanager:GetSecretValue for specific secrets only
    - name: Get DB password
      run: aws secretsmanager get-secret-value --secret-id prod/payment/db-password

Level 2: GitHub/GitLab encrypted secrets:
  Secrets stored in GitHub Secrets (AES-256 encrypted at rest)
  Referenced in workflow: ${{ secrets.DB_PASSWORD }}
  Masked in logs: GitHub replaces secret values with ***
  Limitation: static secrets (rotated manually)

Level 3: Sealed Secrets (for GitOps):
  Problem: how to store Kubernetes Secrets in git?
  git + kubernetes Secret = base64-encoded plaintext in your repo (NOT encrypted)
  
  Sealed Secrets solution:
    SealedSecret controller in cluster has a private key (never leaves cluster)
    Engineer: kubeseal --cert <cluster-public-key> < secret.yaml > sealed-secret.yaml
    Sealed secret: encrypted with cluster public key → safe to commit to git
    In cluster: SealedSecret controller decrypts → creates Kubernetes Secret
    
  Alternative: External Secrets Operator (pulls from Vault/AWS SM at runtime)
    ExternalSecret CRD: "fetch this secret from AWS SM and create a K8s Secret"
    Advantage: no sealed secret in git, secrets always fresh from source
```

### Deployment Frequency as a Technical Metric

DORA (DevOps Research and Assessment) metrics define four key metrics for software delivery performance:

```
1. Deployment Frequency
   Elite: multiple times per day (per service)
   High: once per day to once per week
   Medium: once per week to once per month
   Low: once per month or less

2. Lead Time for Changes
   Elite: < 1 hour (commit → production)
   High: 1 day to 1 week
   Medium: 1 week to 1 month
   Low: 1-6 months

3. Change Failure Rate
   Elite: 0-15% of deployments cause incidents
   High: 16-30%
   Low/Medium: 46-60%

4. Time to Restore Service (MTTR)
   Elite: < 1 hour
   High: < 1 day
   Medium: 1 day to 1 week
   Low: 1 week to 1 month

CI/CD impact on DORA metrics:
  Deployment frequency: CI removes manual testing gates → deploys multiple times/day
  Lead time: automated pipeline: commit → production in minutes (not days)
  Change failure rate: canary + automated rollback → fewer incidents reach full exposure
  MTTR: git revert + ArgoCD sync: rollback in < 3 minutes (not 4 hours)
```

---

## Real-World Example

### Google's Borg Deployment System — The Origin of Continuous Deployment

Google deploys updates to its services thousands of times per day. This is only possible because of:

1. **Mandatory automated tests.** All code at Google goes through Blaze (internal Bazel) testing before being allowed to submit. Test coverage requirements are enforced by the build system — not by culture.

2. **Hermetic builds.** Every build at Google is hermetic (all dependencies are versioned, builds are reproducible). The same commit built twice produces the same binary. This enables: "rollback to commit X" to always produce the same artifact.

3. **Binary authorization.** Google's production clusters (Borg) only accept binaries that have passed specific test suites and been signed by the build system. Engineers cannot deploy an unsigned binary.

4. **Canary infrastructure.** Every service has a "canary" tier: a small number of instances running the new version. Traffic is gradually shifted. Automated analysis gates the rollout.

5. **Rollback as a first-class operation.** Rollback at Google takes seconds (the old binary is cached in the build system and deployment framework). The expectation is: if something goes wrong, you roll back first, fix second.

This infrastructure is what allows 20,000+ engineers to deploy code to shared production services simultaneously without constant conflicts and incidents.

---

## Failure Scenarios

### Scenario 1: Secret Leaked via Git History

```
Engineer adds a debugging print statement: log.Printf("DB URL: %s", dbURL)
Code reviewed, merged to main. CI passes.
Pipeline deploys to production.

Security team: scans GitHub CI logs → finds DB URL with credentials in plain text.
  DB URL: postgresql://admin:SuperSecret123@prod.db.internal:5432/payments

Response:
  1. Rotate DB credentials immediately (generate new password)
  2. Update Kubernetes Secret with new credentials
  3. Rolling restart payment-service (picks up new credentials)
  4. Audit: who/what accessed the DB URL? Check DB logs for unusual connections.
  5. Scan git history: was the credential committed? (It wasn't — only in logs)
  6. Remediation: remove the log statement, re-deploy

Prevention:
  1. Secrets scanning in CI: git-secrets, detect-secrets, trufflehog
     Runs on every commit: scans for patterns matching credentials
     Blocks PR merge if credential pattern found
  
  2. Never log configuration values (especially connection strings)
     Structured logging: log field names, not values:
     log.WithField("dbHost", host).Info("connecting to database")
     (Host only, not the full URL with password)
  
  3. GitHub Advanced Security: secret scanning (scans all commits, PRs, issues)
     Alerts immediately if a secret pattern is pushed
  
  4. Environment-specific secrets: DB URL never hardcoded, always from environment
     Zero chance of leaking: if the code never has the secret, it can't leak it
```

### Scenario 2: Bad Deploy Cascades Before Automated Rollback

```
Payment service: new version deployed. Canary at 5% (Flagger).
Configuration: analysis interval=5m, threshold=error_rate<1%.

At T=0: canary goes live. 5% of traffic to v2.
At T=1m: v2 has a memory leak. Memory grows 100 MB/minute.
At T=5m: first Flagger analysis. Memory hasn't caused OOM yet (500 MB used).
         Error rate: 0.1% (within threshold). Flagger: advance to 15%.
At T=10m: 15% canary. Memory: 1.5 GB (approaching limit of 2 GB).
          Some pods approaching OOM. Error rate: 0.8% (still within 1% threshold).
          Flagger: advance to 30%.
At T=11m: pods OOMKilled. New pods started (memory leak resets).
          Error rate briefly spikes to 8% during pod restart.
At T=12m: Flagger detects error_rate > 1% threshold → rollback triggered.
          v2 weight → 0%. v1 gets 100% traffic.

Impact: 12 minutes of degraded service (15-30% of users on v2 experienced OOM errors).

Better analysis configuration:
  Add memory metric to Flagger analysis:
    - name: memory-usage
      thresholdRange:
        max: 1500Mi   # max 1.5 GB before rollback
      interval: 2m
  
  With memory metric:
    At T=4m (first analysis with memory metric):
    memory usage: 400 MB → OK
    At T=6m: memory: 600 MB → OK
    At T=8m: memory: 800 MB → OK
    At T=10m: memory: 1000 MB → OK (still < 1500 MB limit)
    At T=12m: memory: 1200 MB → OK
    At T=14m: memory: 1400 MB → OK
    At T=16m: memory: 1500 MB → BREACH → rollback triggered
    
  With shorter interval (1m) and tighter memory threshold:
    At T=8m: memory: 800 MB → with 500 MB threshold: rollback at T=6m
    
  Lesson: canary metrics must include resource utilization, not just error rate and latency.
  Memory leaks don't always manifest as errors immediately.
```

---

## Performance Considerations

### Build Time Optimization — Real Numbers

```
Baseline Go service: 5,000 lines of code, 50 dependencies

Without optimization:
  go mod download: 45 seconds (downloading 50 deps, no cache)
  go build: 30 seconds (full compile)
  docker build: 15 seconds (new layer every time)
  Total: ~90 seconds per run

With caching:
  go mod download: 2 seconds (cache hit, only downloads changed deps)
  go build: 10 seconds (incremental, only recompiles changed packages)
  docker build: 3 seconds (layer cache hit for deps layer)
  Total: ~15 seconds per run (6× faster)

GitHub Actions cache strategy:
  - uses: actions/cache@v3
    with:
      path: |
        ~/go/pkg/mod
        ~/.cache/go-build
      key: go-${{ runner.os }}-${{ hashFiles('go.sum') }}
      restore-keys: go-${{ runner.os }}-
  # key includes go.sum hash: cache invalidated only when deps change
  # restore-keys: fallback to any previous go cache if exact match misses
```

---

## Trade-offs

| Strategy | Rollback Speed | Blast Radius | Infrastructure Cost | DB Migration Complexity |
|----------|----------------|--------------|---------------------|------------------------|
| Blue-Green | Instant (~5s) | All-or-nothing | 2× compute | High (schema compat needed) |
| Canary | Immediate (Flagger) | 1-100% progressive | +N% canary pods | Low (gradual, observable) |
| Feature Flag | < 30s | Per-flag granularity | Minimal (flag eval overhead) | Low (code never changes) |
| Rolling Update | ~3 min (undo) | Progressive | None (same replicas) | Medium |

| Pipeline Approach | Speed | Security | Complexity |
|------------------|-------|----------|------------|
| Push to cluster (kubectl) | Fast | Poor (broad credentials) | Low |
| GitOps (ArgoCD pull) | +3 min (git sync) | Good (limited CI creds) | Medium |
| Ephemeral cluster per PR | Highest isolation | Best | High |
| Hermetic builds (Bazel) | Cached: very fast | Best (reproducible) | Very high |

---

## Production Considerations

1. **Pin all CI action versions and container images to a SHA, not a tag.** `uses: actions/checkout@v4` can change behavior if v4 is updated. Use: `uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11` (SHA-pinned). A malicious update to a GitHub Action can compromise every pipeline that uses it.
2. **Never store secrets in git, even encrypted with symmetric keys.** Symmetric key management is complex and break-glass scenarios are risky. Use asymmetric Sealed Secrets or External Secrets Operator (pulls from Vault/AWS SM at runtime).
3. **Measure and gate on build times.** A CI pipeline that grows to 45 minutes is a productivity drain. Set a budget: CI must complete in < 15 minutes. When a new test suite is added, the engineer must also optimize something to keep within budget.
4. **Require signed images in production via admission webhooks.** An unsigned image should never run in production. Kyverno or OPA Gatekeeper enforce this at the cluster level — no exception, regardless of who kubectl-applies it.
5. **Test your rollback procedure regularly.** "We can roll back in 2 minutes" is only true if you've actually done it recently. Schedule quarterly rollback drills. An untested rollback that fails during an incident is worse than no rollback plan.
6. **Separate the k8s-manifests repo from the application code repo.** This enforces: CI changes code, CD deploys manifests. The two concerns have different review requirements, different change frequency, and different access control requirements.

---

## Common Beginner Mistakes

1. **Rebuilding the Docker image per environment.** "Build in dev, rebuild in staging, rebuild in prod." Each build can have different behavior (non-deterministic build timestamps, library resolution, etc.). Build once, promote the same immutable artifact (identified by git SHA tag) across environments.
2. **Putting all secrets in environment variables via `.env` files committed to git.** `.env` files are the #1 source of credential leaks in open-source repositories. Use `.env.example` (with placeholder values) in git; never `.env` with real values.
3. **Not running security scans in CI because "they slow down the pipeline."** A 2-minute Trivy scan that catches a critical CVE (Log4Shell in a dependency) prevents a production compromise. Security scans are not optional; they are a pipeline stage with a budget.
4. **Using `latest` as the Docker image tag in deployments.** `latest` is mutable — it changes meaning on every push. Two pods with `image: payment-service:latest` may be running different code. Use immutable tags (git SHA: `payment-service:a1b2c3d`).

---

## Common Senior Engineer Mistakes

1. **GitOps with ArgoCD `selfHeal: true` but no branch protection on the manifests repo.** selfHeal reverts manual kubectl changes. But if an engineer directly commits to the manifests repo's main branch without a PR: ArgoCD deploys it automatically, without review. Branch protection + required PR review on the manifests repo is essential.
2. **Canary deployment without adding new metrics per release.** Flagger measures: error rate, latency. But the new version adds a new feature that queries a third-party API. If the third-party API is slow, error rate looks fine (errors are returned as successful responses with error codes in the body). Add business-level metrics to Flagger analysis: `payment_success_rate`, not just `http_success_rate`.
3. **Progressive delivery without a database migration plan.** v1 and v2 run simultaneously during canary. If v2 requires a new DB column, and v1 writes records without that column: v2 may fail on records written by v1. Always use the expand-contract migration pattern (Chapter 12) so both v1 and v2 can read and write the schema simultaneously.
4. **Treating CI pipeline failures as blocking but non-urgent.** A broken main branch CI pipeline means: no new deployments to production. A broken pipeline that stays broken for 3 hours = 3 hours of no ability to ship hotfixes. Treat a broken main-branch pipeline like an incident. Page the on-call. Fix immediately.

---

## Architecture Smells

- **Manual deployments via SSH and scripts** → no audit trail, no reproducibility, no rollback
- **"Works on my machine" — builds not hermetic** → CI might pass but production build differs
- **Single monolithic CI job** (everything serial) → 45-minute pipeline → developer flow destroyed
- **Image tag = `latest`** → deployments are not reproducible, rollback is undefined
- **Secrets in git** (even base64-encoded) → the illusion of security
- **No staging environment** → every change goes directly from code review to production
- **Canary with only error rate and latency** → memory leaks, business metric regressions go undetected
- **No automated rollback** → incidents require waking engineers, 30+ minute MTTRs

---

## Principal Engineer Perspective

Deployment infrastructure is a platform team product. The internal customers are the engineers who deploy services. The SLA of the CI/CD platform is: every engineer can deploy safely, frequently, and confidently, with fast feedback when something goes wrong.

**The four properties of a world-class deployment pipeline:**

1. **Fast feedback.** CI must complete in under 10 minutes for the common case. If feedback is slow, engineers batch changes (to avoid waiting) and deploy larger changesets — which are harder to debug. Fast CI incentivizes small, frequent commits.

2. **Safe deployment.** Every production deployment must have automated quality gates. The system must know (not guess) when a deployment is safe to advance. "It passed staging" is not sufficient; real user behavior in production is the only true signal.

3. **Instant rollback.** If a deploy is bad, recovery must take minutes, not hours. This is a design requirement, not an afterthought. It must be tested regularly.

4. **Full auditability.** Every change to production must be traceable to a commit, a PR, a reviewer, and a CI run. In a PCI/SOC2/ISO 27001 world: "we think we deployed X last Tuesday but we're not sure" is an audit failure.

**The Principal Engineer's pipeline questions:**
- Can any engineer deploy to production independently, safely, and without risk of taking down other teams' services? (If no: the deployment process is a bottleneck or a risk.)
- How long does it take from a "production emergency hotfix" commit to deployed in production? (It should be under 15 minutes — if it takes 2 hours, incidents get worse.)
- What percentage of production outages are caused by bad deployments? (Elite teams: < 15%. Measure it. DORA.)
- Can you tell me what code is running in production right now, who deployed it, and when? (If not: you don't have GitOps.)

---

## Architecture Review Questions

1. Is every Docker image tagged with an immutable identifier (git SHA)? Is `latest` absent from all deployment manifests?
2. Is the deployment pipeline defined as code (YAML in git), not as a GUI configuration?
3. Does CI include: lint, unit tests, integration tests, dependency scan, container scan, and image signing?
4. Is GitOps (ArgoCD/Flux) used for production deployments? Is `selfHeal: true` configured?
5. Is progressive delivery (canary/blue-green) used for production deployments of critical services?
6. What metrics are used as deploy gates? Do they include business metrics, not just technical metrics?
7. What is the rollback procedure? How long does it take? When was it last tested?
8. Are secrets stored outside of git (Vault, AWS Secrets Manager, Sealed Secrets)?
9. Is there a staging environment that mirrors production? Are integration tests run against it automatically?
10. What is the current deployment frequency? Lead time for changes? Change failure rate? Time to restore? (DORA metrics)

---

## Visual / Animation Specification

### Animation 1: GitOps Flow — Code to Production

**Four panels in sequence: Code Repo, CI Pipeline, Manifests Repo, ArgoCD → Cluster.**

**T=0:** Developer pushes commit to `payment-service` repo. Green flash.

**T=30s:** CI pipeline starts. Show stages lighting up in sequence: Lint ✅ (30s) → Unit Tests ✅ (2m) → Security Scan ✅ (2m) → Integration Tests ✅ (5m) → Build Image ✅ (3m).

**T=10m:** Image pushed to registry: `payment-service:sha-a1b2c3d`. Arrow to Manifests Repo. Auto-commit: `image: sha-a1b2c3d`. Manifests repo gets a new green commit dot.

**T=10:30:** ArgoCD (eye icon) detects new commit. "Out of sync: desired=sha-a1b2c3d, actual=sha-0a1b2c3."

**T=11m:** ArgoCD syncs. Kubernetes cluster: rolling update shows pods cycling (old → new). Progress bar: Canary 5% → 15% → 30% → 100%.

**T=15m:** ArgoCD: "Synced and Healthy" ✅. Caption: "15 minutes from commit to 100% production. Zero manual steps."

### Animation 2: Canary Deployment with Automated Rollback

**Traffic meter: 100 incoming arrows. Service boxes: v1 (blue) and v2 (green).**

**Phase 1 (5%):** 95 arrows → v1, 5 arrows → v2. Metrics panel: error_rate=0.1%, latency=120ms. ✅

**Phase 2 (15%):** 85 arrows → v1, 15 arrows → v2. Metrics: error_rate=0.2%, latency=130ms. ✅ Flagger: "Advancing to 30%."

**Phase 3 (30%):** 70 arrows → v1, 30 arrows → v2. Suddenly: v2 metrics spike RED. Error rate: 4.5%. Latency: 800ms.

**Flagger alert:** Red banner. "Threshold exceeded: error_rate=4.5% > 1%. ROLLBACK." Arrow: weight back to 0%.

**Result:** All 100 arrows → v1. v2: zero traffic. "Rollback complete in 45 seconds."

**Caption:** "30% of users were exposed to the bug. Automatic rollback. v2 never reached 100%."

---

## Hands-On Tutorial

### Build a Complete CI Pipeline

```yaml
# .github/workflows/ci-cd.yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # SHA-pinned
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - name: Run golangci-lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: v1.57

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: testpass
        options: --health-cmd pg_isready --health-interval 10s --health-retries 5
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache: true  # caches go module downloads
      - name: Run tests
        env:
          DATABASE_URL: postgres://postgres:testpass@localhost:5432/testdb?sslmode=disable
        run: |
          go test ./... -race -coverprofile=coverage.out -timeout 10m
      - name: Coverage gate
        run: |
          COVERAGE=$(go tool cover -func=coverage.out | grep ^total | awk '{print $3}' | tr -d '%')
          echo "Coverage: ${COVERAGE}%"
          [ $(echo "$COVERAGE >= 80" | bc) -eq 1 ] || { echo "Coverage below 80%"; exit 1; }

  security:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - name: Scan filesystem for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'
      - name: Check for secrets in code
        uses: trufflesecurity/trufflehog@v3
        with:
          path: ./
          base: main
          head: HEAD

  build-push:
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
      id-token: write  # for cosign keyless signing
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Install cosign
        uses: sigstore/cosign-installer@v3
      - name: Sign image
        run: |
          cosign sign --yes \
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ steps.build.outputs.digest }}
      - name: Update k8s-manifests
        run: |
          git clone https://x-access-token:${{ secrets.MANIFESTS_TOKEN }}@github.com/company/k8s-manifests
          cd k8s-manifests
          kustomize edit set image \
            payment-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          git config user.email "ci@company.com"
          git config user.name "CI Bot"
          git add .
          git commit -m "chore: update payment-service to ${{ github.sha }} [ci skip]"
          git push
```

---

## Exercises

**Conceptual:**
1. Explain the difference between Continuous Integration, Continuous Delivery, and Continuous Deployment. Give one scenario where you would stop at CD (Delivery) rather than CD (Deployment).
2. What is GitOps? How does it differ from traditional CI/CD push-to-cluster deployments? What specific security property does GitOps improve?
3. Compare blue-green deployments and canary releases. When is each the right choice?
4. What is a feature flag? Give three use cases for feature flags in a production microservices platform.
5. What is SBOM? What specific incident demonstrates why SBOM matters for large organizations?

**Architecture:**
6. Design the complete CI/CD pipeline for a payment service that must comply with PCI-DSS. Include: CI stages, secret management, deployment strategy, rollback procedure, and audit requirements.
7. A team's CI pipeline takes 45 minutes. Engineers skip tests locally and push directly to get CI results. How would you redesign the pipeline to bring it under 10 minutes?
8. Your staging environment is showing a bug that doesn't reproduce in production. But your canary is at 5% and showing clean metrics. How do you decide whether to advance the canary or roll back?

**Quantitative:**
9. Your canary analysis window is 5 minutes, step weight is 10%, and you start at 5%. How many minutes does it take to reach 100% if all checks pass? How many users experience the canary version when it's at 30% with 10,000 RPS?
10. Your CI pipeline costs $0.008/minute on GitHub-hosted runners. Current pipeline: 45 minutes per run. 50 runs per day. Monthly cost? If you reduce to 12 minutes per run with self-hosted runners at $0.001/minute (same 50 runs/day), what is the monthly savings?

---

## Solutions

### Exercise 9

**Time to 100%:**
- Start: 5%
- Steps: 5% → 15% → 25% → 35% → 45% → 55% → 65% → 75% → 85% → 95% → 100%
- That's 10 increment steps × 5 minutes each = **50 minutes minimum** to reach 100%
  (5 minute analysis window per step × 10 steps from 5% to 100%)

**Users at 30% canary, 10,000 RPS:**
- 10,000 × 0.30 = **3,000 RPS hitting v2** (the canary version)
- 7,000 RPS → v1

### Exercise 10

**Current cost:**
- 45 min × $0.008/min × 50 runs/day × 30 days = **$540/month**

**Optimized cost:**
- 12 min × $0.001/min × 50 runs/day × 30 days = **$18/month**

**Monthly savings: $522** (97% cost reduction)

The ROI of pipeline optimization compounds: faster pipelines also mean developers spend less time waiting, increasing effective engineering hours.

---

## Interview Questions

### Beginner
- What is the difference between CI and CD?
- What does it mean for a Docker image to be immutable? Why is `latest` a bad tag for production?
- What is a readiness probe? How does it relate to deployment safety?

### Senior
- Explain the GitOps model. How is it different from pushing deployments from CI?
- Walk through a canary deployment. What metrics determine whether to advance or roll back?
- What is a feature flag? When should you use it instead of a canary deployment?
- Why should you build a Docker image once and promote it across environments, rather than rebuilding per environment?

### Staff
- Design the CI/CD pipeline for a Kubernetes-native platform: 30 microservices, 200 engineers. Address: build speed, secret management, deployment strategy, and rollback.
- A bad deployment reached 50% canary before the automated rollback fired. What does this tell you about your deploy gate configuration? How do you improve it?
- Explain SLSA provenance and cosign image signing. How do they defend against supply chain attacks?

### Principal
- Your organization deploys once per sprint (every 2 weeks). Leadership wants to move to daily deployments. What is the technical roadmap? What are the organizational blockers?
- Design a global deployment system for a financial platform: 100 microservices, 5 regions, PCI-DSS compliance, zero-downtime during regional failover. Address: pipeline, deployment strategy, audit trail, and rollback.
- A Principal Engineer argues that canary deployments are unnecessary because "staging tests everything." Write the counter-argument with specific failure modes that canary catches that staging misses.

---

## Summary

A CI/CD pipeline is a trust-building machine — each stage adds evidence that an artifact is safe to deploy:

- **CI pipeline stages:** Lint → Unit Test (coverage gate) → Integration Test (with real dependencies) → Security Scan (SAST, dependency scan) → Build (multi-stage Dockerfile, immutable SHA tag) → Container Scan → Sign (cosign) + SBOM.
- **GitOps:** Git is the source of truth for production. ArgoCD pulls from git and reconciles the cluster. Audit = git log. Rollback = git revert. CI cannot directly kubectl-apply to production.
- **Deployment strategies:** Blue-Green (instant switch, 2× infra), Canary (gradual, metrics-gated, Flagger automates), Feature Flag (instant rollback, per-user control, code complexity cost).
- **Supply chain security:** Signed images (cosign + Rekor), SBOM (vulnerability tracking), admission policy (Kyverno: unsigned images rejected), SLSA provenance.
- **Rollback:** Automated (Flagger metrics gate) < 60 seconds. Manual (git revert + ArgoCD) ~3 minutes. Emergency (kubectl rollout undo) ~90 seconds — creates drift, must be reconciled.
- **DORA metrics:** Deployment frequency, lead time, change failure rate, MTTR — the four metrics that measure CI/CD maturity. Elite: multiple deploys/day, lead time < 1 hour, MTTR < 1 hour.

---

## What You Should Now Be Able To Explain

- ✅ Why immutable image tags (git SHA) are required for reproducible deployments and rollback
- ✅ The exact GitOps pull model and why it's more secure than pushing from CI
- ✅ The difference between blue-green (instant switch) and canary (gradual, metrics-gated)
- ✅ How cosign keyless signing works (OIDC → Rekor transparency log — no private key management)
- ✅ Why building the image once and promoting it prevents "works in staging, fails in production"
- ✅ The four DORA metrics and what "elite" performance looks like for each

---

## What To Learn Next

**Chapter 18 — Microservice Patterns: Saga, CQRS, and Event Sourcing.** You now know how services are deployed safely. Chapter 18 covers how distributed services maintain data consistency without 2PC (two-phase commit): the Saga pattern for long-running transactions across services, CQRS (Command Query Responsibility Segregation) for separating read and write models to enable independent scaling, and Event Sourcing for rebuilding state from an immutable event log. The chapter where "how do I make a payment that involves order service, inventory service, and notification service — all atomically?" gets a real answer.
