const fs = require('fs');
const pool = require('../models/db');
const data = JSON.parse(fs.readFileSync('data/data.json', 'utf8'));
const moment = require('moment');

exports.getVacationOptions = async (req, res, next) => {
    try{
        return res.send(data);
    }
    catch (error){
        next(error);
    }
};

exports.submitVacation = async (req, res, next) => {
    try {
        const accessCode = req.params.userCode;
        const { startDate, endDate, destination, vacationType } = req.body;

        try{
            validateVacationDetails(startDate, endDate, destination, vacationType);
        }
        catch(error){
            return res.status(400).send(error.message);
        }

        const connection = await pool.getConnection();
        try {
            const [userResults] = await connection.query('SELECT * FROM tbl_38_users WHERE access_code = ?', [accessCode]);
            if (userResults.length === 0) {
                return res.status(400).send('Invalid access code');
            }

            const userId = userResults[0].id;
            const formattedStartDate = moment(startDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
            const formattedEndDate = moment(endDate, 'DD/MM/YYYY').format('YYYY-MM-DD');

            const [vacationResults] = await connection.query('SELECT * FROM tbl_38_vacation_details WHERE user_id = ?', [userId]);
            if (vacationResults.length > 0) {
                return res.status(400).send('Details already submitted, use PUT instead to update preferences.');
            }

            await connection.query('INSERT INTO tbl_38_vacation_details (user_id, start_date, end_date, destination, vacation_type, submit_time) VALUES (?, ?, ?, ?, ?, NOW())',
                [userId, formattedStartDate, formattedEndDate, destination, vacationType]);
            
            res.status(201).send('Vacation details submitted');
        } finally {
            connection.release();
        }
    } catch (error) {
        next(error);
    }
};

exports.updateVacation = async (req, res, next) => {
    try {
        const accessCode = req.params.userCode;
        const { startDate, endDate, destination, vacationType } = req.body;

        try{
            validateVacationDetails(startDate, endDate, destination, vacationType);
        }
        catch(error){
            return res.status(400).send(error.message);
        }

        const connection = await pool.getConnection();
        try {
            const [userResults] = await connection.query('SELECT * FROM tbl_38_users WHERE access_code = ?', [accessCode]);
            if (userResults.length === 0) {
                return res.status(404).send('User not found');
            }

            const userId = userResults[0].id;
            const formattedStartDate = moment(startDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
            const formattedEndDate = moment(endDate, 'DD/MM/YYYY').format('YYYY-MM-DD');

            await connection.query(
                'UPDATE tbl_38_vacation_details SET start_date = ?, end_date = ?, destination = ?, vacation_type = ?, submit_time = NOW() WHERE user_id = ?',
                [formattedStartDate, formattedEndDate, destination, vacationType, userId]
            );

            res.status(200).send('Vacation details updated successfully');
        } finally {
            connection.release();
        }
    } catch (error) {
        next(error);
    }
};

const validateVacationDetails = (startDate, endDate, destination, vacationType) => {
    if(!startDate || !endDate || !destination || !vacationType){
        throw new Error('Invalid request body format');
    }

    const formattedStartDate = moment(startDate, 'DD/MM/YYYY', true);
    const formattedEndDate = moment(endDate, 'DD/MM/YYYY', true);

    if (!formattedStartDate.isValid() || !formattedEndDate.isValid()) {
        throw new Error('Invalid date format. Please use DD/MM/YYYY.');
    }

    const vacationLengthInDays = moment(endDate, 'DD/MM/YYYY').diff(moment(startDate, 'DD/MM/YYYY'), 'days');

    if (vacationLengthInDays > 7) {
        throw new Error('Vacation length cannot exceed a week (7 days).');
    }

    if (!data.destinations.includes(destination) || !data.vacationTypes.includes(vacationType)) {
        throw new Error('Invalid destination or vacation type');
    }
};

exports.getUserVacationChoice = async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const connection = await pool.getConnection();
        try {
            const [userResults] = await connection.query('SELECT * FROM tbl_38_users WHERE username = ?', [userId]);
            if (userResults.length === 0) {
                return res.status(400).send('User does not exist.');
            }

            const [vacationResults] = await connection.query('SELECT * FROM tbl_38_vacation_details WHERE user_id = ?', [userResults[0].id]);
            if (vacationResults.length === 0) {
                return res.send('User did not input choice yet');
            }

            return res.send({
                user: userId,
                start_date: formatDate(vacationResults[0].start_date),
                end_date: formatDate(vacationResults[0].end_date),
                destination: vacationResults[0].destination,
                vacation_type: vacationResults[0].vacation_type
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        next(error);
    }
};

exports.getVacationResults = async (req, res, next) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [results] = await connection.query('SELECT * FROM tbl_38_vacation_details');
            if (results.length < 5) {
                return res.send('Not all friends have submitted their details');
            }

            // Fetch the row with the earliest submit time
            const [earliestResults] = await connection.query('SELECT * FROM tbl_38_vacation_details ORDER BY submit_time ASC LIMIT 1');
            if (earliestResults.length === 0) {
                return res.status(400).send('No submissions found');
            }

            let defaultValues = earliestResults[0];

            const majorityVote = (arr, defaultValue) => {
                const count = arr.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                let majority = defaultValue; // Initialize with default value
                Object.keys(count).forEach(key => {
                    if (count[key] > count[majority]) {
                        majority = key; // Update majority if found higher count
                    }
                });

                return majority;
            };

            const destinations = results.map(details => details.destination);
            const vacationTypes = results.map(details => details.vacation_type);
            const startDates = results.map(details => new Date(details.start_date));
            const endDates = results.map(details => new Date(details.end_date));

            const destination = majorityVote(destinations, defaultValues.destination);
            const vacationType = majorityVote(vacationTypes, defaultValues.vacation_type);
            const startDate = new Date(Math.max(...startDates.map(date => date.getTime())));
            const endDate = new Date(Math.min(...endDates.map(date => date.getTime())));

            if (startDate > endDate) {
                return res.status(200).send('No overlapping date range found');
            }

            const formattedStartDate = startDate.toLocaleDateString('en-GB');
            const formattedEndDate = endDate.toLocaleDateString('en-GB');

            res.status(200).send({
                destination,
                vacationType,
                startDate: formattedStartDate,
                endDate: formattedEndDate
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        next(error);
    }
};

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}