# OTP MFA Flow Diagram

## Complete MFA Login Sequence

```mermaid
sequenceDiagram
    actor User
    participant Client
    participant API as /api/v1/auth/*
    participant Service as auth.service<br/>otp.service
    participant DB as Database
    participant Email as Email Queue

    User->>Client: Enter email & password
    Client->>API: POST /auth/login
    
    API->>Service: validateLogin(email, password)
    Service->>DB: findUserByEmail()
    DB-->>Service: user {mfaEnabled: true}
    Service-->>API: user data
    
    API->>Service: generateOtp(tenantId, userId, email)
    Service->>DB: createOtpChallenge()
    DB-->>Service: challenge {challengeId, code}
    Service->>Email: enqueueOtpEmail(email, code)
    Email-->>Service: queued
    Service-->>API: {challengeId, destinationMasked, expiresIn}
    
    API-->>Client: 202 Accepted (mfaRequired)
    
    User->>Client: Receive OTP email
    User->>Client: Enter 6-digit code
    
    Client->>API: POST /auth/verify-otp {challengeId, code}
    
    API->>Service: verifyOtp(tenantId, challengeId, code)
    Service->>DB: findOtpChallenge()
    DB-->>Service: challenge data
    
    alt Code Valid
        Service->>DB: updateOtpChallenge(consumedAt: now)
        Service-->>API: {valid: true, userId}
        
        API->>Service: completeMfaLogin(userId)
        Service->>DB: createSession()
        DB-->>Service: session {sessionId, refreshToken}
        Service->>Service: generateAccessToken()
        Service-->>API: {accessToken, refreshToken, user, permissions}
        
        API-->>Client: 200 OK with tokens
        Client->>Client: Store accessToken in memory
        Client->>Client: refreshToken in httpOnly cookie (automatic)
    else Code Invalid
        Service->>Service: Increment attempts counter
        alt Max Attempts Reached
            Service->>DB: updateOtpChallenge(lockedAt: now + 15min)
            Service-->>API: OTP_LOCKED (429)
        else Attempts Remaining
            Service-->>API: OTP_INVALID (400)
        end
        API-->>Client: Error with status code
    end
```

## OTP Resend Flow

```mermaid
sequenceDiagram
    actor User
    participant Client
    participant API as /api/v1/auth/resend-otp
    participant Service as otp.service
    participant DB as Database
    participant Email as Email Queue

    User->>Client: Click "Resend OTP"
    Client->>API: POST /auth/resend-otp {challengeId}
    
    API->>Service: resendOtp(tenantId, challengeId, email)
    Service->>DB: findOtpChallenge()
    DB-->>Service: challenge data
    
    alt Cooldown Active (< 60 sec)
        Service-->>API: OTP_RESEND_COOLDOWN (429)
        API-->>Client: Error: "Wait X seconds"
    else Max Resends Exceeded (> 3)
        Service-->>API: OTP_RESEND_LIMIT_EXCEEDED (429)
        API-->>Client: Error: "Contact support"
    else Resend Allowed
        Service->>Service: Generate new OTP code
        Service->>DB: updateOtpChallenge()
        Service->>Email: enqueueOtpEmail()
        Email-->>Service: queued
        Service-->>API: {destinationMasked, expiresIn}
        
        API-->>Client: 202 Accepted
        Client->>Client: Show "OTP resent"
        User->>Client: Receive new OTP email
    end
```

## State Machine: OTP Challenge Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active: Challenge Created
    
    Active --> Expired: Timeout (10 min)
    Active --> Locked: 5 Failed Attempts
    Active --> Consumed: Valid Code
    
    Expired --> [*]
    Locked --> [*]: 15 min cooldown
    Consumed --> [*]
    
    note right of Active
        - Code attempts: 0-4
        - Resend count: 0-2
        - Cooldown tracking
    end note
    
    note right of Locked
        User can retry after 15 min
        or request password reset
    end note
```

## Login Decision Tree

```mermaid
graph TD
    A["POST /auth/login<br/>email, password"] --> B{User Exists?}
    
    B -->|No| C["401 INVALID_CREDENTIALS"]
    B -->|Yes| D{Password Correct?}
    
    D -->|No| C
    D -->|Yes| E{Account Active?}
    
    E -->|Locked/Disabled| F["401 ACCOUNT_LOCKED/DISABLED"]
    E -->|Active| G{MFA Enabled?}
    
    G -->|No| H["Create Session"]
    G -->|Yes| I["Generate OTP Challenge"]
    
    H --> J["Return Access Token<br/>202 OK"]
    I --> K["Queue OTP Email<br/>202 Accepted<br/>mfaRequired: true"]
    
    C --> L["End: User cannot proceed"]
    F --> L
    J --> M["End: User authenticated"]
    K --> N["User must verify OTP<br/>POST /auth/verify-otp"]
    N --> O{OTP Valid?}
    O -->|Yes| P["POST /auth/verify-otp<br/>challengeId, code"]
    P --> H
    O -->|No| Q["Update attempts<br/>Return 400 or 429"]
    Q --> N
```

## Key Security Properties

1. **Raw tokens never stored**: Only SHA256 hashes in database
2. **Single-use**: OTP consumed immediately after verification
3. **Time-bounded**: 10-minute expiry on challenge
4. **Rate-limited**: 5 failed attempts → 15-minute lockout
5. **Cooldown protected**: 60 seconds between resends, max 3 resends
6. **No enumeration**: Forgot password always returns 202
7. **Session isolation**: Each MFA verification creates new session/token family
8. **Audit trail**: All OTP events logged for security monitoring
