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
    const backToBackPenalty = 100;
    const mealTimePenalty = 100;
    const eveningTimePlus = 10;
    const singleUnitPenalty = 100;
    const tooLongUnitPenalty = 100;

    const lunchStart = "1200";
    const lunchEnd = "1400";
    const dinnerStart = "1700";
    const dinnerEnd = "2000";

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
        if ((timing.timingStart <= lunchEnd && timing.timingEnd >= lunchStart) || (timing.timingStart <= dinnerEnd && timing.timingEnd >= dinnerStart)) {
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
        const dayComparison = days.indexOf(a.day) - days.indexOf(b.day);
    
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
    let availableSlots = generateAvailableSlots(schedule)
    if (pickedTask.releasedOn) {
        availableSlots = availableSlots.filter(slot => days.indexOf(slot.day) >= days.indexOf(pickedTask.releasedOn) && days.indexOf(slot.day) < days.indexOf(pickedTask.deadline));
    }
    // Not enough available slots for this task:
    if (availableSlots.length < pickedTask.duration) {
        return [];
    }
    const possibleTimings = new Set();
    for (let i = 0; i < 100; i++) {
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
        for (let i = 8; i <= 21; i++) {
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

function hillclimb(assignedUnits, unassignedTask) {
    // Initial schedule (Greedy):
    let currentBestSchedule = JSON.parse(JSON.stringify(assignedUnits));
    
    let availableSlots = generateAvailableSlots(currentBestSchedule);

    const unitReleasedOn = unassignedTask.releasedOn;
    const unitDeadline = unassignedTask.deadline;
    let availableSlotsForUnit = [...availableSlots];
    if (unitReleasedOn) {
        availableSlotsForUnit = availableSlots.filter(slot => days.indexOf(slot.day) >= days.indexOf(unitReleasedOn) && days.indexOf(slot.day) < days.indexOf(unitDeadline));
    }
    let unitTimingLeft = unassignedTask.duration;
    let unitTimings = [];
    // Not enough slots to assign task:
    if (availableSlotsForUnit.length < unitTimingLeft) {
        return 0;
    }
    while (unitTimingLeft > 0) {
        unitTimings.push(availableSlotsForUnit[0]);
        availableSlotsForUnit.shift();
        unitTimingLeft -= 1;
    }
    unassignedTask.timings = mergeTimings(unitTimings);
    currentBestSchedule.push(unassignedTask)
    

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


// Assignments:
function mergeTimingsDate(timings) {
    // Sort the timings based on day and timing start
    const sortedTimings = timings.sort((a, b) => {
        const dateComparison = new Date(a.date) - new Date(b.date);
        if (dateComparison !== 0) {
            return dateComparison;
        } else {
            return a.timingStart.localeCompare(b.timingStart);
        }
    });
  
    const mergedTimings = [];
    let lastMergedTiming = {...sortedTimings[0]};

    for (let i = 1; i < sortedTimings.length; i++) {
        timing = sortedTimings[i];
        if (
            lastMergedTiming &&
            lastMergedTiming.timingEnd === timing.timingStart &&
            lastMergedTiming.date === timing.date
        ) {
            // Extend the last merged timing
            lastMergedTiming.timingEnd = timing.timingEnd;
        } else {
            // Add the timing as a new merged timing
            mergedTimings.push({...lastMergedTiming});
            lastMergedTiming = {...timing};
        }
    }
    mergedTimings.push({...lastMergedTiming});
  
    return mergedTimings;
}
const exampleTiming = {day: 'Monday', timingStart: '0900', timingEnd: '1100', date: '2023-07-05'}


function calculateScoreDate(schedule, releasedOnDate, deadlineDate) {
    /* TODO
    - Need to loop through dates from releasedOnDate to deadlineDate
    */
    const timings = [].concat(...schedule.map(unit => unit.timings));
    const backToBackPenalty = 10;
    const mealTimePenalty = 50;
    const eveningTimePlus = 10;
    const singleUnitPenalty = 20;
    const tooLongUnitPenalty = 15;

    const lunchStart = "1200";
    const lunchEnd = "1400";

    const eveningTime = "1500";

    let score = 0;

    let currentDate = new Date(releasedOnDate);
    while (currentDate < deadlineDate) {
        let dayIndex = currentDate.getDay() - 1;
        dayIndex = dayIndex < 0 ? 6 : dayIndex;
        const currentDay = days[dayIndex];
        const timingsToday = timings.filter(timing => {
            if (timing.date) {
                return timing.date === `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            } else {
                return timing.day === currentDay;
            }
        });

        if (!timingsToday) {
            continue
        }

        const sortedTimingsToday = timingsToday.sort((a, b) => a.timingStart.localeCompare(b.timingStart));

        let previousTiming = sortedTimingsToday[0];

        // Check for back-to-back units:
        for (let i = 1; i < sortedTimingsToday.length; i++) {
            let currentTiming = sortedTimingsToday[i];
            if (previousTiming.timingEnd == currentTiming.timingStart) {
                score -= backToBackPenalty;
            }
            previousTiming = currentTiming;
        }

        // Not too many single hour units:
        score -= timingsToday.length * singleUnitPenalty;

        for (let timing of timingsToday) {
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

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return score;
}

/*
const exampleLesson = {'title': 'CS2109S', 'colour': '#FFFFFF', 'timings': [{day: 'Monday', timingStart: '0900', timingEnd: '1100'}, {day: 'Tuesday', timingStart: '1200', timingEnd: '1400'}]};

const exampleNeighbours = generateNeighborsDate([{'title': 'CS2109S', 'colour': '#FFFFFF', 'isAssigned': true, 'timings': [{day: 'Monday', timingStart: '0900', timingEnd: '1100'}, {day: 'Tuesday', timingStart: '1200', timingEnd: '1400'}]},
{'title': 'CS2105', 'colour': '#FFFFFF', 'isAssigned': true, 'timings': [{day: 'Monday', timingStart: '1200', timingEnd: '1300'}, {day: 'Tuesday', timingStart: '0800', timingEnd: '0900'}]},
{'title': 'CS2102', 'colour': '#FFFFFF', 'isAssigned': true, 'timings': [{day: 'Monday', timingStart: '1100', timingEnd: '1200'}, {day: 'Friday', timingStart: '0900', timingEnd: '1000'}]},
{'title': 'CS2106', 'colour': '#FFFFFF', 'isAssigned': true, 'timings': [{day: 'Wednesday', timingStart: '0900', timingEnd: '1100'}, {day: 'Wednesday', timingStart: '1200', timingEnd: '1400'}]},
{'title': 'CS2109S', 'colour': '#FFFFFF', 'duration': 4, 'isAssigned': false, 'timings': [{day: 'Wednesday', timingStart: '1600', timingEnd: '1800', date: new Date('2023-07-05')}, {day: 'Thursday', timingStart: '1600', timingEnd: '1800', date: new Date('2023-07-06')}]}], new Date('2023-07-02'), new Date('2023-07-12'));

console.log(exampleNeighbours[0][4].timings);
*/

function generateNeighborsDate(schedule, releasedOnDate, deadlineDate) {
    const neighbours = [];
    
    // Get unassigned assignment:
    const unassignedAssignment = schedule.filter((assignment) => !assignment.isAssigned)[0];
    unassignedAssignment.timings = [];
    
    // Get all available slots possible between releasedOnDate to deadlineDate:
    const availableSlotsWeekly = generateAvailableSlots(schedule);
    let availableSlots = [];

    let currentDate = new Date(releasedOnDate);
    const deadlineDateDate = new Date(deadlineDate);

    while (currentDate < deadlineDateDate) {
        let dayIndex = currentDate.getDay() - 1;
        dayIndex = dayIndex < 0 ? 6 : dayIndex;
        const currentDay = days[dayIndex];
        const availableSlotsForDay = availableSlotsWeekly.filter(slot => slot.day == currentDay);
        availableSlots.push(...availableSlotsForDay.map(slot => {
            slot.date = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            return JSON.parse(JSON.stringify(slot));
        }));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate 50 possible random timings:

    if (availableSlots.length < unassignedAssignment.duration) {
        return [];
    }

    const possibleTimings = new Set();
    for (let i = 0; i < 3; i++) {
        let assignmentDuration = unassignedAssignment.duration;
        const currentTimings = [];
        while (assignmentDuration > 0) {
            const randomIndex = Math.floor(Math.random() * availableSlots.length);
            const availableSlot = availableSlots[randomIndex];

            // Check if the available slot is already in the current timing
            if (!currentTimings.includes(availableSlot)) {
                currentTimings.push(availableSlot);
                assignmentDuration -= 1;
            }
        }
        const mergedTimings = mergeTimingsDate(currentTimings);
        possibleTimings.add(mergedTimings);
    }

    for (let timings of possibleTimings) {
        unassignedAssignment.timings = timings;
        neighbours.push(JSON.parse(JSON.stringify(schedule)));
    }

    return neighbours;
}

function hillclimbAssignment(assignedUnits, unassignedAssignment) {
    // Initial schedule (Greedy):
    let currentBestSchedule = JSON.parse(JSON.stringify(assignedUnits));
    
    let availableSlotsWeekly = generateAvailableSlots(currentBestSchedule);

    const unitReleasedOnDate = unassignedAssignment.releasedOnDate;
    const unitDeadlineDate = new Date(unassignedAssignment.deadlineDate);
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    let availableSlots = [];
    let currentDate = new Date(unitReleasedOnDate);
    while (currentDate < unitDeadlineDate) {
        let dayIndex = currentDate.getDay() - 1;
        dayIndex = dayIndex < 0 ? 6 : dayIndex;
        const currentDay = days[dayIndex];
        const availableSlotsForDay = availableSlotsWeekly.filter(slot => slot.day == currentDay);
        availableSlots.push(...availableSlotsForDay.map(slot => {
            slot.date = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            return JSON.parse(JSON.stringify(slot));
        }));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let unitTimingLeft = unassignedAssignment.duration;
    let unitTimings = [];
    // Not enough slots to assign task:
    if (availableSlots.length < unitTimingLeft) {
        console.log(availableSlots)
        return 0;
    }
    while (unitTimingLeft > 0) {
        unitTimings.push(availableSlots[0]);
        availableSlots.shift();
        unitTimingLeft -= 1;
    }

    unassignedAssignment.timings = mergeTimingsDate(unitTimings);
    currentBestSchedule.push(unassignedAssignment);

    // Calculate score (For greedy):
    let currentScore = calculateScoreDate(currentBestSchedule, unitReleasedOnDate, unitDeadlineDate);
    let currentSolution = currentBestSchedule;

    // Iterate until no better solution can be found
    while (true) {
        // Generate neighbors of the current solution
        const neighbours = generateNeighborsDate(currentSolution, unitReleasedOnDate, unitDeadlineDate);

        // Find the neighbor with the best score
        let bestNeighbor = null;
        let bestNeighborScore = currentScore;

        for (const neighbour of neighbours) {
            const neighborScore = calculateScoreDate(neighbour, unitReleasedOnDate, unitDeadlineDate);

            if (neighborScore > bestNeighborScore) {
                bestNeighbor = neighbour;
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

/*
const assignedUnits = [
{'title': 'CS2105', 'type': 'Lesson', 'colour': '#FFFFFF', 'isAssigned': true, 'timings': [{day: 'Monday', timingStart: '1200', timingEnd: '1300'}, {day: 'Tuesday', timingStart: '0800', timingEnd: '0900'}]},
{'title': 'CS2102', 'type': 'Lesson', 'colour': '#FFFFFF', 'isAssigned': true, 'timings': [{day: 'Monday', timingStart: '1100', timingEnd: '1200'}, {day: 'Friday', timingStart: '0900', timingEnd: '1000'}]},
{'title': 'CS2106', 'type': 'Lesson', 'colour': '#FFFFFF', 'isAssigned': true, 'timings': [{day: 'Wednesday', timingStart: '0900', timingEnd: '1100'}, {day: 'Wednesday', timingStart: '1200', timingEnd: '1400'}]}
]

const unassignedAssignment = {'title': 'CS2105', 'type': 'Assignment', 'colour': '#FFFFFF', 'duration': 4, 'isAssigned': false, 'releasedOnDate': new Date('2023-07-08'), 'deadlineDate': new Date('2023-07-16')};


const bestSchedule = hillclimbAssignment(assignedUnits, unassignedAssignment);
console.log(bestSchedule[3].timings);
*/


module.exports = { hillclimb, hillclimbAssignment };
