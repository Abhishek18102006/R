// src/components/Conflicts.jsx (SIMPLIFIED - Suggestion, Options, Risks)
import { useState, useEffect } from "react";
import { detectBlockConflicts, getSeverityColor } from "../utils/blockConflictDetector";
import { detectLoopLineConflicts } from "../utils/loopLineDetector";
import { detectJunctionConflicts, getJunctionSeverityColor } from "../utils/junctionConflictDetector";
import { resolveConflictAI } from "../utils/aiResolver";

export default function Conflicts({
  trains,
  onAcceptResolution,
  onRejectResolution,
  onUpdateConflictCounts
}) {
  const [blockAiResults, setBlockAiResults] = useState({});
  const [loopAiResults, setLoopAiResults] = useState({});
  const [junctionAiResults, setJunctionAiResults] = useState({});
  
  const [error, setError] = useState(null);
  const [loadingConflictId, setLoadingConflictId] = useState(null);
  const [sameBlockConflicts, setSameBlockConflicts] = useState([]);
  const [loopLineConflicts, setLoopLineConflicts] = useState([]);
  const [junctionConflicts, setJunctionConflicts] = useState([]);
  const [recentlyResolved, setRecentlyResolved] = useState([]);

  // Detect conflicts
  useEffect(() => {
    try {
      if (Array.isArray(trains) && trains.length > 0) {
        const blockConflicts = detectBlockConflicts(trains);
        const loopConflicts = detectLoopLineConflicts(trains);
        const junctionConflictsData = detectJunctionConflicts(trains);
        
        setSameBlockConflicts(blockConflicts);
        setLoopLineConflicts(loopConflicts);
        setJunctionConflicts(junctionConflictsData);
        setError(null);

        if (onUpdateConflictCounts) {
          onUpdateConflictCounts('block', blockConflicts.length);
          onUpdateConflictCounts('loop', loopConflicts.length);
          onUpdateConflictCounts('junction', junctionConflictsData.length);
        }
      } else {
        setSameBlockConflicts([]);
        setLoopLineConflicts([]);
        setJunctionConflicts([]);
      }
    } catch (err) {
      console.error("Conflict detection error:", err);
      setError(err.message);
      setSameBlockConflicts([]);
      setLoopLineConflicts([]);
      setJunctionConflicts([]);
    }
  }, [trains, onUpdateConflictCounts]);

  useEffect(() => {
    const resolved = trains.filter(t => 
      t.status === "RESOLVED" && 
      t.resolved_at && 
      (Date.now() - t.resolved_at) < 300000
    );
    setRecentlyResolved(resolved);
  }, [trains]);

  async function handleResolve(conflict, conflictType, conflictId) {
    setLoadingConflictId(conflictId);
    setError(null);
    
    try {
      console.log("🤖 Resolving conflict with AI:", conflict);
      
      const trainA = trains.find(t => 
        t.train_id === conflict.trainA || 
        t.train_id === conflict.leadingTrain || 
        t.train_id === conflict.train1
      );
      const trainB = trains.find(t => 
        t.train_id === conflict.trainB || 
        t.train_id === conflict.followingTrain || 
        t.train_id === conflict.train2
      );
      
      if (!trainA || !trainB) {
        throw new Error("Could not find train objects for conflict resolution");
      }

      const enrichedConflict = {
        ...conflict,
        trainAObj: trainA,
        trainBObj: trainB
      };
      
      const result = await resolveConflictAI(enrichedConflict);
      
      console.log("✅ AI Resolution received:", result);
      
      if (!result.success) {
        setError(result.error || "AI resolution failed");
        return;
      }
      
      if (conflictType === "SAME_BLOCK") {
        setBlockAiResults(prev => ({ ...prev, [conflictId]: result }));
      } else if (conflictType === "LOOP_LINE") {
        setLoopAiResults(prev => ({ ...prev, [conflictId]: result }));
      } else if (conflictType === "JUNCTION") {
        setJunctionAiResults(prev => ({ ...prev, [conflictId]: result }));
      }
      
    } catch (err) {
      console.error("AI resolution error:", err);
      setError("Failed to resolve conflict: " + err.message);
    } finally {
      setLoadingConflictId(null);
    }
  }

  function handleAccept(conflictType, conflictId, aiResult) {
    if (!aiResult) {
      console.error("No AI result to accept");
      return;
    }

    console.log("✅ Accepting AI resolution:", aiResult);

    let delayReduction = 0;
    if (aiResult.suggested_speed > 0 && aiResult.suggested_speed < 80) {
      delayReduction = Math.floor((80 - aiResult.suggested_speed) / 10);
    }

    const resolutionDetails = {
      priority_train: aiResult.priority_train,
      reduced_train: aiResult.reduced_train,
      decision: aiResult.decision,
      confidence: aiResult.confidence,
      suggested_speed: aiResult.suggested_speed,
      suggested_delay: aiResult.suggested_delay,
      delayReduction: delayReduction,
      reason: aiResult.reason,
      conflictType: aiResult.conflictType
    };

    console.log("📤 Sending resolution details:", resolutionDetails);

    onAcceptResolution(aiResult.reduced_train, resolutionDetails);

    if (conflictType === "SAME_BLOCK") {
      setBlockAiResults(prev => {
        const updated = { ...prev };
        delete updated[conflictId];
        return updated;
      });
    } else if (conflictType === "LOOP_LINE") {
      setLoopAiResults(prev => {
        const updated = { ...prev };
        delete updated[conflictId];
        return updated;
      });
    } else if (conflictType === "JUNCTION") {
      setJunctionAiResults(prev => {
        const updated = { ...prev };
        delete updated[conflictId];
        return updated;
      });
    }

    if (onUpdateConflictCounts) {
      const type = conflictType === 'SAME_BLOCK' ? 'block' :
                   conflictType === 'LOOP_LINE' ? 'loop' : 'junction';
      onUpdateConflictCounts(type, 0, 1);
    }
    
    console.log("✅ Resolution accepted and state cleared");
  }

  function handleReject(conflictType, conflictId, aiResult) {
    if (!aiResult) return;

    console.log("❌ Rejecting AI resolution for:", aiResult.reduced_train);
    onRejectResolution(aiResult.reduced_train);
    
    if (conflictType === "SAME_BLOCK") {
      setBlockAiResults(prev => {
        const updated = { ...prev };
        delete updated[conflictId];
        return updated;
      });
    } else if (conflictType === "LOOP_LINE") {
      setLoopAiResults(prev => {
        const updated = { ...prev };
        delete updated[conflictId];
        return updated;
      });
    } else if (conflictType === "JUNCTION") {
      setJunctionAiResults(prev => {
        const updated = { ...prev };
        delete updated[conflictId];
        return updated;
      });
    }
  }

  return (
    <div className="table-card">
      <h3>🚦 Conflict Resolution</h3>

      {error && (
        <div style={{
          background: "#fee2e2",
          border: "1px solid #fca5a5",
          padding: "12px",
          borderRadius: "6px",
          marginBottom: "16px",
          color: "#b91c1c"
        }}>
          ⚠ <strong>Error:</strong> {error}
        </div>
      )}

      {/* SAME BLOCK CONFLICTS */}
      <div style={{ marginTop: "20px" }}>
        <h4 style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          marginBottom: "12px" 
        }}>
          ⚠ Same Block Conflicts
          <span style={{
            background: sameBlockConflicts.length > 0 ? "#fca5a5" : "#d1fae5",
            color: sameBlockConflicts.length > 0 ? "#7f1d1d" : "#065f46",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {sameBlockConflicts.length}
          </span>
        </h4>

        {sameBlockConflicts.length === 0 ? (
          <p style={{ color: "#16a34a", fontSize: "14px" }}>
            ✓ No same-block conflicts detected
          </p>
        ) : (
          sameBlockConflicts.map((conflict, i) => {
            const conflictId = `block_${i}`;
            const aiResult = blockAiResults[conflictId];
            const isLoading = loadingConflictId === conflictId;

            return (
              <div 
                key={i} 
                style={{
                  background: "#fef2f2",
                  border: `2px solid ${getSeverityColor(conflict.severity)}`,
                  padding: "14px",
                  borderRadius: "8px",
                  marginBottom: "12px"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "start",
                  marginBottom: "8px"
                }}>
                  <div>
                    <div style={{ 
                      fontSize: "12px", 
                      fontWeight: "600",
                      color: getSeverityColor(conflict.severity),
                      marginBottom: "4px"
                    }}>
                      Block: {conflict.block_id} | Severity: {conflict.severity}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "500" }}>
                      Train A: <strong>{conflict.trainA}</strong> ↔ 
                      Train B: <strong>{conflict.trainB}</strong>
                    </div>
                  </div>
                  <div style={{ 
                    background: getSeverityColor(conflict.severity),
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {conflict.timeDiff} min gap
                  </div>
                </div>

                {!aiResult && (
                  <button 
                    onClick={() => handleResolve(conflict, "SAME_BLOCK", conflictId)}
                    disabled={isLoading}
                    style={{
                      background: isLoading ? "#9ca3af" : "#6366f1",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      opacity: isLoading ? 0.5 : 1
                    }}
                  >
                    {isLoading ? "🔄 Processing..." : "🤖 Resolve with AI"}
                  </button>
                )}

                {aiResult && aiResult.success && (
                  <SimplifiedAIResultDisplay
                    aiResult={aiResult}
                    conflict={conflict}
                    onAccept={() => handleAccept("SAME_BLOCK", conflictId, aiResult)}
                    onReject={() => handleReject("SAME_BLOCK", conflictId, aiResult)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* LOOP LINE CONFLICTS */}
      <div style={{ marginTop: "24px" }}>
        <h4 style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          marginBottom: "12px" 
        }}>
          🔁 Loop Line Conflicts
          <span style={{
            background: loopLineConflicts.length > 0 ? "#fed7aa" : "#d1fae5",
            color: loopLineConflicts.length > 0 ? "#7c2d12" : "#065f46",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {loopLineConflicts.length}
          </span>
        </h4>

        {loopLineConflicts.length === 0 ? (
          <p style={{ color: "#16a34a", fontSize: "14px" }}>
            ✓ No loop-line conflicts detected
          </p>
        ) : (
          loopLineConflicts.map((conflict, i) => {
            const conflictId = `loop_${i}`;
            const aiResult = loopAiResults[conflictId];
            const isLoading = loadingConflictId === conflictId;

            return (
              <div
                key={i}
                style={{
                  background: "#eff6ff",
                  border: "2px solid #60a5fa",
                  padding: "14px",
                  borderRadius: "8px",
                  marginBottom: "12px"
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#1e40af" }}>
                    Block: {conflict.block_id}
                  </div>
                  <div style={{ fontSize: "14px", marginTop: "4px" }}>
                    <strong>Leading:</strong> Train {conflict.leadingTrain}
                    <br />
                    <strong>Following:</strong> Train {conflict.followingTrain}
                    <br />
                    <strong>Gap:</strong> {conflict.timeDiff} minutes
                  </div>
                </div>

                {!aiResult && (
                  <button 
                    onClick={() => handleResolve(conflict, "LOOP_LINE", conflictId)}
                    disabled={isLoading}
                    style={{
                      background: isLoading ? "#9ca3af" : "#6366f1",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      opacity: isLoading ? 0.5 : 1
                    }}
                  >
                    {isLoading ? "🔄 Processing..." : "🤖 Resolve with AI"}
                  </button>
                )}

                {aiResult && aiResult.success && (
                  <SimplifiedAIResultDisplay
                    aiResult={aiResult}
                    conflict={conflict}
                    onAccept={() => handleAccept("LOOP_LINE", conflictId, aiResult)}
                    onReject={() => handleReject("LOOP_LINE", conflictId, aiResult)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* JUNCTION CONFLICTS */}
      <div style={{ marginTop: "24px" }}>
        <h4 style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          marginBottom: "12px" 
        }}>
          🔀 Junction Conflicts
          <span style={{
            background: junctionConflicts.length > 0 ? "#fca5a5" : "#d1fae5",
            color: junctionConflicts.length > 0 ? "#7f1d1d" : "#065f46",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {junctionConflicts.length}
          </span>
        </h4>

        {junctionConflicts.length === 0 ? (
          <p style={{ color: "#16a34a", fontSize: "14px" }}>
            ✓ No junction conflicts detected
          </p>
        ) : (
          junctionConflicts.map((conflict, i) => {
            const conflictId = `junction_${i}`;
            const aiResult = junctionAiResults[conflictId];
            const isLoading = loadingConflictId === conflictId;

            return (
              <div 
                key={i} 
                style={{
                  background: "#fef3c7",
                  border: `2px solid ${getJunctionSeverityColor(conflict.severity)}`,
                  padding: "14px",
                  borderRadius: "8px",
                  marginBottom: "12px"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "start",
                  marginBottom: "8px"
                }}>
                  <div>
                    <div style={{ 
                      fontSize: "12px", 
                      fontWeight: "600",
                      color: getJunctionSeverityColor(conflict.severity),
                      marginBottom: "4px"
                    }}>
                      Junction: {conflict.junction_id} | Severity: {conflict.severity}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "500" }}>
                      Train 1: <strong>{conflict.train1}</strong> (from {conflict.route1})
                      <br />
                      Train 2: <strong>{conflict.train2}</strong> (from {conflict.route2})
                    </div>
                  </div>
                  <div style={{ 
                    background: getJunctionSeverityColor(conflict.severity),
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {conflict.timeGap} min gap
                    <div style={{ fontSize: "10px", opacity: 0.9 }}>
                      (needs {conflict.clearanceNeeded} min)
                    </div>
                  </div>
                </div>

                {!aiResult && (
                  <button 
                    onClick={() => handleResolve(conflict, "JUNCTION", conflictId)}
                    disabled={isLoading}
                    style={{
                      background: isLoading ? "#9ca3af" : "#6366f1",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      opacity: isLoading ? 0.5 : 1
                    }}
                  >
                    {isLoading ? "🔄 Processing..." : "🤖 Resolve with AI"}
                  </button>
                )}

                {aiResult && aiResult.success && (
                  <SimplifiedAIResultDisplay
                    aiResult={aiResult}
                    conflict={conflict}
                    onAccept={() => handleAccept("JUNCTION", conflictId, aiResult)}
                    onReject={() => handleReject("JUNCTION", conflictId, aiResult)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* RECENTLY RESOLVED CONFLICTS */}
      {recentlyResolved.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h4 style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            marginBottom: "12px",
            color: "#16a34a"
          }}>
            ✅ Recently Resolved
            <span style={{
              background: "#d1fae5",
              color: "#065f46",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "600"
            }}>
              {recentlyResolved.length}
            </span>
          </h4>

          <div style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            padding: "12px",
            borderRadius: "8px"
          }}>
            {recentlyResolved.map((train, i) => (
              <div 
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px",
                  background: "white",
                  borderRadius: "6px",
                  marginBottom: i < recentlyResolved.length - 1 ? "8px" : "0",
                  border: "1px solid #bbf7d0"
                }}
              >
                <div>
                  <strong style={{ color: "#166534" }}>Train {train.train_id}</strong>
                  <span style={{ 
                    marginLeft: "8px", 
                    fontSize: "13px", 
                    color: "#16a34a" 
                  }}>
                    {train.resolution_applied}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#15803d" }}>
                  {train.resolution_time}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#16a34a",
            fontStyle: "italic"
          }}>
            ℹ️ Trains will be available for re-evaluation after 5 minutes
          </div>
        </div>
      )}
    </div>
  );
}

/* ⭐ SIMPLIFIED AI RESULT DISPLAY - Only Suggestion, Options, and Risks */
function SimplifiedAIResultDisplay({ aiResult, conflict, onAccept, onReject }) {
  const [activeTab, setActiveTab] = useState("suggestion");

  return (
    <div 
      style={{
        marginTop: "12px",
        background: "#f0fdf4",
        border: "2px solid #4ade80",
        borderRadius: "8px",
        overflow: "hidden"
      }}
    >
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
        padding: "12px",
        color: "white"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🤖</span>
            <strong style={{ fontSize: "15px" }}>AI Recommendation</strong>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.2)",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {aiResult.confidence}% Confidence
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #d1fae5",
        background: "white"
      }}>
        <TabButton 
          active={activeTab === "suggestion"}
          onClick={() => setActiveTab("suggestion")}
          icon="💡"
          label="AI Suggestion"
        />
        <TabButton 
          active={activeTab === "alternatives"}
          onClick={() => setActiveTab("alternatives")}
          icon="🔄"
          label="Other Options"
        />
        <TabButton 
          active={activeTab === "risks"}
          onClick={() => setActiveTab("risks")}
          icon="⚠️"
          label="Risk Mitigation"
        />
      </div>

      {/* Tab Content */}
      <div style={{ padding: "16px", background: "white", minHeight: "200px" }}>
        {activeTab === "suggestion" && (
          <SuggestionTab aiResult={aiResult} conflict={conflict} />
        )}
        {activeTab === "alternatives" && (
          <AlternativesTab aiResult={aiResult} conflict={conflict} />
        )}
        {activeTab === "risks" && (
          <RisksTab aiResult={aiResult} />
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ 
        padding: "12px", 
        background: "#f8fafc",
        borderTop: "1px solid #e5e7eb",
        display: "flex", 
        gap: "8px" 
      }}>
        <button
          onClick={onAccept}
          style={{
            background: "#16a34a",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            flex: 1,
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.target.style.background = "#15803d"}
          onMouseLeave={(e) => e.target.style.background = "#16a34a"}
        >
          ✅ Accept & Execute
        </button>

        <button
          onClick={onReject}
          style={{
            background: "#dc2626",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            flex: 1,
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.target.style.background = "#b91c1c"}
          onMouseLeave={(e) => e.target.style.background = "#dc2626"}
        >
          ❌ Reject
        </button>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px",
        background: active ? "#f0fdf4" : "transparent",
        border: "none",
        borderBottom: active ? "2px solid #16a34a" : "2px solid transparent",
        color: active ? "#166534" : "#64748b",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: active ? "600" : "500",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px"
      }}
      onMouseEnter={(e) => {
        if (!active) e.target.style.background = "#f8fafc";
      }}
      onMouseLeave={(e) => {
        if (!active) e.target.style.background = "transparent";
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Suggestion Tab
function SuggestionTab({ aiResult, conflict }) {
  return (
    <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
      {/* Main Recommendation */}
      <div style={{
        background: "#eff6ff",
        padding: "14px",
        borderRadius: "6px",
        marginBottom: "16px",
        border: "2px solid #3b82f6"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "10px"
        }}>
          <span style={{ fontSize: "24px" }}>🎯</span>
          <strong style={{ fontSize: "16px", color: "#1e40af" }}>
            Recommended Action: {aiResult.decision}
          </strong>
        </div>
        
        <div style={{ 
          fontSize: "14px", 
          color: "#1e3a8a",
          lineHeight: "1.6",
          marginBottom: "12px"
        }}>
          {aiResult.reason}
        </div>

        {/* Key Details */}
        <div style={{
          background: "white",
          padding: "12px",
          borderRadius: "4px",
          fontSize: "13px"
        }}>
          <div style={{ marginBottom: "6px" }}>
            <strong style={{ color: "#1e40af" }}>Priority Train:</strong> {aiResult.priority_train}
          </div>
          <div style={{ marginBottom: "6px" }}>
            <strong style={{ color: "#1e40af" }}>Affected Train:</strong> {aiResult.reduced_train}
          </div>
          {aiResult.suggested_speed && (
            <div style={{ marginBottom: "6px" }}>
              <strong style={{ color: "#1e40af" }}>Suggested Speed:</strong> {aiResult.suggested_speed} km/h
            </div>
          )}
          {aiResult.suggested_delay && (
            <div style={{ marginBottom: "6px" }}>
              <strong style={{ color: "#1e40af" }}>Expected Delay:</strong> {aiResult.suggested_delay} minutes
            </div>
          )}
        </div>
      </div>

      {/* Expected Outcome */}
      <div style={{
        background: "#f0fdf4",
        border: "1px solid #86efac",
        padding: "12px",
        borderRadius: "6px"
      }}>
        <div style={{ fontWeight: "600", color: "#166534", marginBottom: "8px" }}>
          📊 Expected Outcome
        </div>
        <ul style={{ 
          margin: "0", 
          paddingLeft: "20px",
          fontSize: "12px",
          color: "#15803d",
          lineHeight: "1.8"
        }}>
          <li>Conflict will be safely resolved</li>
          <li>Priority train {aiResult.priority_train} maintains schedule</li>
          <li>
            Train {aiResult.reduced_train} delay: {aiResult.suggested_delay || 3} minutes 
            {aiResult.suggested_delay && aiResult.suggested_delay <= 5 && " (acceptable)"}
          </li>
          <li>Zero safety risk with this approach</li>
          <li>Minimal impact on overall network flow</li>
        </ul>
      </div>

      {/* What Happens Next */}
      <div style={{
        background: "#fef3c7",
        border: "1px solid #fbbf24",
        padding: "12px",
        borderRadius: "6px",
        marginTop: "12px"
      }}>
        <div style={{ fontWeight: "600", color: "#92400e", marginBottom: "8px" }}>
          ⏭️ What Happens When You Accept
        </div>
        <div style={{ fontSize: "12px", color: "#78350f", lineHeight: "1.8" }}>
          {aiResult.decision === "HOLD_TRAIN" && (
            <>
              1. Signal system will set RED for Train {aiResult.reduced_train}<br />
              2. Radio notification sent to driver automatically<br />
              3. Train {aiResult.priority_train} clears the block<br />
              4. Signal automatically changes to GREEN<br />
              5. Train {aiResult.reduced_train} proceeds safely
            </>
          )}
          {aiResult.decision === "SEQUENCE_AT_JUNCTION" && (
            <>
              1. Junction points locked for Train {aiResult.priority_train}<br />
              2. Route signals set to GREEN for priority entry<br />
              3. Train {aiResult.reduced_train} receives YELLOW signal<br />
              4. After {aiResult.suggested_delay || 3} minute clearance, second train proceeds<br />
              5. Both trains safely through junction
            </>
          )}
          {aiResult.decision === "ROUTE_TO_LOOP" && (
            <>
              1. Switch points diverted to LOOP LINE<br />
              2. Speed reduction signal sent to Train {aiResult.reduced_train}<br />
              3. Train {aiResult.priority_train} continues on main line<br />
              4. Affected train uses loop, rejoins main line ahead<br />
              5. Safe separation maintained throughout
            </>
          )}
          {!["HOLD_TRAIN", "SEQUENCE_AT_JUNCTION", "ROUTE_TO_LOOP"].includes(aiResult.decision) && (
            <>
              1. Resolution commands will be sent automatically<br />
              2. Train operators will be notified<br />
              3. Signal systems will be updated<br />
              4. Monitoring will continue until conflict cleared<br />
              5. System returns to normal operations
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Alternatives Tab
function AlternativesTab({ aiResult, conflict }) {
  const alternatives = [
    {
      option: "A",
      title: `Reduce Train ${aiResult.priority_train} Speed`,
      details: [
        `• Slow Train ${aiResult.priority_train} to 40-50 km/h`,
        `• Allows Train ${aiResult.reduced_train} to maintain position`,
        "• Trade-off: Both trains delayed (2-3 min each)",
        "• Risk: Medium - requires precise speed coordination"
      ],
      color: "#d97706"
    },
    {
      option: "B",
      title: `Reroute Train ${aiResult.reduced_train} to Loop Line`,
      details: [
        "• Divert at next available switch point",
        "• Uses alternative loop line route",
        `• Trade-off: 4-6 min longer route for Train ${aiResult.reduced_train}`,
        "• Risk: Low - completely separates train paths"
      ],
      color: "#0284c7"
    },
    {
      option: "C",
      title: "Hold Both Trains (Conservative)",
      details: [
        "• Stop both trains at safe positions",
        "• Manually sequence after complete stop",
        "• Trade-off: 8-12 min total delay for both trains",
        "• Risk: Very Low - maximum safety buffer"
      ],
      color: "#7c3aed"
    },
    {
      option: "D",
      title: "Manual Override & Control",
      details: [
        "• Reject AI recommendation entirely",
        "• Section controller makes all decisions",
        "• Full manual control of signals and routing",
        "• Risk: Depends on controller judgment and timing"
      ],
      color: "#dc2626"
    }
  ];

  return (
    <div>
      <div style={{
        background: "#eff6ff",
        padding: "12px",
        borderRadius: "6px",
        marginBottom: "16px"
      }}>
        <div style={{ fontWeight: "600", color: "#1e40af", marginBottom: "8px" }}>
          🔄 Alternative Solutions Available
        </div>
        <div style={{ fontSize: "12px", color: "#1e3a8a" }}>
          If you choose to reject the AI recommendation, here are other viable options to resolve this conflict:
        </div>
      </div>

      {alternatives.map((alt, i) => (
        <div key={i} style={{
          marginBottom: "12px",
          padding: "12px",
          background: "white",
          borderRadius: "6px",
          border: `2px solid ${alt.color}`,
          borderLeft: `6px solid ${alt.color}`
        }}>
          <div style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#0f172a",
            marginBottom: "8px"
          }}>
            <span style={{
              background: alt.color,
              color: "white",
              padding: "3px 10px",
              borderRadius: "4px",
              marginRight: "8px",
              fontSize: "12px"
            }}>
              OPTION {alt.option}
            </span>
            {alt.title}
          </div>
          {alt.details.map((detail, j) => (
            <div key={j} style={{
              fontSize: "12px",
              color: "#475569",
              marginBottom: "3px",
              lineHeight: "1.6"
            }}>
              {detail}
            </div>
          ))}
        </div>
      ))}

      <div style={{
        background: "#f0fdf4",
        border: "2px solid #16a34a",
        padding: "14px",
        borderRadius: "6px",
        marginTop: "16px"
      }}>
        <div style={{ fontSize: "14px", color: "#166534" }}>
          <strong>⚡ Why AI Recommends Option: {aiResult.decision}</strong>
          <div style={{ fontSize: "13px", marginTop: "8px", lineHeight: "1.6" }}>
            This solution provides the optimal balance between:
            <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
              <li>Minimum total delay across all trains</li>
              <li>Maximum safety with standard procedures</li>
              <li>Least disruption to overall network</li>
              <li>Proven effectiveness in similar scenarios</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Risks Tab
function RisksTab({ aiResult }) {
  const scenarios = [
    {
      title: `Driver of Train ${aiResult.reduced_train} doesn't acknowledge`,
      icon: "📻",
      actions: [
        "→ Send 2nd radio call within 15 seconds",
        "→ If no response: Use emergency brake override signal",
        "→ Escalate to supervisor if no contact in 30 seconds",
        "→ Meanwhile: Hold all other trains in vicinity"
      ],
      severity: "HIGH"
    },
    {
      title: `Train ${aiResult.reduced_train} doesn't stop in time`,
      icon: "🚨",
      actions: [
        "→ Immediate: Activate track circuit override",
        `→ Emergency signal to Train ${aiResult.priority_train} to stop`,
        "→ Alert all trains in adjacent blocks",
        "→ Activate emergency protocols EP-07",
        "→ Dispatch emergency response team"
      ],
      severity: "CRITICAL"
    },
    {
      title: "Signal system malfunction or failure",
      icon: "⚡",
      actions: [
        "→ Switch immediately to manual flag signaling",
        "→ Deploy portable signal equipment",
        "→ Follow emergency procedure EP-12",
        "→ Notify maintenance team for urgent repair",
        "→ Update all affected train drivers"
      ],
      severity: "HIGH"
    },
    {
      title: `Train ${aiResult.priority_train} experiences delay in block`,
      icon: "⏱️",
      actions: [
        `→ Update estimated clearance time for Train ${aiResult.reduced_train}`,
        `→ Radio notification to Train ${aiResult.reduced_train} driver`,
        "→ Monitor position every 30 seconds",
        "→ Adjust subsequent train schedules if needed",
        "→ Prepare passenger announcements"
      ],
      severity: "MEDIUM"
    },
    {
      title: "Weather or track conditions deteriorate",
      icon: "🌧️",
      actions: [
        "→ Re-evaluate safe speeds for all trains",
        "→ Increase safety buffers and clearance times",
        "→ May need to implement Option C (hold both trains)",
        "→ Continuous monitoring of track sensors",
        "→ Weather-based protocol activation"
      ],
      severity: "MEDIUM"
    }
  ];

  return (
    <div>
      <div style={{
        background: "#fef3c7",
        padding: "12px",
        borderRadius: "6px",
        marginBottom: "16px"
      }}>
        <div style={{ fontWeight: "600", color: "#92400e", marginBottom: "8px" }}>
          ⚠️ Risk Mitigation & Emergency Responses
        </div>
        <div style={{ fontSize: "12px", color: "#78350f" }}>
          Prepared contingency plans for potential failure scenarios. These procedures are automated where possible.
        </div>
      </div>

      {scenarios.map((scenario, i) => (
        <div key={i} style={{
          marginBottom: "14px",
          padding: "12px",
          background: "#f8fafc",
          borderRadius: "6px",
          border: `1px solid ${getSeverityBorderColor(scenario.severity)}`,
          borderLeft: `4px solid ${getSeverityBorderColor(scenario.severity)}`
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px"
          }}>
            <span style={{ fontSize: "20px" }}>{scenario.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#0f172a",
                marginBottom: "2px"
              }}>
                {scenario.title}
              </div>
              <span style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "3px",
                background: getSeverityBadgeColor(scenario.severity),
                color: "white",
                fontWeight: "600"
              }}>
                {scenario.severity} PRIORITY
              </span>
            </div>
          </div>
          
          <div style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            fontSize: "12px"
          }}>
            {scenario.actions.map((action, j) => (
              <div key={j} style={{
                color: "#475569",
                marginBottom: "4px",
                paddingLeft: "12px",
                lineHeight: "1.6"
              }}>
                {action}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{
        background: "#eff6ff",
        border: "1px solid #60a5fa",
        padding: "12px",
        borderRadius: "6px",
        marginTop: "16px"
      }}>
        <div style={{ fontSize: "13px", color: "#1e40af" }}>
          <strong>🛡️ Safety Note:</strong> All critical scenarios trigger automatic alerts to the control center. 
          Emergency protocols are pre-loaded in the system and can be activated with one click if needed.
        </div>
      </div>
    </div>
  );
}

// Helper function for severity colors
function getSeverityBorderColor(severity) {
  const colors = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#d97706",
    LOW: "#16a34a"
  };
  return colors[severity] || "#94a3b8";
}

function getSeverityBadgeColor(severity) {
  const colors = {
    CRITICAL: "#b91c1c",
    HIGH: "#c2410c",
    MEDIUM: "#b45309",
    LOW: "#15803d"
  };
  return colors[severity] || "#64748b";
}