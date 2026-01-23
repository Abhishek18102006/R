// src/pages/PerformancePage.jsx (COMPLETE REPLACEMENT - FIXED METRICS)
import { useState } from "react";

export default function PerformancePage({ performanceData, history, trains }) {
  const [timeRange, setTimeRange] = useState("today");
  
  const {
    totalConflictsDetected = 0,
    totalConflictsResolved = 0,
    totalConflictsRejected = 0,
    averageResolutionTime = 0,
    totalTrainsCleared = 0,
    totalDelayReduced = 0,
    blockConflictsDetected = 0,
    blockConflictsResolved = 0,
    loopConflictsDetected = 0,
    loopConflictsResolved = 0,
    junctionConflictsDetected = 0,
    junctionConflictsResolved = 0,
    resolutionHistory = []
  } = performanceData;

  // ⭐ CALCULATE REAL AI ACCURACY RATE
  const totalAttempted = totalConflictsResolved + totalConflictsRejected;
  const aiAccuracyRate = totalAttempted > 0
    ? Math.round((totalConflictsResolved / totalAttempted) * 100)
    : totalConflictsResolved > 0 ? 100 : 0;

  // ⭐ CALCULATE REAL THROUGHPUT IMPROVEMENT
  const throughputImprovement = (() => {
    if (totalConflictsResolved === 0) return 0;
    const baseImprovement = Math.min(50, totalConflictsResolved * 5);
    const delayImprovement = Math.min(50, Math.floor(totalDelayReduced / 2));
    return Math.min(100, baseImprovement + delayImprovement);
  })();

  // Calculate derived metrics
  const resolutionRate = totalConflictsDetected > 0 
    ? ((totalConflictsResolved / totalConflictsDetected) * 100).toFixed(1)
    : totalConflictsResolved > 0 ? "100.0" : "0.0";

  const activeConflicts = trains.filter(t => 
    t.conflict || 
    t.status === "IN_CONFLICT" || 
    t.status === "DELAYED"
  ).length;
  
  const averageDelayReduction = totalConflictsResolved > 0
    ? (totalDelayReduced / totalConflictsResolved).toFixed(1)
    : 0;

  const systemEfficiency = totalConflictsDetected > 0
    ? Math.min(100, (totalConflictsResolved / totalConflictsDetected) * 100).toFixed(1)
    : totalConflictsResolved > 0 ? "100.0" : "0.0";

  const systemStatus = activeConflicts > 0 ? "MANAGING" : "OPTIMAL";

  return (
    <div style={{ padding: "20px" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px"
      }}>
        <h2 style={{ margin: 0, color: "#0a2540" }}>
          📊 Performance Metrics
        </h2>
        
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            fontSize: "14px"
          }}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Primary KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        <MetricCard
          title="Conflicts Detected"
          value={totalConflictsDetected}
          icon="⚠️"
          color="#dc2626"
          subtitle={`${activeConflicts} active`}
        />
        <MetricCard
          title="Conflicts Resolved"
          value={totalConflictsResolved}
          icon="✅"
          color="#16a34a"
          subtitle={`${resolutionRate}% success rate`}
        />
        <MetricCard
          title="AI Acceptance Rate"
          value={`${aiAccuracyRate}%`}
          icon="🤖"
          color="#0284c7"
          subtitle={`${totalConflictsRejected} rejected`}
        />
        <MetricCard
          title="Trains Cleared"
          value={totalTrainsCleared}
          icon="🚂"
          color="#7c3aed"
          subtitle={`${trains.length} active`}
        />
      </div>

      {/* Detailed Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "20px",
        marginBottom: "24px"
      }}>
        {/* AI Performance */}
        <MetricPanel title="🤖 AI Performance">
          <MetricRow 
            label="Average Resolution Time" 
            value={`${averageResolutionTime.toFixed(2)}s`}
          />
          <MetricRow 
            label="AI Acceptance Rate" 
            value={`${aiAccuracyRate}%`}
            valueColor="#16a34a"
            tooltip={`${totalConflictsResolved} accepted / ${totalAttempted} total attempts`}
          />
          <MetricRow 
            label="Average Delay Reduction" 
            value={`${averageDelayReduction} min`}
            valueColor="#0284c7"
          />
          <MetricRow 
            label="Total Delay Saved" 
            value={`${totalDelayReduced} min`}
            valueColor="#7c3aed"
          />
        </MetricPanel>

        {/* System Efficiency */}
        <MetricPanel title="⚡ System Efficiency">
          <MetricRow 
            label="Resolution Rate" 
            value={`${resolutionRate}%`}
            valueColor="#16a34a"
            tooltip="Conflicts resolved vs conflicts detected"
          />
          <MetricRow 
            label="Active Conflicts" 
            value={activeConflicts}
            valueColor={activeConflicts > 0 ? "#dc2626" : "#16a34a"}
          />
          <MetricRow 
            label="Throughput Improvement" 
            value={`+${throughputImprovement}%`}
            valueColor="#0284c7"
            tooltip="Estimated based on conflicts resolved and delays saved"
          />
          <MetricRow 
            label="System Status" 
            value={systemStatus}
            valueColor={activeConflicts > 0 ? "#d97706" : "#16a34a"}
          />
        </MetricPanel>
      </div>

      {/* Resolution Breakdown */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "16px",
        marginBottom: "24px"
      }}>
        <BreakdownCard
          title="Block Conflicts"
          resolved={blockConflictsResolved}
          total={blockConflictsDetected}
          color="#dc2626"
        />
        <BreakdownCard
          title="Loop Line Conflicts"
          resolved={loopConflictsResolved}
          total={loopConflictsDetected}
          color="#d97706"
        />
        <BreakdownCard
          title="Junction Conflicts"
          resolved={junctionConflictsResolved}
          total={junctionConflictsDetected}
          color="#0284c7"
        />
      </div>

      {/* Calculation Explanation */}
      {(totalConflictsDetected > 0 || totalConflictsResolved > 0) && (
        <div style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          padding: "16px",
          borderRadius: "10px",
          marginBottom: "24px"
        }}>
          <h3 style={{ 
            margin: "0 0 12px 0", 
            fontSize: "15px",
            color: "#1e40af",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            📐 Metric Calculations
          </h3>
          <div style={{ fontSize: "13px", color: "#1e40af", lineHeight: "1.8" }}>
            <div style={{ marginBottom: "8px" }}>
              <strong>Total Conflicts Detected:</strong> {blockConflictsDetected} (block) + {loopConflictsDetected} (loop) + {junctionConflictsDetected} (junction) = <strong>{totalConflictsDetected}</strong>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>AI Acceptance Rate:</strong> {totalConflictsResolved} accepted ÷ {totalAttempted} attempted = <strong>{aiAccuracyRate}%</strong>
              <div style={{ fontSize: "11px", color: "#60a5fa", marginLeft: "20px" }}>
                (Attempted = {totalConflictsResolved} accepted + {totalConflictsRejected} rejected)
              </div>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>Resolution Rate:</strong> {totalConflictsResolved} resolved ÷ {totalConflictsDetected} detected = <strong>{resolutionRate}%</strong>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>Throughput Improvement:</strong> 
              <ul style={{ margin: "4px 0 0 20px", padding: 0 }}>
                <li>Base: {totalConflictsResolved} conflicts × 5% = {Math.min(50, totalConflictsResolved * 5)}%</li>
                <li>Delay bonus: {totalDelayReduced} min ÷ 2 = {Math.min(50, Math.floor(totalDelayReduced / 2))}%</li>
                <li>Total: <strong>+{throughputImprovement}%</strong> (capped at 100%)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recent Resolutions */}
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
      }}>
        <h3 style={{ marginBottom: "16px", color: "#334155" }}>
          🕐 Recent AI Resolutions
        </h3>
        
        {resolutionHistory.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
            No resolutions recorded yet
          </p>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {resolutionHistory.slice(0, 10).map((resolution, i) => (
              <ResolutionItem key={i} resolution={resolution} />
            ))}
          </div>
        )}
      </div>

      {/* Performance Insights */}
      <div style={{
        marginTop: "24px",
        background: "white",
        padding: "20px",
        borderRadius: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
      }}>
        <h3 style={{ marginBottom: "16px", color: "#334155" }}>
          💡 Performance Insights
        </h3>
        
        <div style={{ display: "grid", gap: "12px" }}>
          {aiAccuracyRate >= 80 && totalConflictsResolved > 0 && (
            <InsightCard
              type="success"
              message={`Excellent performance! ${aiAccuracyRate}% AI acceptance rate with ${totalConflictsResolved} conflicts successfully resolved.`}
            />
          )}
          
          {aiAccuracyRate > 0 && aiAccuracyRate < 80 && (
            <InsightCard
              type="warning"
              message={`AI acceptance at ${aiAccuracyRate}%. Consider reviewing rejected resolutions to improve the model.`}
            />
          )}
          
          {averageResolutionTime < 3 && totalConflictsResolved > 0 && (
            <InsightCard
              type="success"
              message={`Fast AI response time: ${averageResolutionTime.toFixed(2)}s average resolution time.`}
            />
          )}
          
          {totalDelayReduced > 0 && (
            <InsightCard
              type="info"
              message={`System saved ${totalDelayReduced} minutes of total delay through AI interventions, improving throughput by approximately ${throughputImprovement}%.`}
            />
          )}
          
          {activeConflicts > 3 && (
            <InsightCard
              type="warning"
              message={`${activeConflicts} active conflicts detected. Consider immediate intervention.`}
            />
          )}
          
          {totalConflictsResolved === 0 && totalConflictsDetected > 0 && (
            <InsightCard
              type="info"
              message="Conflicts detected but none resolved yet. Use AI recommendations to resolve conflicts."
            />
          )}

          {totalConflictsDetected === 0 && (
            <InsightCard
              type="info"
              message="No conflicts detected yet. Upload train data with conflicting schedules to test the system."
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, icon, color, subtitle }) {
  return (
    <div style={{
      background: "white",
      padding: "20px",
      borderRadius: "10px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start"
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
            {title}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ fontSize: "32px", opacity: 0.8 }}>{icon}</div>
      </div>
    </div>
  );
}

// Metric Panel Component
function MetricPanel({ title, children }) {
  return (
    <div style={{
      background: "white",
      padding: "20px",
      borderRadius: "10px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
    }}>
      <h3 style={{ marginBottom: "16px", color: "#334155" }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {children}
      </div>
    </div>
  );
}

// Metric Row Component
function MetricRow({ label, value, valueColor = "#0f172a", tooltip }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      borderBottom: "1px solid #f3f4f6"
    }}>
      <span style={{ fontSize: "14px", color: "#64748b" }} title={tooltip}>
        {label}
        {tooltip && <span style={{ fontSize: "11px", marginLeft: "4px" }}>ℹ️</span>}
      </span>
      <strong style={{ fontSize: "16px", color: valueColor }}>{value}</strong>
    </div>
  );
}

// Breakdown Card Component
function BreakdownCard({ title, resolved, total, color }) {
  const percentage = total > 0 ? ((resolved / total) * 100).toFixed(0) : 0;
  
  return (
    <div style={{
      background: "white",
      padding: "16px",
      borderRadius: "10px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
    }}>
      <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a", marginBottom: "8px" }}>
        {resolved}/{total}
      </div>
      <div style={{
        width: "100%",
        height: "6px",
        background: "#f3f4f6",
        borderRadius: "3px",
        overflow: "hidden"
      }}>
        <div style={{
          width: `${percentage}%`,
          height: "100%",
          background: color,
          transition: "width 0.3s"
        }} />
      </div>
      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
        {percentage}% resolved
      </div>
    </div>
  );
}

// Resolution Item Component
function ResolutionItem({ resolution }) {
  return (
    <div style={{
      padding: "12px",
      background: "#f8fafc",
      borderRadius: "6px",
      marginBottom: "8px",
      borderLeft: `3px solid ${resolution.decision === "HOLD_TRAIN" ? "#dc2626" : 
                                resolution.decision === "ROUTE_TO_LOOP" ? "#d97706" : "#3b82f6"}`
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "start",
        marginBottom: "4px"
      }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
          {resolution.priority_train} vs {resolution.reduced_train}
        </div>
        <div style={{ fontSize: "11px", color: "#64748b" }}>
          {resolution.timestamp}
        </div>
      </div>
      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>
        Decision: <strong style={{ color: "#0f172a" }}>{resolution.decision}</strong>
        {resolution.conflictType && (
          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#6b7280" }}>
            ({resolution.conflictType})
          </span>
        )}
      </div>
      <div style={{ fontSize: "11px", color: "#64748b" }}>
        Confidence: {resolution.confidence}% | Time: {resolution.resolutionTime}s
      </div>
    </div>
  );
}

// Insight Card Component
function InsightCard({ type, message }) {
  const styles = {
    success: { bg: "#dcfce7", border: "#16a34a", text: "#166534", icon: "✅" },
    warning: { bg: "#fef3c7", border: "#d97706", text: "#92400e", icon: "⚠️" },
    info: { bg: "#dbeafe", border: "#0284c7", text: "#1e40af", icon: "ℹ️" }
  };
  
  const style = styles[type] || styles.info;
  
  return (
    <div style={{
      padding: "12px 16px",
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: "6px",
      display: "flex",
      alignItems: "start",
      gap: "10px"
    }}>
      <span style={{ fontSize: "18px" }}>{style.icon}</span>
      <span style={{ fontSize: "14px", color: style.text }}>
        {message}
      </span>
    </div>
  );
}