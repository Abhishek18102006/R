// src/utils/aiResolver.js (COMPLETE REPLACEMENT)

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
   SAME BLOCK CONFLICT RESOLVER
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
    delay: Number(trainA.delay || trainB.delay || 0)
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

  // Generate alternatives for same block conflict
  const alternatives = generateSameBlockAlternatives(data, trainA, trainB, conflict);

  return {
    success: true,
    conflictType: "SAME_BLOCK",
    priority_train: data.priority_train,
    reduced_train: data.reduced_train,
    suggested_speed: data.suggested_speed || 0,
    reason: data.reason || "Opposing trains on same block - one must be held",
    confidence: data.confidence || 75,
    decision: data.decision || "HOLD_TRAIN",
    probabilities: data.probabilities,
    priority_analysis: data.priority_analysis,
    alternatives: alternatives
  };
}

/* ================================================================
   LOOP LINE CONFLICT RESOLVER
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
  
  let priorityTrain, affectedTrain, decision, suggestedSpeed, reason;

  if (leadingPriority > followingPriority) {
    priorityTrain = conflict.leadingTrain;
    affectedTrain = conflict.followingTrain;
    decision = "ROUTE_TO_LOOP";
    suggestedSpeed = 60;
    reason = `Train ${priorityTrain} (Priority ${leadingPriority}) has precedence. Route Train ${affectedTrain} to LOOP LINE at reduced speed.`;
  } else if (followingPriority > leadingPriority) {
    priorityTrain = conflict.followingTrain;
    affectedTrain = conflict.leadingTrain;
    decision = "SPEED_ADJUSTMENT";
    suggestedSpeed = Math.floor(Number(leadingTrain.max_speed) * 0.7);
    reason = `Train ${priorityTrain} (Priority ${followingPriority}) needs to overtake. Reduce Train ${affectedTrain} speed to ${suggestedSpeed} km/h.`;
  } else {
    priorityTrain = conflict.leadingTrain;
    affectedTrain = conflict.followingTrain;
    decision = "ROUTE_TO_LOOP";
    suggestedSpeed = 60;
    reason = `Equal priority - maintain current order. Route Train ${affectedTrain} to LOOP LINE.`;
  }

  const timeGap = conflict.timeDiff || 0;
  const confidence = timeGap < 2 ? 85 : timeGap < 4 ? 75 : 65;

  // Generate alternatives for loop line conflict
  const alternatives = generateLoopLineAlternatives(
    priorityTrain, 
    affectedTrain, 
    leadingTrain, 
    followingTrain,
    conflict
  );

  return {
    success: true,
    conflictType: "LOOP_LINE",
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    suggested_speed: suggestedSpeed,
    suggested_delay: 5,
    reason: reason,
    confidence: confidence,
    decision: decision,
    alternatives: alternatives
  };
}

/* ================================================================
   JUNCTION CONFLICT RESOLVER
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

  let priorityTrain, delayedTrain, entryDelay, reason;

  if (score1 > score2) {
    priorityTrain = conflict.train1;
    delayedTrain = conflict.train2;
    entryDelay = Math.max(clearanceNeeded - timeGap, 0);
    reason = `Train ${priorityTrain} (Priority ${priority1}, ${passengers1} passengers) gets junction entry first.`;
  } else if (score2 > score1) {
    priorityTrain = conflict.train2;
    delayedTrain = conflict.train1;
    entryDelay = Math.max(clearanceNeeded - timeGap, 0);
    reason = `Train ${priorityTrain} (Priority ${priority2}, ${passengers2} passengers) gets junction entry first.`;
  } else {
    const arrivalTime1 = train1.arrival || 0;
    const arrivalTime2 = train2.arrival || 0;
    
    if (arrivalTime1 < arrivalTime2) {
      priorityTrain = conflict.train1;
      delayedTrain = conflict.train2;
    } else {
      priorityTrain = conflict.train2;
      delayedTrain = conflict.train1;
    }
    entryDelay = Math.max(clearanceNeeded - timeGap, 0);
    reason = `Equal priority - first arrival gets preference.`;
  }

  const confidence = severity === "CRITICAL" ? 95 : 
                    severity === "HIGH" ? 85 : 
                    severity === "MEDIUM" ? 75 : 65;

  // Generate alternatives for junction conflict
  const alternatives = generateJunctionAlternatives(
    priorityTrain,
    delayedTrain,
    train1,
    train2,
    conflict,
    entryDelay
  );

  return {
    success: true,
    conflictType: "JUNCTION",
    priority_train: priorityTrain,
    reduced_train: delayedTrain,
    suggested_speed: Number(train2.max_speed) || 100,
    suggested_delay: Math.ceil(entryDelay),
    reason: reason,
    confidence: confidence,
    decision: "SEQUENCE_AT_JUNCTION",
    junctionId: conflict.junction_id,
    alternatives: alternatives
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
      decision: "REDUCE_SPEED",
      reason: `Train ${trainA} has higher priority (${priorityA} vs ${priorityB})`,
      confidence: 70,
      alternatives: []
    };
  } else {
    return {
      success: true,
      conflictType: "UNKNOWN",
      priority_train: trainB,
      reduced_train: trainA,
      suggested_speed: 60,
      decision: "REDUCE_SPEED",
      reason: `Train ${trainB} has higher priority (${priorityB} vs ${priorityA})`,
      confidence: 70,
      alternatives: []
    };
  }
}

/* ================================================================
   ALTERNATIVE GENERATORS
   ================================================================ */

function generateSameBlockAlternatives(aiData, trainA, trainB, conflict) {
  const alternatives = [];
  const priorityTrain = aiData.priority_train;
  const affectedTrain = aiData.reduced_train;

  // Alternative 1: Hold Both Trains (Conservative)
  alternatives.push({
    option: "A",
    title: "Hold Both Trains (Maximum Safety)",
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: "HOLD_BOTH_TRAINS",
    suggested_speed: 0,
    suggested_delay: 10,
    confidence: 95,
    reason: "Stop both trains completely - manually sequence after full stop. Maximum safety buffer.",
    tradeoff: "8-12 min delay for both trains",
    risk: "Very Low",
    color: "#7c3aed"
  });

  // Alternative 2: Speed Reduction
  alternatives.push({
    option: "B",
    title: `Reduce Speed of Train ${affectedTrain}`,
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: "REDUCE_SPEED",
    suggested_speed: 45,
    suggested_delay: 4,
    confidence: 75,
    reason: `Slow Train ${affectedTrain} to 45 km/h while Train ${priorityTrain} maintains speed.`,
    tradeoff: "3-5 min delay for affected train",
    risk: "Medium - requires speed monitoring",
    color: "#d97706"
  });

  // Alternative 3: Priority Reversal (if close)
  const priorityDiff = Math.abs(
    (Number(trainA.priority) || 2) - (Number(trainB.priority) || 2)
  );
  
  if (priorityDiff <= 1) {
    alternatives.push({
      option: "C",
      title: `Reverse Priority - Favor Train ${affectedTrain}`,
      priority_train: affectedTrain,
      reduced_train: priorityTrain,
      decision: "REVERSE_PRIORITY",
      suggested_speed: 50,
      suggested_delay: 3,
      confidence: 65,
      reason: `Give priority to Train ${affectedTrain} instead. Train ${priorityTrain} slows down.`,
      tradeoff: "Different train gets delayed",
      risk: "Medium - only valid if priorities are close",
      color: "#dc2626"
    });
  }

  return alternatives;
}

function generateLoopLineAlternatives(priorityTrain, affectedTrain, leadingTrain, followingTrain, conflict) {
  const alternatives = [];

  // Alternative 1: Hold Both
  alternatives.push({
    option: "A",
    title: "Hold Both Trains (Conservative)",
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: "HOLD_BOTH_TRAINS",
    suggested_speed: 0,
    suggested_delay: 10,
    confidence: 95,
    reason: "Stop both trains - manually sequence with maximum gap.",
    tradeoff: "8-12 min delay for both",
    risk: "Very Low",
    color: "#7c3aed"
  });

  // Alternative 2: Reroute to Loop
  alternatives.push({
    option: "B",
    title: `Reroute Train ${affectedTrain} to Loop Line`,
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: "ROUTE_TO_LOOP",
    suggested_speed: 60,
    suggested_delay: 5,
    confidence: 85,
    reason: `Divert Train ${affectedTrain} to alternate loop line route.`,
    tradeoff: "4-6 min longer route",
    risk: "Low - completely separates paths",
    color: "#0284c7"
  });

  // Alternative 3: Gradual Speed Reduction
  alternatives.push({
    option: "C",
    title: `Gradual Speed Reduction`,
    priority_train: priorityTrain,
    reduced_train: affectedTrain,
    decision: "REDUCE_SPEED",
    suggested_speed: 55,
    suggested_delay: 3,
    confidence: 70,
    reason: `Reduce Train ${affectedTrain} speed gradually to maintain safe gap.`,
    tradeoff: "2-4 min delay",
    risk: "Medium - requires continuous monitoring",
    color: "#d97706"
  });

  return alternatives;
}

function generateJunctionAlternatives(priorityTrain, delayedTrain, train1, train2, conflict, entryDelay) {
  const alternatives = [];

  // Alternative 1: Hold Delayed Train
  alternatives.push({
    option: "A",
    title: `Hold Train ${delayedTrain} at Approach`,
    priority_train: priorityTrain,
    reduced_train: delayedTrain,
    decision: "SEQUENCE_AT_JUNCTION",
    suggested_speed: 0,
    suggested_delay: Math.ceil(entryDelay) + 2,
    confidence: 90,
    reason: `Stop Train ${delayedTrain} at approach signal. Proceed after ${Math.ceil(entryDelay) + 2} min clearance.`,
    tradeoff: `${Math.ceil(entryDelay) + 2} min delay`,
    risk: "Low",
    color: "#16a34a"
  });

  // Alternative 2: Speed Reduction Before Junction
  alternatives.push({
    option: "B",
    title: `Slow Train ${delayedTrain} Before Junction`,
    priority_train: priorityTrain,
    reduced_train: delayedTrain,
    decision: "REDUCE_SPEED",
    suggested_speed: 40,
    suggested_delay: Math.ceil(entryDelay),
    confidence: 75,
    reason: `Reduce Train ${delayedTrain} speed to arrive after clearance window.`,
    tradeoff: `${Math.ceil(entryDelay)} min delay`,
    risk: "Medium - timing critical",
    color: "#d97706"
  });

  // Alternative 3: Hold Both (Maximum Safety)
  alternatives.push({
    option: "C",
    title: "Hold Both Trains (Maximum Safety)",
    priority_train: priorityTrain,
    reduced_train: delayedTrain,
    decision: "HOLD_BOTH_TRAINS",
    suggested_speed: 0,
    suggested_delay: 12,
    confidence: 95,
    reason: "Stop both trains before junction - manually sequence with extra buffer.",
    tradeoff: "10-15 min delay for both",
    risk: "Very Low",
    color: "#7c3aed"
  });

  return alternatives;
}