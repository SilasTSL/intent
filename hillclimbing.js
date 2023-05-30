


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


async function hillclimb(assignedUnits, unassignedUnits) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // Initial schedule (Greedy):
    let unassignedUnitsIndex = 0;

    let current_timings = [];
    let currentBestSchedule = JSON.parse(JSON.stringify(assignedUnits));
    for (let c = 0; c < 5; c++) {
        for (let r = 8; r <= 18; r++) {
            if (unassignedUnitsIndex >= unassignedUnits.length) {
                break;
            }

            // Remove top task if finished:
            if (unassignedUnits[unassignedUnitsIndex].hasOwnProperty("timeLeft") && unassignedUnits[unassignedUnitsIndex].timeLeft == 0) {
                // Combine timings:
                const mergedTimings = [];
                let currentTiming = current_timings[0];
                for (let i = 1; i < current_timings.length; i++) {
                    const nextTiming = current_timings[i];
                    if (currentTiming.day == nextTiming.day && currentTiming.timingEnd == nextTiming.timingStart) {
                        currentTiming.timingEnd = nextTiming.timingEnd;
                    } else {
                        mergedTimings.push(currentTiming);
                        currentTiming = nextTiming;
                    }
                }
                mergedTimings.push(currentTiming);
                unassignedUnits[unassignedUnitsIndex].timings = mergedTimings;
                unassignedUnits[unassignedUnitsIndex].isAssigned = true;
                currentBestSchedule.push(unassignedUnits[unassignedUnitsIndex]);
                current_timings = [];
                unassignedUnitsIndex++;
            }

            // Finished assigning all unassigned units:
            if (unassignedUnitsIndex >= unassignedUnits.length) {
                break;
            }

            //Allocate tasks:
            var currentTask = unassignedUnits[unassignedUnitsIndex];
            if (assignedUnits.some(assignedUnit => assignedUnit.timings.some( timing => timing.day == days[c] && parseInt(timing.timingStart.substring(0, 2)) <= r && parseInt(timing.timingEnd.substring(0, 2)) > r))) {
                continue;
            } else {
                if (!currentTask.hasOwnProperty("timeLeft")) {
                    currentTask.timeLeft = currentTask.duration - 1;
                } else {
                    currentTask.timeLeft -= 1
                }
                current_timings.push({
                    day: days[c],
                    timingStart: (r.toString() + "00").padStart(4, "0"),
                    timingEnd: ((r + 1).toString() + "00").padStart(4, "0")
                })        
            }
        }
    }

    // Calculate score:
    
    
    // Generate neighbours:

    // Pick best:
}

function calculateScore(schedule) {

    const timings = [].concat(...schedule.map(unit => unit.timings));
    console.log(timings)
    const backToBackPenalty = 10;
    const mealTimePenalty = 30;

    const lunchStart = "1200";
    const lunchEnd = "1400";

    let score = 0;
    let previousTiming = timings[0];
    //Check for back-to-back units:
    for (let i = 0; i < timings.length - 1; i++) {
        console.log("1")
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
        if (timing.timingStart < lunchEnd && timing.timingEnd > lunchStart) {
            score -= mealTimePenalty;
        }
    }

    return score;
}

