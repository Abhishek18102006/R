// src/components/Conflicts.jsx (COMPLETE REPLACEMENT)
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

  // Track previous conflict counts to detect new conflicts
  const [prevConflictCounts, setPrevConflictCounts] = useState({
    block: 0,
    loop: 0,
    junction: 0
  });

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
          // Only count NEW conflicts (increment by difference)
          const newBlockConflicts = Math.max(0, blockConflicts.length - prevConflictCounts.block);
          const newLoopConflicts = Math.max(0, loopConflicts.length - prevConflictCounts.loop);
          const newJunctionConflicts = Math.max(0, junctionConflictsData.length - prevConflictCounts.junction);
          
          if (newBlockConflicts > 0) {
            onUpdateConflictCounts('block', newBlockConflicts);
          }
          if (newLoopConflicts > 0) {
            onUpdateConflictCounts('loop', newLoopConflicts);
          }
          if (newJunctionConflicts > 0) {
            onUpdateConflictCounts('junction', newJunctionConflicts);
          }
          
          // Update previous counts
          setPrevConflictCounts({
            block: blockConflicts.length,
            loop: loopConflicts.length,
            junction: junctionConflictsData.length
          });
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
              <ConflictCard
                key={i}
                conflict={conflict}
                conflictId={conflictId}
                conflictType="SAME_BLOCK"
                aiResult={aiResult}
                isLoading={isLoading}
                onResolve={() => handleResolve(conflict, "SAME_BLOCK", conflictId)}
                onAccept={() => handleAccept("SAME_BLOCK", conflictId, aiResult)}
                onReject={() => handleReject("SAME_BLOCK", conflictId, aiResult)}
                getSeverityColor={getSeverityColor}
              />
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
              <ConflictCard
                key={i}
                conflict={conflict}
                conflictId={conflictId}
                conflictType="LOOP_LINE"
                aiResult={aiResult}
                isLoading={isLoading}
                onResolve={() => handleResolve(conflict, "LOOP_LINE", conflictId)}
                onAccept={() => handleAccept("LOOP_LINE", conflictId, aiResult)}
                onReject={() => handleReject("LOOP_LINE", conflictId, aiResult)}
                getSeverityColor={() => "#60a5fa"}
              />
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
              <ConflictCard
                key={i}
                conflict={conflict}
                conflictId={conflictId}
                conflictType="JUNCTION"
                aiResult={aiResult}
                isLoading={isLoading}
                onResolve={() => handleResolve(conflict, "JUNCTION", conflictId)}
                onAccept={() => handleAccept("JUNCTION", conflictId, aiResult)}
                onReject={() => handleReject("JUNCTION", conflictId, aiResult)}
                getSeverityColor={getJunctionSeverityColor}
              />
            );
          })
        )}
      </div>

      {/* RECENTLY RESOLVED */}
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
        </div>
      )}
    </div>
  );
}

/* ================================================================
   CONFLICT CARD COMPONENT
   ================================================================ */
function ConflictCard({ 
  conflict, 
  conflictId, 
  conflictType, 
  aiResult, 
  isLoading, 
  onResolve, 
  onAccept, 
  onReject,
  getSeverityColor 
}) {
  const [selectedAlternative, setSelectedAlternative] = useState(null);

  const severityColor = conflict.severity 
    ? getSeverityColor(conflict.severity) 
    : "#60a5fa";

  return (
    <div 
      style={{
        background: "#fef2f2",
        border: `2px solid ${severityColor}`,
        padding: "14px",
        borderRadius: "8px",
        marginBottom: "12px"
      }}
    >
      {/* Conflict Info */}
      <ConflictInfo conflict={conflict} conflictType={conflictType} severityColor={severityColor} />

      {/* Resolve Button */}
      {!aiResult && (
        <button 
          onClick={onResolve}
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

      {/* AI Result Display */}
      {aiResult && aiResult.success && (
        <AIResultDisplay
          aiResult={aiResult}
          selectedAlternative={selectedAlternative}
          setSelectedAlternative={setSelectedAlternative}
          onAccept={onAccept}
          onReject={onReject}
        />
      )}
    </div>
  );
}

/* ================================================================
   CONFLICT INFO
   ================================================================ */
function ConflictInfo({ conflict, conflictType, severityColor }) {
  if (conflictType === "SAME_BLOCK") {
    return (
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "12px", fontWeight: "600", color: severityColor }}>
          Block: {conflict.block_id} | Severity: {conflict.severity}
        </div>
        <div style={{ fontSize: "14px", fontWeight: "500" }}>
          Train A: <strong>{conflict.trainA}</strong> ↔ Train B: <strong>{conflict.trainB}</strong>
        </div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
          Time Gap: {conflict.timeDiff} minutes
        </div>
      </div>
    );
  } else if (conflictType === "LOOP_LINE") {
    return (
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "12px", fontWeight: "600", color: severityColor }}>
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
    );
  } else if (conflictType === "JUNCTION") {
    return (
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "12px", fontWeight: "600", color: severityColor }}>
          Junction: {conflict.junction_id} | Severity: {conflict.severity}
        </div>
        <div style={{ fontSize: "14px", fontWeight: "500" }}>
          Train 1: <strong>{conflict.train1}</strong> (from {conflict.route1})
          <br />
          Train 2: <strong>{conflict.train2}</strong> (from {conflict.route2})
        </div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
          Time Gap: {conflict.timeGap} min (needs {conflict.clearanceNeeded} min)
        </div>
      </div>
    );
  }
  
  return null;
}

/* ================================================================
   AI RESULT DISPLAY WITH ALTERNATIVES
   ================================================================ */
function AIResultDisplay({ aiResult, selectedAlternative, setSelectedAlternative, onAccept, onReject }) {
  const [activeTab, setActiveTab] = useState("recommendation");

  // Determine which resolution to execute
  const resolutionToExecute = selectedAlternative || aiResult;

  return (
    <div style={{
      marginTop: "12px",
      background: "#f0fdf4",
      border: "2px solid #4ade80",
      borderRadius: "8px",
      overflow: "hidden"
    }}>
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
            <strong style={{ fontSize: "15px" }}>
              {selectedAlternative ? `Alternative ${selectedAlternative.option} Selected` : "AI Recommendation"}
            </strong>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.2)",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            {resolutionToExecute.confidence}% Confidence
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
          active={activeTab === "recommendation"}
          onClick={() => setActiveTab("recommendation")}
          icon="💡"
          label="AI Recommendation"
        />
        {aiResult.alternatives && aiResult.alternatives.length > 0 && (
          <TabButton 
            active={activeTab === "alternatives"}
            onClick={() => setActiveTab("alternatives")}
            icon="🔄"
            label={`Alternatives (${aiResult.alternatives.length})`}
          />
        )}
      </div>

      {/* Tab Content */}
      <div style={{ padding: "16px", background: "white", minHeight: "150px" }}>
        {activeTab === "recommendation" && (
          <RecommendationTab aiResult={aiResult} />
        )}
        {activeTab === "alternatives" && (
          <AlternativesTab 
            aiResult={aiResult}
            selectedAlternative={selectedAlternative}
            setSelectedAlternative={setSelectedAlternative}
          />
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
          onClick={() => onAccept()}
          style={{
            background: "#16a34a",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            flex: 1
          }}
        >
          ✅ Execute {selectedAlternative ? `Alternative ${selectedAlternative.option}` : "AI Recommendation"}
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
            flex: 1
          }}
        >
          ❌ Reject
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   TAB COMPONENTS
   ================================================================ */
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px"
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function RecommendationTab({ aiResult }) {
  // Get detailed action steps based on decision type
  const getActionSteps = () => {
    switch(aiResult.decision) {
      case "SEQUENCE_AT_JUNCTION":
        return [
          `🔒 Lock junction points for Train ${aiResult.priority_train}`,
          `🟢 Set GREEN signal for Train ${aiResult.priority_train} to enter junction`,
          `🟡 Set YELLOW signal for Train ${aiResult.reduced_train} - hold at approach`,
          `⏱️ Train ${aiResult.reduced_train} waits ${aiResult.suggested_delay || 3} minutes for clearance`,
          `✅ After clearance: GREEN signal to Train ${aiResult.reduced_train}`,
          `📡 Radio notifications sent to both train drivers`
        ];
      
      case "HOLD_TRAIN":
        return [
          `🔴 Set RED signal immediately for Train ${aiResult.reduced_train}`,
          `📻 Send radio notification: "Stop at next signal - priority conflict"`,
          `🟢 Train ${aiResult.priority_train} proceeds normally`,
          `⏱️ Train ${aiResult.reduced_train} holds until block is clear`,
          `⏲️ Estimated hold time: ${aiResult.suggested_delay || 5} minutes`,
          `✅ Once clear: Signal changes to GREEN automatically`
        ];
      
      case "HOLD_BOTH_TRAINS":
        return [
          `🔴 Set RED signal for Train ${aiResult.priority_train}`,
          `🔴 Set RED signal for Train ${aiResult.reduced_train}`,
          `📻 Radio notification to both drivers: "Hold for manual sequencing"`,
          `⏱️ Both trains stop at safe positions`,
          `👤 Section controller manually sequences after full stop`,
          `🟢 Train ${aiResult.priority_train} proceeds first (higher priority)`,
          `⏲️ Total delay: ~${aiResult.suggested_delay || 10} minutes for both trains`
        ];
      
      case "REDUCE_SPEED":
        return [
          `📉 Speed restriction signal sent to Train ${aiResult.reduced_train}`,
          `🎯 Target speed: ${aiResult.suggested_speed} km/h`,
          `📻 Radio: "Reduce speed to ${aiResult.suggested_speed} km/h - conflict resolution"`,
          `📊 Track sensors monitor compliance`,
          `🟢 Train ${aiResult.priority_train} maintains current speed`,
          `⏱️ Expected delay: ${aiResult.suggested_delay || 3} minutes`,
          `✅ Speed restriction lifted once separation is safe`
        ];
      
      case "ROUTE_TO_LOOP":
        return [
          `🔀 Lock switch points for loop line diversion`,
          `📻 Radio to Train ${aiResult.reduced_train}: "Divert to loop line ahead"`,
          `🟡 YELLOW signal at switch point`,
          `➡️ Train ${aiResult.reduced_train} takes loop line route`,
          `🟢 Train ${aiResult.priority_train} continues on main line`,
          `⏱️ Loop line adds ${aiResult.suggested_delay || 5} minutes to journey`,
          `🔄 Train rejoins main line at next junction`
        ];
      
      case "SPEED_ADJUSTMENT":
        return [
          `📉 Reduce Train ${aiResult.reduced_train} to ${aiResult.suggested_speed} km/h`,
          `📻 Radio notification sent to driver`,
          `📊 Continuous speed monitoring via track sensors`,
          `🟢 Train ${aiResult.priority_train} maintains schedule`,
          `⏱️ Speed reduction for ${Math.ceil((aiResult.suggested_delay || 3) * 2)} minutes`,
          `✅ Normal speed restored after safe separation achieved`
        ];
      
      case "REVERSE_PRIORITY":
        return [
          `⚠️ Priority reversal initiated`,
          `🟡 YELLOW signal to Train ${aiResult.reduced_train} (now priority)`,
          `🔴 RED signal to Train ${aiResult.priority_train} (now delayed)`,
          `📻 Radio: "Priority change - Train ${aiResult.reduced_train} proceeds first"`,
          `⏱️ Train ${aiResult.priority_train} holds for ${aiResult.suggested_delay || 3} minutes`,
          `✅ Proceed after Train ${aiResult.reduced_train} clears`
        ];
      
      default:
        return [
          `🎯 Resolution action: ${aiResult.decision}`,
          `📻 Radio notifications sent to affected trains`,
          `🚦 Signal system updated automatically`,
          `⏱️ Estimated time to resolution: ${aiResult.suggested_delay || 3} minutes`
        ];
    }
  };

  const actionSteps = getActionSteps();

  return (
    <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
      {/* Main Decision Box */}
      <div style={{
        background: "#eff6ff",
        padding: "16px",
        borderRadius: "6px",
        marginBottom: "16px",
        border: "2px solid #3b82f6"
      }}>
        <div style={{
          fontSize: "18px",
          fontWeight: "700",
          color: "#1e40af",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "24px" }}>🎯</span>
          {aiResult.decision.replace(/_/g, ' ')}
        </div>
        
        <div style={{ fontSize: "14px", color: "#1e3a8a", marginBottom: "12px", lineHeight: "1.6" }}>
          {aiResult.reason}
        </div>

        {/* Key Details Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "12px",
          marginTop: "12px"
        }}>
          <div style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #bfdbfe"
          }}>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
              PRIORITY TRAIN
            </div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#16a34a" }}>
              {aiResult.priority_train}
            </div>
            <div style={{ fontSize: "11px", color: "#15803d", marginTop: "2px" }}>
              ✓ Proceeds normally
            </div>
          </div>

          <div style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #bfdbfe"
          }}>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
              AFFECTED TRAIN
            </div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#dc2626" }}>
              {aiResult.reduced_train}
            </div>
            <div style={{ fontSize: "11px", color: "#b91c1c", marginTop: "2px" }}>
              ⏱️ Delay: {aiResult.suggested_delay || 3} min
            </div>
          </div>

          {aiResult.suggested_speed !== undefined && (
            <div style={{
              background: "white",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #bfdbfe"
            }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                SPEED LIMIT
              </div>
              <div style={{ fontSize: "15px", fontWeight: "600", color: "#d97706" }}>
                {aiResult.suggested_speed} km/h
              </div>
              <div style={{ fontSize: "11px", color: "#92400e", marginTop: "2px" }}>
                For Train {aiResult.reduced_train}
              </div>
            </div>
          )}

          <div style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #bfdbfe"
          }}>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
              CONFIDENCE
            </div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#7c3aed" }}>
              {aiResult.confidence}%
            </div>
            <div style={{ fontSize: "11px", color: "#6b21a8", marginTop: "2px" }}>
              AI certainty level
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Action Steps */}
      <div style={{
        background: "#f0fdf4",
        border: "1px solid #86efac",
        padding: "14px",
        borderRadius: "6px",
        marginBottom: "12px"
      }}>
        <div style={{ 
          fontWeight: "600", 
          color: "#166534", 
          marginBottom: "10px",
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "18px" }}>⚙️</span>
          Execution Sequence
        </div>
        <div style={{
          background: "white",
          padding: "12px",
          borderRadius: "4px",
          border: "1px solid #bbf7d0"
        }}>
          {actionSteps.map((step, index) => (
            <div 
              key={index}
              style={{
                display: "flex",
                alignItems: "start",
                gap: "10px",
                marginBottom: index < actionSteps.length - 1 ? "10px" : "0",
                paddingBottom: index < actionSteps.length - 1 ? "10px" : "0",
                borderBottom: index < actionSteps.length - 1 ? "1px dashed #d1fae5" : "none"
              }}
            >
              <div style={{
                background: "#16a34a",
                color: "white",
                minWidth: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: "600"
              }}>
                {index + 1}
              </div>
              <div style={{ flex: 1, color: "#15803d", fontSize: "13px", paddingTop: "2px" }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expected Outcome */}
      <div style={{
        background: "#fef3c7",
        border: "1px solid #fbbf24",
        padding: "12px",
        borderRadius: "6px"
      }}>
        <div style={{ fontWeight: "600", color: "#92400e", marginBottom: "8px", fontSize: "13px" }}>
          📊 Expected Outcome
        </div>
        <ul style={{ 
          margin: "0", 
          paddingLeft: "20px",
          fontSize: "12px",
          color: "#78350f",
          lineHeight: "1.8"
        }}>
          <li>Conflict will be safely resolved within {aiResult.suggested_delay || 3} minutes</li>
          <li>Train {aiResult.priority_train} maintains schedule (0 min delay)</li>
          <li>Train {aiResult.reduced_train} delay: {aiResult.suggested_delay || 3} minutes</li>
          <li>Zero safety risk - full signal and track protection active</li>
          <li>Minimal impact on following trains in the network</li>
          <li>Automated monitoring continues until conflict cleared</li>
        </ul>
      </div>
    </div>
  );
}

function AlternativesTab({ aiResult, selectedAlternative, setSelectedAlternative }) {
  if (!aiResult.alternatives || aiResult.alternatives.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
        No alternatives available for this conflict type
      </div>
    );
  }

  return (
    <div>
      <div style={{
        background: "#eff6ff",
        padding: "12px",
        borderRadius: "6px",
        marginBottom: "16px"
      }}>
        <div style={{ fontSize: "13px", color: "#1e3a8a" }}>
          Click any alternative to select it, then use "Execute" button to apply it.
        </div>
      </div>

      {aiResult.alternatives.map((alt, i) => (
        <AlternativeOption
          key={i}
          alternative={alt}
          isSelected={selectedAlternative?.option === alt.option}
          onClick={() => setSelectedAlternative(alt)}
        />
      ))}
    </div>
  );
}

function AlternativeOption({ alternative, isSelected, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        marginBottom: "12px",
        padding: "12px",
        background: isSelected ? "#f0fdf4" : "white",
        borderRadius: "6px",
        border: `2px solid ${isSelected ? "#16a34a" : alternative.color}`,
        borderLeft: `6px solid ${alternative.color}`,
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px"
      }}>
        <div style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#0f172a"
        }}>
          <span style={{
            background: alternative.color,
            color: "white",
            padding: "3px 10px",
            borderRadius: "4px",
            fontSize: "12px",
            marginRight: "8px"
          }}>
            {alternative.option}
          </span>
          {alternative.title}
        </div>
        
        {isSelected && (
          <span style={{
            background: "#16a34a",
            color: "white",
            padding: "4px 8px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: "600"
          }}>
            SELECTED
          </span>
        )}
      </div>

      <div style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>
        {alternative.reason}
      </div>

      <div style={{
        display: "flex",
        gap: "16px",
        fontSize: "12px",
        color: "#64748b"
      }}>
        <span><strong>Trade-off:</strong> {alternative.tradeoff}</span>
        <span><strong>Risk:</strong> {alternative.risk}</span>
        <span><strong>Confidence:</strong> {alternative.confidence}%</span>
      </div>
    </div>
  );
}