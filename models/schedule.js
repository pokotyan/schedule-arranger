'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

const Schedule = loader.database.define('schedules',{
  scheduleId:{
    type: Sequelize.UUID,  //scheduleモデルの主キーはuuidにする。連番を主キーとすると、予定表示のurl /schedules/:scheduleId が簡単に予測されてしまう。
    primaryKey: true,      //関係のない人に予定表示をさせないためにも主キーはuuidにする。また、各DBにはuuid格納用のデータ型（uuid）が提供されている。
    allowNull: false
  },
  scheduleName:{
    type: Sequelize.STRING,
    allowNull: false
  },
  memo:{
    type: Sequelize.TEXT,
    allowNull: false
  },
  createdBy:{
    type: Sequelize.INTEGER,
    allowNull: false
  },
  updatedAt:{
    type: Sequelize.DATE,
    allowNull: false
  }
},{
  freezeTableName: true,
  timestamps: false,
  indexes:[
    {
      fields:['createdBy']
    }
  ]
});

module.exports = Schedule;