/**
 * Clinical Pharmacist AI Drug Check Engine
 * Interfaces with OpenRouter (mistralai/mistral-7b-instruct)
 * Includes deterministic clinical fallback interaction and allergy matrix
 */

// Fallback knowledge base for drug-drug interactions
const DRUG_INTERACTION_RULES = [
  {
    drugs: ['warfarin', 'aspirin'],
    severity: 'high',
    reason: 'Concurrent use markedly elevates hemorrhage and gastrointestinal bleeding risk.'
  },
  {
    drugs: ['warfarin', 'ibuprofen'],
    severity: 'high',
    reason: 'NSAIDs displace warfarin from protein binding and cause platelet inhibition, leading to severe bleeding risk.'
  },
  {
    drugs: ['ssri', 'maoi'],
    severity: 'high',
    reason: 'Combined serotonergic activity can cause life-threatening Serotonin Syndrome.'
  },
  {
    drugs: ['fluoxetine', 'phenelzine'],
    severity: 'high',
    reason: 'SSRI + MAOI combination triggers severe Serotonin Syndrome.'
  },
  {
    drugs: ['lithium', 'nsaid'],
    severity: 'high',
    reason: 'NSAIDs decrease renal lithium clearance, inducing severe lithium toxicity.'
  },
  {
    drugs: ['lithium', 'ibuprofen'],
    severity: 'high',
    reason: 'Ibuprofen reduces renal excretion of lithium, causing toxic plasma lithium concentrations.'
  },
  {
    drugs: ['digoxin', 'amiodarone'],
    severity: 'high',
    reason: 'Amiodarone substantially increases serum digoxin concentration, provoking fatal cardiac arrhythmias.'
  },
  {
    drugs: ['metformin', 'alcohol'],
    severity: 'medium',
    reason: 'Alcohol potentiates metformin effect on lactate metabolism, increasing risk of lactic acidosis.'
  },
  {
    drugs: ['ace inhibitor', 'potassium'],
    severity: 'medium',
    reason: 'ACE inhibitors decrease aldosterone production, risking dangerous hyperkalemia.'
  },
  {
    drugs: ['lisinopril', 'potassium'],
    severity: 'medium',
    reason: 'Concurrent potassium supplementation with Lisinopril leads to severe hyperkalemia.'
  },
  {
    drugs: ['statin', 'amiodarone'],
    severity: 'medium',
    reason: 'Inhibition of CYP3A4 metabolism increases statin exposure, provoking rhabdomyolysis and myopathy.'
  },
  {
    drugs: ['atorvastatin', 'amiodarone'],
    severity: 'medium',
    reason: 'Marked increase in statin plasma levels with risk of acute skeletal muscle breakdown.'
  },
  {
    drugs: ['clopidogrel', 'ppi'],
    severity: 'medium',
    reason: 'Proton pump inhibitors (e.g. omeprazole) inhibit CYP2C19, decreasing active clopidogrel and antiplatelet efficacy.'
  },
  {
    drugs: ['clopidogrel', 'omeprazole'],
    severity: 'medium',
    reason: 'Omeprazole reduces clopidogrel antiplatelet activation, raising ischemic event risk.'
  },
  {
    drugs: ['ciprofloxacin', 'antacid'],
    severity: 'low',
    reason: 'Divalent cations in antacids chelate fluoroquinolones, substantially reducing antibiotic absorption.'
  }
];

// Fallback knowledge base for drug-allergy cross-sensitivities
const ALLERGY_RULES = [
  {
    allergyKeywords: ['penicillin', 'amoxicillin', 'ampicillin', 'beta-lactam'],
    drugKeywords: ['amoxicillin', 'ampicillin', 'penicillin', 'augmentin', 'piperacillin', 'ticarcillin'],
    severity: 'high',
    reason: 'Severe hypersensitivity conflict: Cross-reactivity between beta-lactam penicillins can trigger anaphylaxis, angioedema, or severe cutaneous reactions.'
  },
  {
    allergyKeywords: ['sulfa', 'sulfonamide'],
    drugKeywords: ['bactrim', 'septra', 'sulfamethoxazole', 'sulfasalazine', 'celecoxib'],
    severity: 'high',
    reason: 'Potential cross-reactive sulfonamide hypersensitivity reaction (rash, Stevens-Johnson syndrome).'
  },
  {
    allergyKeywords: ['aspirin', 'nsaid'],
    drugKeywords: ['aspirin', 'ibuprofen', 'naproxen', 'ketorolac', 'diclofenac'],
    severity: 'high',
    reason: 'Cross-reactive cyclooxygenase-1 inhibition can cause bronchospasm and severe anaphylactoid shock in NSAID-sensitive patients.'
  },
  {
    allergyKeywords: ['codeine', 'morphine', 'opioid'],
    drugKeywords: ['codeine', 'morphine', 'oxycodone', 'hydrocodone', 'tramadol'],
    severity: 'high',
    reason: 'Opioid hypersensitivity or pseudoallergy causing severe histamine release and respiratory distress.'
  }
];

/**
 * Deterministic local clinical check
 */
export function checkInteractionsFallback(drugs = [], allergies = []) {
  const normDrugs = drugs.map(d => String(d).toLowerCase().trim()).filter(Boolean);
  const normAllergies = allergies.map(a => String(a).toLowerCase().trim()).filter(Boolean);

  const interactions = [];
  const allergy_conflicts = [];

  // Check drug-drug interactions
  for (const rule of DRUG_INTERACTION_RULES) {
    const matched = rule.drugs.every(reqDrug =>
      normDrugs.some(userDrug => userDrug.includes(reqDrug) || reqDrug.includes(userDrug))
    );

    if (matched) {
      interactions.push({
        drugs: rule.drugs,
        severity: rule.severity,
        reason: rule.reason
      });
    }
  }

  // Check drug-allergy conflicts
  for (const drug of normDrugs) {
    for (const allergy of normAllergies) {
      for (const rule of ALLERGY_RULES) {
        const matchesAllergy = rule.allergyKeywords.some(kw => allergy.includes(kw));
        const matchesDrug = rule.drugKeywords.some(kw => drug.includes(kw));

        if (matchesAllergy && matchesDrug) {
          allergy_conflicts.push({
            drug,
            allergy,
            severity: rule.severity,
            reason: rule.reason
          });
        }
      }
    }
  }

  const hasHighOrMedium =
    interactions.some(i => i.severity === 'high' || i.severity === 'medium') ||
    allergy_conflicts.length > 0;

  return {
    interactions,
    allergy_conflicts,
    safe: !hasHighOrMedium
  };
}

let currentKeyIndex = 0;

/**
 * Primary AI drug check calling OpenRouter API with mistralai/mistral-7b-instruct
 * Rotates across multiple API keys on 429 / failure, and falls back to deterministic clinical rules
 */
export async function analyzeDrugSafety(drugs = [], allergies = []) {
  const keys = [
    process.env.OPENROUTER_API_KEY_1,
    process.env.OPENROUTER_API_KEY_2,
    process.env.OPENROUTER_API_KEY_3,
    process.env.OPENROUTER_API_KEY
  ].map(k => k?.trim()).filter(Boolean);

  // If no API key or empty lists, use local fallback
  if (keys.length === 0 || (drugs.length === 0 && allergies.length === 0)) {
    return checkInteractionsFallback(drugs, allergies);
  }

  const promptUser = `Drugs: ${drugs.join(', ')}. Allergies: ${allergies.join(', ')}.`;

  // Try each API key in failover sequence starting from currentKeyIndex
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIdx = (currentKeyIndex + attempt) % keys.length;
    const apiKey = keys[keyIdx];

    try {
      console.log(`[AI Clinical] Calling OpenRouter with key #${keyIdx + 1}...`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'RxVault'
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct',
          messages: [
            {
              role: 'system',
              content: `You are a clinical pharmacist AI. Analyze drug interactions and allergy conflicts.
Respond ONLY with valid JSON (no markdown):
{
  "interactions": [{"drugs": ["drug1", "drug2"], "severity": "high"|"medium"|"low", "reason": "string"}],
  "allergy_conflicts": [{"drug": "string", "allergy": "string", "reason": "string"}],
  "safe": true|false
}`
            },
            {
              role: 'user',
              content: promptUser
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        console.warn(`[AI Clinical] Key #${keyIdx + 1} returned status ${response.status}. Rotating to next key to manage load & avoid 429...`);
        continue; // Try next key
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        console.warn(`[AI Clinical] Empty response from key #${keyIdx + 1}. Trying next key...`);
        continue;
      }

      // Advance starting key index for round-robin load distribution
      currentKeyIndex = (keyIdx + 1) % keys.length;

      // Clean any accidental markdown code blocks
      const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      // Merge with deterministic allergy safety net (e.g. Penicillin / Amoxicillin)
      const fallbackCheck = checkInteractionsFallback(drugs, allergies);
      const combinedAllergies = [...(parsed.allergy_conflicts || [])];

      for (const fConflict of fallbackCheck.allergy_conflicts) {
        if (!combinedAllergies.some(c => c.drug?.toLowerCase() === fConflict.drug.toLowerCase())) {
          combinedAllergies.push(fConflict);
        }
      }

      const combinedInteractions = [...(parsed.interactions || [])];
      for (const fInt of fallbackCheck.interactions) {
        if (!combinedInteractions.some(i => JSON.stringify(i.drugs.sort()) === JSON.stringify(fInt.drugs.sort()))) {
          combinedInteractions.push(fInt);
        }
      }

      const isSafe =
        (parsed.safe === true || parsed.safe === 'true') &&
        combinedAllergies.length === 0 &&
        !combinedInteractions.some(i => i.severity === 'high');

      return {
        interactions: combinedInteractions,
        allergy_conflicts: combinedAllergies,
        safe: isSafe
      };
    } catch (err) {
      console.warn(`[AI Clinical] Error with key #${keyIdx + 1}: ${err.message}. Rotating...`);
    }
  }

  console.warn('[AI Clinical] All OpenRouter API keys failed or rate limited. Engaging deterministic clinical fallback engine.');
  return checkInteractionsFallback(drugs, allergies);
}

