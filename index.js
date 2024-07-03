require('express-async-errors');
require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const authRouter = require('./routers/authRouter');
const vacationRoute = require('./routers/vacationRouter');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(bodyParser.json());

app.use('/auth', authRouter);
app.use('/vacation', vacationRoute);

app.use(errorHandler);
app.all('*', (req, res) => res.send("Incorrect API format. See documentation for details."));

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
