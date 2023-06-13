const { array } = require("joi");

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];


function calculateScore(schedule) {

    const timings = [].concat(...schedule.map(unit => unit.timings));

    // Sort timings:
    const sortedTimings = timings.sort((a, b) => {
        const dayComparison = a.day.localeCompare(b.day);
    
        if (dayComparison !== 0) {
            return dayComparison;
        } else {
            return a.timingStart.localeCompare(b.timingStart);
        }
    });
    const backToBackPenalty = 10;
    const mealTimePenalty = 50;
    const eveningTimePlus = 10;
    const singleUnitPenalty = 20;
    const tooLongUnitPenalty = 15;

    const lunchStart = "1200";
    const lunchEnd = "1400";

    const eveningTime = "1500";

    let score = 0;
    let previousTiming = sortedTimings[0];
    // Check for back-to-back units:
    for (let i = 0; i < sortedTimings.length - 1; i++) {
        currentTiming = sortedTimings[i];
        for (let j = i + 1; j < sortedTimings.length; j++) {
            previousTiming = sortedTimings[j];
            if ((currentTiming.timingStart == previousTiming.timingEnd || currentTiming.timingEnd == previousTiming.timingStart) && currentTiming.day == previousTiming.day) {
                score -= backToBackPenalty;
            }
        }
    }
    
    // Not too many single hour units:
    score -= timings.length * singleUnitPenalty;

    for (let timing of timings) {
        // Check for units during meal times
        if (timing.timingStart <= lunchEnd && timing.timingEnd >= lunchStart) {
            score -= mealTimePenalty;
        }
        // Check for units in evening (+)
        if (timing.timingStart >= eveningTime || timing.timingEnd >= eveningTime) {
            score += eveningTimePlus;
        }
        // Not too long units
        const tooLongPenalty = parseInt(timing.timingEnd.slice(0, 2)) - parseInt(timing.timingStart.slice(0, 2)) * tooLongUnitPenalty;
        if (tooLongPenalty > 0) {
            score -= tooLongPenalty;
        }
    }

    return score;
}

function mergeTimings(timings) {
    // Sort the timings based on day and timing start
    const sortedTimings = timings.sort((a, b) => {
        const dayComparison = a.day.localeCompare(b.day);
    
        if (dayComparison !== 0) {
            return dayComparison;
        } else {
            return a.timingStart.localeCompare(b.timingStart);
        }
    });
  
    const mergedTimings = [];
  
    for (let timing of sortedTimings) {
        const lastMergedTiming = mergedTimings[mergedTimings.length - 1];
    
        if (
            lastMergedTiming &&
            lastMergedTiming.day === timing.day &&
            lastMergedTiming.timingEnd === timing.timingStart
        ) {
            // Extend the last merged timing
            lastMergedTiming.timingEnd = timing.timingEnd;
        } else {
            // Add the timing as a new merged timing
            mergedTimings.push({
            day: timing.day,
            timingStart: timing.timingStart,
            timingEnd: timing.timingEnd
            });
        }
    }
  
    return mergedTimings;
}
  

function generateNeighbors(schedule) {
    const neighbours = [];
    
    // Filter unassigned tasks
    const unassignedTasks = schedule.filter((task) => !task.isAssigned);
    
    // Pick a random unassigned task and generate 50 random timings:
    const pickedTask = unassignedTasks[Math.floor(Math.random() * unassignedTasks.length)];
    pickedTask.timings = [];
    const availableSlots = generateAvailableSlots(schedule).filter(slot => days.indexOf(slot.day) >= days.indexOf(pickedTask.releasedOn) && days.indexOf(slot.day) < days.indexOf(pickedTask.deadline));
    // Not enough available slots for this task:
    if (availableSlots.length < pickedTask.duration) {
        return [];
    }
    const possibleTimings = new Set();
    for (let i = 0; i < 50; i++) {
        let taskDuration = pickedTask.duration;
        const currentTiming = [];
        while (taskDuration > 0) {
            const randomIndex = Math.floor(Math.random() * availableSlots.length);
            const availableSlot = availableSlots[randomIndex];
            
            // Check if the available slot is already in the current timing
            if (!currentTiming.includes(availableSlot)) {
                currentTiming.push(availableSlot);
                taskDuration -= 1;
            }
        }
        const mergedTiming = mergeTimings(currentTiming);
        possibleTimings.add(mergedTiming);
    }

    for (let timing of possibleTimings) {
        pickedTask.timings = timing;
        neighbours.push(JSON.parse(JSON.stringify(schedule)));
    }
    
    return neighbours;
}
  
function generateAvailableSlots(schedule) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const availableSlots = [];
    for (const day of days) {
        for (let i = 8; i <= 17; i++) {
            const timingStart = (i * 100).toString().padStart(4, "0");
            const timingEnd = ((i + 1) * 100).toString().padStart(4, "0");
    
            // Check if the slot conflicts with any existing tasks in the schedule
            const conflictingTask = schedule.some(
            (task) =>
                task.timings.some(
                (timing) =>
                    timing.day === day &&
                    ((timingStart >= timing.timingStart && timingStart < timing.timingEnd) ||
                    (timingEnd > timing.timingStart && timingEnd <= timing.timingEnd) ||
                    (timingStart <= timing.timingStart && timingEnd >= timing.timingEnd))
                )
            );
    
            if (!conflictingTask) {
            availableSlots.push({ day, timingStart, timingEnd });
            }
        }
    }
  
    return availableSlots;
}

function hillclimb(assignedUnits, unassignedUnits) {
    // Initial schedule (Greedy):
    let currentBestSchedule = JSON.parse(JSON.stringify(assignedUnits));
    
    let availableSlots = generateAvailableSlots(currentBestSchedule);
    for (let unassignedUnit of unassignedUnits) {
        const unitReleasedOn = unassignedUnit.releasedOn;
        const unitDeadline = unassignedUnit.deadline;
        const availableSlotsForUnit = availableSlots.filter(slot => days.indexOf(slot.day) >= days.indexOf(unitReleasedOn) && days.indexOf(slot.day) < days.indexOf(unitDeadline));
        let unitTimingLeft = unassignedUnit.duration;
        let unitTimings = [];
        while (unitTimingLeft > 0) {
            // Not enough slots to assign task:
            if (availableSlotsForUnit.length <= 0) {
                return 0;
            }
            unitTimings.push(availableSlotsForUnit[0]);
            availableSlotsForUnit.shift();
            unitTimingLeft -= 1;
        }
        unassignedUnit.timings = mergeTimings(unitTimings);
        currentBestSchedule.push(unassignedUnit)
        availableSlots = generateAvailableSlots(currentBestSchedule);
    }
    

    // Calculate score:
    let currentScore = calculateScore(currentBestSchedule);
    let currentSolution = currentBestSchedule;

    // Iterate until no better solution can be found
    while (true) {
        // Generate neighbors of the current solution
        const neighbors = generateNeighbors(currentBestSchedule);

        // Find the neighbor with the best score
        let bestNeighbor = null;
        let bestNeighborScore = currentScore;

        for (const neighbor of neighbors) {
            const neighborScore = calculateScore(neighbor);

            if (neighborScore > bestNeighborScore) {
                bestNeighbor = neighbor;
                bestNeighborScore = neighborScore;
            }
        }

        // If no better neighbor is found, stop the iteration
        if (!bestNeighbor || bestNeighborScore <= currentScore) {
        break;
        }

        // Move to the best neighbor
        currentSolution = bestNeighbor;
        currentScore = bestNeighborScore;
    }
    
    // Return the final solution
    return currentSolution;
}


module.exports = hillclimb;