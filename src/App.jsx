// src/App.jsx (COMPLETE REPLACEMENT - WITH CASCADING CONFLICT DETECTION)
import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./components/Dashboard";
import Layout from "./components/Layout";
import ConflictResolution from "./pages/ConflictResolution";
import HistoryPage from "./pages/HistoryPage";
import PerformancePage from "./pages/PerformancePage";
import { timeToMinutes } from "./utils/time";
import { detectBlockConflicts } from "./utils/blockConflictDetector";
import { detectLoopLineConflicts } from "./utils/loopLineDetector";
import { detectJunctionConflicts } from "./utils/junctionConflictDetector";

function App() {
  const [user, setUser] = useState(null);
  const [trains, setTrains] = useState([]);
  const [page, setPage] = useState("dashboard");
  
  const [history, setHistory] = useState([]);
  
  const [performanceData, setPerformanceData] = useState({
    totalConflictsDetected: 0,
    totalConflictsResolved: 0,
    totalConflictsRejected: 0,
    averageResolutionTime: 0,
    totalTrainsCleared: 0,
    aiAccuracyRate: 85,
    totalDelayReduced: 0,
    blockConflictsDetected: 0,
    blockConflictsResolved: 0,
    loopConflictsDetected: 0,
    loopConflictsResolved: 0,
    junctionConflictsDetected: 0,
    junctionConflictsResolved: 0,
    resolutionHistory: []
  });

  // ⭐ NEW: Track cascading conflicts (conflicts created by AI resolutions)
  const [showOnlyNewConflicts, setShowOnlyNewConflicts] = useState(false);
  const [newConflictIds, setNewConflictIds] = useState(new Set());
  const [cascadingNotification, setCascadingNotification] = useState(null);

  useEffect(() => {
    console.log("📊 Current State:", {
      trains: trains.length,
      history: history.length,
      page,
      performanceData,
      showOnlyNewConflicts,
      newConflictIds: newConflictIds.size
    });
  }, [trains, history, page, performanceData, showOnlyNewConflicts, newConflictIds]);

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (cascadingNotification) {
      const timer = setTimeout(() => {
        setCascadingNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [cascadingNotification]);

  function handleClearTrain(trainId) {
    const train = trains.find(t => t.train_id === trainId);
    if (!train) {
      console.error(`❌ Train ${trainId} not found`);
      return;
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });

    console.log(`✅ Clearing train ${trainId} from junction at ${timeString}`);

    const historyRecord = {
      ...train,
      clearedAt: timeString,
      clearedDate: now.toLocaleDateString(),
      status: train.status === "RESOLVED" ? "RESOLVED" : "CLEARED"
    };

    setHistory(prev => {
      const updated = [historyRecord, ...prev];
      console.log(`📜 History updated. Total records: ${updated.length}`);
      return updated;
    });

    setTrains(prev => {
      const updated = prev.filter(t => t.train_id !== trainId);
      console.log(`🚂 Active trains updated. Remaining: ${updated.length}`);
      return updated;
    });

    setPerformanceData(prev => ({
      ...prev,
      totalTrainsCleared: prev.totalTrainsCleared + 1
    }));

    console.log(`✅ Train ${trainId} cleared successfully`);
  }

  function handleAcceptResolution(trainId, resolutionDetails = {}) {
    console.log(`✅ Accepting AI resolution for train ${trainId}`, resolutionDetails);
    
    const startTime = performance.now();
    
    setTrains(prev => {
      const updatedTrains = prev.map(t => {
        if (t.train_id === resolutionDetails.reduced_train) {
          const originalArrival = t.arrival || timeToMinutes(t.arrival_time);
          let newDelay = t.delay || 0;
          
          if (resolutionDetails.suggested_delay) {
            newDelay += resolutionDetails.suggested_delay;
          }
          
          if (resolutionDetails.delayReduction) {
            newDelay = Math.max(0, newDelay - resolutionDetails.delayReduction);
          }
          
          const newArrival = originalArrival + newDelay;
          
          const updatedTrain = {
            ...t,
            status: "RESOLVED",
            conflict: false,
            conflict_reason: `Resolved: ${resolutionDetails.decision}`,
            max_speed: resolutionDetails.suggested_speed || t.max_speed,
            delay: newDelay,
            arrival: newArrival,
            resolution_applied: resolutionDetails.decision,
            resolution_time: new Date().toLocaleTimeString(),
            resolved_at: Date.now()
          };
          
          console.log(`🔄 Updated train ${t.train_id}:`, {
            old_speed: t.max_speed,
            new_speed: updatedTrain.max_speed,
            old_delay: t.delay,
            new_delay: updatedTrain.delay,
            old_arrival: originalArrival,
            new_arrival: newArrival,
            resolution: resolutionDetails.decision
          });
          
          return updatedTrain;
        }
        
        if (t.train_id === resolutionDetails.priority_train) {
          return {
            ...t,
            status: "ON TIME",
            conflict: false,
            conflict_reason: null,
            resolved_at: Date.now()
          };
        }
        
        return t;
      });

      // ⭐ CRITICAL: RE-DETECT CONFLICTS AFTER RESOLUTION
      console.log("🔍 RE-DETECTING conflicts after resolution...");
      
      // Filter out recently resolved trains from conflict detection
      const trainsToCheck = updatedTrains.filter(t => 
        t.status !== "RESOLVED" || 
        !t.resolved_at || 
        (Date.now() - t.resolved_at) > 5000 // Only exclude if resolved within last 5 seconds
      );
      
      console.log(`🔍 Checking ${trainsToCheck.length} trains (excluding ${updatedTrains.length - trainsToCheck.length} recently resolved)`);
      
      const newBlockConflicts = detectBlockConflicts(trainsToCheck);
      const newLoopConflicts = detectLoopLineConflicts(trainsToCheck);
      const newJunctionConflicts = detectJunctionConflicts(trainsToCheck);
      
      // Filter out conflicts involving the trains we just resolved
      const justResolvedTrainIds = [resolutionDetails.priority_train, resolutionDetails.reduced_train];
      
      const filteredBlockConflicts = newBlockConflicts.filter(c => 
        !justResolvedTrainIds.includes(c.trainA) && !justResolvedTrainIds.includes(c.trainB)
      );
      
      const filteredLoopConflicts = newLoopConflicts.filter(c => 
        !justResolvedTrainIds.includes(c.leadingTrain) && !justResolvedTrainIds.includes(c.followingTrain)
      );
      
      const filteredJunctionConflicts = newJunctionConflicts.filter(c => 
        !justResolvedTrainIds.includes(c.train1) && !justResolvedTrainIds.includes(c.train2)
      );
      
      const totalNewConflicts = filteredBlockConflicts.length + filteredLoopConflicts.length + filteredJunctionConflicts.length;
      
      console.log("🔍 Re-detection results:", {
        blockConflicts: filteredBlockConflicts.length,
        loopConflicts: filteredLoopConflicts.length,
        junctionConflicts: filteredJunctionConflicts.length,
        total: totalNewConflicts,
        excludedTrains: justResolvedTrainIds
      });

      if (totalNewConflicts > 0) {
        console.warn("⚠️ NEW CONFLICTS DETECTED after resolution!");
        
        // ⭐ Track new conflict IDs for filtering
        const newIds = new Set();
        
        // Build conflict IDs
        filteredBlockConflicts.forEach(c => {
          newIds.add(`block_${c.trainA}_${c.trainB}`);
        });
        filteredLoopConflicts.forEach(c => {
          newIds.add(`loop_${c.leadingTrain}_${c.followingTrain}`);
        });
        filteredJunctionConflicts.forEach(c => {
          newIds.add(`junction_${c.train1}_${c.train2}`);
        });
        
        setNewConflictIds(newIds);
        setShowOnlyNewConflicts(true);
        
        // Show notification to user with auto-navigation
        setCascadingNotification({
          type: "warning",
          message: `⚠️ Resolution created ${totalNewConflicts} new conflict(s)! Redirecting to Conflicts tab...`,
          conflicts: {
            block: filteredBlockConflicts.length,
            loop: filteredLoopConflicts.length,
            junction: filteredJunctionConflicts.length
          }
        });

        // Auto-navigate to conflicts page after 1 second
        setTimeout(() => {
          setPage("conflicts");
        }, 1000);

        // Mark affected trains as IN_CONFLICT again
        return updatedTrains.map(train => {
          // Skip the trains we just resolved
          if (justResolvedTrainIds.includes(train.train_id)) {
            return train;
          }

          // Check if this train is in any new conflict
          const inBlockConflict = filteredBlockConflicts.some(c => 
            c.trainA === train.train_id || c.trainB === train.train_id
          );
          const inLoopConflict = filteredLoopConflicts.some(c => 
            c.leadingTrain === train.train_id || c.followingTrain === train.train_id
          );
          const inJunctionConflict = filteredJunctionConflicts.some(c => 
            c.train1 === train.train_id || c.train2 === train.train_id
          );

          if (inBlockConflict || inLoopConflict || inJunctionConflict) {
            console.log(`⚠️ Train ${train.train_id} now in NEW conflict!`);
            return {
              ...train,
              status: "IN_CONFLICT",
              conflict: true,
              conflict_reason: "New conflict detected after previous resolution",
              is_cascading_conflict: true // Mark as cascading
            };
          }

          return train;
        });
      } else {
        console.log("✅ No new conflicts detected - resolution was clean!");
        
        // Clear cascading filter
        setShowOnlyNewConflicts(false);
        setNewConflictIds(new Set());
        
        setCascadingNotification({
          type: "success",
          message: "✅ Resolution successful - no new conflicts detected!",
          conflicts: null
        });

        return updatedTrains;
      }
    });

    const endTime = performance.now();
    const resolutionTime = ((endTime - startTime) / 1000).toFixed(3);

    setPerformanceData(prev => {
      const newResolutionCount = prev.totalConflictsResolved + 1;
      const newAverageTime = (
        (prev.averageResolutionTime * prev.totalConflictsResolved + parseFloat(resolutionTime)) / 
        newResolutionCount
      );

      const delayReduction = resolutionDetails.delayReduction || 0;
      
      const newResolution = {
        timestamp: new Date().toLocaleTimeString(),
        priority_train: resolutionDetails.priority_train || trainId,
        reduced_train: resolutionDetails.reduced_train || trainId,
        decision: resolutionDetails.decision || "RESOLVED",
        confidence: resolutionDetails.confidence || 75,
        resolutionTime: resolutionTime,
        conflictType: resolutionDetails.conflictType || "UNKNOWN"
      };

      const updated = {
        ...prev,
        totalConflictsResolved: newResolutionCount,
        averageResolutionTime: newAverageTime,
        totalDelayReduced: prev.totalDelayReduced + delayReduction,
        resolutionHistory: [newResolution, ...prev.resolutionHistory.slice(0, 49)]
      };
      
      console.log("📊 Performance updated:", updated);
      return updated;
    });
  }

  function handleRejectResolution(trainId) {
    console.log(`❌ Rejecting AI resolution for train ${trainId}`);
    
    setTrains(prev =>
      prev.map(t =>
        t.train_id === trainId
          ? {
              ...t,
              status: "MANUAL_REVIEW",
              conflict: true,
              conflict_reason: "AI resolution rejected - requires manual intervention"
            }
          : t
      )
    );

    setPerformanceData(prev => ({
      ...prev,
      totalConflictsRejected: prev.totalConflictsRejected + 1
    }));
  }

  function updateConflictCounts(conflictType, detected, resolved = 0) {
    setPerformanceData(prev => {
      const updates = { ...prev };
      
      switch(conflictType) {
        case 'block':
          if (detected !== undefined) {
            updates.blockConflictsDetected = prev.blockConflictsDetected + detected;
          }
          if (resolved > 0) {
            updates.blockConflictsResolved = prev.blockConflictsResolved + resolved;
          }
          break;
        case 'loop':
          if (detected !== undefined) {
            updates.loopConflictsDetected = prev.loopConflictsDetected + detected;
          }
          if (resolved > 0) {
            updates.loopConflictsResolved = prev.loopConflictsResolved + resolved;
          }
          break;
        case 'junction':
          if (detected !== undefined) {
            updates.junctionConflictsDetected = prev.junctionConflictsDetected + detected;
          }
          if (resolved > 0) {
            updates.junctionConflictsResolved = prev.junctionConflictsResolved + resolved;
          }
          break;
      }
      
      updates.totalConflictsDetected = 
        updates.blockConflictsDetected + 
        updates.loopConflictsDetected + 
        updates.junctionConflictsDetected;
      
      console.log("📊 Performance counts updated:", {
        type: conflictType,
        detected,
        resolved,
        newTotals: {
          blockDetected: updates.blockConflictsDetected,
          blockResolved: updates.blockConflictsResolved,
          loopDetected: updates.loopConflictsDetected,
          loopResolved: updates.loopConflictsResolved,
          junctionDetected: updates.junctionConflictsDetected,
          junctionResolved: updates.junctionConflictsResolved,
          totalDetected: updates.totalConflictsDetected,
          totalResolved: updates.totalConflictsResolved
        }
      });
      
      return updates;
    });
  }

  if (!user) return <Login onLogin={setUser} />;

  return (
    <Layout setPage={setPage} currentPage={page}>
      {/* ⭐ NEW: Cascading Conflict Notification */}
      {cascadingNotification && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
          maxWidth: "400px",
          background: cascadingNotification.type === "success" ? "#dcfce7" : "#fef3c7",
          border: `2px solid ${cascadingNotification.type === "success" ? "#16a34a" : "#fbbf24"}`,
          padding: "16px",
          borderRadius: "10px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          animation: "slideIn 0.3s ease-out"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            marginBottom: "8px"
          }}>
            <strong style={{ 
              color: cascadingNotification.type === "success" ? "#166534" : "#92400e",
              fontSize: "15px"
            }}>
              {cascadingNotification.type === "success" ? "✅ Success" : "⚠️ Warning"}
            </strong>
            <button
              onClick={() => setCascadingNotification(null)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
                padding: "0",
                color: cascadingNotification.type === "success" ? "#166534" : "#92400e"
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ 
            fontSize: "14px", 
            color: cascadingNotification.type === "success" ? "#15803d" : "#78350f",
            marginBottom: "12px"
          }}>
            {cascadingNotification.message}
          </div>

          {cascadingNotification.conflicts && (
            <div style={{
              background: "white",
              padding: "10px",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#0f172a"
            }}>
              <strong>New Conflicts:</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                {cascadingNotification.conflicts.block > 0 && (
                  <li>Block conflicts: {cascadingNotification.conflicts.block}</li>
                )}
                {cascadingNotification.conflicts.loop > 0 && (
                  <li>Loop line conflicts: {cascadingNotification.conflicts.loop}</li>
                )}
                {cascadingNotification.conflicts.junction > 0 && (
                  <li>Junction conflicts: {cascadingNotification.conflicts.junction}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {page === "dashboard" && (
        <Dashboard 
          trains={trains} 
          setTrains={setTrains}
          onClearTrain={handleClearTrain}
          onAcceptResolution={handleAcceptResolution}
          onRejectResolution={handleRejectResolution}
          performanceData={performanceData}
        />
      )}

      {page === "conflicts" && (
        <ConflictResolution
          trains={trains}
          onAcceptResolution={handleAcceptResolution}
          onRejectResolution={handleRejectResolution}
          onUpdateConflictCounts={updateConflictCounts}
          performanceData={performanceData}
          showOnlyNewConflicts={showOnlyNewConflicts}
          newConflictIds={newConflictIds}
          onClearNewConflictFilter={() => setShowOnlyNewConflicts(false)}
        />
      )}

      {page === "history" && (
        <HistoryPage history={history} />
      )}

      {page === "performance" && (
        <PerformancePage 
          performanceData={performanceData}
          history={history}
          trains={trains}
        />
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </Layout>
  );
}

export default App;