import { z } from 'zod';

// Schema for AI-generated column mapping
export const columnMappingSchema = z.object({
    partNumber: z.string().nullable().describe('Column name that contains part numbers, SKUs, or item codes'),
    quantity: z.string().nullable().describe('Column name that contains quantities or amounts'),
    description: z.string().nullable().describe('Column name that contains item descriptions'),
    unitPrice: z.string().nullable().describe('Column name that contains unit prices or costs'),
    unitOfMeasure: z.string().nullable().describe('Column name that contains units (each, box, kg, etc)'),
    notes: z.string().nullable().describe('Column name that contains notes, comments, or remarks'),
    terms: z.string().nullable().describe('Column name that contains terms, conditions, or shipping info'),
    headerRow: z.number().describe('The row number (1-indexed) where headers are located'),
});

// Schema for risk detection results
export const riskFlagSchema = z.object({
    id: z.string().describe('Unique identifier for this risk'),
    type: z.enum(['incoterms', 'liquidated_damages', 'uom_conflict', 'duplicate', 'missing_data', 'general']),
    level: z.enum(['low', 'medium', 'high', 'critical']),
    title: z.string().describe('Short title for the risk'),
    description: z.string().describe('Detailed description of the risk'),
    affectedRows: z.array(z.number()).optional().describe('Row numbers affected by this risk'),
    extractedValue: z.string().optional().describe('The specific value that triggered this risk'),
    recommendation: z.string().describe('Recommended action to address this risk'),
});

// Schema for the complete AI analysis response
export const quoteAnalysisSchema = z.object({
    columnMapping: columnMappingSchema,
    risks: z.array(riskFlagSchema),
    parsedRows: z.array(z.object({
        rowNumber: z.number(),
        partNumber: z.string(),
        quantity: z.number().nullable(),
        description: z.string(),
        unitPrice: z.number().nullable(),
        unitOfMeasure: z.string(),
        notes: z.string(),
    })),
});

// Incoterms reference data
export const INCOTERMS_DATA: Record<string, { riskLevel: 'low' | 'medium' | 'high' | 'critical'; description: string }> = {
    'EXW': { riskLevel: 'low', description: 'Ex Works - Minimal seller responsibility' },
    'FCA': { riskLevel: 'low', description: 'Free Carrier - Seller delivers to carrier' },
    'FAS': { riskLevel: 'medium', description: 'Free Alongside Ship - Seller delivers alongside vessel' },
    'FOB': { riskLevel: 'medium', description: 'Free on Board - Seller loads onto vessel' },
    'CFR': { riskLevel: 'medium', description: 'Cost and Freight - Seller pays freight to destination' },
    'CIF': { riskLevel: 'medium', description: 'Cost, Insurance, Freight - Seller pays freight + insurance' },
    'CPT': { riskLevel: 'medium', description: 'Carriage Paid To - Seller pays carriage to destination' },
    'CIP': { riskLevel: 'high', description: 'Carriage and Insurance Paid - Seller pays carriage + insurance' },
    'DAP': { riskLevel: 'high', description: 'Delivered at Place - Seller delivers to named place' },
    'DPU': { riskLevel: 'high', description: 'Delivered at Place Unloaded - Seller unloads at destination' },
    'DDP': { riskLevel: 'critical', description: 'Delivered Duty Paid - Seller pays ALL costs including duties' },
};

export type ColumnMappingType = z.infer<typeof columnMappingSchema>;
export type RiskFlagType = z.infer<typeof riskFlagSchema>;
export type QuoteAnalysisType = z.infer<typeof quoteAnalysisSchema>;
