const { array } = require("joi");

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const testSchedule = [
    {
        _id: "6475ed32bac98a75e624a880",
        userId: '64664d2d92f130e23eaea655',
        type: 'Lesson',
        isAssigned: true,
        title: 'CS2109S - Introduction to ML and AI',
        colour: '#C62828',
        timings: [
          {
            day: 'Monday',
            timingStart: '1000',
            timingEnd: '1200',
          },
          {
            day: 'Monday',
            timingStart: '1200',
            timingEnd: '1300',
          },
          {
            day: 'Tuesday',
            timingStart: '0900',
            timingEnd: '1100',
          },
          {
            day: 'Wednesday',
            timingStart: '1300',
            timingEnd: '1400',
          }
        ]
    },
    {
        _id: "6475ed32bac98c75e624a880",
        userId: '64664d2d92f13ae23eaea655',
        type: 'Lesson',
        isAssigned: true,
        title: 'CS2106 - OS',
        colour: '#C62828',
        timings: [
          {
            day: 'Tuesday',
            timingStart: '1100',
            timingEnd: '1500',
          },
          {
            day: 'Thursday',
            timingStart: '0900',
            timingEnd: '1100',
          }
        ]
    }
];

const testTasks = [
    {
        _id: "6475ed3fbac98a75e624a893",
        userId: '64664d2d92f130e23eaea655',
        type: 'WeeklyTask',
        isAssigned: false,
        title: 'CS2109S Problem Set',
        colour: '#696969',
        releasedOn: 'Tuesday',
        deadline: 'Wednesday',
        duration: 6,
        timings: []
    }
]

function calculateScore(schedule) {

    const timings = [].concat(...schedule.map(unit => unit.timings));
    const backToBackPenalty = 10;
    const mealTimePenalty = 30;

    const lunchStart = "1200";
    const lunchEnd = "1400";

    let score = 0;
    let previousTiming = timings[0];
    //Check for back-to-back units:
    for (let i = 0; i < timings.length - 1; i++) {
        currentTiming = timings[i];
        for (let j = i + 1; j < timings.length; j++) {
            previousTiming = timings[j];
            if ((currentTiming.timingStart == previousTiming.timingEnd || currentTiming.timingEnd == previousTiming.timingStart) && currentTiming.day == previousTiming.day) {
                score -= backToBackPenalty;
            }
        }
    }
    // Check for units during meal times
    for (let timing of timings) {
        if (timing.timingStart <= lunchEnd && timing.timingEnd >= lunchStart) {
            score -= mealTimePenalty;
        }
    }

    return score;
}

function mergeTimings(timings) {
    // Sort the timings based on the start time
    const sortedTimings = timings.sort((a, b) => a.timingStart.localeCompare(b.timingStart));
  
    const mergedTimings = [];
    let currentTiming = sortedTimings[0];
  
    for (let i = 1; i < sortedTimings.length; i++) {
        const nextTiming = sortedTimings[i];
    
        if (
            currentTiming.day === nextTiming.day &&
            currentTiming.timingEnd >= nextTiming.timingStart
        ) {
            // Merge the next timing into the current timing
            currentTiming.timingEnd = nextTiming.timingEnd;
        } else {
            // Add the current timing to the merged list
            mergedTimings.push(currentTiming);
            // Move to the next timing
            currentTiming = nextTiming;
        }
    }
  
    // Add the last timing to the merged list
    mergedTimings.push(currentTiming);
  
    return mergedTimings;
}

function generateNeighbors(schedule) {
    const neighbours = [];
    
    // Filter unassigned tasks
    const unassignedTasks = schedule.filter((task) => !task.isAssigned);
    
    // For each unassigned task, pick one at a time and try assigning it to 10 random possible timings:
    for (let unassignedTask of unassignedTasks) {
        const oldTiming = [ ...unassignedTask.timings ];
        unassignedTask.timings = [];
        const availableSlots = generateAvailableSlots(schedule).filter(slot => days.indexOf(slot.day) >= days.indexOf(unassignedTask.releasedOn) && days.indexOf(slot.day) < days.indexOf(unassignedTask.deadline));;
        const newTimingsSet = new Set();

        // Generate new possible timings:
        for (let i = 0; i < 10; i++) {
            let currentTiming = [];
            let taskDuration = unassignedTask.duration;
            let fullScheduleCounter = 0; // To prevent infinite loop if task cannot be assigned!
            let isFullSchedule = false;
            while (taskDuration > 0) {
                if (fullScheduleCounter > 10) {
                    isFullSchedule = true;
                    break
                }
                let randomTimeslot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
                if (currentTiming.includes(randomTimeslot)) {
                    fullScheduleCounter += 1;
                    continue;
                }
                currentTiming.push(randomTimeslot);
                taskDuration -= 1;
            }
            if (isFullSchedule) {
                continue;
            }

            // Merge each timing in currentTimings:
            const mergedTimings = mergeTimings(currentTiming);
            newTimingsSet.add(mergedTimings);
        }
        
        // For each new timing, get new neighbour:
        for (let newTiming of newTimingsSet) {
            unassignedTask.timings = newTiming;
            neighbours.push(JSON.parse(JSON.stringify(schedule)));
        }

        // Assign old timing to selected task:
        unassignedTask.timings = oldTiming;
    }

    return neighbours;
}
  
function generateAvailableSlots(schedule) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
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


testSolution = [
    {
        _id: "6475ed32bac98a75e624a880",
        userId: '64664d2d92f130e23eaea655',
        type: 'Lesson',
        isAssigned: true,
        title: 'CS2109S - Introduction to ML and AI',
        colour: '#C62828',
        timings: [
          {
            day: 'Monday',
            timingStart: '1000',
            timingEnd: '1200',
          },
          {
            day: 'Monday',
            timingStart: '1200',
            timingEnd: '1300',
          },
          {
            day: 'Tuesday',
            timingStart: '0900',
            timingEnd: '1100',
          },
          {
            day: 'Wednesday',
            timingStart: '1300',
            timingEnd: '1400',
          }
        ]
    },
    {
        _id: "6475ed32bac98c75e624a880",
        userId: '64664d2d92f13ae23eaea655',
        type: 'Lesson',
        isAssigned: true,
        title: 'CS2106 - OS',
        colour: '#C62828',
        timings: [
          {
            day: 'Tuesday',
            timingStart: '1100',
            timingEnd: '1500',
          },
          {
            day: 'Thursday',
            timingStart: '0900',
            timingEnd: '1100',
          }
        ]
    },
    {
        _id: "6475ed32bac98a85e624a880",
        userId: '64664d2d92f132e23eaea655',
        type: 'WeeklyTask',
        isAssigned: false,
        title: 'CS2101 - Speaking',
        colour: '#C62828',
        duration: 3,
        timings: [
          {
            day: 'Friday',
            timingStart: '1000',
            timingEnd: '1200',
          },
          {
              day: 'Friday',
              timingStart: '1400',
              timingEnd: '1500'
          }
        ]
    },
]


module.exports = hillclimb;