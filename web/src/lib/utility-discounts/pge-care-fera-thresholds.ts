export type PgeCareFeraThreshold = {
  householdSize: number;
  careMax: number;
  feraMin: number;
  feraMax: number;
};

// PG&E CARE/FERA income guidelines valid through May 31, 2026.
// Verify and update these thresholds annually before June 1.
export const PGE_CARE_FERA_THRESHOLDS: PgeCareFeraThreshold[] = [
  { householdSize: 2, careMax: 42300, feraMin: 42301, feraMax: 52875 },
  { householdSize: 3, careMax: 53300, feraMin: 53301, feraMax: 66625 },
  { householdSize: 4, careMax: 64300, feraMin: 64301, feraMax: 80375 },
  { householdSize: 5, careMax: 75300, feraMin: 75301, feraMax: 94125 },
  { householdSize: 6, careMax: 86300, feraMin: 86301, feraMax: 107875 },
  { householdSize: 7, careMax: 97300, feraMin: 97301, feraMax: 121625 },
  { householdSize: 8, careMax: 108300, feraMin: 108301, feraMax: 135375 },
];

export const PGE_CARE_FERA_ADDITIONAL_PERSON = {
  careMax: 11000,
  feraMin: 11000,
  feraMax: 13750,
};
