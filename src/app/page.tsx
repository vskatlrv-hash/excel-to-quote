'use client';

import { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import ResultsTable from '@/components/ResultsTable';
import RiskPanel from '@/components/RiskPanel';
import ExportButtons from '@/components/ExportButtons';
import AICopilot from '@/components/AICopilot';
import { processExcelFile } from './actions/processExcel';
import type { QuoteAnalysis } from '@/types/quote';


export default function Home() {
  const [analysis, setAnalysis] = useState<QuoteAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setAnalysis(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await processExcelFile(formData);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle data updates from AI tool calls
  const handleDataUpdate = useCallback((event: {
    type: 'update_cell' | 'fix_quantities' | 'delete_rows' | 'clear_column';
    rowNumber?: number;
    field?: string;
    newValue?: unknown;
    affectedRows?: number[];
    rowNumbers?: number[];
    defaultQuantity?: number;
  }) => {
    console.log('handleDataUpdate received event:', event);


    setAnalysis(prev => {
      if (!prev) return prev;

      const updatedRows = [...prev.rows];

      if (event.type === 'update_cell' && event.rowNumber && event.field) {
        console.log(`[page.tsx] Processing update_cell for row ${event.rowNumber}, field ${event.field}, value ${event.newValue}`);
        const rowIndex = updatedRows.findIndex(r => r.rowNumber === event.rowNumber);
        console.log(`[page.tsx] Found row index: ${rowIndex} for rowNumber ${event.rowNumber} (type: ${typeof event.rowNumber})`);

        if (rowIndex !== -1) {
          updatedRows[rowIndex] = {
            ...updatedRows[rowIndex],
            [event.field]: event.newValue,
          };
          console.log('[page.tsx] Updated row:', updatedRows[rowIndex]);
        } else {
          console.warn(`[page.tsx] Row ${event.rowNumber} not found! Available rows:`, updatedRows.map(r => r.rowNumber).slice(0, 10));
        }
      } else if (event.type === 'fix_quantities' && event.affectedRows) {
        console.log('Processing fix_quantities for rows:', event.affectedRows);
        event.affectedRows.forEach(rowNum => {
          const rowIndex = updatedRows.findIndex(r => r.rowNumber === rowNum);
          console.log(`Checking row ${rowNum}, found index: ${rowIndex}`);
          if (rowIndex !== -1) {
            console.log('Updating row before:', updatedRows[rowIndex]);
            updatedRows[rowIndex] = {
              ...updatedRows[rowIndex],
              quantity: event.defaultQuantity ?? 1,
            };
            console.log('Updating row after:', updatedRows[rowIndex]);
          } else {
            console.log('Row not found for number:', rowNum, 'Available rows:', updatedRows.map(r => r.rowNumber));
          }
        });
      } else if (event.type === 'delete_rows' && event.rowNumbers) {
        console.log('[page.tsx] Processing delete_rows for:', event.rowNumbers);
        // Filter out rows that are in the deletion list
        const initialCount = updatedRows.length;
        const rowsToDelete = new Set(event.rowNumbers);
        const filteredRows = updatedRows.filter(r => !rowsToDelete.has(r.rowNumber));
        console.log(`[page.tsx] Deleted ${initialCount - filteredRows.length} rows. New count: ${filteredRows.length}`);

        return {
          ...prev,
          rows: filteredRows,
        };
      } else if (event.type === 'clear_column' && event.field) {
        console.log('[page.tsx] Processing clear_column for:', event.field);
        // Clear data in the specified field for all rows
        const field = event.field;
        const isNumeric = field === 'quantity' || field === 'unitPrice';

        updatedRows.forEach((row, index) => {
          updatedRows[index] = {
            ...row,
            [field]: isNumeric ? null : '',
          };
        });
      }

      return {
        ...prev,
        rows: updatedRows,
      };
    });
  }, []); // Empty dependency array - we use functional update so we don't need analysis

  const getRiskStatusClass = () => {
    if (!analysis) return '';
    if (analysis.summary.criticalRisks > 0) return 'status-critical';
    if (analysis.summary.highRisks > 0) return 'status-high';
    if (analysis.summary.totalRisks > 0) return 'status-warning';
    return 'status-clear';
  };

  return (
    <main className="app-layout">
      {/* Animated background */}
      <div className="bg-gradient"></div>
      <div className="bg-grid"></div>

      {/* Left Panel - Main Content */}
      <div className="main-panel">
        {/* Compact Hero */}
        <header className="hero-compact">
          <div className="hero-badge">
            <span className="badge-icon">⚡</span>
            <span>AI-Powered Quote Analysis</span>
          </div>
          <h1 className="hero-title-compact">
            Excel-to-Quote
            <span className="gradient-text"> Copilot</span>
          </h1>
          <p className="hero-subtitle-compact">
            Upload your BOM. Let AI analyze risks and map columns instantly.
          </p>
        </header>

        {/* Upload Section */}
        <section className="upload-section">
          <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
        </section>

        {error && (
          <div className="error-banner">
            <span className="error-icon">❌</span>
            <p>{error}</p>
          </div>
        )}

        {/* Results Section */}
        {(analysis || isProcessing) && (
          <div className={`results-section ${getRiskStatusClass()}`}>
            {/* Summary Cards */}
            {analysis && analysis.success && (
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="card-icon">📄</div>
                  <div className="card-content">
                    <span className="card-value">{analysis.fileName}</span>
                    <span className="card-label">File Analyzed</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="card-icon">📊</div>
                  <div className="card-content">
                    <span className="card-value">{analysis.summary.totalRows}</span>
                    <span className="card-label">Line Items</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="card-icon">✅</div>
                  <div className="card-content">
                    <span className="card-value">{analysis.summary.validRows}</span>
                    <span className="card-label">Valid Rows</span>
                  </div>
                </div>

                <div className={`summary-card ${analysis.summary.totalRisks > 0 ? 'has-risks' : ''}`}>
                  <div className="card-icon">
                    {analysis.summary.criticalRisks > 0 ? '🚨' :
                      analysis.summary.highRisks > 0 ? '⚠️' :
                        analysis.summary.totalRisks > 0 ? '⚡' : '✅'}
                  </div>
                  <div className="card-content">
                    <span className="card-value">{analysis.summary.totalRisks}</span>
                    <span className="card-label">Risks Detected</span>
                  </div>
                </div>
              </div>
            )}

            {/* Column Mapping Info */}
            {analysis && analysis.success && analysis.columnMapping && (
              <div className="mapping-info">
                <h4>🧠 AI Column Mapping</h4>
                <div className="mapping-grid">
                  {Object.entries(analysis.columnMapping)
                    .filter(([key, value]) => value && key !== 'headerRow')
                    .map(([key, value]) => (
                      <div key={key} className="mapping-item">
                        <span className="mapping-key">{formatKey(key)}</span>
                        <span className="mapping-arrow">→</span>
                        <span className="mapping-value">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Export Buttons */}
            {analysis && analysis.success && (
              <ExportButtons analysis={analysis} />
            )}

            {/* Stacked Results: Table then Risks */}
            <div className="results-stacked">
              <ResultsTable
                rows={analysis?.rows ?? []}
                isLoading={isProcessing}
              />
              <RiskPanel
                risks={analysis?.risks ?? []}
                summary={analysis?.summary}
                isLoading={isProcessing}
              />
            </div>
          </div>
        )}

        {/* Features Section - Show when no analysis */}
        {!analysis && !isProcessing && (
          <section className="features-section">
            <h2>Why Use the Copilot?</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>10x Faster Quoting</h3>
                <p>Transform hours of manual data entry into seconds of automated processing.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🧠</div>
                <h3>AI Column Mapping</h3>
                <p>Intelligent detection of part numbers, quantities, and pricing columns regardless of format.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🛡️</div>
                <h3>Risk Detection</h3>
                <p>Automatic scanning for Incoterms, Liquidated Damages, and data quality issues.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h3>Zero Data Retention</h3>
                <p>Enterprise-grade security. All processing happens in-memory with no file storage.</p>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="footer">
          <p>
            <span className="footer-icon">🔒</span>
            Your data is processed in-memory and never stored.
            <span className="footer-separator">|</span>
            Built for Sales Engineers.
          </p>
        </footer>
      </div>

      {/* Right Panel - AI Copilot (Always Visible) */}
      <aside className="ai-panel">
        <AICopilot analysis={analysis} onDataUpdate={handleDataUpdate} />
      </aside>
    </main>
  );
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
