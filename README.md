# RxVault — Patient-Sovereign Health Data Exchange Platform

> **Core Architectural Principle: IDENTITY ≠ AUTHORIZATION ≠ ACCESS**
>
> Knowing a patient's share code does **NOT** grant data access.  
> Being an authenticated healthcare organization does **NOT** grant access to all patients.  
> Having an authorization does **NOT** grant access outside its approved scope.  
>
> **Final Access** = Authenticated Organization + Valid Patient Authorization + Valid RSA Signature + Correct Scope + Not Expired + Not Revoked

---

## Architecture & Features

### 1. Cryptographic Zero-Trust Foundation
- **Client & Server RSA-2048 Keypairs**: Generated deterministically for every patient upon registration.
- **AES-256-CBC Sovereign Key Encryption**: The patient's private key is encrypted at rest using `SHA-256(PIN)`. The plaintext private key is **never** persisted in the database.
- **RSA-PSS Digital Signatures**: Every prescription and access authorization is cryptographically signed using RSA-PSS padding.
- **Blockchain-Style Hash Chain**: Every prescription block references its predecessor:
  $$\text{chain\_hash} = \text{SHA-256}(\text{prev\_hash} + \text{canonical\_content\_hash} + \text{signature})$$
- **Tamper-Evident Audit Ledger**: Every transaction is chained from a Genesis block. Any database manipulation breaks the hash chain and is flagged immediately.

### 2. AI Drug Interaction Engine with Triple-Key Failover
- **OpenRouter Mistral AI (`mistralai/mistral-7b-instruct`)**: Evaluates drug-drug interactions and patient clinical allergy conflicts in real time.
- **Automatic Multi-Key Failover & Load Balancing**: Sequentially rotates across 3 OpenRouter API keys to prevent 429 rate limits and manage load gracefully.
- **Clinical Pharmacology Safety Net**: If all external APIs are unreachable, a deterministic clinical fallback engine ensures critical warnings (such as Penicillin $\leftrightarrow$ Amoxicillin cross-reactivity and Warfarin $\leftrightarrow$ Aspirin bleeding risks) are never missed.

### 3. Healthcare Fraud & Anomaly Detection
Four synchronous fraud rules run in real time:
1. `MULTI_ORG_ATTEMPT`: Triggered when $\ge 3$ distinct organizations request data for the same patient within 60 minutes (prescription shopping).
2. `DUPLICATE_REQUEST`: Triggered when the same organization requests access to the same patient within 10 minutes.
3. `EXPIRED_PRESCRIPTION`: Automatically blocks requests targeting expired prescriptions.
4. `UNVERIFIED_ORG`: Flags requests originating from organizations pending administrator verification.

### 4. Enterprise Minimalist UI (Inter Typography & Crisp Architecture)
- Typography: Inter Bold (700) for primary headings and metric counters, Inter Medium (500) for navigation, card headings, and buttons, Inter Regular (400) for subtitles.
- High-contrast enterprise design: White cards (`#FFFFFF`) with crisp black borders (`border border-black`), zero emojis (React Icons `ri` only), and no QR codes.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Remix Icons (`react-icons/ri`), Axios |
| **Backend** | Node.js, Express, Native `node:crypto`, JSON Web Tokens, bcryptjs |
| **Database** | Neon Cloud PostgreSQL (Serverless pooling with SSL) + Embedded PGlite fallback |
| **AI / LLM** | OpenRouter API (`mistralai/mistral-7b-instruct`) with multi-key rotation |

---

## Getting Started

### 1. Prerequisites
- Node.js $\ge 18.0.0$
- npm or yarn

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Neon DB connection string and OpenRouter API keys
npm start
```
The backend server will run on `http://localhost:3001`. On first start, all PostgreSQL tables (`users`, `health_vault`, `prescriptions`, `medical_documents`, `access_requests`, `audit_log`, `fraud_flags`) and default demo accounts are seeded automatically.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend dev server will launch at `http://localhost:5173` with proxy routing to `http://localhost:3001`.

---

## Demo Credentials

| Role | Email | Password | PIN | Sovereign Share Code |
|---|---|---|---|---|
| **Patient** (Rahul Sharma) | `rahul@patient.com` | `Patient@123` | `1234` | `A1B2C3` |
| **Hospital** (CityCare Hospital) | `citycare@hospital.com` | `Hospital@123` | `1234` | — *(Unverified Org)* |
| **Pharmacy** (Metro Pharmacy) | `metro@pharmacy.com` | `Pharmacy@123` | `1234` | — *(Verified Org)* |
| **System Admin** | `admin@rxvault.com` | `Admin@123` | `1234` | — |

---

## 15-Step Live Demonstration Script

1. **Patient Login**: Log in as Rahul Sharma (`rahul@patient.com`). View the unique sovereign share code `A1B2C3`.
2. **Health Vault**: Inspect basic medical profile (Blood group O+, emergency contacts) and pre-seeded Penicillin allergy.
3. **Prescription Ledger**: Click `+ Add Prescription`. Enter `Amoxicillin 500mg`, prescribing doctor, and PIN `1234`.
4. **AI Clinical Conflict**: AI engine detects beta-lactam cross-reactivity with the recorded Penicillin allergy and displays an amber warning banner.
5. **Cryptographic Verification**: Click `Verify Integrity` on the prescription card to inspect the Canonical Content Hash, RSA-PSS signature, and hash chain continuity.
6. **Upload Document**: Upload a lab report PDF with SHA-256 integrity hashing.
7. **Hospital Portal**: Log in as CityCare Hospital (`citycare@hospital.com`). Note the `UNVERIFIED_ORG` banner.
8. **Admin Verification**: Switch to System Admin (`admin@rxvault.com`) and verify CityCare Hospital in the Organizations tab.
9. **Patient Discovery**: CityCare enters `A1B2C3` in "Find Patient". Rahul's identity is resolved (metadata only, zero medical data exposed).
10. **Scoped Request**: CityCare requests access to *Allergies* and *Current Medications* for 24 hours.
11. **Sovereign Approval**: Rahul receives the pending access request, clicks Approve, and enters PIN `1234`.
12. **6-Step Cryptographic Popup**: Centerpiece animation visualizes RSA key decryption, grant construction, canonical hashing, digital signing, and ledger recording live.
13. **Strict Scope View**: CityCare clicks `View Data` and observes *only* the approved allergies and medications—no documents, diagnoses, or unapproved records.
14. **Fraud Flagging**: Simulate multiple pharmacy requests within an hour to trigger the `MULTI_ORG_ATTEMPT` rule.
15. **Immediate Revocation & Audit**: Rahul clicks `Revoke` on CityCare's grant; CityCare is immediately blocked. Audit Trail recalculates the SHA-256 hash chain and confirms 100% data integrity.
