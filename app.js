const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Transaction = require('./models/transaction');
const methodOverride = require('method-override');

const app = express();

//Connecting to database:
mongoose.connect('mongodb://localhost:27017/stash-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "conection error:"));
db.once("open", () => {
    console.log("Database connected");
});


//Setting app to reference view folder:
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Ask express to help decode our req bodies:
app.use(express.urlencoded({extended: true}));
//Allow us to override method types (can use PUT etc.):
app.use(methodOverride('_method'));

app.get('/', (req, res) => {
    res.render('home');
})

//GET Index page
app.get('/transactions', async (req, res) => {
    const transactions = await Transaction.find({});
    res.render('transactions/index', { transactions });
})

//GET make new transaction page
app.get('/transactions/new', (req, res) => {
    res.render('transactions/new');
})

//POST make new transaction
app.post('/transactions', async (req, res) => {
    const transaction = new Transaction(req.body.transaction);
    await transaction.save();
    res.redirect(`/transactions/${transaction._id}`);
})

//GET transaction details page
app.get('/transactions/:id', async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);
    res.render('transactions/show', { transaction });
})

//GET edit transaction page
app.get('/transactions/:id/edit', async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);
    res.render('transactions/edit', { transaction });
})

//PUT edit transaction
app.put('/transactions/:id', async (req, res) => {
    const { id } = req.params;
    const transaction = await Transaction.findByIdAndUpdate(id, { ...req.body.transaction });
    res.redirect(`/transactions/${transaction._id}`);
})

//DELETE transaction
app.delete('/transactions/:id', async (req, res) => {
    const { id } = req.params;
    await Transaction.findByIdAndDelete(id);
    res.redirect('/transactions');
})

app.listen(3000, () => {
    console.log("LISTENING ON PORT 3000!");
})