const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UnitSchema = new Schema({
    moduleId: {
        type: String,
        required: true
    },
    colour: {
        type: String,
        required: true
    },
    moduleCode: {
        type: String,
        required: true
    },
    class: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['LEC', 'TUT', 'REC', 'LAB', 'SEC', 'TSK', 'ASS'],
        required: true
    },
    timings: {
        type: [{
            day: String,
            timingStart: String,
            timingEnd: String,
            date: String
        }],
        default: []
    }

});

module.exports = mongoose.model('Unit', UnitSchema);