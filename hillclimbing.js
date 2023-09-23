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
// Helper functions:
const exampleUnits = [
    {colour: '#123456', moduleCode: 'CS2109S', class: '1A', type: 'LEC', timings: [{day: 'Thursday', timingStart:'0900', timingEnd: '1000', date: '2023-09-14'}, {day: 'Thursday', timingStart:'1200', timingEnd: '1300', date: '2023-09-14'}, {day: 'Sunday', timingStart:'0900', timingEnd: '1000', date: '2023-09-17'}]},
    {colour: '#123456', moduleCode: 'CS2102', class: '1A', type: 'REC', timings: [{day: 'Friday', timingStart:'0900', timingEnd: '1000', date: '2023-09-15'}, {day: 'Thursday', timingStart:'1600', timingEnd: '1700', date: '2023-09-14'}, {day: 'Saturday', timingStart:'0900', timingEnd: '1000', date: '2023-09-16'}]},
    {colour: '#123456', moduleCode: 'CS2109S', class: '1A', type: 'TUT', timings: [{day: 'Monday', timingStart:'1100', timingEnd: '1400', date: '2023-09-12'}, {day: 'Thursday', timingStart:'1900', timingEnd: '2000', date: '2023-09-14'}, {day: 'Saturday', timingStart:'1100', timingEnd: '1200', date: '2023-09-16'}]}
]

function sortTimings(timings) {
    // Create a copy of the input array to avoid modifying the original
    const sortedTimings = [...timings];
    
    // Define a custom sorting function
    function compareTimings(a, b) {
        // If the days are the same, compare dates
        if (new Date(a.date) < new Date(b.date)) return -1;
        if (new Date(a.date) > new Date(b.date)) return 1;
    
        // If the days and dates are the same, compare timingStart
        if (a.timingStart < b.timingStart) return -1;
        if (a.timingStart > b.timingStart) return 1;
    
        return 0; // Timings are equal
    }
  
    // Use the custom sorting function to sort the copied array
    sortedTimings.sort(compareTimings);
    return sortedTimings;
}

function mergeConsecutiveTimings(unmergedTimings) {
    if (unmergedTimings.length === 0) {
      return [];
    }
  
    // Sort the timings by date and start time
    const timings = sortTimings(unmergedTimings);
  
    const mergedTimings = [timings[0]];
  
    for (let i = 1; i < timings.length; i++) {
      const currentTiming = timings[i];
      const lastMergedTiming = mergedTimings[mergedTimings.length - 1];
  
      if (
        currentTiming.date === lastMergedTiming.date &&
        parseInt(currentTiming.timingStart) <= parseInt(lastMergedTiming.timingEnd)
      ) {
        // Timings are consecutive, merge them
        lastMergedTiming.timingEnd = currentTiming.timingEnd;
      } else {
        // Timings are not consecutive, add the current timing as a new entry
        mergedTimings.push(currentTiming);
      }
    }
  
    return mergedTimings;
}

function doTimingsOverlap(timing1, timing2) {
    // Check if the days are the same
    if (timing1.date !== timing2.date) {
      return false; // Timings cannot overlap on different days
    }
  
    // Convert timingStart and timingEnd to numerical values for easier comparison
    const start1 = parseInt(timing1.timingStart, 10);
    const end1 = parseInt(timing1.timingEnd, 10);
    const start2 = parseInt(timing2.timingStart, 10);
    const end2 = parseInt(timing2.timingEnd, 10);
  
    // Check if the timings overlap
    if (end1 <= start2 || start1 >= end2) {
      return false; // Timings do not overlap
    }
  
    return true; // Timings overlap
  }

function dateToString(currentDate) {
    // Get the year, month, and day components
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Month is 0-based, so add 1 and pad with leading zero
    const day = String(currentDate.getDate()).padStart(2, '0');

    // Create the yyyy-mm-dd formatted string
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
}

function getAllAvailableTimings(units, semStartDate) {
    // Get all possible non-occupied timings from semStartDate to last unit timing:
    let availableTimings = [];

    let unavailableTimings = [];

    for (let unit of units) {
        unavailableTimings = unavailableTimings.concat(unit.timings);
    }

    const sortedUnavailableTimings = sortTimings(unavailableTimings);
    
    let currentDate = new Date(semStartDate);
    const lastUnitTimingsDate = new Date(sortedUnavailableTimings[sortedUnavailableTimings.length - 1].date);
    while (currentDate < lastUnitTimingsDate) {
        for (let i = 8; i < 22; i++) {
            const timingStartInt = i;
            const timingEndInt = i + 1;
            let currentDateString = dateToString(currentDate);
            
            if (!sortedUnavailableTimings.some(timing => timing.date == currentDateString && (parseInt(timing.timingStart.substring(0, 2) <= timingEndInt) && timing.timingEnd.substring(0, 2) >= timingStartInt))) {
                availableTimings.push({
                    date: currentDateString,
                    timingStart: timingStartInt.toString().padStart(2, '0') + '00',
                    timingEnd: timingEndInt.toString().padStart(2, '0') + '00',
                    day: currentDate.toLocaleDateString('en-US', {weekday: 'long'})
                })
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableTimings;
}

function getAvailableTimingsForTask(availableTimings, taskTiming) {
    // Gets all timings < 1 week before due day:
    const availableTimingsForTask = availableTimings.filter(timing => {
        const timeDifference = new Date(taskTiming.date) - new Date(timing.date);
        const daysApart = Math.ceil(timeDifference / (24 * 60 * 60 * 1000));
        return daysApart < 7 && daysApart > 0;
    })
    return availableTimingsForTask;
}

function generateInitialSchedule(units, tasks, semStartDate) {
    const initialSchedule = [...units];
    let availableTimings = getAllAvailableTimings(initialSchedule, semStartDate);

    // Pick last few possible slots from due timing:
    for (let task of tasks) { // From form (E.g. {moduleCode: 'CS1101S', type: 'TUT', hours: '3'})
        const { moduleCode, type, hours } = task;

        const taskUnit = units.find(unit => unit.moduleCode == moduleCode && unit.type == type);
        let timingsForTask = [];
        for (let taskUnitTiming of taskUnit.timings) { // Every timing of the lesson (e.g. every timing of CS1101S Tutorial)
            const availableTimingsForTask = getAvailableTimingsForTask(availableTimings, taskUnitTiming);

            timingsForTask = timingsForTask.concat(availableTimingsForTask.slice(-1 * hours));

            availableTimings = availableTimings.filter(timing => {
                return !timingsForTask.some(taskTiming => {
                    return taskTiming.date == timing.date && taskTiming.timingStart == timing.timingStart && taskTiming.timingEnd == timing.timingEnd;
                })
            })
        }

        initialSchedule.push({
            moduleId: taskUnit.moduleId,
            colour: taskUnit.colour,
            moduleCode: moduleCode,
            class: taskUnit.class,
            type: type,
            timings: mergeConsecutiveTimings(timingsForTask),
            isTask: true
        });
    }

    return initialSchedule;
    
}

function calculateScore(schedule) {
    let score = 0;

    const mealTimePenalty = 10;
    const contextSwitchingPenalty = 2;

    const tasksTimings = sortTimings(schedule.filter(unit => unit.isTask).map(task => task.timings));

    for (let taskTiming of tasksTimings) {
        // Avoid timings during meal times:
        if (!(parseInt(taskTiming.timingEnd, 10) <= 12 || parseInt(taskTiming.timingStart, 10) >= 14)) {
            score -= mealTimePenalty;
        } 
        if (!(parseInt(taskTiming.timingEnd, 10) <= 17 || parseInt(taskTiming.timingStart, 10) >= 20)) {
            score -= mealTimePenalty;
        }
    }

    console.log('Penalty from meal timings: ', score)

    let consecutiveTasks = 0;

    // Avoid context switching
    console.log('Sorted task timings: ')
    console.log(tasksTimings)
    for (let i = 0; i < tasksTimings.length - 1; i++) {
        const currentTiming = tasksTimings[i];
        const nextTiming = tasksTimings[i + 1];
    
        if (
            currentTiming.date === nextTiming.date &&
            currentTiming.timingEnd === nextTiming.timingStart
        ) {
            consecutiveTasks++;
        }
    }

    console.log('Penalty from context switching: ', consecutiveTasks * contextSwitchingPenalty);

    score -= consecutiveTasks * contextSwitchingPenalty

    return score;
}

function generateNeighbours(schedule) {
    // Pick a random current task timing, then randomise:
    return [];
}


// Optimise: (Basically hillclimbing v2)
function optimise(units, hours, semStartDate) {
    try {
        // Generate initial schedule:

        let currentSchedule = generateInitialSchedule(units, hours, semStartDate);
        // Calculate score:
        let currentScore = calculateScore(currentSchedule);
        console.log('Initial score: ', currentScore)
        // Loop until no better neighbour:
        while (true) {
            let betterScoreExists = false;

            // Generate neighbours:
            let neighbours = generateNeighbours(currentSchedule);

            // Loop through neighbour to find best neighbour:
            for (let neighbourSchedule of neighbours) {
                const neighbourScore = calculateScore(neighbourSchedule);
    
                if (neighbourScore >= currentScore) { // If neighbour score is better, take neighbour
                    betterScoreExists = true;
                    currentScore = neighbourScore;
                    currentSchedule = neighbourSchedule;
                }
            }

            if (!betterScoreExists) { // No neighbours with better score (Local maxima)
                break;
            }
        }

        const optimisedTasks = currentSchedule.filter(unit => unit.isTask);
        return optimisedTasks;
    } catch (e) {
        console.log('Problem with optimising:');
        console.log(e);
    }

}


module.exports = { hillclimb, hillclimbAssignment, optimise };
