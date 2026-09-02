import bcrypt from 'bcryptjs';
import { query } from './db.js';
import { generateRSAKeyPair, encryptPrivateKey, hashContent, buildChainHash } from './crypto.js';
import { logAuditEvent } from './auditLog.js';

export async function initDatabase() {
  console.log('Initializing RxVault database tables...');

  // Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('patient','org','admin')),
      org_type TEXT,
      org_verified BOOLEAN DEFAULT false,
      share_code TEXT UNIQUE,
      public_key TEXT,
      private_key_enc TEXT,
      pin_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Create health_vault table
  await query(`
    CREATE TABLE IF NOT EXISTS health_vault (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
      blood_group TEXT,
      date_of_birth DATE,
      gender TEXT,
      height_cm NUMERIC,
      weight_kg NUMERIC,
      emergency_contact TEXT,
      emergency_phone TEXT,
      allergies JSONB DEFAULT '[]',
      chronic_conditions JSONB DEFAULT '[]',
      current_medications JSONB DEFAULT '[]',
      immunizations JSONB DEFAULT '[]',
      surgeries JSONB DEFAULT '[]',
      family_history JSONB DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Create prescriptions table
  await query(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
      drug_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration TEXT,
      doctor_name TEXT NOT NULL,
      doctor_reg TEXT,
      diagnosis TEXT,
      notes TEXT,
      issued_date DATE NOT NULL,
      expiry_date DATE,
      content_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      prev_hash TEXT DEFAULT '0',
      chain_hash TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      ai_warnings JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Create medical_documents table
  await query(`
    CREATE TABLE IF NOT EXISTS medical_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      file_data TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ DEFAULT now(),
      is_deleted BOOLEAN DEFAULT false
    );
  `);

  // Create access_requests table
  await query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES users(id),
      patient_id UUID REFERENCES users(id),
      share_code TEXT NOT NULL,
      data_categories TEXT[],
      specific_prescription_id UUID REFERENCES prescriptions(id) NULL,
      specific_document_ids UUID[],
      purpose TEXT NOT NULL,
      purpose_notes TEXT,
      duration_hours INTEGER NOT NULL DEFAULT 24,
      status TEXT DEFAULT 'pending',
      authorization_payload JSONB,
      authorization_signature TEXT,
      scoped_data JSONB,
      approved_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      revoke_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Create audit_log table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID REFERENCES users(id),
      actor_role TEXT,
      action TEXT NOT NULL,
      target_id UUID,
      target_type TEXT,
      metadata JSONB,
      prev_hash TEXT,
      event_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Create fraud_flags table
  await query(`
    CREATE TABLE IF NOT EXISTS fraud_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID REFERENCES access_requests(id),
      prescription_id UUID REFERENCES prescriptions(id),
      rule_triggered TEXT NOT NULL,
      severity TEXT DEFAULT 'high',
      org_ids TEXT[],
      details JSONB,
      flagged_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  console.log('Database tables verified successfully.');

  // Seed default admin and demo accounts if empty
  await seedInitialData();
}

async function seedInitialData() {
  const adminCheck = await query("SELECT id FROM users WHERE email = 'admin@rxvault.com'");
  if (adminCheck.rows.length === 0) {
    console.log('Seeding default Admin and Demo accounts...');

    // 1. Admin Account
    const adminPass = await bcrypt.hash('Admin@123', 10);
    const adminPin = await bcrypt.hash('1234', 10);
    const adminUser = await query(
      `INSERT INTO users (name, email, password_hash, role, pin_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['RxVault System Admin', 'admin@rxvault.com', adminPass, 'admin', adminPin]
    );

    await logAuditEvent({
      actorId: adminUser.rows[0].id,
      actorRole: 'admin',
      action: 'system_initialized',
      metadata: { note: 'Platform Genesis Init' }
    });

    // 2. Demo Patient "Rahul Sharma" (matches demo script)
    const rahulPass = await bcrypt.hash('Patient@123', 10);
    const rahulPin = await bcrypt.hash('1234', 10);
    const { publicKey, privateKey } = generateRSAKeyPair();
    const encPrivateKey = encryptPrivateKey(privateKey, '1234');

    const rahulUser = await query(
      `INSERT INTO users (name, email, password_hash, role, share_code, public_key, private_key_enc, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        'Rahul Sharma',
        'rahul@patient.com',
        rahulPass,
        'patient',
        'A1B2C3',
        publicKey,
        encPrivateKey,
        rahulPin
      ]
    );
    const rahulId = rahulUser.rows[0].id;

    // Seed Rahul's Health Vault with Penicillin allergy & basic info
    await query(
      `INSERT INTO health_vault 
       (patient_id, blood_group, date_of_birth, gender, height_cm, weight_kg, emergency_contact, emergency_phone, allergies, chronic_conditions, current_medications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        rahulId,
        'O+',
        '1992-05-14',
        'Male',
        178,
        74,
        'Priya Sharma (Spouse)',
        '+1-555-0199',
        JSON.stringify([
          {
            name: 'Penicillin',
            severity: 'high',
            reaction: 'Severe anaphylaxis and hives',
            added_at: new Date().toISOString()
          }
        ]),
        JSON.stringify([
          {
            name: 'Mild Asthma',
            since: '2015',
            notes: 'Managed with occasional inhaler'
          }
        ]),
        JSON.stringify([
          {
            name: 'Cetirizine 10mg',
            dosage: '10mg',
            frequency: 'Once daily as needed',
            prescribed_by: 'Dr. John Smith'
          }
        ])
      ]
    );

    await logAuditEvent({
      actorId: rahulId,
      actorRole: 'patient',
      action: 'patient_registered',
      targetId: rahulId,
      targetType: 'user',
      metadata: { share_code: 'A1B2C3', name: 'Rahul Sharma' }
    });

    // 3. Demo Hospital "CityCare Hospital" (unverified initially per demo script)
    const cityPass = await bcrypt.hash('Hospital@123', 10);
    const cityPin = await bcrypt.hash('1234', 10);
    const cityUser = await query(
      `INSERT INTO users (name, email, password_hash, role, org_type, org_verified, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'CityCare Hospital',
        'citycare@hospital.com',
        cityPass,
        'org',
        'hospital',
        false, // unverified initially
        cityPin
      ]
    );

    await logAuditEvent({
      actorId: cityUser.rows[0].id,
      actorRole: 'org',
      action: 'org_registered',
      targetId: cityUser.rows[0].id,
      targetType: 'user',
      metadata: { org_type: 'hospital', verified: false }
    });

    // 4. Demo Pharmacy "Metro Pharmacy" (verified org for testing)
    const metroPass = await bcrypt.hash('Pharmacy@123', 10);
    const metroPin = await bcrypt.hash('1234', 10);
    const metroUser = await query(
      `INSERT INTO users (name, email, password_hash, role, org_type, org_verified, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'Metro Pharmacy',
        'metro@pharmacy.com',
        metroPass,
        'org',
        'pharmacy',
        true,
        metroPin
      ]
    );

    await logAuditEvent({
      actorId: metroUser.rows[0].id,
      actorRole: 'org',
      action: 'org_registered',
      targetId: metroUser.rows[0].id,
      targetType: 'user',
      metadata: { org_type: 'pharmacy', verified: true }
    });

    console.log('Seed data successfully initialized.');
  }
}
