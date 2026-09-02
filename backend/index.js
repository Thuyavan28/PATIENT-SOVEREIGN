import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './lib/initDb.js';
import { query } from './lib/db.js';
import { verifyToken } from './middleware/auth.js';

// Route imports
import authRoutes from './routes/auth.js';
import patientsRoutes from './routes/patients.js';
import vaultRoutes from './routes/vault.js';
import prescriptionsRoutes from './routes/prescriptions.js';
import documentsRoutes from './routes/documents.js';
import accessRequestsRoutes from './routes/accessRequests.js';
import aiRoutes from './routes/ai.js';
import auditRoutes from './routes/audit.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing with 50mb limit for base64 medical documents and PDFs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'RxVault Backend', timestamp: new Date().toISOString() });
});

// Manual / Boot DB Init endpoint as requested in specification
app.get('/api/init', async (req, res) => {
  try {
    await initDatabase();
    res.json({
      success: true,
      message: 'RxVault database tables verified, created, and seeded successfully.'
    });
  } catch (err) {
    console.error('API init error:', err);
    res.status(500).json({ error: 'Database init failed', message: err.message });
  }
});

// Patient Data Export endpoint (for Patient Profile tab danger zone)
app.get('/api/patient/export-data', verifyToken(['patient']), async (req, res) => {
  try {
    const userRes = await query('SELECT id, name, email, share_code, created_at FROM users WHERE id = $1', [req.user.id]);
    const vaultRes = await query('SELECT * FROM health_vault WHERE patient_id = $1', [req.user.id]);
    const rxRes = await query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [req.user.id]);
    const docRes = await query('SELECT id, document_type, title, description, file_name, file_size, mime_type, content_hash, uploaded_at FROM medical_documents WHERE patient_id = $1 AND is_deleted = false', [req.user.id]);
    const authRes = await query('SELECT * FROM access_requests WHERE patient_id = $1 ORDER BY created_at DESC', [req.user.id]);
    const auditRes = await query('SELECT * FROM audit_log WHERE actor_id = $1 OR target_id = $1 ORDER BY created_at DESC', [req.user.id]);

    const fullExport = {
      export_timestamp: new Date().toISOString(),
      user: userRes.rows[0],
      health_vault: vaultRes.rows[0] || {},
      prescriptions: rxRes.rows,
      medical_documents: docRes.rows,
      access_authorizations: authRes.rows,
      audit_events: auditRes.rows
    };

    res.setHeader('Content-Disposition', `attachment; filename=rxvault_export_${req.user.share_code}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(fullExport);
  } catch (err) {
    console.error('Export data error:', err);
    res.status(500).json({ error: 'Failed to export data', message: err.message });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/access-requests', accessRequestsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'internal_server_error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Auto-initialize DB on boot and start server
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(` RxVault Backend running on port ${PORT}`);
      console.log(` Ready for Hackathon Live Demo!`);
      console.log(`===========================================`);
    });
  } catch (err) {
    console.error('Failed to initialize database on startup:', err);
    process.exit(1);
  }
}

startServer();
