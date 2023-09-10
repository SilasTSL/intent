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
    }
});

module.exports = mongoose.model('Module', ModuleSchema);