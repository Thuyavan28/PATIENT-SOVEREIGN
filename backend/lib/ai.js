/**
 * Clinical Pharmacist AI — Full Scoped-Data Safety Analysis Engine
 * Sends complete structured scoped data (prescriptions with dosage, meds, allergies, diagnoses)
 * to OpenRouter and returns structured risk assessment with numeric risk score.
 *
 * PRIVACY: AI ONLY sees what is in scoped_data — never full patient PII.
 */

// ──────────────────────────────────────────────────
// Deterministic fallback knowledge base
// ──────────────────────────────────────────────────

const DRUG_INTERACTION_RULES = [
  { drugs: ['warfarin', 'aspirin'],      severity: 'high',   reason: 'Concurrent use markedly elevates hemorrhage and gastrointestinal bleeding risk.' },
  { drugs: ['warfarin', 'ibuprofen'],    severity: 'high',   reason: 'NSAIDs displace warfarin from protein binding, causing severe bleeding risk.' },
  { drugs: ['ssri', 'maoi'],            severity: 'high',   reason: 'Combined serotonergic activity can cause life-threatening Serotonin Syndrome.' },
  { drugs: ['fluoxetine', 'phenelzine'], severity: 'high',   reason: 'SSRI + MAOI combination triggers severe Serotonin Syndrome.' },
  { drugs: ['lithium', 'nsaid'],         severity: 'high',   reason: 'NSAIDs decrease renal lithium clearance, inducing severe lithium toxicity.' },
  { drugs: ['lithium', 'ibuprofen'],     severity: 'high',   reason: 'Ibuprofen reduces renal excretion of lithium, causing toxic plasma lithium concentrations.' },
  { drugs: ['digoxin', 'amiodarone'],    severity: 'high',   reason: 'Amiodarone substantially increases serum digoxin concentration, causing fatal arrhythmias.' },
  { drugs: ['metformin', 'alcohol'],     severity: 'medium', reason: 'Alcohol potentiates metformin effect on lactate metabolism, risk of lactic acidosis.' },
  { drugs: ['lisinopril', 'potassium'],  severity: 'medium', reason: 'ACE inhibitors + potassium leads to severe hyperkalemia.' },
  { drugs: ['atorvastatin', 'amiodarone'], severity: 'medium', reason: 'CYP3A4 inhibition increases statin exposure, causing rhabdomyolysis.' },
  { drugs: ['clopidogrel', 'omeprazole'], severity: 'medium', reason: 'Omeprazole reduces clopidogrel activation, raising ischemic event risk.' },
  { drugs: ['ciprofloxacin', 'antacid'], severity: 'low',    reason: 'Divalent cations chelate fluoroquinolones, substantially reducing antibiotic absorption.' }
];

// Known toxic dose thresholds (mg/dose, approximate upper limits)
const TOXIC_DOSE_THRESHOLDS = {
  warfarin:     { max: 15,   unit: 'mg', reason: 'Warfarin max therapeutic dose is ~10mg/day. Doses ≥15mg are potentially lethal (fatal hemorrhage).' },
  metformin:    { max: 3000, unit: 'mg', reason: 'Metformin >3000mg/day risks lactic acidosis.' },
  paracetamol:  { max: 4000, unit: 'mg', reason: 'Paracetamol >4g/day causes hepatotoxicity.' },
  acetaminophen:{ max: 4000, unit: 'mg', reason: 'Acetaminophen >4g/day causes liver failure.' },
  aspirin:      { max: 4000, unit: 'mg', reason: 'Aspirin >4g/day risks severe salicylate toxicity.' },
  ibuprofen:    { max: 2400, unit: 'mg', reason: 'Ibuprofen >2400mg/day causes GI bleeding and renal failure.' },
  digoxin:      { max: 0.5,  unit: 'mg', reason: 'Digoxin has a narrow therapeutic window; >0.5mg/day risks fatal arrhythmias.' },
  lithium:      { max: 2400, unit: 'mg', reason: 'Lithium >2400mg/day risks toxicity (tremor, seizures, cardiac arrest).' },
  morphine:     { max: 200,  unit: 'mg', reason: 'Morphine >200mg/day in opioid-naïve patients risks respiratory arrest.' },
};

const ALLERGY_RULES = [
  {
    allergyKeywords: ['penicillin', 'amoxicillin', 'ampicillin', 'beta-lactam'],
    drugKeywords: ['amoxicillin', 'ampicillin', 'penicillin', 'augmentin', 'piperacillin', 'ticarcillin'],
    severity: 'high',
    reason: 'Cross-reactivity between beta-lactam penicillins can trigger anaphylaxis.'
  },
  {
    allergyKeywords: ['sulfa', 'sulfonamide'],
    drugKeywords: ['bactrim', 'septra', 'sulfamethoxazole', 'sulfasalazine', 'celecoxib'],
    severity: 'high',
    reason: 'Cross-reactive sulfonamide hypersensitivity (rash, Stevens-Johnson syndrome).'
  },
  {
    allergyKeywords: ['aspirin', 'nsaid'],
    drugKeywords: ['aspirin', 'ibuprofen', 'naproxen', 'ketorolac', 'diclofenac'],
    severity: 'high',
    reason: 'Cross-reactive COX-1 inhibition can cause bronchospasm and anaphylactoid shock.'
  },
  {
    allergyKeywords: ['codeine', 'morphine', 'opioid'],
    drugKeywords: ['codeine', 'morphine', 'oxycodone', 'hydrocodone', 'tramadol'],
    severity: 'high',
    reason: 'Opioid hypersensitivity causing severe histamine release and respiratory distress.'
  }
];

// ──────────────────────────────────────────────────
// Deterministic dose toxicity check
// ──────────────────────────────────────────────────
function checkDoseToxicity(prescriptions = []) {
  const toxic = [];
  for (const rx of prescriptions) {
    if (!rx.drug_name || !rx.dosage) continue;
    const drugLower = rx.drug_name.toLowerCase().trim();
    const dosageStr = String(rx.dosage);
    const doseNum = parseFloat(dosageStr.replace(/[^0-9.]/g, ''));
    if (isNaN(doseNum)) continue;

    for (const [key, threshold] of Object.entries(TOXIC_DOSE_THRESHOLDS)) {
      if (drugLower.includes(key) || key.includes(drugLower)) {
        if (doseNum >= threshold.max) {
          toxic.push({
            drug: rx.drug_name,
            prescribed_dose: dosageStr,
            max_safe_dose: `${threshold.max}${threshold.unit}`,
            severity: 'critical',
            reason: threshold.reason
          });
        }
      }
    }
  }
  return toxic;
}

// ──────────────────────────────────────────────────
// Deterministic interaction + allergy check
// ──────────────────────────────────────────────────
export function checkInteractionsFallback(drugs = [], allergies = []) {
  const normDrugs = drugs.map(d => String(d).toLowerCase().trim()).filter(Boolean);
  const normAllergies = allergies.map(a => String(a).toLowerCase().trim()).filter(Boolean);

  const interactions = [];
  const allergy_conflicts = [];

  for (const rule of DRUG_INTERACTION_RULES) {
    const matched = rule.drugs.every(reqDrug =>
      normDrugs.some(userDrug => userDrug.includes(reqDrug) || reqDrug.includes(userDrug))
    );
    if (matched) interactions.push({ drugs: rule.drugs, severity: rule.severity, reason: rule.reason });
  }

  for (const drug of normDrugs) {
    for (const allergy of normAllergies) {
      for (const rule of ALLERGY_RULES) {
        const matchesAllergy = rule.allergyKeywords.some(kw => allergy.includes(kw));
        const matchesDrug = rule.drugKeywords.some(kw => drug.includes(kw));
        if (matchesAllergy && matchesDrug) {
          allergy_conflicts.push({ drug, allergy, severity: rule.severity, reason: rule.reason });
        }
      }
    }
  }

  const hasHighOrMedium =
    interactions.some(i => i.severity === 'high' || i.severity === 'medium') ||
    allergy_conflicts.length > 0;

  return { interactions, allergy_conflicts, safe: !hasHighOrMedium };
}

// ──────────────────────────────────────────────────
// Compute risk score (0–100)
// ──────────────────────────────────────────────────
function computeRiskScore({ interactions = [], allergy_conflicts = [], toxic_doses = [], safe }) {
  let score = 0;
  for (const i of interactions) {
    if (i.severity === 'high')   score += 35;
    else if (i.severity === 'medium') score += 20;
    else score += 8;
  }
  for (const a of allergy_conflicts) {
    score += a.severity === 'high' ? 40 : 25;
  }
  for (const t of toxic_doses) {
    score += 50; // Toxic dose is most critical
  }
  return Math.min(score, 100);
}

// ──────────────────────────────────────────────────
// Main AI analysis — full scoped data context
// ──────────────────────────────────────────────────
let currentKeyIndex = 0;

/**
 * @param {object} scopedData - The exact scoped data object released to the org
 *   { prescriptions, current_medications, allergies, diagnoses, chronic_conditions, ... }
 * Only this scoped data is sent to the AI — no patient PII.
 */
export async function analyzeScopedDataSafety(scopedData = {}) {
  // ── Extract clinical entities from scoped data ──
  const prescriptions = Array.isArray(scopedData.prescriptions) ? scopedData.prescriptions : [];
  const currentMeds   = Array.isArray(scopedData.current_medications) ? scopedData.current_medications : [];
  const allergies     = Array.isArray(scopedData.allergies) ? scopedData.allergies : [];
  const diagnoses     = Array.isArray(scopedData.diagnoses) ? scopedData.diagnoses : [];
  const chronicConds  = Array.isArray(scopedData.chronic_conditions) ? scopedData.chronic_conditions : [];

  // Normalize drug names for fallback
  const drugNames = [
    ...prescriptions.map(rx => rx.drug_name).filter(Boolean),
    ...currentMeds.map(m => (typeof m === 'string' ? m : m.name || m.drug_name || '')).filter(Boolean)
  ];
  const allergyNames = allergies.map(a => (typeof a === 'string' ? a : a.name || a.allergen || '')).filter(Boolean);

  // ── Deterministic dose toxicity check (always runs) ──
  const toxic_doses = checkDoseToxicity(prescriptions);

  // ── Build AI prompt with FULL clinical context ──
  const prescriptionLines = prescriptions.map(rx =>
    `- ${rx.drug_name}: dose=${rx.dosage}, frequency=${rx.frequency || 'N/A'}, duration=${rx.duration || 'N/A'}, diagnosis=${rx.diagnosis || 'N/A'}`
  ).join('\n') || 'None';

  const medLines = currentMeds.map(m =>
    typeof m === 'string' ? `- ${m}` : `- ${m.name || ''} ${m.dosage || ''} ${m.frequency || ''}`
  ).join('\n') || 'None';

  const allergyLines = allergies.map(a =>
    typeof a === 'string' ? `- ${a}` : `- ${a.name || a.allergen || ''} (${a.severity || 'unknown'} severity): ${a.reaction || ''}`
  ).join('\n') || 'None';

  const diagnosisLines = [...diagnoses, ...chronicConds].map(d =>
    typeof d === 'string' ? `- ${d}` : `- ${d.condition || d.name || ''}`
  ).join('\n') || 'None';

  const fullPrompt = `
SCOPED PATIENT CLINICAL DATA (pharmacy access — no PII):
==========================================================
PRESCRIPTIONS (with dosage):
${prescriptionLines}

CURRENT MEDICATIONS:
${medLines}

ALLERGIES:
${allergyLines}

DIAGNOSES / CONDITIONS:
${diagnosisLines}
==========================================================
Perform a comprehensive clinical safety analysis. Pay special attention to:
1. Toxic or lethal dosages (e.g. warfarin 1000mg is immediately life-threatening)
2. Drug-drug interactions (including prescription + current meds)
3. Allergy conflicts with prescribed drugs
4. Drug-condition contraindications
5. Assign a risk_score from 0 (perfectly safe) to 100 (immediately life-threatening)

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "risk_score": <integer 0-100>,
  "risk_level": "safe"|"low"|"moderate"|"high"|"critical",
  "summary": "<one sentence clinical summary>",
  "toxic_doses": [{"drug": "string", "prescribed_dose": "string", "reason": "string", "severity": "critical"}],
  "interactions": [{"drugs": ["drug1","drug2"], "severity": "high"|"medium"|"low", "reason": "string"}],
  "allergy_conflicts": [{"drug": "string", "allergy": "string", "severity": "high"|"medium"|"low", "reason": "string"}],
  "contraindications": [{"drug": "string", "condition": "string", "reason": "string"}],
  "recommendations": ["string"],
  "safe": true|false
}`;

  const keys = [
    process.env.OPENROUTER_API_KEY_1,
    process.env.OPENROUTER_API_KEY_2,
    process.env.OPENROUTER_API_KEY_3,
    process.env.OPENROUTER_API_KEY
  ].map(k => k?.trim()).filter(Boolean);

  if (keys.length > 0 && drugNames.length > 0) {
    const candidateModels = [
      'minimax/minimax-m2.7:free',
      'liquid/lfm-2.5-2.6b:free',
      'nvidia/nemotron-3.5-lightning:free'
    ];

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const keyIdx = (currentKeyIndex + attempt) % keys.length;
      const apiKey = keys[keyIdx];

      for (const modelId of candidateModels) {
        try {
          console.log(`[AI Clinical] Full scoped-data analysis via OpenRouter (${modelId}) key #${keyIdx + 1}...`);
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'RxVault Clinical AI'
            },
            body: JSON.stringify({
              model: modelId,
              messages: [
                {
                  role: 'system',
                  content: 'You are a senior clinical pharmacist AI conducting a medication safety review. Respond ONLY with valid JSON matching the exact schema requested. Be clinically precise about toxic dosages — warfarin 1000mg is lethal (normal max is ~10mg/day).'
                },
                { role: 'user', content: fullPrompt }
              ],
              temperature: 0.05,
              max_tokens: 800
            })
          });

          if (!response.ok) {
            console.warn(`[AI Clinical] Model ${modelId} with key #${keyIdx + 1} returned ${response.status}. Trying next...`);
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (!content) {
            console.warn(`[AI Clinical] Empty response from ${modelId}. Trying next...`);
            continue;
          }

        currentKeyIndex = (keyIdx + 1) % keys.length;

        const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        // Merge deterministic checks as safety net
        const fallback = checkInteractionsFallback(drugNames, allergyNames);

        // Merge interactions
        const mergedInteractions = [...(parsed.interactions || [])];
        for (const fi of fallback.interactions) {
          if (!mergedInteractions.some(i => JSON.stringify(i.drugs?.sort()) === JSON.stringify(fi.drugs.sort()))) {
            mergedInteractions.push(fi);
          }
        }

        // Merge allergy conflicts
        const mergedAllergies = [...(parsed.allergy_conflicts || [])];
        for (const fa of fallback.allergy_conflicts) {
          if (!mergedAllergies.some(c => c.drug?.toLowerCase() === fa.drug.toLowerCase())) {
            mergedAllergies.push(fa);
          }
        }

        // Merge toxic doses (always keep deterministic ones)
        const mergedToxic = [...toxic_doses];
        for (const td of (parsed.toxic_doses || [])) {
          if (!mergedToxic.some(t => t.drug?.toLowerCase() === td.drug?.toLowerCase())) {
            mergedToxic.push(td);
          }
        }

        // Recompute risk score incorporating everything
        const detScore = computeRiskScore({
          interactions: mergedInteractions,
          allergy_conflicts: mergedAllergies,
          toxic_doses: mergedToxic,
          safe: parsed.safe
        });

        const finalScore = Math.max(parsed.risk_score || 0, detScore);
        const isSafe = finalScore < 10 && mergedToxic.length === 0 && mergedAllergies.length === 0 && !mergedInteractions.some(i => i.severity === 'high');

        const riskLevel = finalScore >= 70 ? 'critical'
          : finalScore >= 50 ? 'high'
          : finalScore >= 30 ? 'moderate'
          : finalScore >= 10 ? 'low'
          : 'safe';

        return {
          risk_score: finalScore,
          risk_level: riskLevel,
          summary: parsed.summary || (isSafe ? 'No critical safety concerns detected.' : 'Safety concerns identified — pharmacist review required.'),
          toxic_doses: mergedToxic,
          interactions: mergedInteractions,
          allergy_conflicts: mergedAllergies,
          contraindications: parsed.contraindications || [],
          recommendations: parsed.recommendations || [],
          safe: isSafe
        };
        } catch (err) {
          console.warn(`[AI Clinical] Error with key #${keyIdx + 1}: ${err.message}. Rotating...`);
        }
      }
    }
  }

  // ── Full deterministic fallback ──
  console.warn('[AI Clinical] All OpenRouter keys failed. Using deterministic fallback engine.');
  const fallback = checkInteractionsFallback(drugNames, allergyNames);
  const mergedToxic = [...toxic_doses, ...(fallback.toxic_doses || [])];
  const riskScore = computeRiskScore({
    interactions: fallback.interactions,
    allergy_conflicts: fallback.allergy_conflicts,
    toxic_doses: mergedToxic
  });
  const riskLevel = riskScore >= 70 ? 'critical'
    : riskScore >= 50 ? 'high'
    : riskScore >= 30 ? 'moderate'
    : riskScore >= 10 ? 'low'
    : 'safe';

  return {
    risk_score: riskScore,
    risk_level: riskLevel,
    summary: mergedToxic.length > 0
      ? `CRITICAL: Toxic dosage detected in ${mergedToxic.map(t => t.drug).join(', ')}. Immediate pharmacist intervention required.`
      : fallback.safe ? 'No critical safety concerns detected by deterministic clinical rules.' : 'Safety concerns identified.',
    toxic_doses: mergedToxic,
    interactions: fallback.interactions,
    allergy_conflicts: fallback.allergy_conflicts,
    contraindications: [],
    recommendations: mergedToxic.length > 0
      ? [`STOP dispensing ${mergedToxic.map(t => t.drug).join(', ')} immediately`, 'Contact prescribing physician before dispensing']
      : [],
    safe: fallback.safe && mergedToxic.length === 0
  };
}

// Keep old export for backward compatibility (prescriptions page)
export async function analyzeDrugSafety(drugs = [], allergies = []) {
  return checkInteractionsFallback(drugs, allergies);
}
