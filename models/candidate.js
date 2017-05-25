'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

const Candidate = loader.database.define('candidates',{
  candidateId:{
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  candidateName:{
    type: Sequelize.STRING,
    allowNull: false
  },
  scheduleId:{
    type: Sequelize.UUID,
    allowNull: false
  }
},{
  freezeTableName: true,
  timestamps: false,
  indexes:[
    {
      fields: ['scheduleId'] //予定 ID で検索することを想定して、予定 IDにインデックスを貼る
    }
  ]
});

module.exports = Candidate;