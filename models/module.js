const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ModuleSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: true
    },
    colour: {
        type: String,
        required: true
    },
    units: {
        type: [{
            type: {
                type: String,
                enum: ['LEC', 'TUT', 'REC', 'SEC', 'LAB'],
                required: true
            },
            dates: {
                type: [{
                    date: String
                }]             
            },
            timingStart: {
                type: String,
                required: true
            },
            timingEnd: {
                type: String,
                required: true
            }
        }],
        default: []
    }
});

module.exports = mongoose.model('Module', ModuleSchema);