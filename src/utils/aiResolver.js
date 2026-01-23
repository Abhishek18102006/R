// src/utils/aiResolver.js (COMPLETE REPLACEMENT - THROUGHPUT OPTIMIZED)

export async function resolveConflictAI(conflict) {
  try {
    console.log("🔍 Conflict received:", conflict);
    
    const conflictType = conflict.type;
    console.log(`📊 Conflict Type: ${conflictType}`);
    
    switch(conflictType) {
      case "SAME_BLOCK":
        return await resolveSameBlockConflict(conflict);
      
      case "LOOP_LINE":
        return await resolveLoopLineConflict(conflict);
      
      case "JUNCTION":
        return await resolveJunctionConflict(conflict);
      
      default:
        console.warn("⚠️ Unknown conflict type, using default resolver");
        return await resolveDefaultConflict(conflict);
    }

  } catch (err) {
    console.error("❌ AI RESOLUTION FAILED:", err);
    
    return {
      success: false,
      error: err.message,
      decision: "MANUAL_INTERVENTION",
      reason: `AI resolution failed: ${err.message}. Manual intervention required.`,
      confidence: 0,
      alternatives: []
    };
  }
}

/* ================================================================
   SAME BLOCK CONFLICT RESOLVER (THROUGHPUT OPTIMIZED)
   ================================================================ */
async function resolveSameBlockConflict(conflict) {
  console.log("🚦 Resolving SAME BLOCK conflict");
  
  const trainA = conflict.trainAObj;
  const trainB = conflict.trainBObj;
  
  if (!trainA || !trainB) {
    throw new Error("Missing train objects for same block conflict");
  }

  const payload = {
    priority_train: conflict.trainA,
    affected_train: conflict.trainB,
    priority_train_level: Number(trainA.priority) || 1,
    affected_train_level: Number(trainB.priority) || 1,
    priority_train_passengers: Number(trainA.passengers) || 600,
    priority_train_distance: Number(trainA.distance_km) || 300,
    priority_train_travel_time: Number(trainA.travel_time_hr) || 5.0,
    priority_train_capacity: Number(trainA.train_capacity) || 800,
    affected_train_passengers: Number(trainB.passengers) || 600,
    affected_train_distance: Number(trainB.distance_km) || 300,
    affected_train_travel_time: Number(trainB.travel_time_hr) || 5.0,
    affected_train_capacity: Number(trainB.train_capacity) || 800,
    passengers: Number(trainA.passengers || trainB.passengers || 600),
    distance_km: Number(trainA.distance_km || trainB.distance_km || 300),
    travel_time_hr: Number(trainA.travel_time_hr || trainB.travel_time_hr || 5.0),
    train_capacity: Number(trainA.train_capacity || trainB.train_capacity || 800),
    is_peak_hour: Number(trainA.is_peak_hour || trainB.is_peak_hour || 0),
    delay: Number(trainA.delay || trainB.delay || 0),
    time_gap: conflict.timeDiff || 3
  };

  console.log("📤 Sending to ML API:", payload);

  const res = await fetch("http://localhost:5000/ai-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  console.log("🤖 ML Response:", data);

  if (!data.success) {
    throw new Error(data.error || "ML returned unsuccessful response");
  }

  // ✅ Generate alternatives with throughput priority
  const alternatives = generateSameBlockAlternatives(data, trainA, trainB, conflict);

  return {
    success: true,
    conflictType: "SAME_BLOCK",
    priority_train: data.priority_train,
    reduced_train: data.reduced_train,
    suggested_speed: data.suggested_speed || 0,
    suggested_delay: 3,
    reason: data.reason || "Opposing trains on same block - speed reduction recommended",
    confidence: data.confidence || 75,
    decision: data.decision || "REDUCE_SPEED",
    probabilities: data.probabilities,
    priority_analysis: data.priority_analysis,
    alternatives: alternatives,
    throughput_impact: getThroughputImpact(data.decision) // ✅ NEW
  };
}

/* ================================================================
   LOOP LINE CONFLICT RESOLVER (THROUGHPUT OPTIMIZED)
   ================================================================ */
async function resolveLoopLineConflict(conflict) {
  console.log("🔁 Resolving LOOP LINE conflict");
  
  const leadingTrain = conflict.leadingTrainObj || conflict.trainAObj;
  const followingTrain = conflict.followingTrainObj || conflict.trainBObj;
  
  if (!leadingTrain || !followingTrain) {
    throw new Error("Missing train objects for loop line conflict");
  }

  const leadingPriority = Number(leadingTrain.priority) || 2;
  const followingPriority = Number(followingTrain.priority) || 2;
  const timeGap = conflict.timeDiff || 0;
  
  let priorityTrain, affectedTrain, decision, suggestedSpeed, suggestedDelay, reason;

  // ✅ THROUGHPUT-FIRST LOGIC
  if (timeGap >= 3) {
    // Good gap - just speed adjustment
    priorityTrain = conflict.leadingTrain;
    affectedTrain = conflict.followingTrain;
    decision = "SPEED_ADJUSTMENT";
    suggestedSpeed = Math.floor(Number(followingTrain.max_speed) * 0.85);
    suggestedDelay = 2;
    reason = `Adequate gap (${timeGap} min). Reduce Train ${affectedTrain} speed to ${suggestedSpeed} km/h to maintain safe separation.`;
  } else if (timeGap >= 2) {
    // Medium gap - route to loop if needed
    if (leadingPriority > followingPriority) {
      priorityTrain = conflict.leadingTrain;
      affectedTrain = conflict.followingTrain;
      decision = "ROUTE_TO_LOOP";
      suggestedSpeed = 60;
      suggestedDelay = 4;
      reason = `Train ${priorityTrain} (Priority ${leadingPriority}) has precedence. Route Train ${affectedTrain} to LOOP LINE.`;
    } else if (followingPriority > leadingPriority) {
      priorityTrain = conflict.followingTrain;
      affectedTrain = conflict.leadingTrain;
      decision = "SPEED_ADJUSTMENT";
      suggestedSpeed = Math.floor(Number(leadingTrain.max_speed) * 0.7);
      suggestedDelay = 3;
      reason = `Train ${priorityTrain} (Priority ${followingPriority}) needs to overtake. Reduce Train ${affectedTrain} speed to ${suggestedSpeed} km/h.`;
    } else {
      priorityTrain = conflict.leadingTrain;
      affectedTrain = conflict.followingTrain;
      decision = "SPEED_ADJUSTMENT";
      suggestedSpeed = Math.floor(Number(followingTrain.max_speed) * 0.8);
      suggestedDelay = 3;
      reason = `Equal priority - reduce Train ${affectedTrain} speed to ${suggestedSpeed} km/h.`;
    }
  } else {
    // Tight gap - more aggressive intervention
    priorityTrain = conflict.leadingTrain;
    affectedTrain = conflict.followingTrain;
    decision = "ROUTE_TO_LOOP";
    suggestedSpeed = 60;
    suggestedDelay = 5;
    reason = `Critical gap (${timeGap} min). Route Train ${affectedTrain} to LOOP LINE for safety.`;
  }

  const confidence = timeGap < 1 ? 90 : timeGap < 3 ? 80 : 70;

  // ✅ Generate alternatives with throughput priority
  const alternatives = generateLoopLineAlternatives(
    priorityTrain, 
    affectedTrain, 
    leadingTrain, 
    followingTrain,
    conflict,
    decision
  );

  return {
    success: true,
    conflictType: "LOOP_LINE",
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    suggested_speed: suggestedSpeed,
    suggested_delay: suggestedDelay,
    reason: reason,
    confidence: confidence,
    decision: decision,
    alternatives: alternatives,
    throughput_impact: getThroughputImpact(decision) // ✅ NEW
  };
}

/* ================================================================
   JUNCTION CONFLICT RESOLVER (THROUGHPUT OPTIMIZED)
   ================================================================ */
async function resolveJunctionConflict(conflict) {
  console.log("🔀 Resolving JUNCTION conflict");
  
  const train1 = conflict.train1Obj;
  const train2 = conflict.train2Obj;
  
  if (!train1 || !train2) {
    throw new Error("Missing train objects for junction conflict");
  }

  const clearanceNeeded = conflict.clearanceNeeded || 5;
  const timeGap = conflict.timeGap || 0;
  const severity = conflict.severity || "MEDIUM";

  const priority1 = Number(train1.priority) || 2;
  const priority2 = Number(train2.priority) || 2;
  
  const passengers1 = Number(train1.passengers) || 0;
  const passengers2 = Number(train2.passengers) || 0;
  
  const score1 = (priority1 * 100) + (passengers1 * 0.1);
  const score2 = (priority2 * 100) + (passengers2 * 0.1);

  let priorityTrain, delayedTrain, entryDelay, reason, decision;

  // ✅ THROUGHPUT-FIRST LOGIC FOR JUNCTIONS
  if (timeGap >= 4) {
    // Good gap - just sequence normally
    if (score1 > score2) {
      priorityTrain = conflict.train1;
      delayedTrain = conflict.train2;
    } else if (score2 > score1) {
      priorityTrain = conflict.train2;
      delayedTrain = conflict.train1;
    } else {
      const arrivalTime1 = train1.arrival || 0;
      const arrivalTime2 = train2.arrival || 0;
      priorityTrain = arrivalTime1 < arrivalTime2 ? conflict.train1 : conflict.train2;
      delayedTrain = priorityTrain === conflict.train1 ? conflict.train2 : conflict.train1;
    }
    
    decision = "SEQUENCE_AT_JUNCTION";
    entryDelay = Math.ceil(Math.max(clearanceNeeded - timeGap, 1));
    reason = `Good separation (${timeGap} min). Train ${priorityTrain} enters first, Train ${delayedTrain} waits ${entryDelay} min.`;
    
  } else if (timeGap >= 2) {
    // Medium gap - speed adjustment for delayed train
    if (score1 > score2) {
      priorityTrain = conflict.train1;
      delayedTrain = conflict.train2;
    } else {
      priorityTrain = conflict.train2;
      delayedTrain = conflict.train1;
    }
    
    decision = "REDUCE_SPEED_BEFORE_JUNCTION";
    entryDelay = Math.ceil(clearanceNeeded - timeGap + 1);
    reason = `Medium gap (${timeGap} min). Train ${priorityTrain} proceeds normally. Slow Train ${delayedTrain} before junction.`;
    
  } else {
    // Tight gap - hold at approach
    if (score1 > score2) {
      priorityTrain = conflict.train1;
      delayedTrain = conflict.train2;
    } else {
      priorityTrain = conflict.train2;
      delayedTrain = conflict.train1;
    }
    
    decision = "SEQUENCE_AT_JUNCTION";
    entryDelay = Math.ceil(clearanceNeeded - timeGap + 2);
    reason = `Critical gap (${timeGap} min). Train ${priorityTrain} has priority. Hold Train ${delayedTrain} at approach.`;
  }

  const confidence = severity === "CRITICAL" ? 95 : 
                    severity === "HIGH" ? 85 : 
                    severity === "MEDIUM" ? 75 : 65;

  // ✅ Generate alternatives with throughput priority
  const alternatives = generateJunctionAlternatives(
    priorityTrain,
    delayedTrain,
    train1,
    train2,
    conflict,
    entryDelay,
    decision
  );

  return {
    success: true,
    conflictType: "JUNCTION",
    priority_train: priorityTrain,
    reduced_train: delayedTrain,
    suggested_speed: decision === "REDUCE_SPEED_BEFORE_JUNCTION" ? 40 : 0,
    suggested_delay: Math.ceil(entryDelay),
    reason: reason,
    confidence: confidence,
    decision: decision,
    junctionId: conflict.junction_id,
    alternatives: alternatives,
    throughput_impact: getThroughputImpact(decision) // ✅ NEW
  };
}

/* ================================================================
   DEFAULT CONFLICT RESOLVER
   ================================================================ */
async function resolveDefaultConflict(conflict) {
  console.log("⚙️ Using default conflict resolver");
  
  let trainA, trainB, trainAObj, trainBObj;
  
  if (conflict.trainA && conflict.trainB) {
    trainA = conflict.trainA;
    trainB = conflict.trainB;
    trainAObj = conflict.trainAObj;
    trainBObj = conflict.trainBObj;
  } else if (conflict.leadingTrain && conflict.followingTrain) {
    trainA = conflict.leadingTrain;
    trainB = conflict.followingTrain;
    trainAObj = conflict.leadingTrainObj;
    trainBObj = conflict.followingTrainObj;
  } else if (conflict.train1 && conflict.train2) {
    trainA = conflict.train1;
    trainB = conflict.train2;
    trainAObj = conflict.train1Obj;
    trainBObj = conflict.train2Obj;
  } else {
    throw new Error("Unknown conflict structure");
  }

  if (!trainAObj || !trainBObj) {
    throw new Error("Missing train data objects");
  }

  const priorityA = Number(trainAObj.priority) || 2;
  const priorityB = Number(trainBObj.priority) || 2;

  if (priorityA > priorityB) {
    return {
      success: true,
      conflictType: "UNKNOWN",
      priority_train: trainA,
      reduced_train: trainB,
      suggested_speed: 60,
      suggested_delay: 3,
      decision: "REDUCE_SPEED",
      reason: `Train ${trainA} has higher priority (${priorityA} vs ${priorityB})`,
      confidence: 70,
      alternatives: [],
      throughput_impact: "MEDIUM"
    };
  } else {
    return {
      success: true,
      conflictType: "UNKNOWN",
      priority_train: trainB,
      reduced_train: trainA,
      suggested_speed: 60,
      suggested_delay: 3,
      decision: "REDUCE_SPEED",
      reason: `Train ${trainB} has higher priority (${priorityB} vs ${priorityA})`,
      confidence: 70,
      alternatives: [],
      throughput_impact: "MEDIUM"
    };
  }
}

/* ================================================================
   ALTERNATIVE GENERATORS (THROUGHPUT OPTIMIZED)
   ================================================================ */

function generateSameBlockAlternatives(aiData, trainA, trainB, conflict) {
  const alternatives = [];
  const priorityTrain = aiData.priority_train;
  const affectedTrain = aiData.reduced_train;
  const timeGap = conflict.timeDiff || 3;

  // ✅ Alternative 1: ML MODEL DECISION (PRIMARY - RECOMMENDED)
  const mlDecision = aiData.decision || "REDUCE_SPEED";
  const isSpeedReduction = mlDecision === "REDUCE_SPEED";
  
  alternatives.push({
    option: "A",
    title: isSpeedReduction 
      ? `Reduce Speed of Train ${affectedTrain} (AI Recommended)` 
      : `Hold Train ${affectedTrain} (AI Recommended)`,
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: mlDecision,
    suggested_speed: aiData.suggested_speed || (isSpeedReduction ? 60 : 0),
    suggested_delay: isSpeedReduction ? 3 : 5,
    confidence: aiData.confidence || 85,
    reason: aiData.reason || `ML model recommends ${mlDecision.toLowerCase().replace(/_/g, ' ')} based on ${timeGap} minute gap and priority analysis.`,
    tradeoff: isSpeedReduction 
      ? "3-5 min delay for affected train only" 
      : "5-7 min delay for affected train only",
    risk: "Medium - optimal balance of safety and throughput",
    color: "#16a34a", // GREEN
    recommended: true, // ✅ MARK AS RECOMMENDED
    throughput_impact: isSpeedReduction ? "HIGH" : "MEDIUM"
  });

  // ✅ Alternative 2: Alternative Approach (if different from ML)
  if (timeGap >= 2) {
    const altSpeed = isSpeedReduction ? 45 : 60;
    const altDecision = isSpeedReduction ? "REDUCE_SPEED" : "REDUCE_SPEED";
    
    alternatives.push({
      option: "B",
      title: `Reduce Speed to ${altSpeed} km/h`,
      priority_train: priorityTrain,
      reduced_train: affectedTrain,
      decision: altDecision,
      suggested_speed: altSpeed,
      suggested_delay: altSpeed === 45 ? 4 : 3,
      confidence: 75,
      reason: `Alternative speed limit: Slow Train ${affectedTrain} to ${altSpeed} km/h while Train ${priorityTrain} maintains speed.`,
      tradeoff: `${altSpeed === 45 ? '4-6' : '3-5'} min delay for affected train`,
      risk: "Medium - requires speed monitoring",
      color: "#0284c7", // BLUE
      throughput_impact: "MEDIUM-HIGH"
    });
  }

  // ✅ Alternative 3: Priority Reversal (if priorities close)
  const priorityDiff = Math.abs(
    (Number(trainA.priority) || 2) - (Number(trainB.priority) || 2)
  );
  
  if (priorityDiff <= 1 && timeGap >= 1.5) {
    alternatives.push({
      option: "C",
      title: `Reverse Priority - Favor Train ${affectedTrain}`,
      priority_train: affectedTrain,
      reduced_train: priorityTrain,
      decision: "REVERSE_PRIORITY",
      suggested_speed: 50,
      suggested_delay: 3,
      confidence: 65,
      reason: `Priorities are close (${priorityDiff} difference). Give priority to Train ${affectedTrain} instead. Train ${priorityTrain} slows down.`,
      tradeoff: "Different train delayed - 3-4 min impact",
      risk: "Medium - only valid if priorities similar",
      color: "#d97706", // ORANGE
      throughput_impact: "MEDIUM-HIGH"
    });
  }

  // ❌ Alternative LAST: Hold Both (LAST RESORT ONLY)
  alternatives.push({
    option: String.fromCharCode(65 + alternatives.length), // Dynamic letter
    title: "⚠️ Hold Both Trains (LAST RESORT)",
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: "HOLD_BOTH_TRAINS",
    suggested_speed: 0,
    suggested_delay: 10,
    confidence: 95,
    reason: `⚠️ EMERGENCY OPTION: Stop both trains completely - manual sequencing required. Only use if speed reduction alternatives fail or gap is extremely critical (< 1 min). Causes significant network delays.`,
    tradeoff: "8-12 min delay for BOTH trains - cascades delays through entire network",
    risk: "Very Low safety risk, but HIGH operational and throughput impact",
    color: "#dc2626", // RED
    lastResort: true, // ✅ MARK AS LAST RESORT
    throughput_impact: "VERY_LOW"
  });

  return alternatives;
}

function generateLoopLineAlternatives(priorityTrain, affectedTrain, leadingTrain, followingTrain, conflict, primaryDecision) {
  const alternatives = [];
  const timeGap = conflict.timeDiff || 3;

  // ✅ Alternative 1: PRIMARY RECOMMENDATION
  const isPrimarySpeedAdj = primaryDecision === "SPEED_ADJUSTMENT";
  
  alternatives.push({
    option: "A",
    title: isPrimarySpeedAdj 
      ? `Speed Adjustment for Train ${affectedTrain} (Recommended)` 
      : `Route Train ${affectedTrain} to Loop Line (Recommended)`,
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: primaryDecision,
    suggested_speed: isPrimarySpeedAdj ? 70 : 60,
    suggested_delay: isPrimarySpeedAdj ? 2 : 4,
    confidence: 85,
    reason: isPrimarySpeedAdj 
      ? `Gap is ${timeGap} min. Reduce Train ${affectedTrain} speed to maintain safe separation without rerouting.`
      : `Route Train ${affectedTrain} to alternate loop line. Completely separates train paths.`,
    tradeoff: isPrimarySpeedAdj ? "2-3 min delay" : "4-6 min longer route",
    risk: isPrimarySpeedAdj ? "Low - maintains schedule" : "Very Low - complete path separation",
    color: "#16a34a", // GREEN
    recommended: true,
    throughput_impact: isPrimarySpeedAdj ? "HIGH" : "MEDIUM-HIGH"
  });

  // ✅ Alternative 2: Other option
  if (timeGap >= 2) {
    const altDecision = isPrimarySpeedAdj ? "ROUTE_TO_LOOP" : "SPEED_ADJUSTMENT";
    
    alternatives.push({
      option: "B",
      title: altDecision === "ROUTE_TO_LOOP" 
        ? `Reroute to Loop Line` 
        : `Gradual Speed Reduction`,
      priority_train: priorityTrain,
      reduced_train: affectedTrain,
      decision: altDecision,
      suggested_speed: altDecision === "ROUTE_TO_LOOP" ? 60 : 65,
      suggested_delay: altDecision === "ROUTE_TO_LOOP" ? 5 : 3,
      confidence: 75,
      reason: altDecision === "ROUTE_TO_LOOP"
        ? `Alternative: Divert Train ${affectedTrain} to loop line for complete separation.`
        : `Alternative: Reduce Train ${affectedTrain} speed gradually to ${65} km/h.`,
      tradeoff: altDecision === "ROUTE_TO_LOOP" ? "5-7 min longer route" : "3-4 min delay",
      risk: "Medium",
      color: "#0284c7", // BLUE
      throughput_impact: "MEDIUM"
    });
  }

  // ❌ Alternative LAST: Hold Both
  alternatives.push({
    option: "C",
    title: "⚠️ Hold Both Trains (LAST RESORT)",
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: "HOLD_BOTH_TRAINS",
    suggested_speed: 0,
    suggested_delay: 10,
    confidence: 95,
    reason: "⚠️ EMERGENCY: Stop both trains - manually sequence with maximum gap. Use only if speed/routing alternatives fail.",
    tradeoff: "8-12 min delay for both trains",
    risk: "Very Low safety, HIGH throughput impact",
    color: "#dc2626", // RED
    lastResort: true,
    throughput_impact: "VERY_LOW"
  });

  return alternatives;
}

function generateJunctionAlternatives(priorityTrain, delayedTrain, train1, train2, conflict, entryDelay, primaryDecision) {
  const alternatives = [];
  const timeGap = conflict.timeGap || 3;

  // ✅ Alternative 1: PRIMARY RECOMMENDATION
  const isPrimarySequence = primaryDecision === "SEQUENCE_AT_JUNCTION";
  
  alternatives.push({
    option: "A",
    title: isPrimarySequence 
      ? `Sequence at Junction - Hold Train ${delayedTrain} (Recommended)` 
      : `Reduce Speed Before Junction (Recommended)`,
    priority_train: priorityTrain,
    reduced_train: delayedTrain,
    decision: primaryDecision,
    suggested_speed: isPrimarySequence ? 0 : 40,
    suggested_delay: Math.ceil(entryDelay),
    confidence: 90,
    reason: isPrimarySequence
      ? `Stop Train ${delayedTrain} at approach signal. Proceed after ${Math.ceil(entryDelay)} min clearance.`
      : `Reduce Train ${delayedTrain} speed to 40 km/h before junction to time arrival correctly.`,
    tradeoff: `${Math.ceil(entryDelay)} min delay for Train ${delayedTrain}`,
    risk: "Low - standard junction sequencing",
    color: "#16a34a", // GREEN
    recommended: true,
    throughput_impact: isPrimarySequence ? "MEDIUM" : "HIGH"
  });

  // ✅ Alternative 2: Other approach
  if (timeGap >= 2) {
    const altDecision = isPrimarySequence ? "REDUCE_SPEED_BEFORE_JUNCTION" : "SEQUENCE_AT_JUNCTION";
    
    alternatives.push({
      option: "B",
      title: altDecision === "SEQUENCE_AT_JUNCTION" 
        ? `Hold at Approach` 
        : `Speed Reduction Timing`,
      priority_train: priorityTrain,
      reduced_train: delayedTrain,
      decision: altDecision,
      suggested_speed: altDecision === "SEQUENCE_AT_JUNCTION" ? 0 : 45,
      suggested_delay: Math.ceil(entryDelay) + (altDecision === "SEQUENCE_AT_JUNCTION" ? 1 : 0),
      confidence: 80,
      reason: altDecision === "SEQUENCE_AT_JUNCTION"
        ? `Alternative: Complete stop at approach with ${Math.ceil(entryDelay) + 1} min buffer.`
        : `Alternative: Slow Train ${delayedTrain} to 45 km/h before junction entry.`,
      tradeoff: `${Math.ceil(entryDelay) + (altDecision === "SEQUENCE_AT_JUNCTION" ? 1 : 0)} min delay`,
      risk: "Medium - timing critical",
      color: "#0284c7", // BLUE
      throughput_impact: altDecision === "SEQUENCE_AT_JUNCTION" ? "MEDIUM" : "MEDIUM-HIGH"
    });
  }

  // ❌ Alternative LAST: Hold Both
  alternatives.push({
    option: "C",
    title: "⚠️ Hold Both Trains (LAST RESORT)",
    priority_train: priorityTrain,
    reduced_train: delayedTrain,
    decision: "HOLD_BOTH_TRAINS",
    suggested_speed: 0,
    suggested_delay: 12,
    confidence: 95,
    reason: "⚠️ EMERGENCY: Stop both trains before junction - manually sequence with extra buffer. Use only for critical gaps (< 1 min).",
    tradeoff: "10-15 min delay for both trains",
    risk: "Very Low safety, HIGH throughput impact",
    color: "#dc2626", // RED
    lastResort: true,
    throughput_impact: "VERY_LOW"
  });

  return alternatives;
}

/* ================================================================
   HELPER FUNCTIONS
   ================================================================ */

function getThroughputImpact(decision) {
  const impacts = {
    "REDUCE_SPEED": "HIGH",
    "SPEED_ADJUSTMENT": "HIGH",
    "REDUCE_SPEED_BEFORE_JUNCTION": "HIGH",
    "ROUTE_TO_LOOP": "MEDIUM-HIGH",
    "SEQUENCE_AT_JUNCTION": "MEDIUM",
    "HOLD_TRAIN": "MEDIUM",
    "REVERSE_PRIORITY": "MEDIUM",
    "HOLD_BOTH_TRAINS": "VERY_LOW"
  };
  return impacts[decision] || "MEDIUM";
}