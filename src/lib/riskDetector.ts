import type { RiskFlag, ParsedRow, RiskLevel } from '@/types/quote';
import { INCOTERMS_DATA } from './schemas';

/**
 * Scan raw text for Incoterms mentions
 */
export function detectIncoterms(rawText: string): RiskFlag[] {
    const risks: RiskFlag[] = [];
    const upperText = rawText.toUpperCase();

    for (const [term, info] of Object.entries(INCOTERMS_DATA)) {
        // Look for the incoterm followed by optional location
        const regex = new RegExp(`\\b${term}\\s*[\\-–:]?\\s*([A-Za-z\\s,]+)?`, 'gi');
        const matches = upperText.match(regex);

        if (matches) {
            const extractedValue = matches[0];

            risks.push({
                id: `incoterm-${term}-${Date.now()}`,
                type: 'incoterms',
                level: info.riskLevel,
                title: `Incoterm Detected: ${term}`,
                description: info.description,
                extractedValue: extractedValue.trim(),
                recommendation: info.riskLevel === 'critical' || info.riskLevel === 'high'
                    ? `⚠️ Review required. ${term} places significant responsibility on the seller. Ensure pricing includes all associated costs.`
                    : `Standard ${term} terms detected. Verify alignment with your standard commercial terms.`,
            });
        }
    }

    // Also detect "Delivered" or "Duty Paid" phrases that might indicate DDP-like terms
    if (/delivered\s+duty\s+paid/i.test(rawText) && !risks.some(r => r.extractedValue?.includes('DDP'))) {
        risks.push({
            id: `incoterm-ddp-phrase-${Date.now()}`,
            type: 'incoterms',
            level: 'critical',
            title: 'DDP-equivalent Terms Detected',
            description: 'The phrase "Delivered Duty Paid" suggests the seller is responsible for all costs including import duties.',
            extractedValue: 'Delivered Duty Paid',
            recommendation: '🚨 CRITICAL: This implies DDP terms. Verify your quote includes import duties, taxes, and all delivery costs.',
        });
    }

    return risks;
}

/**
 * Scan raw text for Liquidated Damages clauses
 */
export function detectLiquidatedDamages(rawText: string): RiskFlag[] {
    const risks: RiskFlag[] = [];
    const lowerText = rawText.toLowerCase();

    // Patterns that indicate LD clauses
    const ldPatterns = [
        /liquidated\s+damages/i,
        /penalty\s+(for|of)?\s*(late|delay)/i,
        /delay\s+penalty/i,
        /(\d+\.?\d*)\s*%\s*(per|each)\s*(day|week)/i,
        /per\s*diem\s*penalty/i,
        /late\s+delivery\s+(penalty|charge|fee)/i,
    ];

    for (const pattern of ldPatterns) {
        const match = rawText.match(pattern);
        if (match) {
            // Try to extract the percentage if present
            const percentMatch = rawText.match(/(\d+\.?\d*)\s*%\s*(per|each)?\s*(day|week|month)?/i);
            let extractedValue = match[0];
            let level: RiskLevel = 'high';

            if (percentMatch) {
                const percentage = parseFloat(percentMatch[1]);
                extractedValue = percentMatch[0];

                // Higher percentages = higher risk
                if (percentage >= 1) {
                    level = 'critical';
                } else if (percentage >= 0.5) {
                    level = 'high';
                } else {
                    level = 'medium';
                }
            }

            // Try to find cap percentage
            const capMatch = rawText.match(/(?:cap|maximum|max|up\s+to|not\s+(?:to\s+)?exceed)\s*(?:of\s*)?(\d+\.?\d*)\s*%/i);
            let capInfo = '';
            if (capMatch) {
                const cap = parseFloat(capMatch[1]);
                capInfo = ` (Capped at ${cap}%)`;
                if (cap > 10) {
                    level = 'critical';
                }
            }

            risks.push({
                id: `ld-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'liquidated_damages',
                level,
                title: `Liquidated Damages Clause Detected${capInfo}`,
                description: 'This document contains penalty clauses for late delivery. These can significantly impact profitability.',
                extractedValue,
                recommendation: level === 'critical'
                    ? '🚨 CRITICAL: High-risk LD clause detected. Escalate to Deal Desk before quoting. Consider risk premium pricing.'
                    : '⚠️ Review LD terms with legal/commercial team. Ensure delivery timeline is achievable with buffer.',
            });

            break; // Only report one LD risk to avoid duplicates
        }
    }

    return risks;
}

/**
 * Detect duplicate part numbers in the parsed rows
 */
export function detectDuplicates(rows: ParsedRow[]): RiskFlag[] {
    const risks: RiskFlag[] = [];
    const partNumberMap = new Map<string, number[]>();

    for (const row of rows) {
        if (row.partNumber && row.partNumber.trim()) {
            const pn = row.partNumber.trim().toUpperCase();
            const existing = partNumberMap.get(pn) || [];
            existing.push(row.rowNumber);
            partNumberMap.set(pn, existing);
        }
    }

    for (const [partNumber, rowNumbers] of partNumberMap) {
        if (rowNumbers.length > 1) {
            risks.push({
                id: `duplicate-${partNumber}-${Date.now()}`,
                type: 'duplicate',
                level: 'medium',
                title: `Duplicate Part Number: ${partNumber}`,
                description: `Part number "${partNumber}" appears ${rowNumbers.length} times in the document.`,
                affectedRows: rowNumbers,
                extractedValue: partNumber,
                recommendation: 'Consider consolidating duplicate line items to avoid over-ordering or pricing errors.',
            });
        }
    }

    return risks;
}

/**
 * Detect potential UoM conflicts
 */
export function detectUoMConflicts(rows: ParsedRow[]): RiskFlag[] {
    const risks: RiskFlag[] = [];

    // Common UoM mismatches
    const conflictPairs: [string[], string[]][] = [
        [['each', 'ea', 'pc', 'pcs', 'piece', 'pieces'], ['box', 'case', 'pack', 'pkg', 'carton']],
        [['feet', 'ft', 'foot'], ['meter', 'm', 'meters', 'reel', 'roll']],
        [['kg', 'kilogram', 'kilograms'], ['lb', 'lbs', 'pound', 'pounds']],
        [['liter', 'liters', 'l'], ['gallon', 'gal', 'gallons']],
    ];

    for (const row of rows) {
        if (!row.unitOfMeasure) continue;

        const uom = row.unitOfMeasure.toLowerCase().trim();

        // Check if quantity seems wrong for UoM
        if (row.quantity !== null) {
            // Very high quantities with bulk UoM might be an error
            if (row.quantity > 10000 && ['reel', 'roll', 'drum', 'pallet'].some(u => uom.includes(u))) {
                risks.push({
                    id: `uom-quantity-${row.rowNumber}-${Date.now()}`,
                    type: 'uom_conflict',
                    level: 'medium',
                    title: `Unusually High Quantity for UoM`,
                    description: `Row ${row.rowNumber}: Quantity of ${row.quantity} ${row.unitOfMeasure} seems unusual. Verify this is not a unit conversion error.`,
                    affectedRows: [row.rowNumber],
                    extractedValue: `${row.quantity} ${row.unitOfMeasure}`,
                    recommendation: 'Confirm with customer whether quantity is per unit or total. Check if UoM conversion is needed.',
                });
            }

            // Fractional quantities with "each" might be an error
            if (!Number.isInteger(row.quantity) && ['each', 'ea', 'pc', 'pcs'].some(u => uom.includes(u))) {
                risks.push({
                    id: `uom-fraction-${row.rowNumber}-${Date.now()}`,
                    type: 'uom_conflict',
                    level: 'low',
                    title: `Fractional Quantity for Discrete UoM`,
                    description: `Row ${row.rowNumber}: Quantity ${row.quantity} with UoM "${row.unitOfMeasure}" - fractional quantities for discrete units may indicate data entry error.`,
                    affectedRows: [row.rowNumber],
                    extractedValue: `${row.quantity} ${row.unitOfMeasure}`,
                    recommendation: 'Verify quantity is correct. Round up if selling individual items.',
                });
            }
        }
    }

    return risks;
}

/**
 * Detect rows with missing critical data
 */
export function detectMissingData(rows: ParsedRow[]): RiskFlag[] {
    const risks: RiskFlag[] = [];
    const rowsWithMissingPN: number[] = [];
    const rowsWithMissingQty: number[] = [];

    for (const row of rows) {
        if (!row.partNumber || row.partNumber.trim() === '') {
            rowsWithMissingPN.push(row.rowNumber);
        }
        if (row.quantity === null || row.quantity === undefined) {
            rowsWithMissingQty.push(row.rowNumber);
        }
    }

    if (rowsWithMissingPN.length > 0) {
        risks.push({
            id: `missing-pn-${Date.now()}`,
            type: 'missing_data',
            level: rowsWithMissingPN.length > 5 ? 'high' : 'medium',
            title: `Missing Part Numbers (${rowsWithMissingPN.length} rows)`,
            description: `${rowsWithMissingPN.length} rows are missing part numbers. These items cannot be quoted without identification.`,
            affectedRows: rowsWithMissingPN.slice(0, 10), // Limit to first 10
            recommendation: 'Contact customer to provide missing part numbers before proceeding with quote.',
        });
    }

    if (rowsWithMissingQty.length > 0) {
        risks.push({
            id: `missing-qty-${Date.now()}`,
            type: 'missing_data',
            level: 'medium',
            title: `Missing Quantities (${rowsWithMissingQty.length} rows)`,
            description: `${rowsWithMissingQty.length} rows are missing quantity information.`,
            affectedRows: rowsWithMissingQty.slice(0, 10),
            recommendation: 'Verify quantities with customer or assume quantity of 1 for each item.',
        });
    }

    return risks;
}

/**
 * Run all risk detection algorithms
 */
export function analyzeAllRisks(rawText: string, rows: ParsedRow[]): RiskFlag[] {
    const allRisks: RiskFlag[] = [
        ...detectIncoterms(rawText),
        ...detectLiquidatedDamages(rawText),
        ...detectDuplicates(rows),
        ...detectUoMConflicts(rows),
        ...detectMissingData(rows),
    ];

    // Sort by risk level (critical first)
    const levelOrder: Record<RiskLevel, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    };

    return allRisks.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
}
