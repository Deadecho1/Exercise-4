require('express-async-errors');
require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routers/authRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(bodyParser.json());

app.use('/auth', authRoutes);

app.use(errorHandler);

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
