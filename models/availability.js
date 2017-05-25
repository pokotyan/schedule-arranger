'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

const Availability = loader.database.define('availabilities',{
  candidateId:{             //候補日程ID userIdとの複合主キー
    type: Sequelize.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  userId:{                  //githubのユーザーID candidateIdとの複合主キー
    type: Sequelize.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  availability:{            //出欠のenum。0は「欠席」 、1は「？」、 2は「出席」として扱う
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0         //デフォルトは欠席
  },
  scheduleId:{              //関連する予定ID(UUID)
    type: Sequelize.UUID,
    allowNull: false
  }
},{
  freezeTableName: true,
  timestamps: false,
  indexes:[
    {
      fields: ['scheduleId']
    }
  ]
});

module.exports = Availability;