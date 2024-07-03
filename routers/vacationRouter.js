const express = require('express');
const vacationController = require('../controllers/vacationController');
const router = express.Router();

router.post('/preference/:userCode', vacationController.submitVacation);
router.put('/preference/:userCode', vacationController.updateVacation)
router.get('/', vacationController.getVacationOptions);
router.get('/results', vacationController.getVacationResults);
router.get('/:userId', vacationController.getUserVacationChoice);

module.exports = router;