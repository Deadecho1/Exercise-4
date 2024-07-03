const fs = require('fs');
const db = require('../models/db');
const data = JSON.parse(fs.readFileSync('data/data.json', 'utf8'));
const moment = require('moment');

exports.getVacationOptions = async (req, res, next) => {
    try{
        return res.send(data);
    }
    catch (error){
        next(error);
    }
}

exports.updateVacation = async (req, res, next) => {
    const accessCode = req.params.userCode;
    const { startDate, endDate, destination, vacationType } = req.body;

    const formattedStartDate = moment(startDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
    const formattedEndDate = moment(endDate, 'DD/MM/YYYY').format('YYYY-MM-DD');

    try {
        if (!moment(startDate, 'DD/MM/YYYY', true).isValid() || !moment(endDate, 'DD/MM/YYYY', true).isValid()) {
            return res.status(400).send('Invalid date format. Please use DD/MM/YYYY.');
        }

        const vacationLengthInDays = moment(formattedEndDate).diff(moment(formattedStartDate), 'days');

        if (vacationLengthInDays > 7) {
            return res.status(400).send('Vacation length cannot exceed a week (7 days).');
        }

        if (!data.destinations.includes(destination) || !data.vacationTypes.includes(vacationType)) {
            return res.status(400).send('Invalid destination or vacation type');
        }

        db.query('SELECT * FROM tbl_38_users WHERE access_code = ?', [accessCode], (err, results) => {
            if (err) {
                return next(err);
            }
            if (results.length === 0) {
                return res.status(404).send('User not found');
            }

            const userId = results[0].id;

            db.query(
                'UPDATE tbl_38_vacation_details SET start_date = ?, end_date = ?, destination = ?, vacation_type = ? WHERE user_id = ?',
                [formattedStartDate, formattedEndDate, destination, vacationType, userId],
                (err, result) => {
                    if (err) {
                        return next(err);
                    }

                    res.status(200).send('Vacation details updated successfully');
                }
            );
        });
    } catch (error) {
        next(error);
    }
};

exports.getUserVacationChoice = async (req, res, next) =>{
    try{
        const userId = req.params.userId;
        db.query('SELECT * FROM tbl_38_users WHERE username = ?', [userId], async (err, results) => {
            if (err) return next(err);
            if (results.length == 0) {
                return res.status(400).send('User does not exist.');
            }
            db.query('SELECT * FROM tbl_38_vacation_details WHERE user_id = ?', [results[0].id], async (err, results) => {
                if (err) return next(err);
                if (results.length == 0) {
                    return res.send('User did not input choice yet');
                }
                return res.send({
                    user : userId,
                    start_date : formatDate(results[0].start_date),
                    end_date : formatDate(results[0].end_date),
                    destination : results[0].destination,
                    vacation_type : results[0].vacation_type
                })
            })
        });
    }
    catch(error){
        next(error);
    }
}

exports.submitVacation = async (req, res, next) => {
    try {
        const accessCode = req.params.userCode;
        const { startDate, endDate, destination, vacationType } = req.body;

        const formattedStartDate = moment(startDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
        const formattedEndDate = moment(endDate, 'DD/MM/YYYY').format('YYYY-MM-DD');

        if (!moment(startDate, 'DD/MM/YYYY', true).isValid() || !moment(endDate, 'DD/MM/YYYY', true).isValid()) {
            return res.status(400).send('Invalid date format. Please use DD/MM/YYYY.');
        }

        const vacationLengthInDays = moment(formattedEndDate).diff(moment(formattedStartDate), 'days');

        if (vacationLengthInDays > 7) {
            return res.status(400).send('Vacation length cannot exceed a week (7 days).');
        }

        if (!data.destinations.includes(destination) || !data.vacationTypes.includes(vacationType)) {
            return res.status(400).send('Invalid destination or vacation type');
        }

        db.query('SELECT * FROM tbl_38_users WHERE access_code = ?', [accessCode], (err, results) => {
            if (err) return next(err);
            if (results.length === 0) {
                return res.status(400).send('Invalid access code');
            }

            const userId = results[0].id;

            db.query('SELECT * FROM tbl_38_vacation_details WHERE user_id = ?', [userId], (err, results) => {
                if (err) return next(err);
                if (results.length > 0) {
                    return res.status(400).send('Details already submitted, use PUT instead to update preferences.');
                }

                db.query('INSERT INTO tbl_38_vacation_details (user_id, start_date, end_date, destination, vacation_type) VALUES (?, ?, ?, ?, ?)',
                    [userId, formattedStartDate, formattedEndDate, destination, vacationType], (err, results) => {
                        if (err) return next(err);
                        res.status(201).send('Vacation details submitted');
                    });
            });
        });
    } catch (error) {
        next(error);
    }
};

exports.getVacationResults = async (req, res, next) => {
    try {
        db.query('SELECT * FROM tbl_38_vacation_details', (err, results) => {
            if (err) return next(err);
            if (results.length < 5) {
                return res.status(400).send('Not all friends have submitted their details');
            }

            const majorityVote = (arr) => {
                const count = arr.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                let majority = Object.keys(count)[0]; // Initialize with the first key
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

            const destination = majorityVote(destinations);
            const vacationType = majorityVote(vacationTypes);
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
        });
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

