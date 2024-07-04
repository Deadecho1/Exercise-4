const express = require('express');
const vacationController = require('../controllers/vacationController');
const router = express.Router();

router.post('/preferences/:userCode', vacationController.submitVacation);
router.put('/preferences/:userCode', vacationController.updateVacation)
router.get('/', vacationController.getVacationOptions);
router.get('/results', vacationController.getVacationResults);
router.get('/:userId', vacationController.getUserVacationChoice);

module.exports = router;