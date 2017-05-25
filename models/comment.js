'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

const Comment = loader.database.define('comments',{
  scheduleId:{
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false
  },
  userId:{
    type: Sequelize.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  comment:{
    type: Sequelize.STRING,
    allowNull: false
  }
},{
  freezeTableName: true,
  timestamps: false
});

// コメントの情報も、 scheduleId で大量のデータの中から検索するため、 scheduleId のインデックスを作成する必要があるはずです。
// しかし、ここではインデックスを作成する必要がありません。
// なぜなら scheduleId と userId で複合主キーを作成しており、その主キーの作成順番が、scheduleId > userId という順番となっているためです。
// RDB では主キーには自動的にインデックスが構築されます。
// 複合主キーで作成された主キーのインデックスは、途中までデータを検索する順番が一緒であればそれをインデックスとして使うことができます。
// そのため上の例では、 scheduleId のインデックスは別途作成しなくても主キーのインデックスを代わりに用いることができるのです。

module.exports = Comment;