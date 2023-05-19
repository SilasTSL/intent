const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UnitSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['Lesson', 'WeeklyTask'],
        required: true
    },
    isAssigned: {
        type: Boolean,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    colour: {
        type: String,
        required: true
    },
    timings: {
        type: [{
            day: String,
            timingStart: String,
            timingEnd: String
        }],
        default: []
    },
    releasedOn: String, // Specific to weekly task only
    deadline: String, // Specific to weekly task only
    duration: Number, // Specific to weekly task only

});

module.exports = mongoose.model('Unit', UnitSchema);