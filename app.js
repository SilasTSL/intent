const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Transaction = require('./models/transaction');

mongoose.connect('mongodb://localhost:27017/stash-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "conection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//

app.get('/', (req, res) => {
    res.render('home');
})

app.get('/make-transaction', async (req, res) => {
    const transaction = new Transaction({
        title: 'First Transaction',
        description: 'This is a description!'
    });
    await transaction.save();
    res.send(transaction);
})

app.listen(3000, () => {
    console.log("LISTENING ON PORT 3000!");
})