// Type definitions for the Excel-to-Quote Copilot

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ColumnMapping {
    partNumber: string | null;
    quantity: string | null;
    description: string | null;
    unitPrice: string | null;
    unitOfMeasure: string | null;
    notes: string | null;
    terms: string | null;
    headerRow: number;
}

export interface ParsedRow {
    rowNumber: number;
    partNumber: string;
    quantity: number | null;
    description: string;
    unitPrice: number | null;
    unitOfMeasure: string;
    notes: string;
    rawData: Record<string, unknown>;
}

export interface RiskFlag {
    id: string;
    type: 'incoterms' | 'liquidated_damages' | 'uom_conflict' | 'duplicate' | 'missing_data' | 'general';
    level: RiskLevel;
    title: string;
    description: string;
    affectedRows?: number[];
    extractedValue?: string;
    recommendation: string;
}

export interface IncotermInfo {
    term: string;
    riskLevel: RiskLevel;
    description: string;
    sellerResponsibility: string;
}

export interface QuoteAnalysis {
    success: boolean;
    fileName: string;
    processedAt: string;
    columnMapping: ColumnMapping;
    rows: ParsedRow[];
    risks: RiskFlag[];
    summary: {
        totalRows: number;
        validRows: number;
        totalRisks: number;
        criticalRisks: number;
        highRisks: number;
        mediumRisks: number;
        lowRisks: number;
    };
}

export interface ExcelParseResult {
    success: boolean;
    headers: string[];
    rows: Record<string, unknown>[];
    rawText: string;
    error?: string;
}

export interface AIAnalysisRequest {
    headers: string[];
    sampleRows: Record<string, unknown>[];
    rawText: string;
}

export interface StreamingState {
    status: 'idle' | 'uploading' | 'parsing' | 'analyzing' | 'complete' | 'error';
    progress: number;
    message: string;
}

export interface RowRemediation {
    rowNumber: number;
    field: 'quantity' | 'unitPrice' | 'description';
    oldValue: unknown;
    newValue: unknown;
    reason: string;
}

export interface DownloadResult {
    token: string;
    fileName: string;
    remediations: RowRemediation[];
}

