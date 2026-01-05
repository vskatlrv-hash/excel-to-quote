'use client';

import type { RiskFlag, RiskLevel } from '@/types/quote';

interface RiskPanelProps {
    risks: RiskFlag[];
    summary?: {
        totalRisks: number;
        criticalRisks: number;
        highRisks: number;
        mediumRisks: number;
        lowRisks: number;
    };
    isLoading?: boolean;
}

const RISK_CONFIG: Record<RiskLevel, { icon: string; color: string; label: string }> = {
    critical: { icon: '🚨', color: '#ef4444', label: 'Critical' },
    high: { icon: '⚠️', color: '#f59e0b', label: 'High' },
    medium: { icon: '⚡', color: '#eab308', label: 'Medium' },
    low: { icon: 'ℹ️', color: '#3b82f6', label: 'Low' },
};

const TYPE_LABELS: Record<string, string> = {
    incoterms: 'Incoterms',
    liquidated_damages: 'Liquidated Damages',
    uom_conflict: 'UoM Conflict',
    duplicate: 'Duplicate',
    missing_data: 'Missing Data',
    general: 'General',
};

export default function RiskPanel({ risks, summary, isLoading }: RiskPanelProps) {
    if (isLoading) {
        return (
            <div className="risk-panel">
                <div className="risk-header">
                    <h3>🛡️ Risk Assessment</h3>
                </div>
                <div className="risk-loading">
                    <div className="spinner small"></div>
                    <span>Scanning for risks...</span>
                </div>
            </div>
        );
    }

    const hasRisks = risks.length > 0;
    const hasCriticalOrHigh = summary && (summary.criticalRisks > 0 || summary.highRisks > 0);

    return (
        <div className={`risk-panel ${hasCriticalOrHigh ? 'has-critical' : hasRisks ? 'has-warnings' : 'all-clear'}`}>
            <div className="risk-header">
                <h3>🛡️ Risk Assessment</h3>
                {summary && (
                    <div className="risk-summary-badges">
                        {summary.criticalRisks > 0 && (
                            <span className="badge critical">{summary.criticalRisks} Critical</span>
                        )}
                        {summary.highRisks > 0 && (
                            <span className="badge high">{summary.highRisks} High</span>
                        )}
                        {summary.mediumRisks > 0 && (
                            <span className="badge medium">{summary.mediumRisks} Medium</span>
                        )}
                        {summary.lowRisks > 0 && (
                            <span className="badge low">{summary.lowRisks} Low</span>
                        )}
                    </div>
                )}
            </div>

            {!hasRisks ? (
                <div className="risk-clear">
                    <div className="clear-icon">✅</div>
                    <p>No risks detected</p>
                    <span>This quote appears to have standard terms</span>
                </div>
            ) : (
                <div className="risk-list">
                    {risks.map((risk, index) => {
                        const config = RISK_CONFIG[risk.level];
                        return (
                            <div
                                key={risk.id}
                                className={`risk-item risk-${risk.level}`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="risk-item-header">
                                    <span className="risk-icon">{config.icon}</span>
                                    <div className="risk-title-group">
                                        <h4>{risk.title}</h4>
                                        <div className="risk-meta">
                                            <span className="risk-type">{TYPE_LABELS[risk.type] || risk.type}</span>
                                            <span
                                                className="risk-level-badge"
                                                style={{ backgroundColor: config.color }}
                                            >
                                                {config.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <p className="risk-description">{risk.description}</p>

                                {risk.extractedValue && (
                                    <div className="risk-extracted">
                                        <span className="extracted-label">Detected:</span>
                                        <code>{risk.extractedValue}</code>
                                    </div>
                                )}

                                {risk.affectedRows && risk.affectedRows.length > 0 && (
                                    <div className="risk-rows">
                                        <span className="rows-label">Affected rows:</span>
                                        <span className="rows-list">
                                            {risk.affectedRows.slice(0, 5).join(', ')}
                                            {risk.affectedRows.length > 5 && ` +${risk.affectedRows.length - 5} more`}
                                        </span>
                                    </div>
                                )}

                                <div className="risk-recommendation">
                                    <span className="recommendation-label">📋 Recommendation:</span>
                                    <p>{risk.recommendation}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
