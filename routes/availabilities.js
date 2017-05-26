'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const Availability = require('../models/availability');

router.post('/:scheduleId/users/:userId/candidates/:candidateId', authenticationEnsurer, (req, res, next)=>{
  const scheduleId = req.params.scheduleId;                   //req.paramsはurlの:idを取得できる
  const userId = req.params.userId;
  const candidateId = req.params.candidateId;
  let availability = req.body.availability;                   //req.bodyはpostで送られてきた値を取得できる
  availability = availability ? parseInt(availability) : 0;   //availabilityのデータが送られてきてなかったら0を設定

  Availability.upsert({
    scheduleId: scheduleId,
    userId: userId,
    candidateId: candidateId,
    availability: availability
  }).then(()=>{
    res.json({ status: 'OK', availability: availability });
  });
});

module.exports = router;